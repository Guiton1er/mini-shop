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
import { test, beforeEach } from 'node:test';
import request from 'supertest';
import { app } from '../app';
import { initSchema } from '../db';
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
