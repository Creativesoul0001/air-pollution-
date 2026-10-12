"""A small, explainable PM2.5 model: standardised ridge regression in log space,
validated with leave-one-location-out (LOSO) cross-validation.

Uncertainty is an EMPIRICAL residual-quantile band from LOSO, reported honestly as
such (not a full predictive posterior).
"""

from __future__ import annotations

import math

import numpy as np

from app.ml.features import FEATURE_NAMES
from app.utils.geo import haversine_km

FEATURES = len(FEATURE_NAMES)


def _design(features: list[list[float]]) -> np.ndarray:
    X = np.asarray(features, dtype=float)
    if X.ndim != 2 or X.shape[1] != FEATURES:
        raise ValueError(f"expected {FEATURES} features per row, got shape {X.shape}")
    return X


def standardise_fit(X: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    mean = X.mean(axis=0)
    std = X.std(axis=0)
    std = np.where(std < 1e-9, 1.0, std)
    return mean, std


def ridge_fit(X: np.ndarray, y: np.ndarray, l2: float = 1.0) -> np.ndarray:
    """Closed-form ridge via least squares on the augmented system.

    Mathematically equivalent to the penalised normal equations, but numerically robust
    when the design matrix is rank-deficient (e.g. constant feature columns, l2=0).
    """
    n = X.shape[0]
    ones = np.ones((n, 1))
    A = np.hstack([ones, X])
    penalty = np.sqrt(float(max(l2, 0.0))) * np.eye(A.shape[1])
    penalty[0, 0] = 0.0  # never penalise the intercept
    A_aug = np.vstack([A, penalty])
    y_aug = np.concatenate([np.asarray(y, dtype=float), np.zeros(A.shape[1])])
    weights, *_ = np.linalg.lstsq(A_aug, y_aug, rcond=None)
    return weights


def ridge_predict(X: np.ndarray, weights: np.ndarray) -> np.ndarray:
    n = X.shape[0]
    A = np.hstack([np.ones((n, 1)), X])
    return A @ weights


def loso_groups(locations: list[tuple[float, float]]) -> dict[int, int]:
    """Map each sample index to a stable group id (one group per distinct location)."""
    groups: dict[tuple[float, float], int] = {}
    out: dict[int, int] = {}
    for i, loc in enumerate(locations):
        if loc not in groups:
            groups[loc] = len(groups)
        out[i] = groups[loc]
    return out


def loso_metrics(
    features: list[list[float]],
    log_targets: list[float],
    locations: list[tuple[float, float]],
    l2: float = 1.0,
) -> dict:
    """Leave-one-location-out RMSE/MAE/R2 in ORIGINAL µg/m³ units, plus residual quantiles."""
    X_all = _design(features)
    y_all = np.asarray(log_targets, dtype=float)
    groups = loso_groups(locations)
    group_ids = np.array([groups[i] for i in range(len(features))])

    mean, std = standardise_fit(X_all)
    Xs = (X_all - mean) / std

    preds = np.zeros(len(features))
    for g in np.unique(group_ids):
        train = group_ids != g
        test = ~train
        if train.sum() < FEATURES + 2 or test.sum() == 0:
            preds[group_ids == g] = np.exp(y_all[group_ids == g].mean())
            continue
        w = ridge_fit(Xs[train], y_all[train], l2)
        preds[test] = ridge_predict(Xs[test], w)

    actual = np.exp(y_all)
    # clip to a sane floor so catastrophic back-transform can't produce negative µg/m³
    preds = np.clip(preds, 0.01, None)
    errors = actual - preds
    rmse = float(np.sqrt(np.mean(errors**2)))
    mae = float(np.mean(np.abs(errors)))
    ss_res = float(np.sum(errors**2))
    ss_tot = float(np.sum((actual - actual.mean()) ** 2))
    r2 = float(1 - ss_res / ss_tot) if ss_tot > 0 else float("nan")

    log_res = y_all - np.log(preds)
    q = np.quantile(log_res, [0.1, 0.5, 0.9])

    return {
        "method": "LOSO",
        "n_samples": int(len(features)),
        "n_locations": int(len(np.unique(group_ids))),
        "rmse": round(rmse, 3),
        "mae": round(mae, 3),
        "r2": round(r2, 4),
        "rmse_note": "µg/m³, on held-out locations the model has never seen",
        "residual_quantiles_log": [float(v) for v in q],
        "bias_note": (
            "p10/p50/p90 come from LOSO residual quantiles (empirical band), not a full "
            "predictive posterior"
        ),
    }


def _idw_value(target: dict, donors: list[dict], power: float, radius_km: float) -> float | None:
    """Inverse-distance-weighted estimate of PM2.5 from donor samples."""
    num = 0.0
    den = 0.0
    for d in donors:
        dist = haversine_km(target["lat"], target["lon"], d["lat"], d["lon"])
        if dist < 1e-6:
            return float(d["pm2_5"])
        if dist > radius_km:
            continue
        w = 1.0 / (dist ** power)
        den += w
        num += w * float(d["pm2_5"])
    if den == 0.0:
        return None
    return num / den


def idw_loso(records: list[dict], power: float = 2.0, radius_km: float = 80.0) -> dict:
    """Leave-one-location-out metrics for IDW interpolation between real observation points."""
    from collections import defaultdict

    by_ts: dict[str, list[int]] = defaultdict(list)
    for i, r in enumerate(records):
        by_ts[r["ts"]].append(i)

    locs = [(r["lat"], r["lon"]) for r in records]
    unique_locs = sorted(set(locs))
    preds: list[float] = []
    actual: list[float] = []

    for held in unique_locs:
        for _ts, idxs in by_ts.items():
            targets = [i for i in idxs if locs[i] == held]
            if not targets:
                continue
            donors = [records[i] for i in idxs if locs[i] != held]
            if not donors:
                continue
            for t in targets:
                value = _idw_value(records[t], donors, power, radius_km)
                if value is None:
                    continue
                preds.append(value)
                actual.append(float(records[t]["pm2_5"]))

    if not preds:
        return {"method": "LOSO_IDW", "n_samples": 0, "rmse": None, "mae": None, "r2": None}

    p = np.asarray(preds)
    a = np.asarray(actual)
    err = a - p
    rmse = float(np.sqrt(np.mean(err ** 2)))
    mae = float(np.mean(np.abs(err)))
    ss_res = float(np.sum(err ** 2))
    ss_tot = float(np.sum((a - a.mean()) ** 2))
    r2 = float(1 - ss_res / ss_tot) if ss_tot > 0 else float("nan")
    log_res = np.log(a + 1e-6) - np.log(np.clip(p, 0.01, None))
    q = np.quantile(log_res, [0.1, 0.5, 0.9])

    return {
        "method": "LOSO_IDW",
        "n_samples": int(len(preds)),
        "n_locations": len(unique_locs),
        "rmse": round(rmse, 3),
        "mae": round(mae, 3),
        "r2": round(r2, 4),
        "power": power,
        "radius_km": radius_km,
        "rmse_note": "µg/m³, interpolating to held-out locations from real observation points",
        "residual_quantiles_log": [float(v) for v in q],
        "bias_note": "p10/p50/p90 come from LOSO residual quantiles (empirical band)",
    }


def train_best(features, log_targets, locations, records, l2=1.0, idw_power=2.0, idw_radius_km=80.0) -> dict:
    """Train both approaches, validate both with LOSO, and keep the better one.
    The losing approach and its metrics are still reported for transparency."""
    ridge = train_model(features, log_targets, locations, l2)
    idw = idw_loso(records, power=idw_power, radius_km=idw_radius_km)

    def _score(m: dict) -> float:
        return m.get("rmse") if m.get("rmse") is not None else float("inf")

    selected = "idw" if _score(idw) < _score(ridge["metrics"]) else "ridge"
    return {
        "selected": selected,
        "type": "ridge_log_pm25+idw",
        "l2": l2,
        "idw": {"power": idw_power, "radius_km": idw_radius_km},
        "feature_names": None,
        "mean": ridge["mean"],
        "std": ridge["std"],
        "weights": ridge["weights"],
        "metrics": idw if selected == "idw" else ridge["metrics"],
        "candidates": {"ridge": ridge["metrics"], "idw": idw},
        "selection_note": (
            f"selected '{selected}' by lowest LOSO RMSE "
            f"(ridge {ridge['metrics'].get('rmse')} vs idw {idw.get('rmse')})"
        ),
    }


def train_model(features, log_targets, locations, l2: float = 1.0) -> dict:
    X = _design(features)
    y = np.asarray(log_targets, dtype=float)
    mean, std = standardise_fit(X)
    Xs = (X - mean) / std
    weights = ridge_fit(Xs, y, l2)
    metrics = loso_metrics(features, log_targets, locations, l2)
    return {
        "type": "ridge_log_pm25",
        "l2": l2,
        "feature_names": None,
        "mean": mean.tolist(),
        "std": std.tolist(),
        "weights": weights.tolist(),
        "metrics": metrics,
    }


def predict_quantiles(model: dict, features: list[float]) -> dict:
    """Predict p10/p50/p90 (µg/m³) for one feature vector."""
    X = _design([features])
    mean = np.asarray(model["mean"], dtype=float)
    std = np.asarray(model["std"], dtype=float)
    weights = np.asarray(model["weights"], dtype=float)
    Xs = (X - mean) / std
    log_hat = float(ridge_predict(Xs, weights)[0])
    q = model["metrics"]["residual_quantiles_log"]
    return {
        "pm25_p10": round(math.exp(log_hat + q[0]), 2),
        "pm25_p50": round(math.exp(log_hat + q[1]), 2),
        "pm25_p90": round(math.exp(log_hat + q[2]), 2),
        "log_hat": round(log_hat, 5),
    }
