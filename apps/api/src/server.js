import "./config/loadEnv.js";
import { createApp } from "./app.js";
import { initializeDatabase, closeDatabase } from "./db/index.js";
import { initializeCache, closeCache } from "./cache/index.js";
import { initializeStorage } from "./storage.js";

await initializeDatabase();
await initializeCache();
await initializeStorage();
const app = createApp();
const port = Number(process.env.PORT || 4000);
const server = app.listen(port, "0.0.0.0", () => {
  console.log(`RouteCraft API listening on 0.0.0.0:${port} (${process.env.NODE_ENV || "development"})`);
});

async function shutdown(signal) {
  console.log(`${signal}: shutting down RouteCraft API`);
  server.close(async () => {
    await Promise.all([closeDatabase(), closeCache()]);
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
