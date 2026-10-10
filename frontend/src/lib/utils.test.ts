import { cn, formatPM25, formatCount, categoryOf } from "./utils";
import { haversineKm, conePolygon, destPointGeoJSON } from "./geo";

describe("cn", () => {
  it("merges conflicting tailwind classes", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
});

describe("formatPM25", () => {
  it("rounds large values and keeps one decimal below 100", () => {
    expect(formatPM25(198.6)).toBe("199");
    expect(formatPM25(87.42)).toBe("87.4");
  });
});

describe("formatCount", () => {
  it("uses Indian digit grouping", () => {
    expect(formatCount(19544)).toBe("19,544");
    expect(formatCount(0)).toBe("0");
  });
});

describe("categoryOf", () => {
  it("maps PM2.5 to CPCB bands", () => {
    expect(categoryOf(25)).toBe("good");
    expect(categoryOf(45)).toBe("moderate");
    expect(categoryOf(75)).toBe("poor");
    expect(categoryOf(110)).toBe("veryPoor");
    expect(categoryOf(200)).toBe("severe");
  });
});

describe("geo", () => {
  it("haversine is zero for identical points", () => {
    expect(haversineKm(28.6, 77.2, 28.6, 77.2)).toBeCloseTo(0, 6);
  });

  it("haversine between two Delhi landmarks is plausible (0–50 km)", () => {
    const d = haversineKm(28.6315, 77.2167, 28.6129, 77.2295); // CP -> India Gate
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThan(50);
  });

  it("destPoint moves north for bearing 0", () => {
    const [lon, lat] = destPointGeoJSON(28.6, 77.2, 0, 10);
    expect(lat).toBeGreaterThan(28.6);
    expect(lon).toBeCloseTo(77.2, 3);
  });

  it("conePolygon returns a closed ring including apex", () => {
    const ring = conePolygon(28.6, 77.2, 305, 5, 60)[0];
    expect(ring[0]).toEqual([77.2, 28.6]);
    expect(ring[ring.length - 1]).toEqual([77.2, 28.6]);
    expect(ring.length).toBeGreaterThan(10);
  });
});
