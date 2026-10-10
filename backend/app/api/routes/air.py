from fastapi import APIRouter, HTTPException, Query

import app.pipeline.providers as providers

router = APIRouter(prefix="/api/v1")


@router.get("/airquality/current")
def airquality_current(lat: float = Query(...), lon: float = Query(...)):
    try:
        data = providers.current_air(lat, lon)
    except Exception as exc:  # provider unreachable -> honest 503, never fabricated data
        raise HTTPException(status_code=503, detail=f"air-quality provider unavailable: {exc}")
    return {"status": "ok", "location": {"lat": lat, "lon": lon}, **data}


@router.get("/weather/current")
def weather_current(lat: float = Query(...), lon: float = Query(...)):
    try:
        data = providers.current_weather(lat, lon)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"weather provider unavailable: {exc}")
    return {"status": "ok", "location": {"lat": lat, "lon": lon}, **data}
