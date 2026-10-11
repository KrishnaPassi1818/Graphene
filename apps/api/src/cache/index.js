import Redis from "ioredis";

let client = null;
const localCache = new Map();
const revokedLocal = new Map();

export async function initializeCache() {
  if (!process.env.REDIS_URL) return { enabled: false, status: "disabled" };
  client = new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1, connectTimeout: 3000, retryStrategy: () => null });
  client.on("error", () => {});
  try { await client.connect(); await client.ping(); return { enabled: true, status: "ready" }; }
  catch (error) { client.disconnect(); client = null; throw new Error(`Redis connection failed: ${error.message}`); }
}

export async function cacheGet(key) {
  if (client) {
    const value = await client.get(key);
    return value == null ? null : JSON.parse(value);
  }
  const entry = localCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) { localCache.delete(key); return null; }
  return entry.value;
}

export async function cacheSet(key, value, ttlSeconds = 3600) {
  if (client) await client.set(key, JSON.stringify(value), "EX", ttlSeconds);
  else localCache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export async function revokeAccessToken(jti, ttlSeconds) {
  if (!jti) return;
  if (client) await client.set(`bl:${jti}`, "1", "EX", Math.max(1, ttlSeconds));
  else revokedLocal.set(jti, Date.now() + Math.max(1, ttlSeconds) * 1000);
}

export async function isAccessTokenRevoked(jti) {
  if (!jti) return false;
  if (client) return (await client.exists(`bl:${jti}`)) === 1;
  const expiration = revokedLocal.get(jti);
  if (!expiration) return false;
  if (expiration < Date.now()) { revokedLocal.delete(jti); return false; }
  return true;
}

export function cacheHealth() { return { status: client ? "ready" : process.env.REDIS_URL ? "error" : "disabled" }; }

export async function closeCache() {
  if (client) { await client.quit().catch(() => client?.disconnect()); client = null; }
}
