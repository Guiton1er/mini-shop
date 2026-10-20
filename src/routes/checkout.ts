// src/routes/checkout.ts
import { Router } from 'express';
import { requireLogin, AuthedRequest } from '../middleware/auth';
import { db } from '../db';

export const checkoutRouter = Router();

function logEvent(message: string): void {
  db.prepare(`INSERT INTO logs (message) VALUES (?)`).run(message);
}

checkoutRouter.post('/api/checkout', requireLogin, (req: AuthedRequest, res) => {
  const { items, total } = req.body || {};

  logEvent(`Checkout par user ${req.user!.id} : ${JSON.stringify(req.body)}`);

  if (!Array.isArray(items) || items.length === 0 || typeof total !== 'number') {
    res.status(400).json({ error: 'items et total sont requis' });
    return;
  }

  const paymentId = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const order = db
    .prepare(`INSERT INTO orders (user_id, total, status, payment_id) VALUES (?, ?, 'paid', ?)`)
    .run(req.user!.id, total, paymentId);

  const insertItem = db.prepare(`INSERT INTO order_items (order_id, product_id, qty) VALUES (?, ?, ?)`);
  for (const item of items) {
    insertItem.run(order.lastInsertRowid, item.productId, item.qty);
  }

  const fileName = `facture-${order.lastInsertRowid}.txt`;
  db.prepare(`INSERT INTO invoices (order_id, user_id, amount, file_name) VALUES (?, ?, ?, ?)`).run(
    order.lastInsertRowid,
    req.user!.id,
    total,
    fileName
  );

  res.status(201).json({ status: 'ok', orderId: order.lastInsertRowid, paymentId, total });
});
