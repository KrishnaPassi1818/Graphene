import { useMemo, useState } from "react";
import { Crosshair, Layers2, Minus, Plus } from "lucide-react";

const ROUTE_COLORS = ["#2b72e5", "#0eaa87", "#e39a22", "#8c62d8", "#ec6c69", "#1686a9"];

export default function RouteMap({ depot, stops, result, selectedRoute, onSelectRoute }) {
  const [zoom, setZoom] = useState(1);
  const [hovered, setHovered] = useState(null);
  const size = { width: 1000, height: 560, padding: 75 };
  const projection = useMemo(() => {
    const points = [depot, ...stops];
    const latitudes = points.map((point) => point.lat);
    const longitudes = points.map((point) => point.lng);
    const minLat = Math.min(...latitudes), maxLat = Math.max(...latitudes);
    const minLng = Math.min(...longitudes), maxLng = Math.max(...longitudes);
    const latSpan = Math.max(maxLat - minLat, 0.005);
    const lngSpan = Math.max(maxLng - minLng, 0.005);
    const innerWidth = size.width - size.padding * 2;
    const innerHeight = size.height - size.padding * 2;
    const scale = Math.min(innerWidth / lngSpan, innerHeight / latSpan);
    const usedW = lngSpan * scale, usedH = latSpan * scale;
    const offsetX = (size.width - usedW) / 2;
    const offsetY = (size.height - usedH) / 2;
    return (point) => ({
      x: offsetX + (point.lng - minLng) * scale,
      y: size.height - offsetY - (point.lat - minLat) * scale,
    });
  }, [depot, stops]);

  const pointToRoute = useMemo(() => {
    const map = new Map();
    result?.routes?.forEach((route, routeIndex) => route.slice(1, -1).forEach((stopIndex) => map.set(stopIndex, routeIndex)));
    return map;
  }, [result]);

  const routePaths = result?.routes?.map((route, routeIndex) => {
    const coords = route.map((index) => index === 0 ? projection(depot) : projection(stops[index - 1])).filter(Boolean);
    const d = coords.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
    return { d, color: ROUTE_COLORS[routeIndex % ROUTE_COLORS.length], routeIndex, coords };
  }) ?? [];

  const hoveredPoint = hovered?.type === "depot" ? projection(depot) : hovered?.type === "stop" ? projection(stops[hovered.index]) : null;
  const mapTransform = `translate(${size.width / 2} ${size.height / 2}) scale(${zoom}) translate(${-size.width / 2} ${-size.height / 2})`;

  return (
    <div className="route-map-frame">
      <svg className="route-map-svg" viewBox={`0 0 ${size.width} ${size.height}`} role="img" aria-label="Schematic route map with depot and delivery stops">
        <defs>
          <linearGradient id="mapWash" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f5f8fb" /><stop offset="1" stopColor="#eef3f4" /></linearGradient>
          <pattern id="mapGrid" width="52" height="52" patternUnits="userSpaceOnUse"><path d="M52 0H0V52" fill="none" stroke="#d8e1e5" strokeWidth="1" opacity=".7" /></pattern>
          <filter id="markerShadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#233c4c" floodOpacity=".16" /></filter>
          <marker id="routeArrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="context-stroke" /></marker>
        </defs>
        <rect width={size.width} height={size.height} fill="url(#mapWash)" />
        <rect width={size.width} height={size.height} fill="url(#mapGrid)" />
        <g opacity=".55" fill="none" stroke="#cdd9de" strokeWidth="6" strokeLinecap="round">
          <path d="M-30 470 C180 385 250 340 390 285 S690 170 1030 220" />
          <path d="M130 -20 C170 100 260 190 330 245 S470 360 515 590" />
          <path d="M775 -20 C725 90 650 205 620 280 S570 420 610 590" />
          <path d="M-25 170 C180 190 260 135 420 112 S780 110 1030 75" />
        </g>
        <g opacity=".62" fill="none" stroke="#ffffff" strokeWidth="2.3" strokeLinecap="round">
          <path d="M-30 470 C180 385 250 340 390 285 S690 170 1030 220" />
          <path d="M130 -20 C170 100 260 190 330 245 S470 360 515 590" />
          <path d="M775 -20 C725 90 650 205 620 280 S570 420 610 590" />
          <path d="M-25 170 C180 190 260 135 420 112 S780 110 1030 75" />
        </g>
        <g transform={mapTransform}>
          {routePaths.map((path) => {
            const isDimmed = selectedRoute !== null && selectedRoute !== path.routeIndex;
            return <path key={path.routeIndex} className="route-line" d={path.d} fill="none" stroke={path.color} strokeWidth={selectedRoute === path.routeIndex ? 6 : 4.5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="10 7" markerEnd="url(#routeArrow)" opacity={isDimmed ? 0.16 : 0.78} onClick={() => onSelectRoute?.(path.routeIndex)} />;
          })}
          {stops.map((stop, index) => {
            const point = projection(stop);
            const routeIndex = pointToRoute.get(index + 1);
            const color = routeIndex == null ? "#6c8995" : ROUTE_COLORS[routeIndex % ROUTE_COLORS.length];
            const dimmed = selectedRoute !== null && routeIndex != null && selectedRoute !== routeIndex;
            return (
              <g key={stop.id} className="map-stop" transform={`translate(${point.x} ${point.y})`} filter="url(#markerShadow)" opacity={dimmed ? 0.28 : 1} onMouseEnter={() => setHovered({ type: "stop", index })} onMouseLeave={() => setHovered(null)}>
                <circle r="16" fill="#ffffff" stroke={color} strokeWidth="3" />
                <circle r="12" fill={color} />
                <text textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize="9" fontWeight="800">{String(index + 1).padStart(2, "0")}</text>
              </g>
            );
          })}
          {(() => {
            const point = projection(depot);
            return <g className="map-depot" transform={`translate(${point.x} ${point.y})`} filter="url(#markerShadow)" onMouseEnter={() => setHovered({ type: "depot" })} onMouseLeave={() => setHovered(null)}>
              <circle r="25" fill="#10243a" opacity=".1" />
              <rect x="-14" y="-14" width="28" height="28" rx="8" fill="#10243a" stroke="#fff" strokeWidth="3" />
              <path d="M-6 3V-4L0-8L6-4V3M-3 3V-1H2V3" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
            </g>;
          })()}
        </g>
        <g className="map-labels">
          <text x="28" y="38" className="map-region-label">LUDHIANA · PUNJAB</text>
          <text x="28" y="58" className="map-caption-label">SYNTHETIC DELIVERY AREA</text>
          <text x="818" y="522" className="map-neighborhood-label">NORTH ZONE</text>
        </g>
        {hoveredPoint && <g className="map-tooltip" transform={`translate(${Math.min(size.width - 180, hoveredPoint.x + 18)} ${Math.max(70, hoveredPoint.y - 14)})`}>
          <rect width="165" height="56" rx="10" fill="#10243a" opacity=".96" />
          <text x="12" y="21" fill="#fff" fontSize="11" fontWeight="700">{hovered.type === "depot" ? depot.label : stops[hovered.index]?.label}</text>
          <text x="12" y="40" fill="#b7c6d2" fontSize="10">{hovered.type === "depot" ? "Dispatch origin" : `${stops[hovered.index]?.demand} kg · stop ${String(hovered.index + 1).padStart(2, "0")}`}</text>
        </g>}
      </svg>
      <div className="map-controls">
        <button aria-label="Zoom in" onClick={() => setZoom((value) => Math.min(1.7, value + 0.15))}><Plus size={15} /></button>
        <button aria-label="Zoom out" onClick={() => setZoom((value) => Math.max(0.8, value - 0.15))}><Minus size={15} /></button>
        <button aria-label="Reset map view" onClick={() => setZoom(1)}><Crosshair size={15} /></button>
      </div>
      <div className="map-layer-chip"><Layers2 size={14} /><span>STREET SCHEMATIC</span></div>
      <div className="map-scale-chip"><span className="scale-line" /> 2 km</div>
    </div>
  );
}

export { ROUTE_COLORS };
