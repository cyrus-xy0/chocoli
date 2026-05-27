import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/app.mjs";
import { COOKIE_NAME } from "../server/auth.mjs";
import { openDatabase } from "../server/db.mjs";

async function withServer(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "birthday-cabin-"));
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
  assert.equal(payload.settings.homeTitle, "我们的生日小屋");
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
      tags: "生日,孕期"
    })
  });
  assert.equal(entryResponse.status, 201);
  const entry = await entryResponse.json();
  assert.deepEqual(entry.tags, ["生日", "孕期"]);

  const exportResponse = await fetch(`${base}/api/export.json`, { headers: { cookie } });
  assert.equal(exportResponse.status, 200);
  const exported = await exportResponse.json();
  assert.equal(exported.entries.length, 1);
  assert.equal(exported.settings.babyNickname, "小星星");
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
