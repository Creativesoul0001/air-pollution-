import { useCallback, useEffect, useState } from "react";
import { fetchModelEstimate } from "@/lib/api";
import type { ModelEstimate } from "@/lib/types";

export function useModelEstimate(lat: number, lon: number, enabled = true) {
  const [data, setData] = useState<ModelEstimate | null>(null);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setData(null);
      setUnavailable(false);
      return;
    }
    const c = new AbortController();
    setLoading(true);
    setUnavailable(false);
    fetchModelEstimate(lat, lon, c.signal).then((r) => {
      if (c.signal.aborted) return;
      setLoading(false);
      if (r.ok && r.data.pm25_p50 != null) setData(r.data);
      else {
        setData(null);
        setUnavailable(true);
      }
    });
    return () => c.abort();
  }, [lat, lon, enabled, nonce]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);
  return { data, loading, unavailable, refresh };
}
