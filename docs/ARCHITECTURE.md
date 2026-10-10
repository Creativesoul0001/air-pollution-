# Architecture — Dhuan Detective

This document describes the system that powers street-level air quality attribution for Delhi. It uses the [C4 model](https://c4model.com) plus sequence and state-machine diagrams.

## 1. System context

```mermaid
C4Context
    title System Context — Dhuan Detective

    Person(resident, "Delhi Resident", "Parents, riders, workers")
    System(dd, "Dhuan Detective", "Estimates street-level PM2.5 and attributes likely causes")

    System_Ext(cpcb, "CPCB / OpenAQ", "Official AQI station readings")
    System_Ext(meteo, "Open-Meteo", "Weather + boundary-layer data")
    System_Ext(firms, "NASA FIRMS", "Fire / thermal detections")
    System_Ext(osm, "OpenStreetMap", "Pollution source geometry")
    System_Ext(aws, "AWS", "OpenSearch, Step Functions, SNS, Lambda, DynamoDB, S3, SageMaker, Location")
    System_Ext(agent, "Strands Agent", "Reasoning core for attribution")

    Rel(resident, dd, "Search a place, view estimate, get advice")
    Rel(dd, cpcb, "Hourly station PM2.5")
    Rel(dd, meteo, "Hourly wind + BLH")
    Rel(dd, firms, "3-hourly fire detections")
    Rel(dd, osm, "On-demand source sync")
    Rel(dd, aws, "Compute, storage, search, orchestration")
    Rel(dd, agent, "Attribution + advice")
```

## 2. Container view

```mermaid
C4Container
    title Container View

    Person(resident, "Delhi Resident")

    System_Boundary(dd, "Dhuan Detective") {
        Container(web, "Web App", "Next.js 14 / React", "Single-screen responsive UI + map")
        Container(api, "API", "API Gateway + Lambda (FastAPI)", "REST + WebSocket")
        Container(orch, "Data Pipeline", "Step Functions + Lambda", "Hourly ingest + estimate refresh")
        Container(agent, "Attribution & Advice Agents", "Python + Strands SDK", "Reasoning core")
        ContainerDb(os, "OpenSearch", "OpenSearch 2.x", "Geo-indexed pollution sources")
        ContainerDb(ddb, "DynamoDB", "DynamoDB", "Estimates, subscriptions, reports, traces")
        ContainerDb(s3, "S3", "S3", "Raw data lake, model artifacts, private photos")
        Container(sm, "SageMaker", "XGBoost endpoint", "PM2.5 inference")
        Container(sns, "SNS", "SNS", "Threshold alerts")
        Container(loc, "Amazon Location", "Location Service", "Geocoding + map tiles + routing")
    }

    Rel(resident, web, "HTTPS")
    Rel(web, api, "REST/JSON + WSS")
    Rel(api, agent, "Invokes")
    Rel(api, ddb, "Reads/writes")
    Rel(api, os, "Geo-queries")
    Rel(api, sm, "Batch/grid inference")
    Rel(api, loc, "Geocode, tiles")
    Rel(orch, ddb, "Refreshes estimates")
    Rel(orch, os, "Reindexes sources")
    Rel(orch, s3, "Reads raw / writes")
    Rel(orch, sm, "Triggers training")
    Rel(orch, sns, "Publishes alerts")
    Rel(agent, os, "Tool: query sources")
    Rel(agent, sm, "Tool: get estimate")
```

## 3. Request lifecycle — "why is my air bad?"

```mermaid
sequenceDiagram
    autonumber
    actor U as Resident
    participant W as Web App
    participant AG as API Gateway
    participant LF as GetEstimate Lambda
    participant RD as Redis
    participant DY as DynamoDB
    participant SM as SageMaker
    participant OS as OpenSearch
    participant SA as Strands Agent

    U->>W: Search "Connaught Place"
    W->>AG: GET /api/v1/estimate?lat=&lon=
    AG->>LF: proxy (Lambda authorizer verifies JWT)
    LF->>RD: GET estimate:{grid}:{hh}
    alt Cache hit (< 15 min)
        RD-->>LF: cached payload
    else Cache miss
        LF->>DY: GET Estimates#{grid}#{YYYYMMDDHH}
        alt Grid reading present
            DY-->>LF: p10/p50/p90
        else Run inference
            LF->>SM: InvokeEndpoint(features)
            SM-->>LF: quantiles
            LF->>DY: PutItem (TTL 2h)
        end
        LF->>OS: geo_distance(5km) + upwind filter
        OS-->>LF: sources[]
        LF->>SA: reason(estimate, wind, sources, fires)
        SA-->>LF: causes + advice + trace
        LF->>RD: SETEX 900 payload
    end
    LF-->>AG: 200 EstimateResponse
    AG-->>W: JSON
    W-->>U: Render number, causes, agent trace, advice
```

## 4. Hourly pipeline (Step Functions state machine)

```mermaid
stateDiagram-v2
    [*] --> Ingest
    state "Parallel Ingest" as Ingest {
        [*] --> FetchCPCB
        [*] --> FetchWeather
        [*] --> FetchFIRMS
        [*] --> FetchOSMDiff
    }
    Ingest --> Validate: all done
    Validate --> IndexSources: schema OK
    Validate --> DLQ: schema error
    DLQ --> [*]
    IndexSources --> UpdateModel
    UpdateModel --> GridEstimation
    GridEstimation --> AlertEngine
    AlertEngine --> Publish: threshold breached
    AlertEngine --> Done: within limits
    Publish --> Done
    Done --> [*]

    note right of Validate
        Every state has Catch →
        2 retries (30s backoff).
        Terminal failures go to
        SQS DLQ (dhuan-dlq).
    end note
```

## 5. Agent reasoning loop

```mermaid
flowchart TD
    A[Estimate available?] -->|yes| B[Build context: estimate, wind]
    B --> C{Strands loop, max 8 steps}
    C -->|need data| T[Call tool]
    T --> O1[get_air_quality] --> C
    T --> O2[get_weather] --> C
    T --> O3[query_upwind_sources] --> C
    T --> O4[get_fire_detections] --> C
    C -->|have enough evidence| D[Rank likely contributors]
    D --> E[Emit structured JSON + trace]
    E --> F[Advice agent per profile]
    F --> G[Return to API]
```

## 6. Design decisions & boundaries
- **Pure geo math** lives in `backend/app/utils/geo.py` (haversine, bearing, upwind cone). No copies elsewhere.
- **One Lambda, one concern.** Ingestion, API, and inference are separate functions so the pipeline never imports FastAPI and API handlers never run training jobs.
- **Agent isolation.** Attribution logic is in `backend/app/agents/attribution_agent.py`; unit tests mock the tool/LLM boundary — zero external calls in CI.
- **Generated API types.** `frontend/src/lib/types.ts` is produced from Pydantic via `openapi-typescript`. Never hand-edit.
- **Time/scale:** Delhi ~1,500 km². A 1 km decision grid ≈ 1,500 cells; grid estimation is fanned out across Lambda and cached in DynamoDB.
- **Regional note:** OpenSearch + SageMaker are deployed in `ap-south-1`; Bedrock/Strands (if used for advice) in `us-east-1`, the closest region hosting the model.
