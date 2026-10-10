# Agent Instructions — Dhuan Detective

You are an AI coding agent working in this repository. Follow these rules exactly. They exist to keep the system production-grade and judge-defensible.

## Golden rule
**No shortcuts. No fake routes. No seeded "real-looking" data masquerading as real.** If a code path runs in production, it must validate input, handle errors with structured logs, and have a happy-path and sad-path test.

## Before you change anything
1. Read [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) before touching backend services or the pipeline.
2. Read [`docs/AGENT_DESIGN.md`](docs/AGENT_DESIGN.md) before changing attribution or advice logic.
3. Read [`docs/ML_MODEL.md`](docs/ML_MODEL.md) before changing features or training.
4. Read this file's "Architecture boundaries" before adding a new service.

## Architecture boundaries
- **Geospatial math is pure.** All distance, bearing, and upwind-cone math lives in `backend/app/utils/geo.py` as pure functions. Do not inline geo math elsewhere.
- **API types are generated, not hand-written.** `frontend/src/lib/types.ts` is generated from the Pydantic models via `openapi-typescript`. Do not hand-edit it; regenerate it.
- **One Lambda = one concern.** Data fetchers (`backend/app/pipeline/fetch_*.py`) must not import Flask/FastAPI or agent code. API handlers must not run long training jobs.
- **Agent logic isolation.** The Strands attribution agent is in `backend/app/agents/attribution_agent.py`. In unit tests, mock the LLM/tool boundary (`backend/app/agents/tools.py`); never make real external calls in CI.
- **Every new Lambda handler** must have a matching resource in `infra/template.yaml` and be registered in `infra/samconfig.toml`.
- **Secrets** never appear in code. Add new keys to `.env.example` only, never to `.env` in git.

## Data & honesty rules
- Estimates must always expose an uncertainty range (`pm25_p10`, `pm25_p50`, `pm25_p90`). Never return a bare point estimate from `/estimate`.
- Attribution outputs must use "Likely contributor" with a confidence level. The words "confirmed" or "caused by" are forbidden in user-facing strings.
- The agent trace shown in the UI must be the *actual* sequence of Strands tool calls, never a hardcoded narrative.
- Photo uploads go to a **private** S3 bucket; faces and license plates are blurred server-side before storage. Public URLs are pre-signed and short-lived.

## Local dev
- Full stack runs via `make dev` (Docker Compose + LocalStack). A clean checkout must boot with **zero AWS credentials**.
- Run `make test` before opening a PR. It runs backend (pytest), frontend unit (vitest), and lint. CI will block the merge otherwise.
- Do not commit `console.log` (frontend) or `print` (backend) — use the structured JSON logger in `backend/app/core/logging.py`.

## Testing contract
- Every API route: 1 happy-path test, 1 validation-failure test (422), 1 dependency-failure test (503 + `Retry-After`).
- Every pure utility: table-driven tests including edge/empty inputs.
- LocalStack-dependent integration tests must be tagged and skippable when LocalStack is unavailable.

## When in doubt
Prefer the smallest change that keeps the "no shortcuts" rule intact. If a requirement is ambiguous, implement the stricter interpretation (more validation, more logging, more honesty about uncertainty) and note the decision in the PR description.
