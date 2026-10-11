# Project Progress — Dhuan Detective

Legend: ✅ implemented & verified · ⚠️ implemented but blocked on credentials/external access · ❌ not implemented

## Priorities

| # | Item | Status |
|---|------|--------|
| P1 | Clean, light, readable map (no dark overlay) | ✅ |
| P2 | Genuine pollution observations (ground stations) | ⚠️ |
| P3 | Evidence-based source investigation | ✅ |
| P4 | Action tracking + verification | ✅ |
| P5 | Verify, test, document | ✅ |

## Verified live in this environment

- **19,544** real indexed Delhi NCR locations (OpenStreetMap, deduplicated) and **300** real PM2.5 observations ingested.
- Live PM2.5 / PM10 / NO₂ / SO₂ / O₃ / CO and wind for any coordinate (Open-Meteo, keyless).
- Investigation returns **real ranked hypotheses** from real OSM sources + real wind, with supporting and contradicting evidence, uncertainty, and an explicit no-causation caution.
  - Live example: at Connaught Place, wind 72° @ 9.3 km/h; top hypothesis = mapped major road *Outer Circle* (0.38 km, upwind, medium confidence).
- Action lifecycle: create → authorized transition → illegal transition rejected with **422 + allowed list** → assignment → verification (**measured_delta −50 / −25%** with provenance, **insufficient_evidence** without) → append-only audit history.
- Tests: **backend 50 passed**, **frontend 39 passed**, `next build` succeeds.

## P1 — Map readability

- Light OpenStreetMap raster tiles; the dark overlay (`raster-brightness-max`/`saturation`/`contrast`) was removed, so state boundaries, city labels, major/local roads, parks and water bodies are clearly distinguishable.
- Attribution, zoom, locate-me, fullscreen, scale bar, layer toggles, search → map all preserved.
- Tiles remain keyless with correct attribution (verified `200 image/png`).

## P2 — Ground monitoring (why it is *unavailable*)

A real adapter exists (`app/pipeline/ground.py`) and reports `unavailable` rather than fabricating data. Verified from this environment:

| Source | Result |
|--------|--------|
| CPCB portals (`airquality.cpcb.gov…`, `app.cpcbccr.com`) | unreachable / 404 |
| WAQI (`api.waqi.info`) | requires a personal token; the demo token returns unrelated stations and no readings |
| OpenAQ v3 | `401 Unauthorized` |
| Sensor.Community | open/keyless, but **0 sensors in India** (667 in Berlin — endpoint works) |

To enable real station data, set `WAQI_TOKEN` in `.env` (free token from aqicn.org/data). Until then the UI shows "No ground station readings reachable", and model estimates are always labelled as model, never as station readings.

## P3 — Investigation (implemented)

- Real inputs: live wind (Open-Meteo), mapped sources (OSM/Overpass), ground readings where reachable, model air-quality for context.
- Per hypothesis: distance, bearing, upwind alignment (±45°), emission plausibility, and a transparent confidence score.
- Outputs supporting evidence, contradicting evidence, and uncertainty. If wind or sources are missing, the API returns `status: "unavailable"` with reasons.
- Causation language is guarded against in both backend text and frontend tests (`hasCausalLanguage`).

## P4 — Action tracking (implemented)

- SQLite tables `actions`, `action_events` (append-only audit), `action_verifications`.
- Authorized transition graph enforced server-side; illegal transitions → `422` with the allowed list.
- Before/after verification computes a delta **only** when both measurements and their provenance are supplied; otherwise `insufficient_evidence`.
- Model estimates are never used as the "after" measurement by this flow.

## Still requires credentials or external access

| Item | What is needed |
|------|----------------|
| CPCB / WAQI ground stations | `WAQI_TOKEN` |
| Full authentication | Cognito wiring (currently `X-Actor` is a demo identity, recorded in the audit trail) |
| Validated spatial risk map / dispersion model | Not implemented |
| Model-based PM2.5 estimates | Not deployed (`locations_with_model_estimates = 0`) |

## Test suites

```
backend/.venv/Scripts/python.exe -m pytest     # 50 passed
cd frontend && npm run test:unit               # 39 passed
cd frontend && npm run build                   # success
```
