import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/app.mjs";
import { COOKIE_NAME } from "../server/auth.mjs";
import { openDatabase } from "../server/db.mjs";

async function withServer(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "life-cabin-"));
  const db = openDatabase(path.join(dir, "test.sqlite"));
  const app = createApp({
    db,
    password: "secret",
    sessionSecret: "test-secret",
    uploadDir: path.join(dir, "uploads")
  });
  const server = app.listen(0, "127.0.0.1");
  t.after(() => {
    server.close();
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  return { base: `http://127.0.0.1:${address.port}` };
}

async function login(base) {
  const response = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "secret" })
  });
  assert.equal(response.status, 200);
  const cookie = response.headers.get("set-cookie");
  assert.match(cookie, new RegExp(`${COOKIE_NAME}=`));
  return cookie.split(";")[0];
}

async function postJson(base, cookie, endpoint, body) {
  const response = await fetch(`${base}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify(body)
  });
  assert.equal(response.status, 201, `${endpoint} should create a record`);
  return response.json();
}

test("auth rejects anonymous access and accepts shared password", async (t) => {
  const { base } = await withServer(t);
  const anonymous = await fetch(`${base}/api/me`);
  assert.equal(anonymous.status, 401);

  const failed = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "wrong" })
  });
  assert.equal(failed.status, 401);

  const cookie = await login(base);
  const me = await fetch(`${base}/api/me`, { headers: { cookie } });
  assert.equal(me.status, 200);
  const payload = await me.json();
  assert.equal(payload.authenticated, true);
  assert.equal(payload.settings.homeTitle, "我们的生活小屋");
});

test("settings and entries can be created and exported", async (t) => {
  const { base } = await withServer(t);
  const cookie = await login(base);

  const settingsResponse = await fetch(`${base}/api/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ babyNickname: "小星星", dueDate: "2026-12-20" })
  });
  assert.equal(settingsResponse.status, 200);
  const settings = await settingsResponse.json();
  assert.equal(settings.babyNickname, "小星星");

  const entryResponse = await fetch(`${base}/api/entries`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({
      title: "第一次记录",
      body: "今天把小屋搭起来。",
      entry_date: "2026-05-27",
      author: "我们",
      tags: "日常,孕期"
    })
  });
  assert.equal(entryResponse.status, 201);
  const entry = await entryResponse.json();
  assert.deepEqual(entry.tags, ["日常", "孕期"]);

  const letterResponse = await fetch(`${base}/api/letters`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({
      title: "写给她的第一封信",
      body: "这封信要好好存起来。",
      letter_date: "2026-05-31",
      author: "我",
      recipient: "她",
      occasion: "小屋上线"
    })
  });
  assert.equal(letterResponse.status, 201);
  const letter = await letterResponse.json();
  assert.equal(letter.title, "写给她的第一封信");
  assert.equal(letter.is_favorite, false);

  const favoriteResponse = await fetch(`${base}/api/letters/${letter.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ is_favorite: true })
  });
  assert.equal(favoriteResponse.status, 200);
  const favoriteLetter = await favoriteResponse.json();
  assert.equal(favoriteLetter.is_favorite, true);

  const exportResponse = await fetch(`${base}/api/export.json`, { headers: { cookie } });
  assert.equal(exportResponse.status, 200);
  const exported = await exportResponse.json();
  assert.equal(exported.entries.length, 1);
  assert.equal(exported.letters.length, 1);
  assert.equal("tasks" in exported, false);
  assert.equal("appointments" in exported, false);
  assert.equal(exported.settings.babyNickname, "小星星");
});

test("records are written to the local sqlite database", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "life-cabin-persist-"));
  const dbPath = path.join(dir, "persist.sqlite");
  let db = openDatabase(dbPath);
  let server;
  t.after(() => {
    try {
      server?.close();
    } catch {
      // Already closed by the test.
    }
    try {
      db?.close();
    } catch {
      // Already closed by the test.
    }
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const app = createApp({
    db,
    password: "secret",
    sessionSecret: "test-secret",
    uploadDir: path.join(dir, "uploads")
  });
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;
  const cookie = await login(base);

  await postJson(base, cookie, "/api/entries", {
    title: "落盘日记",
    body: "这条记录应该在重启后还在。",
    entry_date: "2026-05-31",
    author: "我们"
  });
  await postJson(base, cookie, "/api/prenatal-records", {
    title: "落盘产检",
    record_date: "2026-06-01"
  });
  await postJson(base, cookie, "/api/info-cards", {
    title: "落盘资料",
    content: "本地数据库里的资料卡。"
  });
  await postJson(base, cookie, "/api/love-notes", { body: "落盘便签" });
  await postJson(base, cookie, "/api/letters", {
    title: "落盘信件",
    body: "这封信应该写进 SQLite。",
    letter_date: "2026-05-31"
  });

  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  db.close();
  server = null;
  db = null;

  const reopened = openDatabase(dbPath);
  try {
    const tables = ["entries", "prenatal_records", "info_cards", "love_notes", "letters"];
    for (const table of tables) {
      const row = reopened.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE deleted_at IS NULL`).get();
      assert.equal(row.count, 1, `${table} should persist after reopening the database`);
    }
    const letter = reopened.prepare("SELECT title, body FROM letters WHERE deleted_at IS NULL").get();
    assert.equal(letter.title, "落盘信件");
    assert.equal(letter.body, "这封信应该写进 SQLite。");
    const taskTable = reopened.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'tasks'").get();
    assert.equal(taskTable, undefined);
    const appointmentTable = reopened.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'appointments'").get();
    assert.equal(appointmentTable, undefined);
  } finally {
    reopened.close();
  }
});

test("image uploads are stored and can be attached to an entry", async (t) => {
  const { base } = await withServer(t);
  const cookie = await login(base);

  const form = new FormData();
  form.append("files", new Blob([Buffer.from("fake png bytes")], { type: "image/png" }), "memory.png");

  const uploadResponse = await fetch(`${base}/api/uploads`, {
    method: "POST",
    headers: { cookie },
    body: form
  });
  assert.equal(uploadResponse.status, 201);
  const uploaded = await uploadResponse.json();
  assert.equal(uploaded.length, 1);
  assert.match(uploaded[0].url, /^\/uploads\//);

  const entryResponse = await fetch(`${base}/api/entries`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({
      title: "带照片的记录",
      body: "这里有一张图。",
      entry_date: "2026-05-27",
      author: "我",
      mediaIds: [uploaded[0].id]
    })
  });
  assert.equal(entryResponse.status, 201);
  const entry = await entryResponse.json();
  assert.equal(entry.media.length, 1);
});
