import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const DEFAULT_SETTINGS = {
  homeTitle: "我们的生日小屋",
  entranceTitle: "欢迎回到我们的小屋",
  entranceSubtitle: "这里放着每天的小事、重要的提醒，还有正在慢慢长大的宝宝。",
  partnerOneName: "我",
  partnerTwoName: "她",
  babyNickname: "小小住客",
  dueDate: "",
  lastPeriodDate: "",
  homeMessage: "今天也想认真照顾你，认真记录我们。"
};

export function resolveDataDir() {
  return process.env.DATA_DIR || path.resolve("data");
}

export function resolveDatabasePath() {
  return process.env.DATABASE_PATH || path.join(resolveDataDir(), "birthday-cabin.sqlite");
}

export function nowIso() {
  return new Date().toISOString();
}

export function openDatabase(databasePath = resolveDatabasePath()) {
  if (databasePath !== ":memory:") {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  }

  const db = new DatabaseSync(databasePath);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA busy_timeout = 5000;");
  if (databasePath !== ":memory:") {
    db.exec("PRAGMA journal_mode = WAL;");
  }
  migrate(db);
  seedDefaults(db);
  return db;
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY,
      entry_date TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      author TEXT NOT NULL,
      mood TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS media (
      id TEXT PRIMARY KEY,
      entry_id TEXT,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      url TEXT NOT NULL,
      created_at TEXT NOT NULL,
      deleted_at TEXT,
      FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      due_date TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'life',
      status TEXT NOT NULL DEFAULT 'open',
      author TEXT NOT NULL DEFAULT '我们',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      appointment_date TEXT NOT NULL,
      location TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      questions TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'planned',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS info_cards (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'life',
      link_url TEXT NOT NULL DEFAULT '',
      pinned INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS love_notes (
      id TEXT PRIMARY KEY,
      body TEXT NOT NULL,
      author TEXT NOT NULL DEFAULT '我',
      note_date TEXT NOT NULL,
      is_pinned INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );
  `);
}

function seedDefaults(db) {
  const insert = db.prepare("INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, ?)");
  const timestamp = nowIso();
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    insert.run(key, JSON.stringify(value), timestamp);
  }
}

export function getSettings(db) {
  const rows = db.prepare("SELECT key, value FROM settings").all();
  return Object.fromEntries(
    rows.map((row) => {
      try {
        return [row.key, JSON.parse(row.value)];
      } catch {
        return [row.key, row.value];
      }
    })
  );
}

export function upsertSettings(db, settings) {
  const timestamp = nowIso();
  const statement = db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `);
  for (const [key, value] of Object.entries(settings)) {
    statement.run(key, JSON.stringify(value ?? ""), timestamp);
  }
  return getSettings(db);
}
