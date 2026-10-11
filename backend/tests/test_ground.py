import pytest

from app.pipeline.ground import ground_readings, waqi_station


class FakeResp:
    def __init__(self, payload=None, status_code=200):
        self._payload = payload
        self.status_code = status_code

    def json(self):
        return self._payload

    @property
    def status_code(self):
        return self._status_code

    @status_code.setter
    def status_code(self, v):
        self._status_code = v


SC_PAYLOAD = [
    {
        "sensor": {"id": 999, "sensor_type": {"name": "SDS011"}, "location": {"latitude": 28.64, "longitude": 77.22}},
        "timestamp": "2026-10-11T10:00:00",
        "sensordatavalues": [{"value_type": "P1", "value": "120.5"}, {"value_type": "P2", "value": "61.0"}],
    }
]

WAQI_PAYLOAD = {
    "status": "ok",
    "data": {
        "city": {"name": "Some CPCB Station, Delhi, India", "geo": [28.65, 77.23], "url": "https://aqicn.org/city/x"},
        "time": {"iso": "2026-10-11T10:00:00+05:30"},
        "iaqi": {"pm25": {"v": 88}, "pm10": {"v": 150}},
        "attributions": [{"name": "CPCB", "url": "https://cpcb.nic.in"}],
    },
}


def test_sensor_community_success(monkeypatch):
    import app.pipeline.ground as ground

    def fake_get(url, params=None, timeout=None):
        return FakeResp(SC_PAYLOAD)

    monkeypatch.setattr(ground.requests, "get", fake_get)
    res = ground_readings(28.6315, 77.2167)
    assert res["status"] == "ok"
    st = res["stations"][0]
    assert st["provenance"]["type"] == "ground_measurement"
    assert any(r["pollutant"] == "pm2_5" and r["value"] == 61.0 for r in st["readings"])


def test_unavailable_without_credentials(monkeypatch, settings=None):
    import app.core.config as config
    import app.pipeline.ground as ground

    monkeypatch.setattr(config.settings, "waqi_token", "")
    monkeypatch.setattr(
        ground.requests, "get", lambda url, params=None, timeout=None: FakeResp([])
    )
    res = ground_readings(28.6315, 77.2167)
    assert res["status"] == "unavailable"
    assert res["stations"] == []
    assert any("token" in a.lower() for a in res["attempts"])
    assert "NOT shown" in res["note"]


def test_waqi_path_used_when_token_present(monkeypatch):
    import app.core.config as config
    import app.pipeline.ground as ground

    monkeypatch.setattr(config.settings, "waqi_token", "test-token")

    def fake_get(url, params=None, timeout=None):
        if "sensor.community" in url:
            return FakeResp([])  # no open sensors nearby
        return FakeResp(WAQI_PAYLOAD)

    monkeypatch.setattr(ground.requests, "get", fake_get)
    res = ground_readings(28.6315, 77.2167)
    assert res["status"] == "ok"
    st = res["stations"][0]
    assert st["station"] == "Some CPCB Station, Delhi, India"
    assert st["provenance"]["type"] == "ground_measurement"
    pollutants = {r["pollutant"]: r["value"] for r in st["readings"]}
    assert pollutants == {"pm2_5": 88, "pm10": 150}


def test_waqi_without_token_reports_unavailable(monkeypatch):
    import app.core.config as config
    import app.pipeline.ground as ground

    monkeypatch.setattr(config.settings, "waqi_token", "")
    stations, reason = waqi_station(28.6, 77.2)
    assert stations == []
    assert "token" in reason.lower()
