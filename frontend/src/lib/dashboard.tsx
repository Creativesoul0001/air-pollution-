"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_COORD } from "./constants";
import { fetchAirQuality, fetchLocationDetail, fetchWeather } from "./api";
import { useLocationStats } from "@/hooks/useLocationStats";
import type { AirCurrent, LocationDetail, LocationResult, LocationStats, WeatherCurrent } from "./types";

export type View = "map" | "investigate" | "actions" | "analytics" | "sources" | "about";

interface DashboardValue {
  coord: { lat: number; lon: number };
  setCoord: (c: { lat: number; lon: number }) => void;
  selected: LocationResult | null;
  selectLocation: (r: LocationResult) => void;
  clearSelection: () => void;
  view: View;
  setView: (v: View) => void;
  lang: "en" | "hi";
  setLang: (l: "en" | "hi") => void;
  air: AirCurrent | null;
  weather: WeatherCurrent | null;
  detail: LocationDetail | null;
  loadingAir: boolean;
  loadingWeather: boolean;
  errorAir: string | null;
  errorWeather: string | null;
  refresh: () => void;
  stats: LocationStats | null;
  statsLoading: boolean;
  statsError: string | null;
}

const Ctx = createContext<DashboardValue | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [coord, setCoord] = useState(DEFAULT_COORD);
  const [selected, setSelected] = useState<LocationResult | null>(null);
  const [view, setView] = useState<View>("map");
  const [lang, setLang] = useState<"en" | "hi">("en");

  const [air, setAir] = useState<AirCurrent | null>(null);
  const [weather, setWeather] = useState<WeatherCurrent | null>(null);
  const [detail, setDetail] = useState<LocationDetail | null>(null);
  const [loadingAir, setLoadingAir] = useState(true);
  const [loadingWeather, setLoadingWeather] = useState(true);
  const [errorAir, setErrorAir] = useState<string | null>(null);
  const [errorWeather, setErrorWeather] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const { stats, loading: statsLoading, error: statsError } = useLocationStats();

  useEffect(() => {
    const c = new AbortController();
    setLoadingAir(true);
    setLoadingWeather(true);
    fetchAirQuality(coord.lat, coord.lon, c.signal).then((r) => {
      if (c.signal.aborted) return;
      setLoadingAir(false);
      if (r.ok) {
        setAir(r.data);
        setErrorAir(null);
      } else {
        setAir(null);
        setErrorAir(r.error);
      }
    });
    fetchWeather(coord.lat, coord.lon, c.signal).then((r) => {
      if (c.signal.aborted) return;
      setLoadingWeather(false);
      if (r.ok) {
        setWeather(r.data);
        setErrorWeather(null);
      } else {
        setWeather(null);
        setErrorWeather(r.error);
      }
    });
    return () => c.abort();
  }, [coord.lat, coord.lon, nonce]);

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }
    const c = new AbortController();
    fetchLocationDetail(selected.id, c.signal).then((r) => {
      if (c.signal.aborted) return;
      setDetail(r.ok ? r.data : null);
    });
    return () => c.abort();
  }, [selected]);

  const selectLocation = useCallback((r: LocationResult) => {
    setSelected(r);
    setCoord({ lat: r.lat, lon: r.lon });
    setView("map");
  }, []);
  const clearSelection = useCallback(() => setSelected(null), []);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  const value = useMemo<DashboardValue>(
    () => ({
      coord,
      setCoord,
      selected,
      selectLocation,
      clearSelection,
      view,
      setView,
      lang,
      setLang,
      air,
      weather,
      detail,
      loadingAir,
      loadingWeather,
      errorAir,
      errorWeather,
      refresh,
      stats,
      statsLoading,
      statsError,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [coord, selected, view, lang, air, weather, detail, loadingAir, loadingWeather, errorAir, errorWeather, stats, statsLoading, statsError]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDashboard(): DashboardValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDashboard must be used within a DashboardProvider");
  return v;
}
