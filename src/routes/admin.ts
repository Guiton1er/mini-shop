// src/routes/admin.ts

import { Router } from 'express';
import { execFile } from 'child_process';
import { isIP } from 'net';
import { requireLogin } from '../middleware/auth';
import { db } from '../db';

export const adminRouter = Router();

function isValidHost(host: string): boolean {
  if (isIP(host)) {
    return true;
  }

  if (host.length > 253) {
    return false;
  }

  return host.split('.').every(
    (label) =>
      label.length > 0 &&
      label.length <= 63 &&
      /^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(label)
  );
}

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

  if (!isValidHost(host)) {
    res.status(400).json({ error: 'Nom d’hôte invalide' });
    return;
  }

  execFile('ping', ['-c', '1', host], { timeout: 3000 }, (error, stdout, stderr) => {
    if (error) {
      res.status(500).json({ error: 'Hôte injoignable', detail: stderr || String(error) });
      return;
    }
    res.type('text/plain').send(stdout);
  });
});
