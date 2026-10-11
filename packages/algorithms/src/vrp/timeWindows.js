export { scheduleRoute } from "../util/timeWindows.js";

// Greedy feasibility-first scheduling. It selects an available stop with the earliest deadline, then shortest leg.
export function orderForTimeWindows(cluster, matrix, stops, { startTimeMinutes = 480, averageSpeedKmh = 28 } = {}) {
  const pending = new Set(cluster);
  const order = [];
  let current = 0;
  let time = startTimeMinutes;
  while (pending.size) {
    const feasible = [];
    for (const index of pending) {
      const stop = stops[index - 1];
      const arrival = time + (matrix[current][index] / averageSpeedKmh) * 60;
      const serviceStart = stop.timeWindow ? Math.max(arrival, stop.timeWindow.start) : arrival;
      if (!stop.timeWindow || serviceStart <= stop.timeWindow.end) feasible.push({ index, stop, arrival, serviceStart });
    }
    if (!feasible.length) return { order: [...order, ...pending], feasible: false };
    feasible.sort((a, b) => (a.stop.timeWindow?.end ?? Infinity) - (b.stop.timeWindow?.end ?? Infinity) || matrix[current][a.index] - matrix[current][b.index]);
    const chosen = feasible[0];
    order.push(chosen.index);
    pending.delete(chosen.index);
    time = chosen.serviceStart + chosen.stop.serviceMinutes;
    current = chosen.index;
  }
  return { order, feasible: true };
}
