// src/index.ts
//
// Point d'entrée : initialise la base, démarre le serveur HTTP.
// La construction de l'app elle-même est dans src/app.ts (voir ce fichier
// pour la liste des failles), séparée pour rester testable avec supertest.

import { app } from './app';
import { initSchema } from './db';

initSchema();

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
  console.log(`MiniShop (vulnérable) démarré sur http://localhost:${PORT}`);
});
