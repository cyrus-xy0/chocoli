import path from "node:path";
import { createApp } from "./app.mjs";
import { getRuntimeSecrets } from "./auth.mjs";
import { openDatabase, resolveDataDir } from "./db.mjs";

const port = Number(process.env.PORT || 3000);
const dataDir = resolveDataDir();
const uploadDir = process.env.UPLOAD_DIR || path.join(dataDir, "uploads");
const db = openDatabase();
const { password, sessionSecret } = getRuntimeSecrets();

const app = createApp({
  db,
  password,
  sessionSecret,
  uploadDir,
  serveStatic: process.env.NODE_ENV === "production"
});

app.listen(port, () => {
  console.log(`生活小屋已启动: http://localhost:${port}`);
});
