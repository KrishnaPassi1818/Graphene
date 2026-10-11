// Repeated relaxation: after i passes all shortest paths using at most i edges are known. O(VE).
export function bellmanFord(vertexCount, edges, source, { trace = false } = {}) {
  if (!Number.isInteger(vertexCount) || vertexCount < 1) throw new RangeError("vertexCount must be positive");
  if (!Number.isInteger(source) || source < 0 || source >= vertexCount) throw new RangeError("Invalid source vertex");
  const distances = Array(vertexCount).fill(Infinity);
  const previous = Array(vertexCount).fill(null);
  const steps = [];
  let operations = 0;
  distances[source] = 0;

  for (let pass = 1; pass < vertexCount; pass += 1) {
    let changed = false;
    for (const edge of edges) {
      operations += 1;
      if (Number.isFinite(distances[edge.from]) && distances[edge.from] + edge.weight < distances[edge.to]) {
        distances[edge.to] = distances[edge.from] + edge.weight;
        previous[edge.to] = edge.from;
        changed = true;
        if (trace && steps.length < 5000) steps.push({ type: "relax", data: { from: edge.from, to: edge.to, pass, distance: distances[edge.to] }, cost: distances[edge.to], note: `Pass ${pass}: improved distance to ${edge.to}.` });
      }
    }
    if (!changed) break;
  }

  const hasNegativeCycle = edges.some((edge) => Number.isFinite(distances[edge.from]) && distances[edge.from] + edge.weight < distances[edge.to]);
  return { distances, previous, hasNegativeCycle, operations, trace: steps };
}
