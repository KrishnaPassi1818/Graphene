import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Plus, Minus, RotateCcw, MapPin, Layers } from "lucide-react";

// Curri / User Palette route colors
export const ROUTE_COLORS = [
  "#aeac78", // rgb(174, 172, 120) Sage Green/Olive
  "#f2c46a", // rgb(242, 196, 106) Golden Yellow
  "#4c4541", // rgb(76, 69, 65) Deep Slate Brown
  "#c88d38", // Warm Amber
  "#6e8268", // Forest Olive
  "#a66b4e", // Terracotta
];

export default function RouteMap({
  depot,
  stops = [],
  result,
  selectedRoute,
  onSelectRoute,
  onLocationSelect,
  highlightEdges = [],
  highlightPath = [],
  highlightColor = "#2b72e5",
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layersGroupRef = useRef(null);
  const [activeTileLayer, setActiveTileLayer] = useState("osm");

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const centerLat = depot?.lat || 30.9004;
    const centerLng = depot?.lng || 75.8573;

    const map = L.map(mapContainerRef.current, {
      center: [centerLat, centerLng],
      zoom: 13,
      zoomControl: false,
      attributionControl: true,
    });

    const osmLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
    }).addTo(map);

    map._tileLayer = osmLayer;

    const layersGroup = L.layerGroup().addTo(map);
    layersGroupRef.current = layersGroup;
    mapInstanceRef.current = map;

    // Handle map click for selecting real locations
    map.on("click", (e) => {
      const { lat, lng } = e.latlng;
      if (onLocationSelect) {
        onLocationSelect({ lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) });
      }
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Tile Layer if user toggles
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !map._tileLayer) return;

    map.removeLayer(map._tileLayer);

    let newLayer;
    if (activeTileLayer === "satellite") {
      newLayer = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 18,
        attribution: "Tiles &copy; Esri",
      });
    } else {
      newLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
      });
    }

    newLayer.addTo(map);
    map._tileLayer = newLayer;
  }, [activeTileLayer]);

  // Redraw Depot, Stops, and Route Polylines whenever data changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = layersGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    const bounds = [];

    // Helper: Map stop index to route index
    const stopToRouteMap = new Map();
    if (result?.routes) {
      result.routes.forEach((route, routeIdx) => {
        route.slice(1, -1).forEach((stopIndex) => {
          stopToRouteMap.set(stopIndex, routeIdx);
        });
      });
    }

    // 1. Draw Routes (Polylines)
    if (result?.routes) {
      result.routes.forEach((route, routeIdx) => {
        const isSelected = selectedRoute === routeIdx;
        const isDimmed = selectedRoute !== null && !isSelected;
        const color = ROUTE_COLORS[routeIdx % ROUTE_COLORS.length];

        const latLngs = route.map((index) => {
          if (index === 0) return [depot.lat, depot.lng];
          const st = stops[index - 1];
          return st ? [st.lat, st.lng] : null;
        }).filter(Boolean);

        if (latLngs.length > 1) {
          // Route background casing
          const polylineBg = L.polyline(latLngs, {
            color: "#4c4541",
            weight: isSelected ? 8 : 5,
            opacity: isDimmed ? 0.15 : 0.45,
            lineJoin: "round",
          });
          layerGroup.addLayer(polylineBg);

          // Route stroke
          const polyline = L.polyline(latLngs, {
            color: color,
            weight: isSelected ? 5.5 : 3.5,
            opacity: isDimmed ? 0.25 : 0.95,
            dashArray: isSelected ? "8, 6" : undefined,
            lineJoin: "round",
          });

          polyline.on("click", (e) => {
            L.DomEvent.stopPropagation(e);
            onSelectRoute?.(routeIdx);
          });

          const load = result.loads?.[routeIdx] || 0;
          const dist = result.perRouteCost?.[routeIdx] || 0;
          polyline.bindTooltip(
            `<b>Vehicle ${routeIdx + 1}</b><br/>Distance: ${dist.toFixed(2)} km<br/>Load: ${load} kg`,
            { sticky: true, className: "leaflet-custom-tooltip" }
          );

          layerGroup.addLayer(polyline);
        }
      });
    }

    // 1b. Draw Highlighted MST / Shortest Path Edges
    const allPoints = depot ? [depot, ...stops] : stops;
    if (Array.isArray(highlightEdges) && highlightEdges.length > 0) {
      highlightEdges.forEach((edge) => {
        const u = allPoints[edge.from];
        const v = allPoints[edge.to];
        if (u && v && Number.isFinite(u.lat) && Number.isFinite(v.lat)) {
          const edgeLine = L.polyline([[u.lat, u.lng], [v.lat, v.lng]], {
            color: highlightColor,
            weight: 4.5,
            opacity: 0.85,
            dashArray: "6, 6",
            lineCap: "round",
          });
          if (edge.weight != null) {
            edgeLine.bindTooltip(`Edge (${edge.from} ↔ ${edge.to}): ${Number(edge.weight).toFixed(2)} km`, { sticky: true });
          }
          layerGroup.addLayer(edgeLine);
        }
      });
    }

    // 1c. Draw Highlighted Shortest Path
    if (Array.isArray(highlightPath) && highlightPath.length > 1) {
      const pathCoords = highlightPath.map((idx) => {
        const pt = allPoints[idx];
        return pt ? [pt.lat, pt.lng] : null;
      }).filter(Boolean);

      if (pathCoords.length > 1) {
        const casing = L.polyline(pathCoords, {
          color: "#ffffff",
          weight: 9,
          opacity: 0.9,
          lineJoin: "round",
        });
        layerGroup.addLayer(casing);

        const pathLine = L.polyline(pathCoords, {
          color: highlightColor,
          weight: 6,
          opacity: 0.95,
          lineJoin: "round",
        });
        pathLine.bindTooltip(`Shortest Path: ${highlightPath.join(" → ")}`, { sticky: true });
        layerGroup.addLayer(pathLine);
      }
    }

    // 2. Draw Delivery Stops Markers
    stops.forEach((stop, idx) => {
      if (!Number.isFinite(stop.lat) || !Number.isFinite(stop.lng)) return;
      bounds.push([stop.lat, stop.lng]);

      const routeIdx = stopToRouteMap.get(idx + 1);
      const isAssigned = routeIdx !== undefined;
      const isDimmed = selectedRoute !== null && routeIdx !== selectedRoute;
      const markerColor = isAssigned ? ROUTE_COLORS[routeIdx % ROUTE_COLORS.length] : "#aeac78";

      const html = `
        <div class="custom-map-marker stop-marker ${isDimmed ? "marker-dimmed" : ""} ${selectedRoute === routeIdx ? "marker-selected" : ""}" 
             style="--marker-color: ${markerColor};">
          <span class="marker-badge">${idx + 1}</span>
        </div>
      `;

      const icon = L.divIcon({
        html,
        className: "leaflet-custom-div-icon",
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker([stop.lat, stop.lng], { icon });
      marker.bindPopup(`
        <div class="map-popup-card">
          <div class="popup-tag">STOP #${idx + 1}</div>
          <h4 class="popup-title">${stop.label || `Stop ${idx + 1}`}</h4>
          <p class="popup-address">${stop.address || "Delivery Location"}</p>
          <div class="popup-meta">
            <span><strong>Weight:</strong> ${stop.demand || 0} kg</span>
            <span><strong>Service:</strong> ${stop.serviceMinutes || 5} min</span>
          </div>
          ${isAssigned ? `<div class="popup-route-pill" style="background:${markerColor}22; color:${markerColor};">Assigned to Vehicle ${routeIdx + 1}</div>` : ""}
        </div>
      `);

      marker.on("click", () => {
        if (isAssigned && onSelectRoute) onSelectRoute(routeIdx);
      });

      layerGroup.addLayer(marker);
    });

    // 3. Draw Depot Marker
    if (depot && Number.isFinite(depot.lat) && Number.isFinite(depot.lng)) {
      bounds.push([depot.lat, depot.lng]);

      const depotHtml = `
        <div class="custom-map-marker depot-marker" style="--marker-color: #4c4541;">
          <div class="depot-icon-inner">★</div>
        </div>
      `;

      const depotIcon = L.divIcon({
        html: depotHtml,
        className: "leaflet-custom-div-icon",
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });

      const depotMarker = L.marker([depot.lat, depot.lng], { icon: depotIcon });
      depotMarker.bindPopup(`
        <div class="map-popup-card">
          <div class="popup-tag" style="background: #4c4541; color: #fcf0da;">HEADQUARTERS</div>
          <h4 class="popup-title">${depot.label || "Main Distribution Hub"}</h4>
          <p class="popup-address">${depot.address || "Central Logistics Depot"}</p>
          <div class="popup-meta">
            <span><strong>Coordinates:</strong> ${depot.lat.toFixed(4)}, ${depot.lng.toFixed(4)}</span>
          </div>
        </div>
      `);
      layerGroup.addLayer(depotMarker);
    }

    // Auto-fit bounds if we have points
    if (bounds.length > 0 && map) {
      try {
        map.fitBounds(bounds, { padding: [45, 45], maxZoom: 15 });
      } catch (err) {
        console.error("Leaflet fitBounds error:", err);
      }
    }
  }, [depot, stops, result, selectedRoute, highlightEdges, highlightPath, highlightColor]);

  const handleZoomIn = () => mapInstanceRef.current?.zoomIn();
  const handleZoomOut = () => mapInstanceRef.current?.zoomOut();
  const handleResetView = () => {
    const map = mapInstanceRef.current;
    if (!map || !depot) return;
    map.setView([depot.lat, depot.lng], 13);
  };

  return (
    <div className="real-map-wrapper">
      {/* Real Free OpenStreetMap Canvas */}
      <div ref={mapContainerRef} className="real-map-container" />

      {/* Floating Map Controls */}
      <div className="real-map-toolbar">
        <div className="map-toolbar-group">
          <button type="button" className="map-tool-btn" onClick={handleZoomIn} title="Zoom in">
            <Plus size={16} />
          </button>
          <button type="button" className="map-tool-btn" onClick={handleZoomOut} title="Zoom out">
            <Minus size={16} />
          </button>
          <button type="button" className="map-tool-btn" onClick={handleResetView} title="Center on depot">
            <RotateCcw size={15} />
          </button>
        </div>

        <div className="map-toolbar-group">
          <button
            type="button"
            className={`map-tool-btn layer-btn ${activeTileLayer === "osm" ? "layer-active" : ""}`}
            onClick={() => setActiveTileLayer(activeTileLayer === "osm" ? "satellite" : "osm")}
            title="Toggle Satellite / Streets Layer"
          >
            <Layers size={15} />
            <span className="layer-label">{activeTileLayer === "osm" ? "Street" : "Satellite"}</span>
          </button>
        </div>
      </div>

      {/* Click-to-pick location hint */}
      <div className="map-interaction-hint">
        <MapPin size={13} />
        <span>Click anywhere on the real map to select stop coordinates</span>
      </div>
    </div>
  );
}
