// src/routes/invoices.ts
import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { requireLogin, AuthedRequest } from '../middleware/auth';
import { db } from '../db';

export const invoicesRouter = Router();

const FILES_DIR = path.join(__dirname, '..', '..', 'files');

invoicesRouter.get('/api/invoices', requireLogin, (req: AuthedRequest, res) => {
  const invoices = db
    .prepare(`SELECT id, order_id, amount, file_name, created_at FROM invoices WHERE user_id = ? ORDER BY id`)
    .all(req.user!.id);
  res.json(invoices);
});

invoicesRouter.get('/api/invoices/:id', requireLogin, (req: AuthedRequest, res) => {
  const invoice = db
    .prepare(`SELECT id, order_id, user_id, amount, file_name, created_at FROM invoices WHERE id = ? AND user_id = ?`)
    .get(req.params.id, req.user!.id);
  if (!invoice) {
    res.status(404).json({ error: 'Facture introuvable' });
    return;
  }
  res.json(invoice);
});

invoicesRouter.get('/download', requireLogin, (req, res) => {
  const name = String(req.query.name || '');

  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name)) {
    res.status(404).send('Fichier introuvable');
    return;
  }

  const fullPath = path.resolve(FILES_DIR, name);
  const relativePath = path.relative(FILES_DIR, fullPath);
  if (relativePath.startsWith(`..${path.sep}`) || relativePath === '..' || path.isAbsolute(relativePath)) {
    res.status(404).send('Fichier introuvable');
    return;
  }

  fs.readFile(fullPath, 'utf-8', (err, data) => {
    if (err) {
      res.status(404).send('Fichier introuvable');
      return;
    }
    res.type('text/plain').send(data);
  });
});
