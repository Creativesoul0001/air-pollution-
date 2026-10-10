import app.pipeline.providers as providers
from app.main import app
from fastapi.testclient import TestClient


def test_airquality_current_ok(monkeypatch):
    monkeypatch.setattr(
        providers,
        "current_air",
        lambda lat, lon: {"time": "t", "pollutants": {"pm2_5": 58.7}, "provider": "p", "units": {}},
    )
    r = TestClient(app).get("/api/v1/airquality/current?lat=1&lon=2")
    assert r.status_code == 200
    assert r.json()["pollutants"]["pm2_5"] == 58.7


def test_airquality_current_503_on_provider_failure(monkeypatch):
    def boom(lat, lon):
        raise RuntimeError("down")

    monkeypatch.setattr(providers, "current_air", boom)
    r = TestClient(app).get("/api/v1/airquality/current?lat=1&lon=2")
    assert r.status_code == 503


def test_weather_current_ok(monkeypatch):
    monkeypatch.setattr(
        providers,
        "current_weather",
        lambda lat, lon: {"time": "t", "wind_direction_deg": 90, "wind_speed_kmh": 10, "provider": "p"},
    )
    r = TestClient(app).get("/api/v1/weather/current?lat=1&lon=2")
    assert r.status_code == 200
    assert r.json()["wind_direction_deg"] == 90
