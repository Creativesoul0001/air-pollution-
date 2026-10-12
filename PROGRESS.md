# Project Progress — Dhuan Detective

Legend: ✅ implemented & verified · ⚠️ implemented but blocked on credentials/external access · ❌ not implemented

## Priorities

| # | Item | Status |
|---|------|--------|
| P1 | Clean, light, readable map (no dark overlay) | ✅ |
| P2 | Genuine pollution observations (ground stations) | ⚠️ |
| P3 | Evidence-based source investigation | ✅ |
| P4 | Action tracking + verification | ✅ |
| P5 | Validate, test, document | ✅ |
| P6 | Validated PM2.5 model (ML) | ✅ |

## Verified live in this environment

- **19,544** real indexed Delhi NCR locations (OpenStreetMap, deduplicated) and **300** real PM2.5 observations ingested.
- **36,600 real hourly air + weather samples** (25 sample locations × 60 days) collected from Open-Meteo archives and used to train and validate a PM2.5 model.
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
backend/.venv/Scripts/python.exe -m pytest     # 69 passed
cd frontend && npm run test:unit               # 49 passed
cd frontend && npm run build                   # success
```

## P6 — Validated PM2.5 model ✅

Two candidate models were trained on the real dataset and **both were validated with
leave-one-location-out (LOSO)**; the lower-error model is served and both are reported.

| Candidate | LOSO RMSE (µg/m³) | LOSO MAE | LOSO R² | Verdict |
|---|---|---|---|---|
| Ridge regression (26 features, log-PM2.5) | 67.4 | 59.9 | **−3.65** | rejected — worse than a mean baseline |
| **IDW interpolation between real observations** | **10.9** | 6.9 | **+0.878** | **selected & served** |

The ridge result is reported honestly: extrapolating to unseen locations from weather alone
does not work in a spatially homogeneous basin. IDW between real observation points does.

- Dataset: 36,600 hourly rows, 25 sample locations (0.15° grid), 60 days, from the
  Open-Meteo archive (air-quality + weather APIs). Target is `log1p(pm2_5)`.
- Features (26): spatial normalisation, cyclical hour/day-of-week/day-of-year, wind u/v,
  wind speed, gusts, temperature, humidity, dew point, boundary-layer height, cloud,
  precipitation, pressure, and the coincident pollutants PM10/NO₂/SO₂/O₃/CO/AOD.
- Uncertainty is an **empirical residual-quantile band** from the same LOSO run
  (`p10/p50/p90`), explicitly not a full predictive posterior.
- Endpoints: `GET /api/v1/model/metrics` (both candidates + selection note),
  `GET /api/v1/model/estimate?lat&lon`, `GET /api/v1/model/grid`, `GET /api/v1/model/coverage`.
- Every response is tagged `is_model_estimate: true` with provenance and validation error, so
  it can never be read as a measurement.
- Grid surface defaults to **0.05°** — finer than the 0.15° training grid — so cells are
  genuinely interpolated (195 cells, 168 distinct values) rather than echoed back.
- Cells beyond every donor within the model radius are omitted (`skipped_outside_radius`)
  rather than extrapolated, with a documented caveat.
- `locations_with_model_estimates` now counts **unique (lat, lon) pairs = 25**, not distinct
  latitudes (which would have wrongly reported 5).
- Frontend: a Model-estimate card with the p10/p50/p90 band and validation error, a
  **Model risk surface** map layer, and real model coverage in the coverage cards/Analytics.

Reproduce with: `cd backend && python -m app.ml.train --days 60 --grid-step 0.15`
