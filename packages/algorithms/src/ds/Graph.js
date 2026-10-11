// Adjacency-list graph. Edge records are immutable plain data, keeping algorithms independent of I/O.
export class Graph {
  constructor(vertexCount, { directed = false } = {}) {
    if (!Number.isInteger(vertexCount) || vertexCount < 0) throw new TypeError("vertexCount must be a non-negative integer");
    this.vertexCount = vertexCount;
    this.directed = directed;
    this.adjacency = Array.from({ length: vertexCount }, () => []);
  }

  addEdge(from, to, weight = 1) {
    this.#assertVertex(from);
    this.#assertVertex(to);
    if (!Number.isFinite(weight)) throw new TypeError("weight must be finite");
    this.adjacency[from].push({ to, weight });
    if (!this.directed) this.adjacency[to].push({ to: from, weight });
    return this;
  }

  neighbors(vertex) {
    this.#assertVertex(vertex);
    return this.adjacency[vertex];
  }

  #assertVertex(vertex) {
    if (!Number.isInteger(vertex) || vertex < 0 || vertex >= this.vertexCount) throw new RangeError(`Invalid vertex: ${vertex}`);
  }
}
