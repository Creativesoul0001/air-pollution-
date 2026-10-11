import os


class Settings:
    db_url: str = os.getenv("DATABASE_URL", "sqlite:///./data/dhuan.db")

    # Overpass endpoints (tried in order, with retries); POST with a descriptive
    # User-Agent is required. Multiple public mirrors improve reliability.
    overpass_endpoints: list[str] = [
        "https://overpass.kumi.systems/api/interpreter",
        "https://overpass-api.de/api/interpreter",
        "https://overpass.private.coffee/api/interpreter",
        "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    ]
    http_user_agent: str = os.getenv(
        "HTTP_USER_AGENT", "DhuanDetective/0.1 (local OSM ingestion; research/demo)"
    )
    http_timeout: int = int(os.getenv("HTTP_TIMEOUT", "180"))

    # Delhi NCR bounding box: (south, west, north, east)
    bbox: tuple[float, float, float, float] = (
        float(os.getenv("BBOX_S", "28.35")),
        float(os.getenv("BBOX_W", "76.80")),
        float(os.getenv("BBOX_N", "28.95")),
        float(os.getenv("BBOX_E", "77.50")),
    )

    # Cap on how many indexed locations get a live pollution observation each run
    # (Open-Meteo is keyless but rate-limited; requests are batched).
    observations_cap: int = int(os.getenv("OBSERVATIONS_CAP", "300"))
    open_meteo_base: str = os.getenv(
        "OPEN_METEO_BASE", "https://air-quality-api.open-meteo.com/v1/air-quality"
    )

    # Real ground monitoring stations. Sensor.Community is open/keyless; WAQI requires a
    # personal data token. Without either, the adapter reports `unavailable` (never fabricated).
    waqi_token: str = os.getenv("WAQI_TOKEN", "")
    sensor_community_url: str = os.getenv(
        "SENSOR_COMMUNITY_URL", "https://data.sensor.community/airrohr/v1/filter"
    )
    ground_radius_km: float = float(os.getenv("GROUND_RADIUS_KM", "10"))

    # Evidence-based source investigation.
    sources_radius_km: float = float(os.getenv("SOURCES_RADIUS_KM", "10"))
    sources_limit: int = int(os.getenv("SOURCES_LIMIT", "200"))

    cors_origins: list[str] = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")


settings = Settings()
