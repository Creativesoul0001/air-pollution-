export const DEFAULT_COORD = { lat: 28.6315, lon: 77.2167 }; // Connaught Place, New Delhi

export interface Place {
  name: string;
  lat: number;
  lon: number;
}

/** A small set of real Delhi coordinates for the on-device search (zero-credential dev fallback). */
export const DELHI_PLACES: Place[] = [
  { name: "Connaught Place", lat: 28.6315, lon: 77.2167 },
  { name: "India Gate", lat: 28.6129, lon: 77.2295 },
  { name: "ITO Junction", lat: 28.628, lon: 77.2405 },
  { name: "Anand Vihar", lat: 28.6469, lon: 77.3152 },
  { name: "Ghazipur Landfill", lat: 28.6219, lon: 77.3264 },
  { name: "Bhalswa Landfill", lat: 28.7549, lon: 77.1537 },
  { name: "Okhla Landfill", lat: 28.5326, lon: 77.275 },
  { name: "Dwarka", lat: 28.5921, lon: 77.046 },
  { name: "RK Puram", lat: 28.5633, lon: 77.1803 },
  { name: "Narela", lat: 28.8527, lon: 77.0929 },
  { name: "Rohini", lat: 28.7495, lon: 77.0565 },
  { name: "Lajpat Nagar", lat: 28.5677, lon: 77.2433 },
];

export const SOURCE_META: Record<
  string,
  { label: string; color: string; ring: string }
> = {
  landfill: { label: "Landfill", color: "bg-red-600", ring: "ring-red-300" },
  construction: { label: "Construction", color: "bg-orange-500", ring: "ring-orange-300" },
  industrial: { label: "Industrial", color: "bg-slate-700", ring: "ring-slate-300" },
  major_junction: { label: "Traffic", color: "bg-amber-500", ring: "ring-amber-300" },
  fire: { label: "Fire", color: "bg-rose-700", ring: "ring-rose-300" },
  kiln: { label: "Brick kiln", color: "bg-yellow-700", ring: "ring-yellow-300" },
};

export function sourceMeta(type: string) {
  return SOURCE_META[type] ?? { label: type, color: "bg-slate-500", ring: "ring-slate-300" };
}
