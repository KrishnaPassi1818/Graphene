import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

// Load the monorepo-root environment before any service module reads configuration.
dotenv.config({ path: fileURLToPath(new URL("../../../../.env", import.meta.url)) });
dotenv.config();

if (process.env.NODE_ENV === "production") {
  const problems = [];
  const secret = process.env.JWT_SECRET ?? "";
  if (secret.length < 32 || /local-compose-secret|local-development-only-secret/i.test(secret)) problems.push("JWT_SECRET must be a unique secret of at least 32 characters.");
  if (process.env.DEMO_MODE !== "false") problems.push("Set DEMO_MODE=false before running in production.");
  if (process.env.COOKIE_SECURE !== "true") problems.push("Set COOKIE_SECURE=true for production refresh cookies.");
  if (!process.env.DATABASE_URL) problems.push("DATABASE_URL is required in production; in-memory storage is not durable.");
  if (process.env.DATABASE_URL?.includes("courier_dev_password")) problems.push("Replace the Docker Compose development database password.");
  const origins = (process.env.WEB_ORIGIN ?? "").split(",").map((origin) => origin.trim()).filter(Boolean);
  if (!origins.length || origins.some((origin) => !origin.startsWith("https://"))) problems.push("Set WEB_ORIGIN to one or more exact HTTPS browser origins.");
  if (problems.length) throw new Error(`Unsafe production configuration: ${problems.join(" ")}`);
}
