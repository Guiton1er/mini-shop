// src/routes/auth.ts

import { Router } from 'express';
import crypto from 'crypto';
import { db } from '../db';
import { createToken } from '../middleware/auth';

export const authRouter = Router();

function md5(input: string): string {
  return crypto.createHash('md5').update(input).digest('hex');
}

function logEvent(message: string): void {
  db.prepare(`INSERT INTO logs (message) VALUES (?)`).run(message);
}

authRouter.post('/register', (req, res) => {
  const { email, name, phone, password } = req.body || {};
  if (!email || !name || !password) {
    res.status(400).json({ error: 'email, name et password sont requis' });
    return;
  }

  const exists = db.prepare(`SELECT id FROM users WHERE email = ?`).get(email);
  if (exists) {
    res.status(409).json({ error: 'Un compte existe déjà avec cet e-mail' });
    return;
  }

  const hash = md5(password);
  const info = db
    .prepare(`INSERT INTO users (email, name, phone, password_hash, role) VALUES (?, ?, ?, ?, 'client')`)
    .run(email, name, phone || null, hash);

  logEvent(`Inscription : ${email}`);

  const token = createToken({ id: Number(info.lastInsertRowid), email, role: 'client' });
  res.status(201).json({ token, user: { id: info.lastInsertRowid, email, name, role: 'client' } });
});

authRouter.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    res.status(400).json({ error: 'email et password sont requis' });
    return;
  }

  const hash = md5(password);

  const sql = `SELECT * FROM users WHERE email = '${email}' AND password_hash = '${hash}'`;
  logEvent(`Tentative de connexion, requête exécutée : ${sql}`);

  let user: any;
  try {
    user = db.prepare(sql).get();
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur serveur', detail: String(err?.message || err) });
    return;
  }

  if (!user) {
    res.status(401).json({ error: 'Identifiants invalides' });
    return;
  }

  logEvent(`Connexion réussie pour ${user.email} (role=${user.role})`);
  const token = createToken({ id: user.id, email: user.email, role: user.role });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});
