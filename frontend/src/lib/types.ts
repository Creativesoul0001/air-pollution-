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
