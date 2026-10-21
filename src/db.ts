// src/db.ts
//
// Connexion à la base SQLite de MiniShop.

import path from 'path';
import Database from 'better-sqlite3';

const DB_PATH = path.join(__dirname, '..', 'data', 'minishop.sqlite');

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

export function initSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      email         TEXT UNIQUE NOT NULL,
      name          TEXT NOT NULL,
      phone         TEXT,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'client'
    );

    CREATE TABLE IF NOT EXISTS products (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      price       REAL NOT NULL,
      stock       INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS orders (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL,
      total       REAL NOT NULL,
      status      TEXT NOT NULL DEFAULT 'pending',
      payment_id  TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id    INTEGER NOT NULL,
      product_id  INTEGER NOT NULL,
      qty         INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id    INTEGER NOT NULL,
      user_id     INTEGER NOT NULL,
      amount      REAL NOT NULL,
      file_name   TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS logs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      message     TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS login_attempts (
      email             TEXT PRIMARY KEY,
      failed_attempts   INTEGER NOT NULL,
      window_started_at INTEGER NOT NULL
    );
  `);
}
