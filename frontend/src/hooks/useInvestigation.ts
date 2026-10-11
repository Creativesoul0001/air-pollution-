import { useCallback, useEffect, useState } from "react";
import { fetchInvestigation } from "@/lib/api";
import type { Investigation } from "@/lib/types";

export function useInvestigation(lat: number, lon: number) {
  const [data, setData] = useState<Investigation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const c = new AbortController();
    setLoading(true);
    setError(null);
    fetchInvestigation(lat, lon, c.signal).then((r) => {
      if (c.signal.aborted) return;
      if (r.ok) setData(r.data);
      else {
        setData(null);
        setError(r.error);
      }
      setLoading(false);
    });
    return () => c.abort();
  }, [lat, lon, nonce]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);
  return { data, loading, error, refresh };
}
