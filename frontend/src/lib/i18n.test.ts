import { t } from "./i18n";

describe("i18n", () => {
  it("has English labels", () => {
    const en = t("en");
    expect(en.navMap).toBe("Map");
    expect(en.navSources).toBe("Data Sources");
  });
  it("translates key nav labels into Hindi", () => {
    const hi = t("hi");
    expect(hi.navMap).toBe("नक्शा");
    expect(hi.navSources).toBe("डेटा स्रोत");
  });
  it("falls back to English for untranslated keys (no undefined)", () => {
    const hi = t("hi");
    expect(hi.coverageIndexed).toBe("Locations indexed");
    expect(Object.values(hi).every((v) => typeof v === "string" && v.length > 0)).toBe(true);
  });
});
