// Deterministic fictional test data; coordinates are approximate map anchors, not real customer addresses.
export const DEMO_INSTANCE = Object.freeze({
  id: "demo-ludhiana-2026",
  name: "Ludhiana north delivery loop",
  region: "Ludhiana · Punjab",
  depot: {
    id: "depot-demo-01",
    label: "RouteCraft Depot",
    address: "Synthetic demo depot",
    lat: 30.9004,
    lng: 75.8573,
  },
  fleet: { vehicles: 3, capacity: 95, averageSpeedKmh: 28 },
  stops: [
    { id: "ST-101", label: "Model Town Market", address: "Synthetic demo location 01", lat: 30.8897, lng: 75.8465, demand: 14, serviceMinutes: 6, timeWindow: { start: 510, end: 1020 } },
    { id: "ST-102", label: "Sarabha Nagar Point", address: "Synthetic demo location 02", lat: 30.8891, lng: 75.8711, demand: 21, serviceMinutes: 8, timeWindow: { start: 510, end: 1020 } },
    { id: "ST-103", label: "BRS Nagar Hub", address: "Synthetic demo location 03", lat: 30.9126, lng: 75.8558, demand: 18, serviceMinutes: 7, timeWindow: { start: 510, end: 1020 } },
    { id: "ST-104", label: "Ferozepur Road Stop", address: "Synthetic demo location 04", lat: 30.8953, lng: 75.8828, demand: 16, serviceMinutes: 6, timeWindow: { start: 510, end: 1020 } },
    { id: "ST-105", label: "Ghumar Mandi Point", address: "Synthetic demo location 05", lat: 30.9146, lng: 75.8488, demand: 23, serviceMinutes: 8, timeWindow: { start: 510, end: 1020 } },
    { id: "ST-106", label: "Dugri Market", address: "Synthetic demo location 06", lat: 30.8769, lng: 75.8589, demand: 19, serviceMinutes: 7, timeWindow: { start: 510, end: 1020 } },
    { id: "ST-107", label: "Civil Lines Point", address: "Synthetic demo location 07", lat: 30.9227, lng: 75.8399, demand: 15, serviceMinutes: 6, timeWindow: { start: 510, end: 1020 } },
    { id: "ST-108", label: "Pakhowal Road Hub", address: "Synthetic demo location 08", lat: 30.8825, lng: 75.8378, demand: 17, serviceMinutes: 7, timeWindow: { start: 510, end: 1020 } },
    { id: "ST-109", label: "Haibowal Stop", address: "Synthetic demo location 09", lat: 30.9361, lng: 75.8551, demand: 22, serviceMinutes: 8, timeWindow: { start: 510, end: 1020 } },
    { id: "ST-110", label: "Sukhdev Nagar Point", address: "Synthetic demo location 10", lat: 30.9069, lng: 75.8796, demand: 16, serviceMinutes: 6, timeWindow: { start: 510, end: 1020 } },
    { id: "ST-111", label: "Gill Road Market", address: "Synthetic demo location 11", lat: 30.8727, lng: 75.8442, demand: 18, serviceMinutes: 7, timeWindow: { start: 510, end: 1020 } },
    { id: "ST-112", label: "Rishi Nagar Point", address: "Synthetic demo location 12", lat: 30.9306, lng: 75.8704, demand: 14, serviceMinutes: 6, timeWindow: { start: 510, end: 1020 } },
    { id: "ST-113", label: "Model Gram Hub", address: "Synthetic demo location 13", lat: 30.8958, lng: 75.8298, demand: 20, serviceMinutes: 8, timeWindow: { start: 510, end: 1020 } },
    { id: "ST-114", label: "Civil City Market", address: "Synthetic demo location 14", lat: 30.9221, lng: 75.8794, demand: 13, serviceMinutes: 6, timeWindow: { start: 510, end: 1020 } },
  ],
  createdAt: "2026-10-11T00:00:00.000Z",
});

export function getDemoInstance() {
  return structuredClone(DEMO_INSTANCE);
}
