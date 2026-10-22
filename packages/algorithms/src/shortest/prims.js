import { MinHeap } from "../ds/MinHeap.js";

/**
 * Prim's algorithm to compute Minimum Spanning Tree (MST) on an adjacency graph.
 * Time complexity: O((V + E) log V)
 * Space complexity: O(V + E)
 *
 * @param {import("../ds/Graph.js").Graph} graph
 * @param {number} startVertex
 * @param {Object} options
 * @returns {{ mstEdges: Array<{from: number, to: number, weight: number}>, totalWeight: number, operations: number, trace: Array<any> }}
 */
export function prims(graph, startVertex = 0, { trace = false } = {}) {
  const n = graph.vertexCount;
  if (!Number.isInteger(startVertex) || startVertex < 0 || startVertex >= n) {
    throw new RangeError("Invalid start vertex");
  }

  const visited = new Uint8Array(n);
  const minHeap = new MinHeap((a, b) => a.weight - b.weight);
  const mstEdges = [];
  const steps = [];
  let totalWeight = 0;
  let operations = 0;

  visited[startVertex] = 1;
  if (trace) {
    steps.push({
      type: "visit-vertex",
      data: { vertex: startVertex },
      cost: 0,
      note: `Initialized Prim's MST starting from vertex ${startVertex}.`,
    });
  }

  for (const edge of graph.neighbors(startVertex)) {
    minHeap.push({ from: startVertex, to: edge.to, weight: edge.weight });
  }

  while (!minHeap.isEmpty && mstEdges.length < n - 1) {
    const { from, to, weight } = minHeap.pop();
    operations += 1;

    if (visited[to]) continue;
    visited[to] = 1;

    mstEdges.push({ from, to, weight });
    totalWeight += weight;

    if (trace && steps.length < 5000) {
      steps.push({
        type: "add-edge",
        data: { from, to, weight, totalWeight },
        cost: totalWeight,
        note: `Connected vertex ${to} via edge (${from} - ${to}) of weight ${weight.toFixed ? weight.toFixed(2) : weight}.`,
      });
    }

    for (const nextEdge of graph.neighbors(to)) {
      if (!visited[nextEdge.to]) {
        minHeap.push({ from: to, to: nextEdge.to, weight: nextEdge.weight });
      }
    }
  }

  return {
    mstEdges,
    totalWeight,
    operations,
    trace: steps,
  };
}
