// src/seed.ts
//
// Remet la base à zéro et la peuple avec des données de démonstration.

import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { db, initSchema } from './db';

export function reset(): void {
  db.exec(`
    DROP TABLE IF EXISTS logs;
    DROP TABLE IF EXISTS invoices;
    DROP TABLE IF EXISTS order_items;
    DROP TABLE IF EXISTS orders;
    DROP TABLE IF EXISTS products;
    DROP TABLE IF EXISTS users;
  `);
  initSchema();
}

export function seed(): void {
  reset();

  const insertUser = db.prepare(
    `INSERT INTO users (email, name, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)`
  );
  const alice = insertUser.run('alice@minishop.test', 'Alice Martin', '0601020304', bcrypt.hashSync('Password123', 12), 'client');
  const bob   = insertUser.run('bob@minishop.test',   'Bob Durand',   '0605060708', bcrypt.hashSync('Soleil2024', 12), 'client');
  insertUser.run('admin@minishop.test', 'Admin MiniShop', '0600000000', bcrypt.hashSync('AdminAdmin1', 12), 'admin');

  const insertProduct = db.prepare(`INSERT INTO products (name, description, price, stock) VALUES (?, ?, ?, ?)`);
  const products = [
    ['Casque audio sans fil', 'Réduction de bruit active et 30 heures d\'autonomie, pour travailler ou écouter de la musique sans fil toute la journée.', 79.99, 42],
    ['Clavier mécanique', 'Switches mécaniques rétroéclairés, châssis en aluminium : une frappe précise pour le développement comme pour le jeu.', 109.0, 17],
    ['Souris ergonomique', 'Prise en main verticale qui soulage le poignet, capteur haute précision, silencieuse au clic.', 39.5, 30],
    ['Webcam HD', 'Capteur 1080p avec correction automatique de la lumière, idéale pour les visioconférences et le streaming.', 54.9, 25],
    ['Support ordinateur portable', 'Aluminium pliable et réglable sur six hauteurs, améliore la posture et la ventilation de la machine.', 29.0, 60],
  ];
  const productIds: number[] = products.map((p) => Number(insertProduct.run(...p).lastInsertRowid));

  const insertOrder = db.prepare(
    `INSERT INTO orders (user_id, total, status, payment_id) VALUES (?, ?, 'paid', ?)`
  );
  const orderAlice = insertOrder.run(alice.lastInsertRowid, 79.99, 'pay_demo_alice_001');
  const insertItem = db.prepare(`INSERT INTO order_items (order_id, product_id, qty) VALUES (?, ?, ?)`);
  insertItem.run(orderAlice.lastInsertRowid, productIds[0], 1);

  const filesDir = path.join(__dirname, '..', 'files');
  fs.mkdirSync(filesDir, { recursive: true });
  const fileNameAlice = `facture-${orderAlice.lastInsertRowid}.txt`;
  fs.writeFileSync(
    path.join(filesDir, fileNameAlice),
    `MiniShop — Facture\nCommande #${orderAlice.lastInsertRowid}\nClient : Alice Martin (alice@minishop.test)\nMontant : 79.99 €\n\n(Ce fichier texte tient lieu de PDF pour la démonstration.)\n`
  );
  db.prepare(
    `INSERT INTO invoices (order_id, user_id, amount, file_name) VALUES (?, ?, ?, ?)`
  ).run(orderAlice.lastInsertRowid, alice.lastInsertRowid, 79.99, fileNameAlice);

  const orderBob = insertOrder.run(bob.lastInsertRowid, 109.0, 'pay_demo_bob_001');
  insertItem.run(orderBob.lastInsertRowid, productIds[1], 1);
  const fileNameBob = `facture-${orderBob.lastInsertRowid}.txt`;
  fs.writeFileSync(
    path.join(filesDir, fileNameBob),
    `MiniShop — Facture\nCommande #${orderBob.lastInsertRowid}\nClient : Bob Durand (bob@minishop.test)\nMontant : 109.00 €\n\n(Ce fichier texte tient lieu de PDF pour la démonstration.)\n`
  );
  db.prepare(
    `INSERT INTO invoices (order_id, user_id, amount, file_name) VALUES (?, ?, ?, ?)`
  ).run(orderBob.lastInsertRowid, bob.lastInsertRowid, 109.0, fileNameBob);

  const secretDir = path.join(__dirname, '..', 'data');
  fs.writeFileSync(
    path.join(secretDir, 'secret-interne.txt'),
    'Ceci est un fichier interne du serveur, hors du dossier public des factures.\n'
  );

  console.log('Base MiniShop réinitialisée et peuplée.');
  console.log(`  - ${alice.lastInsertRowid}: alice@minishop.test / Password123 (client)`);
  console.log(`  - ${bob.lastInsertRowid}: bob@minishop.test / Soleil2024 (client)`);
  console.log(`  - admin@minishop.test / AdminAdmin1 (admin)`);
}

// Ne s'exécute automatiquement que lorsqu'on lance ce fichier directement
// (`node dist/seed.js`), pas quand les tests l'importent pour réinitialiser
// la base entre deux scénarios.
if (require.main === module) {
  seed();
}
