"""Evidence-based source investigation.

Combines REAL evidence: live wind observations (Open-Meteo), mapped pollution sources
(OpenStreetMap/Overpass), ground monitoring readings where reachable, and the current
model air-quality estimate for context. Produces RANKED HYPOTHESES with supporting and
contradicting evidence plus uncertainty. Proximity alone is never treated as causation.
"""

from __future__ import annotations

import logging

import app.pipeline.ground as ground_pipeline
import app.pipeline.providers as providers
import app.pipeline.sources as sources_pipeline
from app.utils import geo

log = logging.getLogger("dhuan.investigate")

CAUTION = (
    "Association only: distance and upwind alignment are not proof of causation. No source "
    "is claimed to be responsible for these values."
)

_CONF_RANK = {"low": 0, "medium": 1, "high": 2}
_MAX_HYPOTHESES = 25


def investigate(lat: float, lon: float, radius_km: float | None = None) -> dict:
    result: dict = {
        "location": {"lat": lat, "lon": lon},
        "status": "ok",
        "generated_reasons": [],
        "unavailable_reasons": [],
        "wind": None,
        "model_context": None,
        "ground": None,
        "sources_provenance": None,
        "sources_radius_km": radius_km if radius_km is not None else None,
        "hypotheses": [],
        "caution": CAUTION,
    }

    # 1) Live wind (drives upwind geometry)
    try:
        wind = providers.current_weather(lat, lon)
    except Exception as exc:
        wind = None
        result["unavailable_reasons"].append(f"wind observation unavailable: {exc}")
    result["wind"] = wind
    wind_dir = (wind or {}).get("wind_direction_deg")
    wind_speed = (wind or {}).get("wind_speed_kmh")

    # 2) Model air-quality estimate, kept strictly separate from ground data
    try:
        m = providers.current_air(lat, lon)
        result["model_context"] = {
            "kind": "model_estimate",
            "provider": m.get("provider"),
            "time": m.get("time"),
            "pollutants": m.get("pollutants"),
        }
    except Exception as exc:
        result["unavailable_reasons"].append(f"model air-quality estimate unavailable: {exc}")

    # 3) Ground monitoring readings (real stations only; unavailable without credentials)
    try:
        ground = ground_pipeline.ground_readings(lat, lon)
    except Exception as exc:
        ground = {"status": "unavailable", "count": 0, "stations": [], "note": str(exc)}
    result["ground"] = ground

    # 4) Mapped sources
    try:
        src = sources_pipeline.nearby_sources(lat, lon, radius_km)
    except Exception as exc:
        src = {"sources": [], "count": 0, "provenance": None}
        result["unavailable_reasons"].append(f"mapped sources unavailable: {exc}")
    result["sources_provenance"] = src.get("provenance")
    result["sources_radius_km"] = src.get("radius_km", result["sources_radius_km"])

    ground_pollutants = {
        r["pollutant"]
        for st in ground.get("stations", [])
        for r in st.get("readings", [])
    }

    hypotheses: list[dict] = []
    for s in src.get("sources", []):
        bearing = geo.bearing_deg(lat, lon, s["lat"], s["lon"])
        s["bearing_deg"] = round(bearing, 1)
        supporting: list[str] = []
        contradicting: list[str] = []

        if wind_dir is not None:
            upwind = geo.is_upwind(s["lat"], s["lon"], lat, lon, wind_dir, tolerance_deg=45)
            diff = geo.relative_angle_diff(bearing, wind_dir)
            s["upwind"] = upwind
            s["bearing_off_wind_deg"] = round(diff, 1)
            if upwind:
                supporting.append(
                    f"lies {bearing:.0f}° from the receiver, within the upwind cone (wind from {wind_dir:.0f}°, {diff:.0f}° off-axis)"
                )
            else:
                contradicting.append(
                    f"lies {diff:.0f}° off the upwind direction (wind from {wind_dir:.0f}°)"
                )
        else:
            s["upwind"] = None
            contradicting.append("no wind observation available — transport direction is unknown")

        distance = s["distance_km"]
        supporting.append(f"{distance:.2f} km from the measurement point")
        if distance > 8:
            contradicting.append(
                f"{distance:.1f} km away — beyond the radius where most primary pollutants remain influential"
            )

        if s.get("pollutants"):
            supporting.append(f"source type plausibly emits {', '.join(s['pollutants'])}")
        if not s.get("name"):
            supporting.append("source is unnamed in OpenStreetMap — its identity is ambiguous")

        if wind_speed is not None and wind_speed < 3:
            contradicting.append(
                f"very low wind speed ({wind_speed:.1f} km/h) — pollutants accumulate locally, so direction is not diagnostic"
            )

        overlap = sorted(set(s.get("pollutants", [])) & ground_pollutants)
        if overlap:
            supporting.append(f"ground readings corroborate elevated {', '.join(overlap)}")
        elif ground.get("status") == "ok":
            contradicting.append(
                "reachable ground readings do not show elevated values for the pollutants this source emits"
            )

        score = {"high": 2, "medium": 1, "low": 0}[s["plausibility"]]
        if wind_dir is not None:
            score += 1 if s["upwind"] else -1
        if distance > 8:
            score -= 1
        if wind_speed is not None and wind_speed < 3:
            score -= 1
        confidence = "high" if score >= 3 else "medium" if score >= 1 else "low"

        uncertainty = [
            "source geometry is a single OSM point/centroid, not an emission inventory",
            "no emission rate or stack height is known",
            "wind is a single-hour observation, not a trajectory",
        ]
        if not s.get("name"):
            uncertainty.append("unnamed source — identity could not be verified")
        if wind_dir is None:
            uncertainty.append("no wind observation — direction could not be assessed")

        hypotheses.append(
            {
                "confidence": confidence,
                "score": score,
                "source": s,
                "supporting_evidence": supporting,
                "contradicting_evidence": contradicting,
                "uncertainty": uncertainty,
            }
        )

    hypotheses.sort(key=lambda h: (-h["score"], h["source"]["distance_km"]))
    result["hypotheses"] = hypotheses[:_MAX_HYPOTHESES]

    if wind_dir is None:
        result["unavailable_reasons"].append(
            "wind observation unavailable — upwind alignment could not be assessed"
        )
    if not hypotheses:
        result["unavailable_reasons"].append(
            "no plausible mapped pollution sources were found within the search radius"
        )

    result["status"] = "ok" if (hypotheses and wind_dir is not None) else "unavailable"
    return result
