# Skill: Delhi Air Quality Attribution

## Description
Given a location in Delhi, produce a street-level PM2.5 estimate with uncertainty, find upwind pollution sources, attribute the likely cause via a reasoning agent, and generate personalized advice.

## Inputs
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `lat` | number | yes | -90..90 |
| `lon` | number | yes | -180..180 |
| `lang` | enum | no | `en` (default) or `hi` |
| `user_profile` | enum | no | `parent`, `rider`, `worker`, `generic` (default) |
| `time_window_hours` | int | no | Attribution lookback, default 3 |

## Process
1. **Estimate.** Look up cached grid estimate in DynamoDB (`grid_id#YYYYMMDDHH`). On miss, run batch/grid inference via the model service; return quantiles `p10/p50/p90`.
2. **Wind.** Fetch latest boundary-layer wind vector (Open-Meteo). Compute upwind bearing.
3. **Sources.** Query OpenSearch `pollution_sources` with a `geo_distance` (5 km) filter, then keep sources within the upwind cone (bearing within +/-60 of the reverse wind vector).
4. **Fires.** Query recent NASA FIRMS detections within 30 km in the same window.
5. **Attribution.** Invoke the Strands attribution agent with tools: `get_air_quality`, `get_weather`, `query_upwind_sources`, `get_fire_detections`. Capture the real tool-call trace.
6. **Advice.** Pass attribution summary to the advice agent to render per-profile text in the requested language.

## Outputs
```json
{
  "pm25_estimate": 87.4,
  "pm25_uncertainty": { "p10": 74.1, "p90": 102.3 },
  "aqi_category": "poor",
  "nearest_station": { "name": "RK Puram", "distance_km": 2.4, "pm25": 92 },
  "attribution": {
    "likely_contributors": [
      { "type": "landfill", "name": "Ghazipur", "distance_km": 3.1, "bearing_deg": 305, "confidence": "medium" }
    ]
  },
  "advice": {
    "parent": "Keep windows closed until ~6 PM; ...",
    "rider": "Wind is from the NW at 8 km/h; ...",
    "worker": "..."
  },
  "agent_trace": [
    { "tool": "get_weather", "result": "8 km/h NW" },
    { "tool": "query_upwind_sources", "result": "3 sources in cone" }
  ]
}
```

## Invariants
- Never omit the uncertainty range.
- Use "likely contributor" + confidence; never "confirmed".
- If the agent or a dependency fails, return 503 with `Retry-After` and a partial (estimate-only) payload flagged `attribution_available: false` — never fabricate causes.
- The `agent_trace` must be the actual sequence of tool invocations, serialized in order.
