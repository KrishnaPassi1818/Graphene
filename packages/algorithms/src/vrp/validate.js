import { scheduleRoute } from "../util/timeWindows.js";

export function validateSolution(routes, { matrix, demands, capacity, vehicles, stops = [], options = {} }) {
  const expected = matrix.length - 1;
  const visits = Array(expected + 1).fill(0);
  const violations = [];
  const loads = [];
  const perRouteCost = [];
  const routeSchedules = [];
  let capacityFeasible = true;
  let routeStructureValid = true;

  routes.forEach((route, routeIndex) => {
    if (route[0] !== 0 || route.at(-1) !== 0 || route.length < 3) {
      routeStructureValid = false;
      violations.push({ type: "route-structure", routeIndex, note: "Each route must start and end at depot index 0 and contain a stop." });
    }
    let load = 0;
    let cost = 0;
    for (let i = 1; i < route.length - 1; i += 1) {
      const stopIndex = route[i];
      if (!Number.isInteger(stopIndex) || stopIndex < 1 || stopIndex > expected) {
        violations.push({ type: "invalid-stop", routeIndex, stopIndex });
        continue;
      }
      visits[stopIndex] += 1;
      load += demands[stopIndex];
    }
    for (let i = 1; i < route.length; i += 1) cost += matrix[route[i - 1]][route[i]];
    loads.push(load);
    perRouteCost.push(cost);
    if (load > capacity + 1e-8) {
      capacityFeasible = false;
      violations.push({ type: "capacity", routeIndex, load, capacity });
    }
    routeSchedules.push(scheduleRoute(route, matrix, stops, options));
  });

  for (let index = 1; index <= expected; index += 1) {
    if (visits[index] !== 1) violations.push({ type: "coverage", stopIndex: index, visits: visits[index] });
  }
  const coverageFeasible = violations.every((item) => item.type !== "coverage" && item.type !== "invalid-stop");
  const fleetFeasible = routes.length <= vehicles;
  if (!fleetFeasible) violations.push({ type: "fleet", routes: routes.length, vehicles });
  const timeWindowFeasible = routeSchedules.every((schedule) => schedule.feasible);
  routeSchedules.forEach((schedule, routeIndex) => schedule.violations.forEach((violation) => violations.push({ type: "time-window", routeIndex, ...violation })));
  return {
    valid: routeStructureValid && capacityFeasible && coverageFeasible && fleetFeasible && timeWindowFeasible,
    capacityFeasible,
    coverageFeasible,
    fleetFeasible,
    timeWindowFeasible,
    violations,
    loads,
    perRouteCost,
    routeSchedules,
  };
}
