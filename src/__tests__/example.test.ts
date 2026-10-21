// src/__tests__/example.test.ts
//
// Exemple minimal, pour voir la syntaxe avant d'écrire vos propres tests.
// Il porte sur une route SAINE (GET /api/products) : il ne prouve aucune
// faille, il montre juste le squelette à reproduire.
//
// À faire, au TP 5-6, pour chaque faille que vous trouvez :
//   1. Copiez ce squelette dans un nouveau fichier (ou ajoutez-y un test).
//   2. Écrivez une assertion qui capture l'exigence (ex. "la réponse doit
//      être 404", "le rôle ne doit pas changer"...).
//   3. Lancez `npm test` : le test doit ÉCHOUER contre le code encore
//      vulnérable — c'est la preuve que le test teste bien quelque chose.
//   4. Corrigez la faille, relancez `npm test` : il doit passer au vert.
//
// Exécution : npm test (compile puis lance node --test sur dist/__tests__/).

import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { test, beforeEach } from 'node:test';
import request from 'supertest';
import { app } from '../app';
import { db, initSchema } from '../db';
import { reset, seed } from '../seed';

// Remet la base dans un état connu avant chaque test, pour que l'ordre
// d'exécution ou ce qu'un autre test a fait n'influence jamais le résultat.
beforeEach(() => {
  reset();
  initSchema();
  seed();
});

test('GET /api/products renvoie la liste des produits', async () => {
  const res = await request(app).get('/api/products');

  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body), 'la réponse doit être un tableau');
  assert.ok(res.body.length > 0, 'le tableau ne doit pas être vide');
});

test('GET /products affiche la recherche sans interpréter le HTML fourni', async () => {
  const payload = '<h1>TEST</h1>';
  const res = await request(app).get('/products').query({ q: payload });

  assert.equal(res.status, 200);
  assert.ok(
    res.text.includes('&lt;h1&gt;TEST&lt;/h1&gt;'),
    'le HTML fourni dans la recherche doit être échappé'
  );
  assert.ok(
    !res.text.includes(payload),
    'le HTML fourni dans la recherche ne doit pas être présent tel quel'
  );
});

test('PUT /api/profile ne permet pas à un client de devenir administrateur', async () => {
  const login = await request(app)
    .post('/login')
    .send({ email: 'alice@minishop.test', password: 'Password123' });

  assert.equal(login.status, 200, 'Alice doit pouvoir se connecter');
  const token = login.body.token;

  await request(app)
    .put('/api/profile')
    .set('Authorization', `Bearer ${token}`)
    .send({ role: 'admin' });

  const profile = await request(app)
    .get('/api/profile')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(profile.status, 200);
  assert.equal(
    profile.body.role,
    'client',
    'ERREUR : un utilisateur a pu modifier son rôle et devenir administrateur'
  );
});

test('GET /api/invoices/:id refuse la facture d’un autre utilisateur', async () => {
  const aliceLogin = await request(app)
    .post('/login')
    .send({ email: 'alice@minishop.test', password: 'Password123' });
  const bobLogin = await request(app)
    .post('/login')
    .send({ email: 'bob@minishop.test', password: 'Soleil2024' });

  assert.equal(aliceLogin.status, 200, 'Alice doit pouvoir se connecter');
  assert.equal(bobLogin.status, 200, 'Bob doit pouvoir se connecter');

  const bobInvoices = await request(app)
    .get('/api/invoices')
    .set('Authorization', `Bearer ${bobLogin.body.token}`);

  assert.equal(bobInvoices.status, 200);
  assert.ok(bobInvoices.body.length > 0, 'Bob doit posséder au moins une facture');

  const res = await request(app)
    .get(`/api/invoices/${bobInvoices.body[0].id}`)
    .set('Authorization', `Bearer ${aliceLogin.body.token}`);

  assert.equal(
    res.status,
    404,
    'ERREUR : Alice a pu accéder à la facture de Bob'
  );
});

