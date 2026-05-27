import crypto from "node:crypto";

export const COOKIE_NAME = "birthday_cabin_session";

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

function sign(value, secret) {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(a, b) {
  const left = crypto.createHash("sha256").update(String(a)).digest();
  const right = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(left, right);
}

export function getRuntimeSecrets() {
  const password = process.env.CABIN_PASSWORD || (process.env.NODE_ENV === "production" ? "" : "chocoli");
  const sessionSecret =
    process.env.SESSION_SECRET || (process.env.NODE_ENV === "production" ? "" : "dev-session-secret-change-me");

  if (!password || !sessionSecret) {
    throw new Error("CABIN_PASSWORD and SESSION_SECRET must be set in production.");
  }

  return { password, sessionSecret };
}

export function passwordMatches(input, expected) {
  return safeEqual(input || "", expected || "");
}

export function createSessionToken(secret) {
  const payload = {
    sub: "family",
    exp: Date.now() + 1000 * 60 * 60 * 24 * 30
  };
  const body = base64url(JSON.stringify(payload));
  return `${body}.${sign(body, secret)}`;
}

export function verifySessionToken(token, secret) {
  if (!token || !token.includes(".")) return false;
  const [body, signature] = token.split(".");
  if (!signature || !safeEqual(signature, sign(body, secret))) return false;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return payload.sub === "family" && Number(payload.exp) > Date.now();
  } catch {
    return false;
  }
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 24 * 30,
    path: "/"
  };
}
