import { assertDistanceMatrix, createTourContext, createTourResult } from "./common.js";

// Prim builds an MST; preorder traversal shortcuts repeated vertices. Triangle inequality proves a 2-approximation.
export function mstTwoApproxTsp(matrix, options = {}) {
  assertDistanceMatrix(matrix);
  const n = matrix.length;
  const { recorder } = createTourContext(options);
  const inTree = new Uint8Array(n);
  const bestEdge = Array(n).fill(Infinity);
  const parent = Array(n).fill(-1);
  bestEdge[0] = 0;
  let operations = 0;
  const children = Array.from({ length: n }, () => []);
  for (let count = 0; count < n; count += 1) {
    let vertex = -1;
    for (let i = 0; i < n; i += 1) {
      operations += 1;
      if (!inTree[i] && (vertex === -1 || bestEdge[i] < bestEdge[vertex])) vertex = i;
    }
    if (vertex === -1) break;
    inTree[vertex] = 1;
    if (parent[vertex] !== -1) {
      children[parent[vertex]].push(vertex);
      recorder.add({ type: "merge", data: { from: parent[vertex], to: vertex, weight: bestEdge[vertex] }, cost: bestEdge[vertex], note: `Add edge ${parent[vertex]} -> ${vertex} to the minimum spanning tree.` });
    }
    for (let next = 0; next < n; next += 1) {
      operations += 1;
      if (!inTree[next] && matrix[vertex][next] < bestEdge[next]) {
        bestEdge[next] = matrix[vertex][next];
        parent[next] = vertex;
      }
    }
  }
  const preorder = [];
  const stack = [0];
  const visited = new Uint8Array(n);
  while (stack.length) {
    const vertex = stack.pop();
    if (visited[vertex]) continue;
    visited[vertex] = 1;
    preorder.push(vertex);
    const next = children[vertex].slice().sort((a, b) => matrix[vertex][b] - matrix[vertex][a]);
    for (const child of next) stack.push(child);
  }
  const route = [...preorder, 0];
  recorder.add({ type: "visit", data: { preorder }, note: "Shortcut the MST preorder into a depot-rooted metric tour." });
  return createTourResult(route, matrix, operations, n, recorder);
}
