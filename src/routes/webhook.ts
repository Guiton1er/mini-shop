// src/routes/webhook.ts
import { Router } from 'express';
import { db } from '../db';

export const webhookRouter = Router();

webhookRouter.post('/api/payment/webhook', (req, res) => {
  const { orderId, status } = req.body || {};

  if (!orderId || !status) {
    res.status(400).json({ error: 'orderId et status sont requis' });
    return;
  }

  const info = db.prepare(`UPDATE orders SET status = ? WHERE id = ?`).run(status, orderId);
  if (info.changes === 0) {
    res.status(404).json({ error: 'Commande introuvable' });
    return;
  }
  res.json({ status: 'ok' });
});
