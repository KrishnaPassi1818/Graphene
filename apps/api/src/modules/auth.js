import { createHash, randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Router } from "express";
import { z } from "zod";
import { getUserByEmail, getUserById, createUser, saveRefreshToken, getRefreshToken, revokeRefreshToken } from "../storage.js";
import { authenticate, publicUser, signAccessToken } from "../middleware/auth.js";
import { revokeAccessToken } from "../cache/index.js";

export const authRouter = Router();
const signupSchema = z.object({ name: z.string().trim().min(2).max(80), email: z.string().trim().email().max(254), password: z.string().min(10).max(128) });
const loginSchema = z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(128) });
const refreshCookie = "routecraft_refresh";
const refreshDays = () => Number(process.env.REFRESH_TOKEN_DAYS || 7);
const cookieOptions = () => ({ httpOnly: true, secure: process.env.COOKIE_SECURE === "true", sameSite: "lax", path: "/api/auth", maxAge: refreshDays() * 24 * 60 * 60 * 1000 });

function tokenHash(token) { return createHash("sha256").update(token).digest("hex"); }

async function createSession(user, res) {
  const { token, jti } = signAccessToken(user);
  const refreshToken = randomBytes(48).toString("base64url");
  const expiresAt = new Date(Date.now() + refreshDays() * 24 * 60 * 60 * 1000).toISOString();
  await saveRefreshToken({ id: randomUUID(), userId: user.id, tokenHash: tokenHash(refreshToken), expiresAt });
  res.cookie(refreshCookie, refreshToken, cookieOptions());
  return { accessToken: token, tokenType: "Bearer", expiresIn: process.env.ACCESS_TOKEN_TTL || "15m", user: publicUser(user), jti };
}

authRouter.post("/signup", async (req, res, next) => {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_SIGNUP !== "true") return res.status(403).json({ error: "Public sign-up is disabled. Ask an administrator for access." });
  try {
    const body = signupSchema.parse(req.body);
    const exists = await getUserByEmail(body.email);
    if (exists) return res.status(409).json({ error: "An account with that email already exists." });
    const passwordHash = await bcrypt.hash(body.password, 12);
    const user = await createUser({ name: body.name, email: body.email.toLowerCase(), passwordHash });
    const session = await createSession(user, res);
    return res.status(201).json({ accessToken: session.accessToken, tokenType: session.tokenType, expiresIn: session.expiresIn, user: session.user });
  } catch (error) { return next(error); }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const user = await getUserByEmail(body.email);
    const valid = user ? await bcrypt.compare(body.password, user.passwordHash) : false;
    if (!valid) return res.status(401).json({ error: "Email or password is incorrect." });
    const session = await createSession(user, res);
    return res.json({ accessToken: session.accessToken, tokenType: session.tokenType, expiresIn: session.expiresIn, user: session.user });
  } catch (error) { return next(error); }
});

authRouter.post("/refresh", async (req, res) => {
  const oldToken = req.cookies?.[refreshCookie];
  if (!oldToken) return res.status(401).json({ error: "Refresh session is missing." });
  const hashed = tokenHash(oldToken);
  const stored = await getRefreshToken(hashed);
  if (!stored || stored.revoked || new Date(stored.expiresAt).getTime() <= Date.now()) {
    res.clearCookie(refreshCookie, { ...cookieOptions(), maxAge: undefined });
    return res.status(401).json({ error: "Refresh session is invalid or expired." });
  }
  await revokeRefreshToken(hashed);
  const user = await getUserById(stored.userId);
  if (!user) return res.status(401).json({ error: "Refresh session is invalid." });
  const session = await createSession(user, res);
  return res.json({ accessToken: session.accessToken, tokenType: session.tokenType, expiresIn: session.expiresIn, user: session.user });
});

authRouter.post("/logout", authenticate, async (req, res) => {
  const refresh = req.cookies?.[refreshCookie];
  if (refresh) await revokeRefreshToken(tokenHash(refresh));
  if (req.auth?.jti) {
    const remaining = Math.max(1, (req.auth.exp ?? 0) - Math.floor(Date.now() / 1000));
    await revokeAccessToken(req.auth.jti, remaining);
  }
  res.clearCookie(refreshCookie, { ...cookieOptions(), maxAge: undefined });
  return res.json({ ok: true });
});

authRouter.get("/me", authenticate, async (req, res) => {
  const user = await getUserById(req.user.id);
  if (!user && process.env.DEMO_MODE === "false") return res.status(401).json({ error: "User session is no longer valid." });
  return res.json({ user: publicUser(user ?? req.user) });
});
