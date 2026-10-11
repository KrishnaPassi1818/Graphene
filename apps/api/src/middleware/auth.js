import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { isAccessTokenRevoked } from "../cache/index.js";
import { getDemoUserId } from "../storage.js";

export function signAccessToken(user) {
  const jti = cryptoRandomId();
  const token = jwt.sign({ role: user.role, email: user.email, name: user.name, jti }, jwtSecret(), {
    subject: user.id,
    issuer: "routecraft-api",
    expiresIn: process.env.ACCESS_TOKEN_TTL || "15m",
  });
  return { token, jti };
}

export async function authenticate(req, res, next) {
  const header = req.headers.authorization ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!bearer && process.env.DEMO_MODE !== "false") {
    req.user = { id: getDemoUserId(), role: "dispatcher", name: "RouteCraft Demo Dispatcher", email: process.env.DEMO_EMAIL || "dispatcher@routecraft.local" };
    return next();
  }
  if (!bearer) return res.status(401).json({ error: "Authentication required." });
  try {
    const payload = jwt.verify(bearer, jwtSecret(), { issuer: "routecraft-api" });
    if (await isAccessTokenRevoked(payload.jti)) return res.status(401).json({ error: "Access token has been revoked." });
    req.user = { id: payload.sub, role: payload.role, email: payload.email, name: payload.name };
    req.auth = { jti: payload.jti, exp: payload.exp };
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired access token." });
  }
}

export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Authentication required." });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: "You do not have permission to perform this action." });
    return next();
  };
}

export function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt };
}

function jwtSecret() {
  return process.env.JWT_SECRET || "local-development-only-secret-change-before-deploy-2026";
}

function cryptoRandomId() { return randomUUID(); }
