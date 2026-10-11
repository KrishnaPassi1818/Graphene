import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const ignored = new Set(["node_modules", ".git", "dist", "coverage"]);
const files = [];
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) { if (!ignored.has(entry.name)) await walk(resolve(directory, entry.name)); }
    else if (entry.isFile() && entry.name.endsWith(".js")) files.push(resolve(directory, entry.name));
  }
}
await walk(root);
let failed = false;
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) { failed = true; process.stderr.write(`${file}\n${result.stderr}`); }
}
if (failed) process.exitCode = 1;
else console.log(`Syntax check passed for ${files.length} JavaScript files.`);
