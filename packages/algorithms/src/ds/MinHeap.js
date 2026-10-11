// Binary min-heap. Invariant: every parent key is <= the keys of its children; push/pop are O(log n).
export class MinHeap {
  constructor(compare = (a, b) => a.priority - b.priority) {
    this.items = [];
    this.compare = compare;
  }

  get size() { return this.items.length; }
  get isEmpty() { return this.items.length === 0; }

  push(value) {
    const items = this.items;
    items.push(value);
    let index = items.length - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (this.compare(items[index], items[parent]) >= 0) break;
      [items[index], items[parent]] = [items[parent], items[index]];
      index = parent;
    }
  }

  pop() {
    if (!this.items.length) return undefined;
    const root = this.items[0];
    const last = this.items.pop();
    if (this.items.length) {
      this.items[0] = last;
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        let smallest = index;
        if (left < this.items.length && this.compare(this.items[left], this.items[smallest]) < 0) smallest = left;
        if (right < this.items.length && this.compare(this.items[right], this.items[smallest]) < 0) smallest = right;
        if (smallest === index) break;
        [this.items[index], this.items[smallest]] = [this.items[smallest], this.items[index]];
        index = smallest;
      }
    }
    return root;
  }

  peek() { return this.items[0]; }
}
