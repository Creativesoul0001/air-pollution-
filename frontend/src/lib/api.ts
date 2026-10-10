import type {
  AirCurrent,
  EstimateResponse,
  LocationDetail,
  LocationResult,
  LocationStats,
  ObsPoint,
  PointRow,
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
