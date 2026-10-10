# Master Engineering Brief — Dhuan Detective

This is the canonical build brief for Dhuan Detective. Deep detail lives in [`docs/`](docs/);
this file states the *what*, the *why*, and the *non-negotiables*.

## North star
Answer any Delhi resident's real question: **"Why is the air bad on my street right now, and what should I do?"** — using real data, an honest uncertainty range, and an AWS Strands Agent that shows its reasoning. Judges reward a small problem solved well with evidence, not a big one solved vaguely.

## AWS services and the real work each one does
| Service | Role |
|---------|------|
| **Strands Agents SDK** | Reasoning core — source-attribution agent + advice agent |
| **Amazon OpenSearch** | Geo-indexed database of pollution sources; upwind-cone queries |
| **Step Functions** | Hourly pipeline: ingest → validate → model update → grid estimate → alerts |
| **EventBridge** | Hourly schedule + custom event bus for alerts |
| **SNS** | Threshold alerts to subscribers (schools, RWAs, riders) |
| **Lambda + API Gateway** | API handlers + WebSocket for realtime map updates |
| **S3** | Data lake (stations/weather/fires/OSM), model artifacts, private photos |
| **DynamoDB** | Cached estimates, subscriptions, reports, agent traces |
| **SageMaker** | Train/serve the PM2.5 model (leave-one-station-out validated) |
| **Amazon Location** | Geocoding (search), map tiles, routes |
| **Cognito** | User auth for subscriptions/reports |
| **Cedar** (stretch) | Fine-grained authz (users see only their own data) |
| **CloudFront + Amplify** | CDN + frontend hosting |
| **SAM CLI / CDK** | Infrastructure as code |
| **Docker + LocalStack** | Zero-credential local development |

Local stack mirrors this via `docker-compose.yml` (OpenSearch, LocalStack, PostGIS, Redis) — a clean checkout boots with **zero AWS credentials**.

## Feature surface (MVP, in this order)
1. **Estimate** — street-level PM2.5 with `p10/p50/p90` + nearest station comparison.
2. **Attribution** — ranked *likely contributors* within the upwind cone, with confidence.
3. **Agent trace** — the actual Strands tool-call sequence, shown in the UI.
4. **Advice** — parent / rider / worker guidance cards.
5. **Map** — user pin, wind overlay, upwind cone, source markers (Amazon Location tiles).
6. **Alerts + subscribe** — SNS notifications on threshold breach.
7. **Reports** — photo upload (blurred server-side) + Cedar authz *(stretch)*.

## Data sources & fallbacks
CPCB/OpenAQ, Open-Meteo (weather + boundary layer), NASA FIRMS (fires), OpenStreetMap/Overpass (sources). Every external feed has an 8s timeout, a circuit-breaker, and a documented fallback — a failed feed degrades gracefully, never fabricates data.

## Architecture (summary)
See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the C4, request-lifecycle sequence, Step Functions state machine, and agent-loop flowcharts. Data model, API contract, agent design, and ML validation are documented in their respective `docs/*.md` files (all with Mermaid diagrams).

## Non-negotiable rules
- **No fake routes.** Every route validates input, logs structured JSON, and handles errors. 503 + `Retry-After` on dependency failure.
- **Uncertainty is first-class.** Never return a bare point estimate from `/estimate`.
- **Honest attribution.** "Likely contributor" + confidence only. "Confirmed" / "caused by" are forbidden in user-facing strings.
- **The trace is real.** The UI trace must be the actual Strands tool calls, never hardcoded.
- **Privacy.** Photos go to a private bucket; faces/plates blurred server-side; pre-signed, short-lived URLs.
- **Generated types.** `frontend/src/lib/types.ts` semantics come from the Pydantic models; don't hand-edit API shapes.
- **Geospatial math is pure** and centralized (no inline copies).
- **One Lambda, one concern.** Fetchers never import web/agent code.

## Test inventory
- **Every API route:** happy path, validation failure (422), dependency failure (503 + `Retry-After`).
- **Every pure utility:** table-driven, incl. edge/empty inputs.
- **Frontend:** component unit tests (vitest) + E2E (Cypress) incl. responsive (320/768/1440) and a11y.
- **Agents:** mock the tool/LLM boundary — zero live calls in CI.

## Build order (time-boxed)
1. Foundation: monorepo, Docker, health endpoint, skeleton UI.
2. Data layer: OpenSearch index + seed, DynamoDB, fetch_* with mocked tests, baseline model.
3. Intelligence: Strands agent + tools, `/estimate` wired to UI.
4. Production: Step Functions + EventBridge + SNS, WebSocket, Cedar, photo pipeline.
5. CI/CD + docs + full test suite + responsive audit + `sam deploy` smoke test.

## Acceptance criteria (do not ship until true)
- `make dev` boots the whole stack locally.
- Searching a real place returns a live estimate with uncertainty, causes, advice, and a real trace.
- Hourly pipeline ingests fresh data; an SNS alert fires on breach.
- UI is usable at 320px; agent trace matches real tool calls.
- All tests pass; `sam build` succeeds; no secrets; no `console.log`/`print`.
