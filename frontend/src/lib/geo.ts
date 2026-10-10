const R = 6371; // km
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

export function haversineKm(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number
): number {
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Point at `distKm` along bearing `brgDeg` (clockwise from north). Returns [lon, lat]. */
export function destPointGeoJSON(
  lat: number,
  lon: number,
  brgDeg: number,
  distKm: number
): [number, number] {
  const brg = toRad(brgDeg);
  const d = distKm / R;
  const lat1 = toRad(lat);
  const lon1 = toRad(lon);
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brg)
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brg) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    );
  return [toDeg(lon2), toDeg(lat2)];
}

/** A triangular wedge (apex at the origin) pointing toward `towardDeg`. */
export function conePolygon(
  lat: number,
  lon: number,
  towardDeg: number,
  radiusKm = 5,
  halfAngleDeg = 60,
  steps = 16
): number[][][] {
  const apex: [number, number] = [lon, lat];
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const a = -halfAngleDeg + (2 * halfAngleDeg * i) / steps;
    ring.push(destPointGeoJSON(lat, lon, (towardDeg + a + 360) % 360, radiusKm));
  }
  return [[apex, ...ring, apex]];
}
