import {
  CONFIDENCE_RANK,
  confidenceTone,
  hasCausalLanguage,
  sortHypotheses,
  summariseHypotheses,
} from "./investigate";
import type { Hypothesis } from "./types";

function h(confidence: "low" | "medium" | "high", score: number, distance: number): Hypothesis {
  return {
    confidence,
    score,
    source: {
      type: "landfill",
      label: "Landfill",
      name: "Test",
      lat: 0,
      lon: 0,
      distance_km: distance,
      bearing_deg: 0,
      upwind: true,
      plausibility: "high",
      pollutants: ["pm2_5"],
      osm_type: "node",
      osm_id: "1",
      osm_url: "u",
    },
    supporting_evidence: [],
    contradicting_evidence: [],
    uncertainty: [],
  };
}

describe("sortHypotheses", () => {
  it("orders by score then by proximity", () => {
    const list = [h("low", 0, 1), h("high", 3, 4), h("medium", 2, 5)];
    const sorted = sortHypotheses(list);
    expect(sorted.map((x) => x.score)).toEqual([3, 2, 0]);
  });

  it("breaks score ties by distance", () => {
    const list = [h("medium", 2, 5), h("medium", 2, 1.5)];
    const sorted = sortHypotheses(list);
    expect(sorted[0].source.distance_km).toBe(1.5);
  });
});

describe("confidence helpers", () => {
  it("ranks confidence", () => {
    expect(CONFIDENCE_RANK.high).toBeGreaterThan(CONFIDENCE_RANK.medium);
    expect(CONFIDENCE_RANK.medium).toBeGreaterThan(CONFIDENCE_RANK.low);
  });
  it("maps confidence to tones", () => {
    expect(confidenceTone("high")).toBe("good");
    expect(confidenceTone("medium")).toBe("moderate");
    expect(confidenceTone("low")).toBe("veryPoor");
  });
});

describe("hasCausalLanguage (honesty guard)", () => {
  it("rejects causal phrasing", () => {
    expect(hasCausalLanguage("the landfill caused the pollution")).toBe(true);
    expect(hasCausalLanguage("confirmed source is the road")).toBe(true);
  });
  it("allows associative phrasing", () => {
    expect(hasCausalLanguage("likely contributor, upwind within 3 km")).toBe(false);
    expect(hasCausalLanguage("association only, medium confidence")).toBe(false);
  });
});

describe("summariseHypotheses", () => {
  it("handles empty and non-empty", () => {
    expect(summariseHypotheses(0, null)).toMatch(/no candidate sources/);
    expect(summariseHypotheses(2, "high")).toMatch(/2 candidate sources/);
    expect(summariseHypotheses(2, "high")).toMatch(/High confidence/);
  });
});