test('GET /api/admin/diagnostic refuse une injection de commande echo', async () => {
  const login = await request(app)
    .post('/login')
    .send({ email: 'admin@minishop.test', password: 'AdminAdmin1' });

  assert.equal(login.status, 200, 'l’administrateur doit pouvoir se connecter');

  const res = await request(app)
    .get('/api/admin/diagnostic')
    .set('Authorization', `Bearer ${login.body.token}`)
    .query({ host: '127.0.0.1; echo INJECTION_TEST' });

  assert.equal(
    res.status,
    400,
    'ERREUR : une commande echo peut être injectée dans le ping'
  );
});

test('GET /download refuse les fichiers hors du dossier des factures', async () => {
  const login = await request(app)
    .post('/login')
    .send({ email: 'alice@minishop.test', password: 'Password123' });

  assert.equal(login.status, 200, 'Alice doit pouvoir se connecter');

  const envPath = path.join(process.cwd(), '.env');
  const marker = 'ENV_FILE_ACCESS_TEST_MARKER';
  const createdEnvFixture = !fs.existsSync(envPath);
  const targetFileName = createdEnvFixture ? '.env' : '.env.example';

  if (createdEnvFixture) {
    fs.writeFileSync(envPath, marker);
  }

  try {
    const res = await request(app)
      .get('/download')
      .set('Authorization', `Bearer ${login.body.token}`)
      .query({ name: `../${targetFileName}` });

    assert.ok(
      res.status === 403 || res.status === 404,
      `ERREUR : le fichier .env est accessible via /download (HTTP ${res.status})`
    );
    assert.ok(
      !res.text.includes(marker),
      'ERREUR : le contenu du fichier .env a été renvoyé'
    );
  } finally {
    if (createdEnvFixture) {
      fs.unlinkSync(envPath);
    }
  }
});

test('POST /register ne journalise pas le mot de passe', async () => {
  const password = 'SecretPasswordForLogTest123!';
  const res = await request(app)
    .post('/register')
    .send({
      email: 'log-test@minishop.test',
      name: 'Log Test',
      password
    });

  assert.equal(res.status, 201, 'l’inscription doit réussir');

  const logs = db.prepare('SELECT message FROM logs').all() as { message: string }[];
  assert.ok(
    !logs.some((log) => log.message.includes(password)),
    'ERREUR : le mot de passe est présent dans les logs d’inscription'
  );
});

test('POST /register stocke les mots de passe avec bcrypt', async () => {
  const password = 'BcryptHashTestPassword123!';
  const res = await request(app)
    .post('/register')
    .send({
      email: 'bcrypt-test@minishop.test',
      name: 'Bcrypt Test',
      password
    });

  assert.equal(res.status, 201, 'l’inscription doit réussir');

  const user = db
    .prepare('SELECT password_hash FROM users WHERE email = ?')
    .get('bcrypt-test@minishop.test') as { password_hash: string } | undefined;

  assert.ok(user, 'ERREUR : le compte inscrit est introuvable en base');
  assert.match(
    user.password_hash,
    /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/,
    'ERREUR : le mot de passe n’est pas stocké avec bcrypt'
  );
  assert.notEqual(user.password_hash, password, 'ERREUR : le mot de passe est stocké en clair');
});

// --- À vous ---
// Inspirez-vous de ce test pour écrire les vôtres : vous aurez besoin de
// vous connecter d'abord dans la plupart des cas, par exemple :
//
//   const login = await request(app)
//     .post('/login')
//     .send({ email: 'alice@minishop.test', password: 'Password123' });
//   const token = login.body.token;
//
//   const res = await request(app)
//     .get('/api/UNE_ROUTE_A_TESTER')
//     .set('Authorization', `Bearer ${token}`);
//
//   assert.equal(res.status, 404); // ou ce que votre exigence attend
