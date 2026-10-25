import { create } from "zustand";
import { DEMO_INSTANCE, solveOptimization } from "@courier/algorithms";

const demo = structuredClone(DEMO_INSTANCE);

let initialResult = null;
try {
  initialResult = solveOptimization({
    depot: demo.depot,
    stops: demo.stops,
    vehicles: demo.fleet.vehicles,
    capacity: demo.fleet.capacity,
    algorithm: "nearest-neighbor",
    options: { seed: 42, trace: true, averageSpeedKmh: 28, startTimeMinutes: 480 }
  });
} catch {
  initialResult = null;
}

export const usePlannerStore = create((set, get) => ({
  page: "planner",
  planner: { depot: demo.depot, stops: demo.stops, fleet: demo.fleet, demoMode: true, algorithms: [] },
  algorithm: "nearest-neighbor",
  result: initialResult,
  comparison: null,
  selectedRoute: null,
  running: false,
  progressText: "",
  history: initialResult ? [{
    id: `curri-demo-init`,
    algorithm: "nearest-neighbor",
    totalDistance: initialResult.totalCost,
    runtimeMs: initialResult.stats.runtimeMs,
    opCount: initialResult.stats.operations,
    createdAt: new Date().toISOString(),
    result: initialResult,
    input: { depot: demo.depot, stops: demo.stops, fleet: demo.fleet }
  }] : [],
  fallbackMode: false,
  setPage: (page) => set({ page }),
  setPlanner: (planner) => set({ planner: { ...get().planner, ...planner }, fallbackMode: false }),
  setFallbackMode: () => set({ fallbackMode: true }),
  setAlgorithm: (algorithm) => set({ algorithm }),
  setResult: (result) => set({ result, selectedRoute: null, comparison: null }),
  setComparison: (comparison) => set({ comparison }),
  setSelectedRoute: (selectedRoute) => set({ selectedRoute }),
  setRunning: (running, progressText = "") => set({ running, progressText }),
  addHistory: (run) => set((state) => ({ history: [run, ...state.history].slice(0, 50) })),
  clearHistory: () => set({ history: [] }),
  addStop: (stop) => set((state) => ({ planner: { ...state.planner, stops: [...state.planner.stops, stop] }, result: null })),
  removeStop: (id) => set((state) => ({ planner: { ...state.planner, stops: state.planner.stops.filter((stop) => stop.id !== id) }, result: null })),
  setStops: (stops) => set((state) => ({ planner: { ...state.planner, stops }, result: null })),
  setFleet: (fleet) => set((state) => ({ planner: { ...state.planner, fleet }, result: null })),
}));
