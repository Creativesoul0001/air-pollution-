# Dhuan Detective — Backend

FastAPI + SQLAlchemy. **SQLite by default** (zero-infra, runs anywhere); a documented
path to Postgres/PostGIS or OpenSearch is available by changing `DATABASE_URL`.

## Ingest real Delhi NCR locations

```bash
python -m app.pipeline.run                 # all categories
python -m app.pipeline.run --categories school hospital   # limit
```

Fetches **real** OpenStreetMap features (Overpass, **ODbL**) for the NCR bounding box and
**deduplicates** by `(provider, osm_type, osm_id)`, storing coordinates, name, category,
provider id, tags, source attribution and timestamps. Then attaches **real PM2.5** readings
from **Open-Meteo** (keyless, batched, capped by `OBSERVATIONS_CAP`, incremental — locations
already observed are not re-fetched).

- Overpass requests go to multiple public mirrors with retries; a single failing category is
  skipped and never aborts the run.
- Re-running is idempotent: existing rows are counted as duplicates, not re-inserted.

## Run the API

```bash
uvicorn app.main:app --port 8000
```

- `GET /api/v1/locations/stats` — total + with-observations counts, cities/areas, category
  breakdown, last successful update, source attribution. `locations_with_model_estimates` is
  `0` until an ML model is deployed.
- `GET /api/v1/locations/search?q=` — real name search (>=1 char, else `422`).
- `GET /api/v1/health`

## Tests

```bash
pytest
```

Hermetic (no network): ingestion + deduplication, observation counting, search, and API
responses (happy path + 422). The Overpass/Open-Meteo boundaries are mocked.

## Configuration (env)

`DATABASE_URL`, `OBSERVATIONS_CAP`, `BBOX_S/W/N/E`, `OPEN_METEO_BASE`, `HTTP_USER_AGENT`,
`CORS_ORIGINS` — see `../.env.example`.
