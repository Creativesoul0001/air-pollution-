import { useEffect, useState } from "react";
import { fetchLocationStats } from "@/lib/api";
import type { LocationStats } from "@/lib/types";

export function useLocationStats() {
  const [stats, setStats] = useState<LocationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchLocationStats(ctrl.signal).then((r) => {
      if (ctrl.signal.aborted) return;
      if (r.ok) {
        setStats(r.data);
        setError(null);
      } else {
        setStats(null);
        setError(r.error);
      }
      setLoading(false);
    });
    return () => ctrl.abort();
  }, []);

  return { stats, loading, error };
}
