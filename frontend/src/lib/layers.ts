export interface MapLayer {
  key: string;
  category: string | null; // null = special (air quality observations)
  color: string;
  label: string;
}

export const MAP_LAYERS: MapLayer[] = [
  { key: "airQuality", category: null, color: "var(--dd-accent)", label: "Air quality (PM2.5)" },
  { key: "schools", category: "school", color: "var(--dd-accent2)", label: "Schools" },
  { key: "hospitals", category: "hospital", color: "var(--dd-crit)", label: "Hospitals" },
  { key: "metro", category: "metro_station", color: "var(--dd-purple)", label: "Metro stations" },
  { key: "parks", category: "park", color: "#22c55e", label: "Parks" },
  { key: "landmarks", category: "landmark", color: "#f472b6", label: "Landmarks" },
  { key: "majorRoads", category: "major_road", color: "#64748b", label: "Major roads" },
];
