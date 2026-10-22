import axios from "axios";

let accessToken = null;
export const apiClient = axios.create({ baseURL: "/api", withCredentials: true, timeout: 15000, headers: { "Content-Type": "application/json" } });

apiClient.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

let refreshing = null;
apiClient.interceptors.response.use((response) => response, async (error) => {
  const original = error.config;
  if (error.response?.status === 401 && !original?._retried && !original?.url?.includes("/auth/")) {
    original._retried = true;
    try {
      refreshing ??= apiClient.post("/auth/refresh").then(({ data }) => {
        accessToken = data.accessToken;
        return data.accessToken;
      }).finally(() => { refreshing = null; });
      const token = await refreshing;
      original.headers.Authorization = `Bearer ${token}`;
      return apiClient(original);
    } catch {
      accessToken = null;
    }
  }
  return Promise.reject(error);
});

export const authApi = {
  async login(payload) { const { data } = await apiClient.post("/auth/login", payload); accessToken = data.accessToken; return data.user; },
  async signup(payload) { const { data } = await apiClient.post("/auth/signup", payload); accessToken = data.accessToken; return data.user; },
  async logout() { try { await apiClient.post("/auth/logout"); } finally { accessToken = null; } },
  async me() { const { data } = await apiClient.get("/auth/me"); return data.user; },
  async restore() { const { data } = await apiClient.post("/auth/refresh"); accessToken = data.accessToken; return data.user; },
};

export const api = {
  async health() { const { data } = await apiClient.get("/health"); return data; },
  async planner() { const { data } = await apiClient.get("/planner"); return data; },
  async algorithms() { const { data } = await apiClient.get("/algorithms"); return data.algorithms; },
  async createStop(stop) { const { data } = await apiClient.post("/stops", stop); return data.stop; },
  async deleteStop(id) { await apiClient.delete(`/stops/${encodeURIComponent(id)}`); },
  async importStops(csv) { const { data } = await apiClient.post("/stops/import", { csv }); return data; },
  async updateFleet(fleet) { const { data } = await apiClient.put("/fleet", fleet); return data.fleet; },
  async optimize(payload) { const { data } = await apiClient.post("/optimizations", payload); return data; },
  async job(id) { const { data } = await apiClient.get(`/optimizations/${id}`); return data; },
  async compare(payload) { const { data } = await apiClient.post("/compare", payload); return data.results; },
  async compareShortestPaths(payload) { const { data } = await apiClient.post("/scenario/compare-shortest", payload); return data; },
  async runs() { const { data } = await apiClient.get("/runs"); return data.runs; },
  async benchmarks() { const { data } = await apiClient.get("/benchmarks"); return data.results; },
  async runBenchmarks(payload) { const { data } = await apiClient.post("/benchmarks/run", payload, { timeout: 120000 }); return data; },
};

export const tokenStorage = {
  get() { return accessToken; },
  set(token) { accessToken = token; },
  clear() { accessToken = null; },
};
