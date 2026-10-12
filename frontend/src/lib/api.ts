import type {
  ActionRecord,
  AirCurrent,
  EstimateResponse,
  GroundResult,
  Investigation,
  LocationDetail,
  LocationResult,
  LocationStats,
  ModelEstimate,
  ModelGrid,
  ModelInfo,
  ObsPoint,
  PointRow,
  VerificationRecord,
  WeatherCurrent,
} from "./types";

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const TIMEOUT_MS = 10000;

async function getJson<T>(url: string, signal?: AbortSignal): Promise<Result<T>> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener("abort", onAbort);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true, data: (await res.json()) as T };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

export function fetchEstimate(
  lat: number,
  lon: number,
  lang: "en" | "hi" = "en",
  signal?: AbortSignal
): Promise<Result<EstimateResponse>> {
  return getJson(`/api/v1/estimate?lat=${lat}&lon=${lon}&lang=${lang}`, signal);
}

export function fetchLocationStats(signal?: AbortSignal): Promise<Result<LocationStats>> {
  return getJson("/api/v1/locations/stats", signal);
}

export function searchLocations(
  q: string,
  signal?: AbortSignal
): Promise<Result<{ query: string; count: number; results: LocationResult[] }>> {
  return getJson(`/api/v1/locations/search?q=${encodeURIComponent(q)}&limit=8`, signal);
}

export function fetchAirQuality(lat: number, lon: number, signal?: AbortSignal): Promise<Result<AirCurrent>> {
  return getJson(`/api/v1/airquality/current?lat=${lat}&lon=${lon}`, signal);
}

export function fetchWeather(lat: number, lon: number, signal?: AbortSignal): Promise<Result<WeatherCurrent>> {
  return getJson(`/api/v1/weather/current?lat=${lat}&lon=${lon}`, signal);
}

export function fetchPoints(
  categories: string[],
  limit = 600,
  signal?: AbortSignal
): Promise<Result<{ count: number; points: PointRow[] }>> {
  return getJson(
    `/api/v1/locations/points?categories=${encodeURIComponent(categories.join(","))}&limit=${limit}`,
    signal
  );
}

export function fetchLocationDetail(
  id: number,
  signal?: AbortSignal
): Promise<Result<LocationDetail>> {
  return getJson(`/api/v1/locations/${id}`, signal);
}

export function fetchObservationPoints(
  limit = 1000,
  signal?: AbortSignal
): Promise<Result<{ count: number; points: ObsPoint[] }>> {
  return getJson(`/api/v1/locations/observations/points?limit=${limit}`, signal);
}

export function fetchInvestigation(
  lat: number,
  lon: number,
  signal?: AbortSignal
): Promise<Result<Investigation>> {
  return getJson(`/api/v1/investigate?lat=${lat}&lon=${lon}`, signal);
}

export function fetchStations(lat: number, lon: number, signal?: AbortSignal): Promise<Result<GroundResult>> {
  return getJson(`/api/v1/stations?lat=${lat}&lon=${lon}`, signal);
}

export function fetchActions(
  status?: string,
  signal?: AbortSignal
): Promise<Result<{ count: number; total: number; results: ActionRecord[] }>> {
  const q = status ? `?status=${encodeURIComponent(status)}` : "";
  return getJson(`/api/v1/actions${q}`, signal);
}

export function fetchAction(id: number, signal?: AbortSignal): Promise<Result<ActionRecord>> {
  return getJson(`/api/v1/actions/${id}`, signal);
}

export type MutResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string; detail?: unknown };

async function mutate<T>(url: string, method: string, body: unknown, actor?: string): Promise<MutResult<T>> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(actor ? { "X-Actor": actor } : {}),
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (res.status === 204) return { ok: true, data: undefined as T };
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: typeof payload?.detail === "string" ? payload.detail : `HTTP ${res.status}`,
        detail: payload?.detail,
      };
    }
    return { ok: true, data: payload as T };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : "Network error" };
  } finally {
    clearTimeout(timer);
  }
}

export function createAction(body: Record<string, unknown>, actor?: string) {
  return mutate<ActionRecord>("/api/v1/actions", "POST", body, actor);
}

export function transitionAction(id: number, toStatus: string, actor?: string) {
  return mutate<ActionRecord>(`/api/v1/actions/${id}/transition`, "POST", { to_status: toStatus }, actor);
}

export function assignAction(id: number, assignee: string, actor?: string) {
  return mutate<ActionRecord>(`/api/v1/actions/${id}/assign`, "POST", { assignee }, actor);
}

export function verifyAction(id: number, body: Record<string, unknown>, actor?: string) {
  return mutate<VerificationRecord>(`/api/v1/actions/${id}/verify`, "POST", body, actor);
}

export function fetchModelMetrics(signal?: AbortSignal): Promise<Result<ModelInfo>> {
  return getJson("/api/v1/model/metrics", signal);
}

export function fetchModelEstimate(
  lat: number,
  lon: number,
  signal?: AbortSignal
): Promise<Result<ModelEstimate>> {
  return getJson(`/api/v1/model/estimate?lat=${lat}&lon=${lon}`, signal);
}

export function fetchModelGrid(
  resolution = 0.05,
  signal?: AbortSignal
): Promise<Result<ModelGrid>> {
  return getJson(`/api/v1/model/grid?resolution=${resolution}&limit=400`, signal);
}
