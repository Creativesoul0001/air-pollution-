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

/* ------------------------- Investigation (evidence) ------------------------- */
export interface SourceFact {
  type: string;
  label: string;
  name: string | null;
  lat: number;
  lon: number;
  distance_km: number;
  bearing_deg: number | null;
  upwind: boolean | null;
  bearing_off_wind_deg?: number | null;
  plausibility: "low" | "medium" | "high";
  pollutants: string[];
  osm_type: string;
  osm_id: string;
  osm_url: string;
}

export interface Hypothesis {
  confidence: "low" | "medium" | "high";
  score: number;
  source: SourceFact;
  supporting_evidence: string[];
  contradicting_evidence: string[];
  uncertainty: string[];
}

export interface GroundReading {
  pollutant: string;
  value: number;
  unit: string;
}

export interface GroundStation {
  station: string;
  network: string;
  lat: number;
  lon: number;
  distance_km: number;
  timestamp: string | null;
  readings: GroundReading[];
  provenance: {
    type: string;
    source: string;
    url?: string | null;
    attributions?: { name: string; url: string }[];
  };
}

export interface GroundResult {
  status: "ok" | "unavailable";
  count: number;
  stations: GroundStation[];
  attempts: string[];
  note: string | null;
}

export interface Investigation {
  location: { lat: number; lon: number };
  status: "ok" | "unavailable";
  generated_reasons: string[];
  unavailable_reasons: string[];
  wind: { wind_direction_deg: number | null; wind_speed_kmh: number | null; time: string } | null;
  model_context: {
    kind: string;
    provider: string;
    time: string;
    pollutants: Record<string, number | null>;
  } | null;
  ground: GroundResult | null;
  sources_provenance: string | null;
  sources_radius_km: number | null;
  hypotheses: Hypothesis[];
  caution: string;
}

/* ------------------------------ Action tracking ----------------------------- */
export interface ActionEventRecord {
  id: number;
  event_type: string;
  actor: string;
  from_status: string | null;
  to_status: string | null;
  note: string | null;
  data: Record<string, unknown> | null;
  created_at: string | null;
}

export interface VerificationRecord {
  id: number;
  pollutant: string;
  units: string;
  before: { value: number | null; time: string | null; provenance: string | null };
  after: { value: number | null; time: string | null; provenance: string | null };
  conclusion: "measured_delta" | "insufficient_evidence";
  delta: number | null;
  pct_change: number | null;
  evidence_note: string;
  actor: string;
  created_at: string | null;
  note: string | null;
}

export interface ActionRecord {
  id: number;
  title: string;
  description: string | null;
  category: string;
  status: string;
  assignee: string | null;
  location_name: string | null;
  lat: number | null;
  lon: number | null;
  source_osm_id: string | null;
  created_by: string;
  allowed_transitions: string[];
  created_at: string | null;
  updated_at: string | null;
  events?: ActionEventRecord[];
  verifications?: VerificationRecord[];
}
