import { create } from "zustand";
import { DEMO_INSTANCE } from "@courier/algorithms";

const demo = structuredClone(DEMO_INSTANCE);

export const usePlannerStore = create((set, get) => ({
  page: "planner",
  planner: { depot: demo.depot, stops: demo.stops, fleet: demo.fleet, demoMode: true, algorithms: [] },
  algorithm: "combined",
  result: null,
  comparison: null,
  selectedRoute: null,
  running: false,
  progressText: "",
  history: [],
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
  addStop: (stop) => set((state) => ({ planner: { ...state.planner, stops: [...state.planner.stops, stop] }, result: null })),
  removeStop: (id) => set((state) => ({ planner: { ...state.planner, stops: state.planner.stops.filter((stop) => stop.id !== id) }, result: null })),
  setStops: (stops) => set((state) => ({ planner: { ...state.planner, stops }, result: null })),
  setFleet: (fleet) => set((state) => ({ planner: { ...state.planner, fleet }, result: null })),
}));
