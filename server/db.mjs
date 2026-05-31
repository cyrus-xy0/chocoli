import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const DEFAULT_SETTINGS = {
  homeTitle: "我们的生活小屋",
  entranceTitle: "欢迎回到我们的小屋",
  entranceSubtitle: "这里放着每天的小事、珍贵的记录，还有正在慢慢长大的宝宝。",
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
  if (process.env.DATABASE_PATH) {
    return process.env.DATABASE_PATH;
  }

  const dataDir = resolveDataDir();
  const nextPath = path.join(dataDir, "life-cabin.sqlite");
  const legacyPath = path.join(dataDir, "birthday-cabin.sqlite");
  return fs.existsSync(legacyPath) && !fs.existsSync(nextPath) ? legacyPath : nextPath;
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
  const hasLegacyAppointments = Boolean(
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'appointments'").get()
  );

  db.exec(`
    DROP TABLE IF EXISTS tasks;

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

    CREATE TABLE IF NOT EXISTS prenatal_records (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      record_date TEXT NOT NULL,
      location TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      questions TEXT NOT NULL DEFAULT '[]',
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

    CREATE TABLE IF NOT EXISTS letters (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      letter_date TEXT NOT NULL,
      author TEXT NOT NULL DEFAULT '我',
      recipient TEXT NOT NULL DEFAULT '她',
      occasion TEXT NOT NULL DEFAULT '',
      is_favorite INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );
  `);

  if (hasLegacyAppointments) {
    db.exec(`
      INSERT OR IGNORE INTO prenatal_records (
        id,
        title,
        record_date,
        location,
        notes,
        questions,
        created_at,
        updated_at,
        deleted_at
      )
      SELECT
        id,
        title,
        appointment_date,
        location,
        notes,
        questions,
        created_at,
        updated_at,
        deleted_at
      FROM appointments;

      DROP TABLE IF EXISTS appointments;
    `);
  }
}

function seedDefaults(db) {
  const insert = db.prepare("INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, ?)");
  const timestamp = nowIso();
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    insert.run(key, JSON.stringify(value), timestamp);
  }

  db.prepare("UPDATE settings SET value = ?, updated_at = ? WHERE key = ? AND value = ?").run(
    JSON.stringify(DEFAULT_SETTINGS.homeTitle),
    timestamp,
    "homeTitle",
    JSON.stringify(["我们的", "生日", "小屋"].join(""))
  );
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
