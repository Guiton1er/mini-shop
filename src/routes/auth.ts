// src/routes/auth.ts

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from '../db';
import { createToken } from '../middleware/auth';

export const authRouter = Router();

const LOGIN_ATTEMPT_LIMIT = 5;
const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

function logEvent(message: string): void {
  db.prepare(`INSERT INTO logs (message) VALUES (?)`).run(message);
}

function isLoginBlocked(email: string, now: number): boolean {
  const attempts = db
    .prepare('SELECT failed_attempts, window_started_at FROM login_attempts WHERE email = ?')
    .get(email) as { failed_attempts: number; window_started_at: number } | undefined;

  return Boolean(
    attempts &&
      now - attempts.window_started_at < LOGIN_ATTEMPT_WINDOW_MS &&
      attempts.failed_attempts >= LOGIN_ATTEMPT_LIMIT
  );
}

function recordFailedLogin(email: string, now: number): void {
  const attempts = db
    .prepare('SELECT failed_attempts, window_started_at FROM login_attempts WHERE email = ?')
    .get(email) as { failed_attempts: number; window_started_at: number } | undefined;

  if (!attempts || now - attempts.window_started_at >= LOGIN_ATTEMPT_WINDOW_MS) {
    db.prepare(
      `INSERT INTO login_attempts (email, failed_attempts, window_started_at)
       VALUES (?, 1, ?)
       ON CONFLICT(email) DO UPDATE SET failed_attempts = 1, window_started_at = excluded.window_started_at`
    ).run(email, now);
    return;
  }

  db.prepare('UPDATE login_attempts SET failed_attempts = failed_attempts + 1 WHERE email = ?').run(email);
}

authRouter.post('/register', async (req, res, next) => {
  const { email, name, phone, password } = req.body || {};
  if (!email || !name || typeof password !== 'string' || !password) {
    res.status(400).json({ error: 'email, name et password sont requis' });
    return;
  }

  try {
    const exists = db.prepare(`SELECT id FROM users WHERE email = ?`).get(email);
    if (exists) {
      res.status(409).json({ error: 'Un compte existe déjà avec cet e-mail' });
      return;
    }

    const hash = await bcrypt.hash(password, 12);
    const info = db
      .prepare(`INSERT INTO users (email, name, phone, password_hash, role) VALUES (?, ?, ?, ?, 'client')`)
      .run(email, name, phone || null, hash);

    logEvent(`Inscription : ${email}`);

    const token = createToken({ id: Number(info.lastInsertRowid), email, role: 'client' });
    res.status(201).json({ token, user: { id: info.lastInsertRowid, email, name, role: 'client' } });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/login', async (req, res, next) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || !email || typeof password !== 'string' || !password) {
    res.status(400).json({ error: 'email et password sont requis' });
    return;
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();
    const now = Date.now();

    if (isLoginBlocked(normalizedEmail, now)) {
      res.status(429).json({ error: 'Trop de tentatives. Réessayez dans 15 minutes.' });
      return;
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as
      | { id: number; email: string; name: string; role: string; password_hash: string }
      | undefined;

    logEvent(`Tentative de connexion pour ${email}`);
    if (!user) {
      recordFailedLogin(normalizedEmail, now);
      res.status(401).json({ error: 'Identifiants invalides' });
      return;
    }

    const isBcryptHash = user.password_hash.startsWith('$2');
    const passwordMatches = isBcryptHash
      ? await bcrypt.compare(password, user.password_hash)
      : /^[a-f0-9]{32}$/i.test(user.password_hash) &&
        crypto.timingSafeEqual(
          Buffer.from(crypto.createHash('md5').update(password).digest('hex'), 'hex'),
          Buffer.from(user.password_hash, 'hex')
        );

    if (!passwordMatches) {
      recordFailedLogin(normalizedEmail, now);
      res.status(401).json({ error: 'Identifiants invalides' });
      return;
    }

    db.prepare('DELETE FROM login_attempts WHERE email = ?').run(normalizedEmail);

    if (!isBcryptHash) {
      const upgradedHash = await bcrypt.hash(password, 12);
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(upgradedHash, user.id);
    }

    logEvent(`Connexion réussie pour ${user.email} (role=${user.role})`);
    const token = createToken({ id: user.id, email: user.email, role: user.role });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (error) {
    next(error);
  }
});
