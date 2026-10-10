import { useEffect, useRef, useState } from "react";
import { fetchEstimate } from "@/lib/api";
import { SAMPLE_RESPONSE } from "@/lib/sample";
import type { EstimateResponse } from "@/lib/types";

interface State {
  data: EstimateResponse;
  loading: boolean;
  error: string | null;
  usingSample: boolean;
}

export function useEstimate(lat: number, lon: number, lang: "en" | "hi") {
  const [state, setState] = useState<State>({
    data: SAMPLE_RESPONSE,
    loading: true,
    error: null,
    usingSample: true,
  });
  const [nonce, setNonce] = useState(0);
  const reqId = useRef(0);

  useEffect(() => {
    const id = ++reqId.current;
    const ctrl = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    fetchEstimate(lat, lon, lang, ctrl.signal).then((res) => {
      if (id !== reqId.current) return; // stale
      if (res.ok) {
        setState({ data: res.data, loading: false, error: null, usingSample: false });
      } else {
        setState({
          data: SAMPLE_RESPONSE,
          loading: false,
          error: res.error,
          usingSample: true,
        });
      }
    });
    return () => ctrl.abort();
  }, [lat, lon, lang, nonce]);

  const reload = () => setNonce((n) => n + 1);
  return { ...state, reload };
}
