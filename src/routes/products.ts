import _ from 'lodash';
// src/routes/products.ts
import { Router } from 'express';
import { db } from '../db';

const PRODUCT_ICONS: Record<number, string> = {
  1: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 26 V22 C8 13 15 7 24 7 C33 7 40 13 40 22 V26" /><rect x="5" y="26" width="9" height="14" rx="3" /><rect x="34" y="26" width="9" height="14" rx="3" /></svg>',
  2: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="14" width="38" height="22" rx="4" /><line x1="16" y1="32" x2="32" y2="32" /></svg>',
  3: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="15" y="6" width="18" height="36" rx="9" /><line x1="24" y1="6" x2="24" y2="18" /></svg>',
  4: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="24" cy="24" r="13" /><circle cx="24" cy="24" r="5" /></svg>',
  5: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 38 L18 16 H30 L42 38 Z" /><line x1="6" y1="38" x2="42" y2="38" /><rect x="16" y="7" width="16" height="11" rx="1.5" /></svg>',
};
function productIcon(id: number): string {
  return PRODUCT_ICONS[id] || '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4"><rect x="8" y="8" width="32" height="32" rx="4"/></svg>';
}

export const productsRouter = Router();

productsRouter.get('/api/products', (_req, res) => {
  const products = db.prepare(`SELECT id, name, price, stock FROM products ORDER BY id`).all();
  res.json(_.sortBy(products, 'name'));
});

productsRouter.get('/api/products/:id', (req, res) => {
  const product = db
    .prepare(`SELECT id, name, description, price, stock FROM products WHERE id = ?`)
    .get(req.params.id);
  if (!product) {
    res.status(404).json({ error: 'Produit introuvable' });
    return;
  }
  res.json(product);
});

productsRouter.get('/products', (req, res) => {
  const q = String(req.query.q || '');

  const results = db
    .prepare(`SELECT id, name, price FROM products WHERE name LIKE '%' || ? || '%'`)
    .all(q) as { id: number; name: string; price: number }[];

  const items = results
    .map(
      (r) => `
      <div class="result-card">
        <div class="result-thumb">${productIcon(r.id)}</div>
        <div class="result-name">${r.name}</div>
        <div class="result-price">${r.price.toFixed(2)} €</div>
      </div>`
    )
    .join('\n');

  res.type('html').send(`
    <!doctype html>
    <html lang="fr">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>MiniShop — Recherche</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: -apple-system, 'Segoe UI', Inter, system-ui, sans-serif; margin: 0; background: #f8fafc; color: #0f172a; }
          header { background: #0f172a; color: #fff; padding: 0 1.5rem; height: 64px; display: flex; align-items: center; gap: .4rem; font-size: 1.25rem; font-weight: 800; }
          header a { color: #fff; text-decoration: none; }
          main { max-width: 980px; margin: 0 auto; padding: 2rem 1.5rem 4rem; }
          h1 { font-size: 1.3rem; font-weight: 600; margin: 0 0 1.4rem; }
          .results-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 1.1rem; }
          .result-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1rem; text-align: center; }
          .result-thumb { width: 48px; height: 48px; border-radius: 50%; background: #0e7490; color: #fff; display: flex; align-items: center; justify-content: center; margin: 0 auto .6rem; } .result-thumb svg { width: 26px; height: 26px; }
          .result-name { font-weight: 700; font-size: .92rem; }
          .result-price { color: #0c5c73; font-weight: 700; margin-top: .2rem; }
          .empty { color: #64748b; }
          .back-link { display: inline-block; margin-top: 2rem; color: #0e7490; text-decoration: none; font-size: .9rem; }
        </style>
      </head>
      <body>
        <header><a href="/">🛍️ MiniShop</a></header>
        <main>
          <h1>Résultats pour : ${_.escape(q)}</h1>
          <div class="results-grid">${items || '<p class="empty">Aucun résultat.</p>'}</div>
          <a class="back-link" href="/">&larr; Retour à la boutique</a>
        </main>
      </body>
    </html>
  `);
});
