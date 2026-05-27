import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import multer from "multer";
import { COOKIE_NAME, cookieOptions, createSessionToken, passwordMatches, verifySessionToken } from "./auth.mjs";
import { getSettings, nowIso, upsertSettings } from "./db.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JSON_FIELDS = new Set(["tags", "questions"]);

const RESOURCE_CONFIG = {
  tasks: {
    table: "tasks",
    columns: ["title", "notes", "due_date", "category", "status", "author"],
    defaults: { notes: "", due_date: "", category: "life", status: "open", author: "我们" },
    order: "CASE WHEN due_date = '' THEN 1 ELSE 0 END, due_date ASC, created_at DESC"
  },
  appointments: {
    table: "appointments",
    columns: ["title", "appointment_date", "location", "notes", "questions", "status"],
    defaults: { location: "", notes: "", questions: [], status: "planned" },
    order: "appointment_date ASC, created_at DESC"
  },
  "info-cards": {
    table: "info_cards",
    columns: ["title", "content", "category", "link_url", "pinned"],
    defaults: { content: "", category: "life", link_url: "", pinned: 0 },
    order: "pinned DESC, updated_at DESC"
  },
  "love-notes": {
    table: "love_notes",
    columns: ["body", "author", "note_date", "is_pinned"],
    defaults: { author: "我", note_date: new Date().toISOString().slice(0, 10), is_pinned: 0 },
    order: "is_pinned DESC, note_date DESC, created_at DESC"
  }
};

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function cleanText(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  return String(value).trim();
}

function toJson(value, fallback = []) {
  if (Array.isArray(value)) return JSON.stringify(value.map((item) => String(item).trim()).filter(Boolean));
  if (typeof value === "string") {
    return JSON.stringify(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    );
  }
  return JSON.stringify(fallback);
}

function parseJson(value, fallback = []) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeResourceRow(row) {
  const normalized = { ...row };
  for (const field of JSON_FIELDS) {
    if (field in normalized) normalized[field] = parseJson(normalized[field]);
  }
  normalized.pinned = Boolean(normalized.pinned);
  normalized.is_pinned = Boolean(normalized.is_pinned);
  return normalized;
}

function compactBody(body, columns, defaults = {}) {
  const output = {};
  for (const column of columns) {
    if (column in body) {
      output[column] = JSON_FIELDS.has(column) ? toJson(body[column]) : body[column];
    } else if (column in defaults) {
      output[column] = JSON_FIELDS.has(column) ? toJson(defaults[column]) : defaults[column];
    }
  }
  return output;
}

function requireTitle(value, label = "标题") {
  if (!cleanText(value)) {
    const error = new Error(`${label}不能为空`);
    error.status = 400;
    throw error;
  }
}

function authMiddleware(sessionSecret) {
  return (req, res, next) => {
    const token = req.cookies?.[COOKIE_NAME];
    if (!verifySessionToken(token, sessionSecret)) {
      return res.status(401).json({ error: "请先进入小屋" });
    }
    return next();
  };
}

