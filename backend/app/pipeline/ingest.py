import logging

from sqlalchemy import select

from app.models.location import Location
from app.pipeline.overpass import categorize, coordinates, tags_json

log = logging.getLogger("dhuan.ingest")


def ingest_locations(db, elements: list[dict]) -> dict:
    """Idempotent import with deduplication.

    - Unique key: (provider="osm", osm_type, osm_id).
    - Rows without a usable coordinate are skipped.
    - Re-running does not create duplicates: existing keys are counted, not re-added.
    Returns counts so the UI/tests can assert real numbers.
    """
    existing = {
        (r[0], r[1], r[2])
        for r in db.execute(select(Location.provider, Location.osm_type, Location.osm_id)).all()
    }
    seen: set[tuple[str, str, str]] = set()
    duplicates = 0
    skipped = 0
    objects: list[Location] = []

    for el in elements:
        osm_type = el.get("type")
        osm_id = str(el.get("id"))
        key = ("osm", osm_type, osm_id)
        if key in existing or key in seen:
            duplicates += 1
            continue
        lat, lon = coordinates(el)
        if lat is None or lon is None:
            skipped += 1
            continue
        tags = el.get("tags", {}) or {}
        objects.append(
            Location(
                provider="osm",
                osm_type=osm_type,
                osm_id=osm_id,
                name=tags.get("name"),
                category=categorize(tags),
                lat=float(lat),
                lon=float(lon),
                city=tags.get("addr:city") or tags.get("is_in:city"),
                tags=tags_json(el),
            )
        )
        seen.add(key)

    if objects:
        db.add_all(objects)
        db.commit()
    added = len(objects)
    log.info(
        "ingest added=%s duplicates=%s skipped=%s input=%s",
        added,
        duplicates,
        skipped,
        len(elements),
    )
    return {"added": added, "duplicates": duplicates, "skipped_no_center": skipped, "input": len(elements)}
