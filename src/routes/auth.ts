// src/routes/auth.ts

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from '../db';
import { createToken } from '../middleware/auth';

export const authRouter = Router();

function logEvent(message: string): void {
  db.prepare(`INSERT INTO logs (message) VALUES (?)`).run(message);
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
  if (!email || typeof password !== 'string' || !password) {
    res.status(400).json({ error: 'email et password sont requis' });
    return;
  }

  try {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as
      | { id: number; email: string; name: string; role: string; password_hash: string }
      | undefined;

    logEvent(`Tentative de connexion pour ${email}`);
    if (!user) {
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
      res.status(401).json({ error: 'Identifiants invalides' });
      return;
    }

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
