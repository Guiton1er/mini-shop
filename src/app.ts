// src/app.ts
//
// Construit l'application Express et l'exporte, SANS appeler app.listen().
// Séparé de index.ts pour que les tests (src/__tests__/*.test.ts) puissent
// importer `app` et l'interroger avec supertest, sans ouvrir de vrai port.

import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { authRouter } from './routes/auth';
import { productsRouter } from './routes/products';
import { profileRouter } from './routes/profile';
import { invoicesRouter } from './routes/invoices';
import { checkoutRouter } from './routes/checkout';
import { webhookRouter } from './routes/webhook';
import { adminRouter } from './routes/admin';

export const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use(authRouter);
app.use(productsRouter);
app.use(profileRouter);
app.use(invoicesRouter);
app.use(checkoutRouter);
app.use(webhookRouter);
app.use(adminRouter);

app.get('/api/crash-demo', () => {
  throw new Error('Erreur de démonstration : panne simulée du service de recommandations');
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(500).json({ error: err.message, stack: err.stack });
});
