import type { EstimateResponse } from "./types";

export type FetchResult =
  | { ok: true; data: EstimateResponse; source: "backend" }
  | { ok: false; error: string };

export async function fetchEstimate(
  lat: number,
  lon: number,
  lang: "en" | "hi" = "en",
  signal?: AbortSignal
): Promise<FetchResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener("abort", onAbort);
  try {
    const res = await fetch(
      `/api/v1/estimate?lat=${lat}&lon=${lon}&lang=${lang}`,
      { signal: ctrl.signal, headers: { Accept: "application/json" } }
    );
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = (await res.json()) as EstimateResponse;
    return { ok: true, data, source: "backend" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network error";
    return { ok: false, error: msg };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}
