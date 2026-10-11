export function createOpCounter() {
  let operations = 0;
  return {
    increment(amount = 1) { operations += amount; },
    get value() { return operations; },
  };
}

export function createTraceRecorder(enabled = false, limit = 5000) {
  const steps = [];
  let skipped = 0;
  return {
    add(step) {
      if (!enabled) return;
      if (steps.length < limit) steps.push(step);
      else skipped += 1;
    },
    get value() {
      return skipped ? [...steps, { type: "summary", data: { skipped }, note: `${skipped} additional steps omitted to keep the trace compact.` }] : steps;
    },
  };
}
