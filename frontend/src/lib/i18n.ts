export type Lang = "en" | "hi";

interface Dict {
  navMap: string;
  navInvestigate: string;
  navAnalytics: string;
  navSources: string;
  navAbout: string;
  subtitle: string;
  searchPlaceholder: string;
  clear: string;
  searching: string;
  noMatches: string;
  searchUnavailable: string;
  coverageGeo: string;
  coverageIndexed: string;
  coverageObserved: string;
  coveragePoi: string;
  coverageCities: string;
  tabLive: string;
  tabSources: string;
  tabActions: string;
  tabAdvice: string;
  tabInvestigate: string;
  aqi: string;
  lastUpdated: string;
  provider: string;
  unavailable: string;
  refresh: string;
}

const en: Dict = {
  navMap: "Map",
  navInvestigate: "Investigate",
  navAnalytics: "Analytics",
  navSources: "Data Sources",
  navAbout: "About",
  subtitle: "Clean Air. Clear Actions. Healthier Delhi NCR.",
  searchPlaceholder: "Search Delhi NCR localities, sectors, roads, schools, hospitals, metro…",
  clear: "Clear selection",
  searching: "Searching…",
  noMatches: "No indexed locations match.",
  searchUnavailable: "Location search unavailable (backend offline).",
  coverageGeo: "Delhi NCR geographic coverage",
  coverageIndexed: "Locations indexed",
  coverageObserved: "With pollution data",
  coveragePoi: "Relevant points of interest",
  coverageCities: "Cities / areas covered",
  tabLive: "Live Data",
  tabSources: "Sources",
  tabActions: "Actions",
  tabAdvice: "Advice",
  tabInvestigate: "Investigate",
  aqi: "AQI (CPCB PM2.5 sub-index)",
  lastUpdated: "Last updated",
  provider: "Provider",
  unavailable: "Unavailable",
  refresh: "Refresh",
};

const hi: Partial<Dict> = {
  navMap: "नक्शा",
  navInvestigate: "जाँच",
  navAnalytics: "विश्लेषण",
  navSources: "डेटा स्रोत",
  navAbout: "परिचय",
  subtitle: "स्वच्छ हवा। स्पष्ट कदम। स्वस्थ दिल्ली NCR।",
  searchPlaceholder: "दिल्ली NCR में इलाके, सेक्टर, सड़कें, स्कूल, अस्पताल, मेट्रो खोजें…",
  searching: "खोज रहे हैं…",
  refresh: "रिफ्रेश",
};

export function t(lang: Lang): Dict {
  return { ...en, ...(lang === "hi" ? hi : {}) };
}

export const POLLUTANT_LABELS: Record<Lang, Record<string, string>> = {
  en: {},
  hi: { pm2_5: "पीएम 2.5", pm10: "पीएम 10" },
};
