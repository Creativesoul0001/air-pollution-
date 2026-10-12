import {
  bandOf,
  bandPrecision,
  bandStyle,
  bandToneFor,
  isUsableEstimate,
  modelSummary,
  relativeBandWidth,
} from "./model";
import type { ModelEstimate, ModelInfo } from "./types";

const BASE: ModelEstimate = {
  status: "ok",
  location: { lat: 28.6, lon: 77.2 },
  is_model_estimate: true,
  kind: "model_estimate",
  method: "idw",
  provenance: "idw model, LOSO RMSE 10.9 ug/m3",
  los_validation: { method: "LOSO_IDW", n_samples: 100, n_locations: 5, rmse: 10.9, mae: 7.0, r2: 0.88, residual_quantiles_log: [-0.2, 0, 0.14] },
  reference_timestamp: "2026-10-11T23:00",
  pm25_p10: 54.8,
  pm25_p50: 67.9,
  pm25_p90: 78.0,
  note: "",
};

describe("bandOf", () => {
  it("maps PM2.5 to CPCB bands", () => {
    expect(bandOf(25)).toBe("good");
    expect(bandOf(45)).toBe("moderate");
    expect(bandOf(75)).toBe("poor");
    expect(bandOf(110)).toBe("veryPoor");
    expect(bandOf(300)).toBe("severe");
  });
  it("exposes a colour and badge tone per band", () => {
    expect(bandStyle("good").color).toBe("var(--dd-accent)");
    expect(bandToneFor(110)).toBe("veryPoor");
    expect(bandToneFor(25)).toBe("good");
  });
});

describe("relativeBandWidth / bandPrecision", () => {
  it("measures the p10-p90 spread relative to p50", () => {
    const w = relativeBandWidth(100, 80, 120);
    expect(w).toBeCloseTo(0.4, 5);
  });
  it("classifies precision", () => {
    expect(bandPrecision(0.1)).toBe("narrow");
    expect(bandPrecision(0.4)).toBe("moderate");
    expect(bandPrecision(1.2)).toBe("wide");
  });
  it("returns null for missing values", () => {
    expect(relativeBandWidth(null, null, null)).toBeNull();
    expect(relativeBandWidth(0, 0, 0)).toBeNull();
  });
});

describe("isUsableEstimate (honesty gate)", () => {
  it("requires a p50 AND a validation error", () => {
    expect(isUsableEstimate(BASE)).toBe(true);
  });
  it("rejects a null p50", () => {
    expect(isUsableEstimate({ ...BASE, pm25_p50: null })).toBe(false);
  });
  it("rejects an estimate with no validation error", () => {
    const noValidation: ModelEstimate = {
      ...BASE,
      los_validation: { method: "LOSO_IDW", n_samples: 0, n_locations: 0, rmse: null, mae: null, r2: null, residual_quantiles_log: [] },
    };
    expect(isUsableEstimate(noValidation)).toBe(false);
  });
  it("rejects nothing-shaped input", () => {
    expect(isUsableEstimate(null)).toBe(false);
  });
});

describe("modelSummary", () => {
  it("summarises the trained model with its validation error", () => {
    const info: ModelInfo = {
      selected: "idw",
      trained_at: "2026-01-01T00:00:00Z",
      metrics: { method: "LOSO_IDW", n_samples: 36600, n_locations: 25, rmse: 10.9, mae: 6.9, r2: 0.88, residual_quantiles_log: [-0.2, 0, 0.14] },
      candidates: null,
      dataset: null,
      selection_note: "",
      provenance: "",
      locations_with_model_estimates: 25,
    };
    expect(modelSummary(info)).toContain("idw");
    expect(modelSummary(info)).toContain("10.9");
    expect(modelSummary(null)).toBe("no validated model");
  });
});
