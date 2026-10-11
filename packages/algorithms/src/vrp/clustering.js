import { seededRandom } from "../util/seededRandom.js";

export function sweepClusters({ stops, depot, vehicles, capacity, demands, trace }) {
  const ordered = stops.map((stop, index) => ({ index: index + 1, stop, angle: Math.atan2(stop.lng - depot.lng, stop.lat - depot.lat) }))
    .sort((a, b) => a.angle - b.angle || a.index - b.index);
  const clusters = [];
  let cluster = [];
  let load = 0;
  for (const item of ordered) {
    const demand = demands[item.index];
    if (demand > capacity) throw new RangeError(`Stop ${item.stop.id} demand exceeds vehicle capacity.`);
    if (cluster.length && load + demand > capacity) {
      clusters.push(cluster);
      cluster = [];
      load = 0;
    }
    cluster.push(item.index);
    load += demand;
  }
  if (cluster.length) clusters.push(cluster);
  if (clusters.length > vehicles) throw new RangeError(`Capacity requires ${clusters.length} routes, but only ${vehicles} vehicles are available.`);
  trace?.add({ type: "cluster", data: { clusters: clusters.map((items) => items.slice()), method: "sweep" }, note: `Sweep-angle ordering produced ${clusters.length} capacity-feasible route groups.` });
  return clusters;
}

export function kmeansClusters({ stops, depot, vehicles, capacity, demands, seed = 42, trace }) {
  const k = Math.min(vehicles, stops.length);
  if (k === 1) return [stops.map((_, index) => index + 1)];
  const random = seededRandom(seed);
  const points = stops.map((stop) => ({ x: (stop.lat - depot.lat) * 111, y: (stop.lng - depot.lng) * 87 }));
  const chosen = new Set();
  const centers = [];
  while (centers.length < k) {
    let index = Math.floor(random() * points.length);
    while (chosen.has(index)) index = (index + 1) % points.length;
    chosen.add(index);
    centers.push({ ...points[index] });
  }
  let clusters = Array.from({ length: k }, () => []);
  const assignmentOrder = points.map((point, index) => ({ point, index })).sort((a, b) => demands[b.index + 1] - demands[a.index + 1]);
  for (let iteration = 0; iteration < 12; iteration += 1) {
    clusters = Array.from({ length: k }, () => []);
    const loads = Array(k).fill(0);
    for (const { point, index } of assignmentOrder) {
      let selected = -1;
      let bestDistance = Infinity;
      for (let clusterIndex = 0; clusterIndex < k; clusterIndex += 1) {
        if (loads[clusterIndex] + demands[index + 1] > capacity) continue;
        const distance = squaredDistance(point, centers[clusterIndex]);
        if (distance < bestDistance) { bestDistance = distance; selected = clusterIndex; }
      }
      if (selected < 0) throw new RangeError("The fleet capacity cannot pack all demo stops into the selected number of vehicles.");
      clusters[selected].push(index + 1);
      loads[selected] += demands[index + 1];
    }
    centers.forEach((_, index) => {
      if (!clusters[index].length) return;
      const members = clusters[index].map((stopIndex) => points[stopIndex - 1]);
      centers[index] = { x: members.reduce((sum, point) => sum + point.x, 0) / members.length, y: members.reduce((sum, point) => sum + point.y, 0) / members.length };
    });
  }
  clusters = clusters.filter((items) => items.length);
  trace?.add({ type: "cluster", data: { clusters: clusters.map((items) => items.slice()), method: "kmeans" }, note: `Capacity-constrained K-means formed ${clusters.length} clusters.` });
  return clusters;
}

function squaredDistance(a, b) { return (a.x - b.x) ** 2 + (a.y - b.y) ** 2; }
