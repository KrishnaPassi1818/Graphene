// Great-circle distance in kilometres using the Haversine formula.
const EARTH_RADIUS_KM = 6371.0088;
const toRadians = (degrees) => degrees * Math.PI / 180;

export function haversineKm(a, b) {
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const dLat = lat2 - lat1;
  const dLng = toRadians(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(Math.min(1, h)));
}

export function distanceMatrixFromPoints(points) {
  const matrix = Array.from({ length: points.length }, () => Array(points.length).fill(0));
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const distance = haversineKm(points[i], points[j]);
      matrix[i][j] = distance;
      matrix[j][i] = distance;
    }
  }
  return matrix;
}
