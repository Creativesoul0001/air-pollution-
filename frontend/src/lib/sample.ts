import type { EstimateResponse } from "./types";

/**
 * Fixed sample payload shown ONLY when the backend is unreachable.
 * The UI always labels this as "sample data"; it is never presented as a live reading.
 */
export const SAMPLE_RESPONSE: EstimateResponse = {
  location: { lat: 28.6315, lon: 77.2167 },
  pm25_p10: 171.2,
  pm25_p50: 198.6,
  pm25_p90: 231.4,
  aqi_category: "veryPoor",
  nearest_station: { name: "Connaught Place (CPCB)", distance_km: 0.8, pm25: 205 },
  attribution: {
    attribution_available: true,
    likely_contributors: [
      { type: "construction", name: "Central Vista Project", distance_km: 1.2, bearing_deg: 210, confidence: "medium" },
      { type: "landfill", name: "Ghazipur Landfill", distance_km: 9.4, bearing_deg: 95, confidence: "low" },
    ],
  },
  advice: {
    parent: "Sample: keep windows closed until ~6 PM; prefer the covered metro walk.",
    rider: "Sample: wind from the NW at 8 km/h — exposure lowest on southbound lanes this hour.",
    worker: "Sample: wear an N95 and take a 10-minute shaded break each hour.",
  },
  agent_trace: [
    { step: 1, tool: "get_weather", result: "8 km/h NW, BLH 480 m" },
    { step: 2, tool: "query_upwind_sources", result: "3 sources within 5 km cone" },
    { step: 3, tool: "get_fire_detections", result: "0 detections in 30 km" },
  ],
  generated_at: "2026-10-07T18:05:12Z",
  wind: { dir_deg: 305, speed_kmh: 8 },
};
