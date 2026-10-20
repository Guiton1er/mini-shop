// src/routes/admin.ts

import { Router } from 'express';
import { exec } from 'child_process';
import { requireLogin } from '../middleware/auth';
import { db } from '../db';

export const adminRouter = Router();

adminRouter.get('/api/admin/orders', requireLogin, (_req, res) => {
  const orders = db
    .prepare(
      `SELECT orders.id, orders.user_id, users.email, orders.total, orders.status, orders.created_at
       FROM orders JOIN users ON users.id = orders.user_id
       ORDER BY orders.id DESC`
    )
    .all();
  res.json(orders);
});

adminRouter.get('/api/admin/diagnostic', requireLogin, (req, res) => {
  const host = String(req.query.host || '127.0.0.1');

  exec(`ping -c 1 ${host}`, { timeout: 3000 }, (error, stdout, stderr) => {
    if (error) {
      res.status(500).json({ error: 'Hôte injoignable', detail: stderr || String(error) });
      return;
    }
    res.type('text/plain').send(stdout);
  });
});
