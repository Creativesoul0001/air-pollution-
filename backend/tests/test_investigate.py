import copy

import app.agents.investigate as investigate_mod
import app.pipeline.ground as ground_pipeline
import app.pipeline.providers as providers
import app.pipeline.sources as sources_pipeline

SOURCES_FIXTURE = {
    "count": 2,
    "total_found": 2,
    "radius_km": 10,
    "bbox": {"south": 28.5, "west": 77.1, "north": 28.7, "east": 77.3},
    "provenance": "OpenStreetMap (Overpass API)",
    "sources": [
        {
            "type": "landfill",
            "label": "Landfill",
            "name": "North Landfill",
            "lat": 28.6459,
            "lon": 77.2167,
            "distance_km": 1.6,
            "plausibility": "high",
            "pollutants": ["pm2_5", "pm10"],
            "osm_type": "node",
            "osm_id": "101",
            "osm_url": "https://www.openstreetmap.org/node/101",
        },
        {
            "type": "industrial_zone",
            "label": "Industrial zone",
            "name": "South Industry",
            "lat": 28.6171,
            "lon": 77.2167,
            "distance_km": 1.6,
            "plausibility": "high",
            "pollutants": ["pm2_5", "no2", "so2"],
            "osm_type": "way",
            "osm_id": "202",
            "osm_url": "https://www.openstreetmap.org/way/202",
        },
    ],
}


def _monkeypatch_all(monkeypatch, *, wind_dir=0.0, wind_speed=8.0, ground_ok=False):
    monkeypatch.setattr(
        providers,
        "current_weather",
        lambda lat, lon: {"wind_direction_deg": wind_dir, "wind_speed_kmh": wind_speed, "time": "t"},
    )
    monkeypatch.setattr(
        providers,
        "current_air",
        lambda lat, lon: {"provider": "Open-Meteo", "time": "t", "pollutants": {"pm2_5": 90}},
    )
    if ground_ok:
        monkeypatch.setattr(
            ground_pipeline,
            "ground_readings",
            lambda lat, lon: {
                "status": "ok",
                "stations": [{"readings": [{"pollutant": "pm2_5", "value": 120.0, "unit": "µg/m³"}]}],
            },
        )
    else:
        monkeypatch.setattr(
            ground_pipeline, "ground_readings", lambda lat, lon: {"status": "unavailable", "stations": []}
        )
    monkeypatch.setattr(
        sources_pipeline, "nearby_sources", lambda lat, lon, rkm=None: copy.deepcopy(SOURCES_FIXTURE)
    )


def test_investigate_ranks_upwind_first(monkeypatch):
    _monkeypatch_all(monkeypatch, wind_dir=0.0)
    res = investigate_mod.investigate(28.6315, 77.2167)
    assert res["status"] == "ok"
    assert len(res["hypotheses"]) == 2
    top = res["hypotheses"][0]
    assert top["source"]["type"] == "landfill"
    assert top["source"]["upwind"] is True
    assert top["supporting_evidence"]
    assert top["confidence"] in {"low", "medium", "high"}
    assert top["source"]["bearing_deg"] is not None
    # caution must avoid causal language
    assert "not proof of causation" in res["caution"].lower()
    assert "caused" not in res["caution"].lower()


def test_downwind_source_gets_contradicting_evidence(monkeypatch):
    _monkeypatch_all(monkeypatch, wind_dir=0.0)
    res = investigate_mod.investigate(28.6315, 77.2167)
    down = [h for h in res["hypotheses"] if h["source"]["type"] == "industrial_zone"][0]
    assert down["source"]["upwind"] is False
    assert down["contradicting_evidence"]


def test_unavailable_when_wind_missing(monkeypatch):
    import app.pipeline.providers as providers

    monkeypatch.setattr(
        providers,
        "current_weather",
        lambda lat, lon: (_ for _ in ()).throw(RuntimeError("meteo down")),
    )
    _monkeypatch_all(monkeypatch)
    monkeypatch.setattr(
        providers,
        "current_weather",
        lambda lat, lon: (_ for _ in ()).throw(RuntimeError("meteo down")),
    )
    res = investigate_mod.investigate(28.6315, 77.2167)
    assert res["status"] == "unavailable"
    assert any("wind observation unavailable" in r for r in res["unavailable_reasons"])


def test_ground_corroboration_adds_evidence(monkeypatch):
    _monkeypatch_all(monkeypatch, wind_dir=0.0, ground_ok=True)
    res = investigate_mod.investigate(28.6315, 77.2167)
    assert res["ground"]["status"] == "ok"
    top = res["hypotheses"][0]
    assert any("ground readings corroborate" in e for e in top["supporting_evidence"])


def test_low_wind_flags_direction_as_non_diagnostic(monkeypatch):
    _monkeypatch_all(monkeypatch, wind_dir=0.0, wind_speed=1.5)
    res = investigate_mod.investigate(28.6315, 77.2167)
    top = res["hypotheses"][0]
    assert any("low wind speed" in e for e in top["contradicting_evidence"])
    assert any("low wind speed" in u.lower() or "wind" in u.lower() for u in top["uncertainty"] + top["contradicting_evidence"])


def test_model_estimate_is_labelled_as_model(monkeypatch):
    _monkeypatch_all(monkeypatch)
    res = investigate_mod.investigate(28.6315, 77.2167)
    assert res["model_context"]["kind"] == "model_estimate"
    assert res["model_context"]["provider"] == "Open-Meteo"
