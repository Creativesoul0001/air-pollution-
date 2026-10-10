export type Confidence = "low" | "medium" | "high";

export interface AttributionContributor {
  type: string;
  name: string;
  distance_km: number;
  bearing_deg: number;
  confidence: Confidence;
}

export interface EstimateResponse {
  location: { lat: number; lon: number };
  pm25_p10: number;
  pm25_p50: number;
  pm25_p90: number;
  aqi_category: string;
  nearest_station: { name: string; distance_km: number; pm25: number } | null;
  attribution: {
    attribution_available: boolean;
    likely_contributors: AttributionContributor[];
  };
  advice: { parent: string; rider: string; worker: string };
  agent_trace: { step: number; tool: string; result: string }[];
  generated_at: string;
  wind?: { dir_deg: number; speed_kmh: number } | null;
}

export type Profile = "parent" | "rider" | "worker";

export interface LocationStats {
  bbox: { south: number; west: number; north: number; east: number };
  total_locations: number;
  locations_with_observations: number;
  locations_with_model_estimates: number;
  cities: string[];
  administrative_areas: string[];
  by_category: Record<string, number>;
  sources: { locations: string; observations: string };
  last_update: string | null;
  status: "ok" | "empty";
}

export interface LocationResult {
  id: number;
  name: string;
  category: string;
  lat: number;
  lon: number;
  city: string | null;
  has_observation: boolean;
}

export interface AirCurrent {
  status: string;
  location: { lat: number; lon: number };
  time: string;
  pollutants: Record<string, number | null>;
  provider: string;
  units: Record<string, string>;
}

export interface WeatherCurrent {
  status: string;
  location: { lat: number; lon: number };
  time: string;
  wind_speed_kmh: number | null;
  wind_direction_deg: number | null;
  temperature_c: number | null;
  humidity_pct: number | null;
  provider: string;
}

export interface PointRow {
  id: number;
  name: string;
  category: string;
  lat: number;
  lon: number;
}

export interface ObsPoint {
  id: number;
  name: string;
  lat: number;
  lon: number;
  value: number;
  pollutant: string;
  observed_at: string;
}

export interface LocationDetail {
  id: number;
  name: string;
  category: string;
  lat: number;
  lon: number;
  city: string | null;
  attribution: string;
  latest_observation: { pollutant: string; value: number; source: string; observed_at: string } | null;
}
