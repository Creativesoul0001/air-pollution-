import { useCallback, useEffect, useState } from "react";
import { fetchStations } from "@/lib/api";
import type { GroundResult } from "@/lib/types";

export function useStations(lat: number, lon: number, enabled = true) {
  const [data, setData] = useState<GroundResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setData(null);
      return;
    }
    const c = new AbortController();
    setLoading(true);
    setError(null);
    fetchStations(lat, lon, c.signal).then((r) => {
      if (c.signal.aborted) return;
      if (r.ok) setData(r.data);
      else {
        setData(null);
        setError(r.error);
      }
      setLoading(false);
    });
    return () => c.abort();
  }, [lat, lon, enabled, nonce]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);
  return { data, loading, error, refresh };
}
