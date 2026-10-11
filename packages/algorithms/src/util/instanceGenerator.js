import { distanceMatrixFromPoints } from "./haversine.js";
import { seededRandom } from "./seededRandom.js";

export function generateInstance({ n = 10, seed = 42, center = { lat: 30.9004, lng: 75.8573 }, spread = 0.035 } = {}) {
  if (!Number.isInteger(n) || n < 1 || n > 200) throw new RangeError("n must be between 1 and 200");
  const random = seededRandom(seed);
  const points = [{ id: "depot", label: "Depot", ...center }];
  const stops = [];
  for (let i = 1; i <= n; i += 1) {
    const point = {
      id: `S-${String(i).padStart(3, "0")}`,
      label: `Stop ${String(i).padStart(2, "0")}`,
      lat: center.lat + (random() - 0.5) * spread,
      lng: center.lng + (random() - 0.5) * spread,
      demand: 8 + Math.floor(random() * 18),
      serviceMinutes: 5 + Math.floor(random() * 6),
    };
    stops.push(point);
    points.push(point);
  }
  return { depot: points[0], stops, demands: [0, ...stops.map((stop) => stop.demand)], matrix: distanceMatrixFromPoints(points), seed };
}
