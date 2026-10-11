import math

from app.utils.geo import (
    bearing_deg,
    downwind_bearing_deg,
    haversine_km,
    is_upwind,
    relative_angle_diff,
)


def test_haversine_zero_for_same_point():
    assert haversine_km(28.61, 77.21, 28.61, 77.21) == 0.0


def test_haversine_cp_to_india_gate_is_plausible():
    d = haversine_km(28.6315, 77.2167, 28.6129, 77.2295)
    assert 1.0 < d < 4.0


def test_haversine_known_delhi_noida():
    # Connaught Place -> Ghazipur is roughly 13-15 km
    d = haversine_km(28.6315, 77.2167, 28.6219, 77.3264)
    assert 10.0 < d < 15.0


def test_bearing_due_north_and_east():
    assert abs(bearing_deg(28.0, 77.0, 29.0, 77.0)) < 0.001
    # along a parallel the great-circle heading is close to but not exactly 90 degrees
    assert abs(bearing_deg(28.0, 77.0, 28.0, 78.0) - 90) < 1.0


def test_bearing_due_south_and_west():
    assert abs(bearing_deg(29.0, 77.0, 28.0, 77.0) - 180) < 0.001
    assert abs(bearing_deg(28.0, 78.0, 28.0, 77.0) - 270) < 1.0


def test_relative_angle_diff_wraps():
    assert relative_angle_diff(350, 10) == 20
    assert relative_angle_diff(10, 350) == 20
    assert relative_angle_diff(90, 270) == 180


def test_downwind_bearing():
    assert downwind_bearing_deg(0) == 180
    assert downwind_bearing_deg(270) == 90
    assert downwind_bearing_deg(350) == 170


def test_is_upwind_source_north_wind_from_north():
    # Wind blows FROM the north (0 deg) -> a source to the north IS upwind.
    assert is_upwind(28.7, 77.2, 28.6, 77.2, wind_dir_deg=0)


def test_is_upwind_source_south_wind_from_north_is_not_upwind():
    assert not is_upwind(28.5, 77.2, 28.6, 77.2, wind_dir_deg=0)


def test_is_upwind_respects_tolerance():
    # 60 deg off-axis with a 45 deg tolerance -> False; with 90 -> True
    assert not is_upwind(28.7, 77.2, 28.6, 77.2, wind_dir_deg=60, tolerance_deg=45)
    assert is_upwind(28.7, 77.2, 28.6, 77.2, wind_dir_deg=60, tolerance_deg=90)


def test_no_math_domain_error_at_equator():
    assert math.isfinite(haversine_km(0, 0, 0.1, 0.1))
    assert math.isfinite(bearing_deg(0, 0, 0, 1))
