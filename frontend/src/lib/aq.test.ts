import {
  aqiFromPm25,
  hrsAgo,
  isStale,
  pm25ToSubIndex,
  resolveStatus,
  statusLabel,
  windDirToCompass,
  POLLUTANTS,
  pollutantMeta,
} from "./aq";

describe("pm25ToSubIndex (CPCB breakpoints)", () => {
  it("matches documented breakpoint values", () => {
    expect(pm25ToSubIndex(0)).toBe(0);
    expect(pm25ToSubIndex(30)).toBe(50);
    expect(pm25ToSubIndex(60)).toBe(100);
    expect(pm25ToSubIndex(90)).toBe(200);
    expect(pm25ToSubIndex(120)).toBe(300);
  });
});

describe("aqiFromPm25", () => {
  it("maps value to band + sub-index", () => {
    const good = aqiFromPm25(20);
    expect(good.band).toBe("good");
    expect(good.label).toBe("Good");
    expect(good.subIndex).toBe(pm25ToSubIndex(20));
  });
  it("severe for high PM2.5", () => {
    expect(aqiFromPm25(300).band).toBe("severe");
  });
});

describe("resolveStatus (honest labelling)", () => {
  it("model_estimate when live air available", () => {
    expect(resolveStatus({ air: true, ingested: true })).toBe("model_estimate");
  });
  it("cached_observation when only ingested data", () => {
    expect(resolveStatus({ air: false, ingested: true })).toBe("cached_observation");
  });
  it("unavailable when nothing available", () => {
    expect(resolveStatus({ air: false, ingested: false })).toBe("unavailable");
  });
  it("statusLabel returns readable labels (never 'Verified')", () => {
    expect(statusLabel("model_estimate")).toBe("Model estimate");
    expect(statusLabel("unavailable")).toBe("Unavailable");
    const all = (["live_observation", "cached_observation", "model_estimate", "development_fixture", "unavailable"] as const).map(statusLabel);
    expect(all).not.toContain("Verified");
  });
});

describe("windDirToCompass", () => {
  it("maps degrees to compass points", () => {
    expect(windDirToCompass(0)).toBe("N");
    expect(windDirToCompass(90)).toBe("E");
    expect(windDirToCompass(180)).toBe("S");
    expect(windDirToCompass(270)).toBe("W");
    expect(windDirToCompass(315)).toBe("NW");
  });
});

describe("isStale / hrsAgo", () => {
  it("treats null and old timestamps as stale", () => {
    expect(isStale(null)).toBe(true);
    expect(isStale(new Date(Date.now() - 3 * 3600_000).toISOString(), 90)).toBe(true);
    expect(isStale(new Date().toISOString(), 90)).toBe(false);
  });
  it("hrsAgo handles null", () => {
    expect(hrsAgo(null)).toBe("unknown time");
    expect(hrsAgo(new Date().toISOString())).toBe("just now");
  });
});

describe("pollutants", () => {
  it("only exposes provider-supported pollutants", () => {
    expect(POLLUTANTS.map((p) => p.key).sort()).toEqual(["co", "no2", "o3", "pm10", "pm2_5", "so2"]);
  });
  it("falls back for unknown pollutant", () => {
    expect(pollutantMeta("zzz").label).toBe("zzz");
  });
});
