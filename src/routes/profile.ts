// src/routes/profile.ts
import { Router } from 'express';
import { requireLogin, AuthedRequest } from '../middleware/auth';
import { db } from '../db';

export const profileRouter = Router();

profileRouter.get('/api/profile', requireLogin, (req: AuthedRequest, res) => {
  const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.user!.id);
  res.json(user);
});

profileRouter.put('/api/profile', requireLogin, (req: AuthedRequest, res) => {
  const current = db
    .prepare(`SELECT id, name, phone, email FROM users WHERE id = ?`)
    .get(req.user!.id) as { id: number; name: string; phone: string | null; email: string } | undefined;

  if (!current) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }

  const { name = current.name, phone = current.phone, email = current.email } = req.body || {};

  db.prepare(
    `UPDATE users SET name = ?, phone = ?, email = ? WHERE id = ?`
  ).run(name, phone, email, current.id);

  res.json({ ...current, name, phone, email });
});
