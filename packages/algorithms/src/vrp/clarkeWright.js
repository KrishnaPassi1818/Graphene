import { UnionFind } from "../ds/UnionFind.js";

// Clarke–Wright savings: merge route endpoints in descending s(i,j), respecting fleet capacity.
export function clarkeWrightClusters({ matrix, demands, vehicles, capacity, trace }) {
  const n = matrix.length - 1;
  const routes = Array.from({ length: n }, (_, i) => [i + 1]);
  const routeLoads = Array.from({ length: n }, (_, i) => demands[i + 1]);
  const savings = [];
  const sets = new UnionFind(n + 1);
  for (let i = 1; i <= n; i += 1) {
    if (demands[i] > capacity) throw new RangeError(`Stop ${i} demand exceeds vehicle capacity.`);
    for (let j = i + 1; j <= n; j += 1) savings.push({ i, j, value: matrix[0][i] + matrix[0][j] - matrix[i][j] });
  }
  savings.sort((a, b) => b.value - a.value || a.i - b.i || a.j - b.j);
  let operations = 0;
  for (const pair of savings) {
    operations += 1;
    const routeI = routes.findIndex((route) => route.includes(pair.i));
    const routeJ = routes.findIndex((route) => route.includes(pair.j));
    if (routeI < 0 || routeJ < 0 || routeI === routeJ) continue;
    if (sets.find(pair.i) === sets.find(pair.j)) continue;
    if (routeLoads[routeI] + routeLoads[routeJ] > capacity) continue;
    const left = routes[routeI].slice();
    const right = routes[routeJ].slice();
    if (left[0] !== pair.i && left.at(-1) !== pair.i) continue;
    if (right[0] !== pair.j && right.at(-1) !== pair.j) continue;
    if (left[0] === pair.i) left.reverse();
    if (right.at(-1) === pair.j) right.reverse();
    const merged = [...left, ...right];
    const mergedLoad = routeLoads[routeI] + routeLoads[routeJ];
    sets.union(pair.i, pair.j);
    const keep = Math.min(routeI, routeJ);
    const drop = Math.max(routeI, routeJ);
    routes.splice(drop, 1);
    routeLoads.splice(drop, 1);
    routes[keep] = merged;
    routeLoads[keep] = mergedLoad;
    trace?.add({ type: "merge", data: { i: pair.i, j: pair.j, saving: pair.value, route: merged.slice() }, cost: pair.value, note: `Merge endpoint stops ${pair.i} and ${pair.j}; save ${pair.value.toFixed(2)} km.` });
  }
  if (routes.length > vehicles) throw new RangeError(`Savings heuristic needs ${routes.length} vehicles, but only ${vehicles} are available at this capacity.`);
  return { clusters: routes, operations };
}
