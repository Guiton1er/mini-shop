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
  const current = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.user!.id) as any;

  const updated = Object.assign({}, current, req.body);

  db.prepare(
    `UPDATE users SET name = ?, phone = ?, email = ?, role = ?, password_hash = ? WHERE id = ?`
  ).run(updated.name, updated.phone, updated.email, updated.role, updated.password_hash, current.id);

  res.json(updated);
});