function wrap(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

function makeCookieParser() {
  return (req, _res, next) => {
    req.cookies = {};
    const header = req.headers.cookie;
    if (header) {
      for (const part of header.split(";")) {
        const [rawKey, ...rawValue] = part.trim().split("=");
        if (rawKey) req.cookies[rawKey] = decodeURIComponent(rawValue.join("="));
      }
    }
    next();
  };
}

export function createApp({ db, password, sessionSecret, uploadDir = path.resolve("uploads"), serveStatic = false } = {}) {
  if (!db) throw new Error("createApp requires a database");
  if (!password || !sessionSecret) throw new Error("createApp requires password and sessionSecret");

  fs.mkdirSync(uploadDir, { recursive: true });
  const app = express();

  const storage = multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, uploadDir),
    filename: (_req, file, callback) => {
      const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
      callback(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
    }
  });
  const upload = multer({
    storage,
    limits: { fileSize: 6 * 1024 * 1024, files: 4 },
    fileFilter: (_req, file, callback) => {
      if (!IMAGE_TYPES.has(file.mimetype)) return callback(new Error("只支持 JPG、PNG、WebP 或 GIF 图片"));
      callback(null, true);
    }
  });

  app.use(express.json({ limit: "1mb" }));
  app.use(makeCookieParser());
  app.use("/uploads", express.static(uploadDir, { maxAge: "7d", immutable: false }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.post("/api/auth/login", (req, res) => {
    if (!passwordMatches(req.body?.password, password)) {
      return res.status(401).json({ error: "密码不对，再轻轻试一次" });
    }
    res.cookie(COOKIE_NAME, createSessionToken(sessionSecret), cookieOptions());
    return res.json({ ok: true });
  });

  app.post("/api/auth/logout", (_req, res) => {
    res.clearCookie(COOKIE_NAME, { path: "/" });
    res.json({ ok: true });
  });

  app.use("/api", authMiddleware(sessionSecret));

  app.get("/api/me", (_req, res) => {
    res.json({ authenticated: true, settings: getSettings(db) });
  });

  app.get("/api/settings", (_req, res) => {
    res.json(getSettings(db));
  });

  app.put("/api/settings", (req, res) => {
    res.json(upsertSettings(db, req.body || {}));
  });

  app.get("/api/entries", (req, res) => {
    const limit = Math.min(Number(req.query.limit || 50), 100);
    const rows = db
      .prepare("SELECT * FROM entries WHERE deleted_at IS NULL ORDER BY entry_date DESC, created_at DESC LIMIT ?")
      .all(limit)
      .map(normalizeResourceRow);
    const mediaByEntry = new Map();
    if (rows.length) {
      const placeholders = rows.map(() => "?").join(",");
      const mediaRows = db
        .prepare(`SELECT * FROM media WHERE deleted_at IS NULL AND entry_id IN (${placeholders}) ORDER BY created_at ASC`)
        .all(...rows.map((row) => row.id));
      for (const media of mediaRows) {
        const list = mediaByEntry.get(media.entry_id) || [];
        list.push(media);
        mediaByEntry.set(media.entry_id, list);
      }
    }
    res.json(rows.map((row) => ({ ...row, media: mediaByEntry.get(row.id) || [] })));
  });

  app.post(
    "/api/entries",
    wrap((req, res) => {
      const title = cleanText(req.body.title);
      const body = cleanText(req.body.body);
      requireTitle(title);
      if (!body) {
        const error = new Error("内容不能为空");
        error.status = 400;
        throw error;
      }
      const id = crypto.randomUUID();
      const timestamp = nowIso();
      db.prepare(
        `INSERT INTO entries (id, entry_date, title, body, author, mood, tags, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        cleanText(req.body.entry_date, new Date().toISOString().slice(0, 10)),
        title,
        body,
        cleanText(req.body.author, "我们"),
        cleanText(req.body.mood),
        toJson(req.body.tags),
        timestamp,
        timestamp
      );
      attachMedia(db, id, req.body.mediaIds);
      res.status(201).json(getEntry(db, id));
    })
  );

  app.put(
    "/api/entries/:id",
    wrap((req, res) => {
      const existing = getEntry(db, req.params.id);
      if (!existing) return res.status(404).json({ error: "没有找到这条记录" });
      const title = cleanText(req.body.title, existing.title);
      const body = cleanText(req.body.body, existing.body);
      requireTitle(title);
      db.prepare(
        `UPDATE entries
         SET entry_date = ?, title = ?, body = ?, author = ?, mood = ?, tags = ?, updated_at = ?
         WHERE id = ? AND deleted_at IS NULL`
      ).run(
        cleanText(req.body.entry_date, existing.entry_date),
        title,
        body,
        cleanText(req.body.author, existing.author),
        cleanText(req.body.mood, existing.mood),
        toJson(req.body.tags ?? existing.tags),
        nowIso(),
        req.params.id
      );
      attachMedia(db, req.params.id, req.body.mediaIds);
      res.json(getEntry(db, req.params.id));
    })
  );

  app.delete("/api/entries/:id", (req, res) => {
    db.prepare("UPDATE entries SET deleted_at = ?, updated_at = ? WHERE id = ?").run(nowIso(), nowIso(), req.params.id);
    res.json({ ok: true });
  });

  app.post(
    "/api/uploads",
    upload.array("files", 4),
    wrap((req, res) => {
      const timestamp = nowIso();
      const rows = [];
      for (const file of req.files || []) {
        const row = {
          id: crypto.randomUUID(),
          filename: file.filename,
          original_name: file.originalname,
          mime_type: file.mimetype,
          size: file.size,
          url: `/uploads/${file.filename}`,
          created_at: timestamp
        };
        db.prepare(
          `INSERT INTO media (id, filename, original_name, mime_type, size, url, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(row.id, row.filename, row.original_name, row.mime_type, row.size, row.url, row.created_at);
        rows.push(row);
      }
      res.status(201).json(rows);
    })
  );

  for (const [routeName, config] of Object.entries(RESOURCE_CONFIG)) {
    registerResource(app, db, routeName, config);
  }

  app.get("/api/export.json", (_req, res) => {
    const entries = db.prepare("SELECT * FROM entries WHERE deleted_at IS NULL ORDER BY entry_date DESC").all();
    const media = db.prepare("SELECT * FROM media WHERE deleted_at IS NULL ORDER BY created_at DESC").all();
    const tasks = db.prepare("SELECT * FROM tasks WHERE deleted_at IS NULL ORDER BY created_at DESC").all();
    const appointments = db.prepare("SELECT * FROM appointments WHERE deleted_at IS NULL ORDER BY appointment_date ASC").all();
    const infoCards = db.prepare("SELECT * FROM info_cards WHERE deleted_at IS NULL ORDER BY pinned DESC, updated_at DESC").all();
    const loveNotes = db.prepare("SELECT * FROM love_notes WHERE deleted_at IS NULL ORDER BY note_date DESC").all();
    res.json({
      exported_at: nowIso(),
      settings: getSettings(db),
      entries,
      media,
      tasks,
      appointments,
      info_cards: infoCards,
      love_notes: loveNotes
    });
  });

  if (serveStatic) {
    const distDir = path.resolve(__dirname, "../dist");
    app.use(express.static(distDir));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  }

  app.use((error, _req, res, _next) => {
    const status = error.status || (error.message?.includes("只支持") ? 400 : 500);
    res.status(status).json({ error: error.message || "小屋暂时有点忙" });
  });

  return app;
}

function getEntry(db, id) {
  const row = db.prepare("SELECT * FROM entries WHERE id = ? AND deleted_at IS NULL").get(id);
  if (!row) return null;
  const media = db.prepare("SELECT * FROM media WHERE entry_id = ? AND deleted_at IS NULL ORDER BY created_at ASC").all(id);
  return { ...normalizeResourceRow(row), media };
}

function attachMedia(db, entryId, mediaIds = []) {
  if (!Array.isArray(mediaIds) || !mediaIds.length) return;
  const statement = db.prepare("UPDATE media SET entry_id = ? WHERE id = ? AND deleted_at IS NULL");
  for (const mediaId of mediaIds) {
    statement.run(entryId, String(mediaId));
  }
}

function registerResource(app, db, routeName, config) {
  app.get(`/api/${routeName}`, (_req, res) => {
    const rows = db
      .prepare(`SELECT * FROM ${config.table} WHERE deleted_at IS NULL ORDER BY ${config.order}`)
      .all()
      .map(normalizeResourceRow);
    res.json(rows);
  });

  app.post(
    `/api/${routeName}`,
    wrap((req, res) => {
      const values = compactBody(req.body || {}, config.columns, config.defaults);
      const required = routeName === "love-notes" ? "body" : "title";
      requireTitle(values[required], routeName === "love-notes" ? "便签" : "标题");
      const id = crypto.randomUUID();
      const timestamp = nowIso();
      const columns = ["id", ...config.columns, "created_at", "updated_at"];
      const placeholders = columns.map(() => "?").join(", ");
      db.prepare(`INSERT INTO ${config.table} (${columns.join(", ")}) VALUES (${placeholders})`).run(
        id,
        ...config.columns.map((column) => normalizeDbValue(values[column])),
        timestamp,
        timestamp
      );
      const row = db.prepare(`SELECT * FROM ${config.table} WHERE id = ?`).get(id);
      res.status(201).json(normalizeResourceRow(row));
    })
  );

  app.put(
    `/api/${routeName}/:id`,
    wrap((req, res) => {
      const existing = db.prepare(`SELECT * FROM ${config.table} WHERE id = ? AND deleted_at IS NULL`).get(req.params.id);
      if (!existing) return res.status(404).json({ error: "没有找到这条内容" });
      const updates = compactBody(req.body || {}, config.columns, {});
      if (!Object.keys(updates).length) return res.json(normalizeResourceRow(existing));
      const assignments = Object.keys(updates).map((column) => `${column} = ?`);
      db.prepare(`UPDATE ${config.table} SET ${assignments.join(", ")}, updated_at = ? WHERE id = ? AND deleted_at IS NULL`).run(
        ...Object.values(updates).map(normalizeDbValue),
        nowIso(),
        req.params.id
      );
      const row = db.prepare(`SELECT * FROM ${config.table} WHERE id = ?`).get(req.params.id);
      res.json(normalizeResourceRow(row));
    })
  );

  app.delete(`/api/${routeName}/:id`, (req, res) => {
    db.prepare(`UPDATE ${config.table} SET deleted_at = ?, updated_at = ? WHERE id = ?`).run(nowIso(), nowIso(), req.params.id);
    res.json({ ok: true });
  });
}

function normalizeDbValue(value) {
  if (typeof value === "boolean") return value ? 1 : 0;
  return value ?? "";
}
