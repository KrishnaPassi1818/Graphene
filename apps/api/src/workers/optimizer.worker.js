import { parentPort, workerData } from "node:worker_threads";
import { solveOptimization } from "@courier/algorithms";

try {
  const result = solveOptimization(workerData);
  parentPort.postMessage({ ok: true, result });
} catch (error) {
  parentPort.postMessage({ ok: false, error: { message: error.message, name: error.name } });
}
