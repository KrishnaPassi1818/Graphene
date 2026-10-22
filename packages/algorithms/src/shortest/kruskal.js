import { UnionFind } from "../ds/UnionFind.js";

/**
 * Kruskal's algorithm to compute Minimum Spanning Tree (MST) on an edge list / graph.
 * Time complexity: O(E log E) or O(E log V)
 * Space complexity: O(V + E)
 *
 * @param {number} vertexCount
 * @param {Array<{from: number, to: number, weight: number}>} edges
 * @param {Object} options
 * @returns {{ mstEdges: Array<{from: number, to: number, weight: number}>, totalWeight: number, operations: number, trace: Array<any> }}
 */
export function kruskal(vertexCount, edges, { trace = false } = {}) {
  if (!Number.isInteger(vertexCount) || vertexCount < 0) {
    throw new RangeError("vertexCount must be a non-negative integer");
  }

  const sortedEdges = edges.slice().sort((a, b) => a.weight - b.weight);
  const uf = new UnionFind(vertexCount);
  const mstEdges = [];
  const steps = [];
  let totalWeight = 0;
  let operations = 0;

  for (const edge of sortedEdges) {
    operations += 1;
    const { from, to, weight } = edge;
    const rootA = uf.find(from);
    const rootB = uf.find(to);

    if (rootA !== rootB) {
      uf.union(from, to);
      mstEdges.push(edge);
      totalWeight += weight;
      if (trace && steps.length < 5000) {
        steps.push({
          type: "add-edge",
          data: { from, to, weight, totalWeight },
          cost: totalWeight,
          note: `Selected edge (${from} - ${to}) with weight ${weight.toFixed ? weight.toFixed(2) : weight}. No cycle formed.`,
        });
      }
      if (mstEdges.length === vertexCount - 1) break;
    } else {
      if (trace && steps.length < 5000) {
        steps.push({
          type: "reject-edge",
          data: { from, to, weight },
          cost: totalWeight,
          note: `Discarded edge (${from} - ${to}) with weight ${weight.toFixed ? weight.toFixed(2) : weight} as it forms a cycle.`,
        });
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
