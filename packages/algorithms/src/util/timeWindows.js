// Earliest-feasible service schedule for a fixed route, using minutes after midnight.
export function scheduleRoute(route, matrix, stops, { averageSpeedKmh = 28, startTimeMinutes = 480 } = {}) {
  let currentTime = startTimeMinutes;
  const schedule = [];
  const violations = [];
  for (let p = 1; p < route.length - 1; p += 1) {
    const index = route[p];
    const previous = route[p - 1];
    const travelMinutes = (matrix[previous][index] / averageSpeedKmh) * 60;
    const arrival = currentTime + travelMinutes;
    const stop = stops[index - 1];
    const window = stop?.timeWindow;
    const serviceStart = window ? Math.max(arrival, window.start) : arrival;
    const serviceMinutes = stop?.serviceMinutes ?? 0;
    const serviceEnd = serviceStart + serviceMinutes;
    if (window && serviceStart > window.end) violations.push({ stopId: stop.id, arrival: serviceStart, deadline: window.end });
    schedule.push({ stopId: stop?.id ?? String(index), arrivalMinutes: arrival, serviceStartMinutes: serviceStart, serviceEndMinutes: serviceEnd });
    currentTime = serviceEnd;
  }
  return { schedule, violations, feasible: violations.length === 0 };
}
