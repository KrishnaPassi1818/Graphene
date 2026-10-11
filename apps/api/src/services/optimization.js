import { createHash, randomUUID } from "node:crypto";
import { Worker } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import { cacheGet, cacheSet } from "../cache/index.js";
import { saveRun, getRunById } from "../storage.js";

const jobs = new Map();
const cachePrefix = "routecraft:opt:";
const defaultTimeoutMs = Number(process.env.OPTIMIZER_TIMEOUT_MS || 30000);
const workerPath = fileURLToPath(new URL("../workers/optimizer.worker.js", import.meta.url));

export function hashInput(input) {
  return createHash("sha256").update(stableStringify(input)).digest("hex");
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export async function startOptimization(input, ownerId) {
  const inputHash = hashInput(input);
  const id = randomUUID();
  const cacheKey = `${cachePrefix}${ownerId}:${inputHash}`;
  const cached = await cacheGet(cacheKey);
  if (cached) {
    await saveRun(ownerId, { id, algorithm: input.algorithm, inputHash, input, result: cached });
    jobs.set(id, { id, ownerId, status: "completed", result: cached, cached: true, createdAt: new Date().toISOString(), completedAt: new Date().toISOString() });
    return { jobId: id, status: "completed", cached: true };
  }

  const job = { id, ownerId, status: "running", result: null, error: null, cached: false, createdAt: new Date().toISOString() };
  jobs.set(id, job);
  runWorker(input, defaultTimeoutMs).then(async (result) => {
    job.status = "completed";
    job.result = result;
    job.completedAt = new Date().toISOString();
    await saveRun(ownerId, { id, algorithm: input.algorithm, inputHash, input, result });
    await cacheSet(cacheKey, result, 3600);
  }).catch((error) => {
    job.status = "failed";
    job.error = { message: error.message, name: error.name ?? "Error" };
    job.completedAt = new Date().toISOString();
  });
  trimJobs();
  return { jobId: id, status: "running", cached: false };
}

export async function runSolverInWorker(input, timeoutMs = defaultTimeoutMs) {
  return runWorker(input, timeoutMs);
}

export async function getOptimizationJob(ownerId, id) {
  const job = jobs.get(id);
  if (job && job.ownerId === ownerId) return job;
  const run = await getRunById(ownerId, id);
  if (!run) return null;
  return { id: run.id, ownerId, status: "completed", result: run.result, cached: false, createdAt: run.createdAt, completedAt: run.createdAt };
}

function runWorker(data, timeoutMs) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerPath, { workerData: data, resourceLimits: { maxOldGenerationSizeMb: 512 } });
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      worker.terminate();
      reject(new Error(`Optimization exceeded the ${timeoutMs} ms worker timeout.`));
    }, timeoutMs);
    worker.once("message", (message) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate();
      if (message?.ok) resolve(message.result);
      else reject(Object.assign(new Error(message?.error?.message || "Worker failed."), { name: message?.error?.name || "WorkerError" }));
    });
    worker.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    worker.once("exit", (code) => {
      if (!settled && code !== 0) {
        settled = true;
        clearTimeout(timer);
        reject(new Error(`Optimization worker stopped with code ${code}.`));
      }
    });
  });
}

function trimJobs() {
  if (jobs.size <= 200) return;
  const entries = [...jobs.values()].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  for (const job of entries.slice(0, jobs.size - 150)) if (job.status !== "running") jobs.delete(job.id);
}
