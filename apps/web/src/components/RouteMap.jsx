import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Plus, Minus, RotateCcw, MapPin, Layers, Play, Pause, RefreshCw, Truck } from "lucide-react";

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
  const vehiclesLayerGroupRef = useRef(null);
  const [activeTileLayer, setActiveTileLayer] = useState("osm");

  // Vehicle Simulation State
  const [simPlaying, setSimPlaying] = useState(false);
  const [simProgress, setSimProgress] = useState(0); // 0 to 1
  const [simSpeed, setSimSpeed] = useState(1); // 1x, 2x, 4x
  const animFrameRef = useRef(null);
  const lastTimeRef = useRef(null);

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

    const vehiclesLayerGroup = L.layerGroup().addTo(map);
    vehiclesLayerGroupRef.current = vehiclesLayerGroup;

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

  // Build full coordinate path for each vehicle route or single vehicle shortest-path route
  const vehicleRoutePaths = useMemo(() => {
    // 1. If result has multiple/single fleet routes
    if (result?.routes && depot) {
      return result.routes.map((route, routeIdx) => {
        const coords = route.map((index) => {
          if (index === 0) return [depot.lat, depot.lng];
          const st = stops[index - 1];
          return st ? [st.lat, st.lng] : null;
        }).filter(Boolean);

        // Precalculate segment distances for constant-speed interpolation
        let totalDist = 0;
        const segDists = [];
        for (let i = 0; i < coords.length - 1; i++) {
          const dLat = coords[i + 1][0] - coords[i][0];
          const dLng = coords[i + 1][1] - coords[i][1];
          const d = Math.sqrt(dLat * dLat + dLng * dLng);
          segDists.push(d);
          totalDist += d;
        }

        return {
          routeIdx,
          color: ROUTE_COLORS[routeIdx % ROUTE_COLORS.length],
          coords,
          totalDist,
          segDists,
          label: `Vehicle ${routeIdx + 1}`,
          shortLabel: `V${routeIdx + 1}`,
        };
      }).filter((r) => r.coords.length > 1);
    }

    // 2. If a single vehicle path is provided via highlightPath (e.g. Shortest Path & MST Suite)
    if (Array.isArray(highlightPath) && highlightPath.length > 1) {
      const allPoints = depot ? [depot, ...stops] : stops;
      const coords = highlightPath.map((idx) => {
        const pt = allPoints[idx];
        return pt && Number.isFinite(pt.lat) && Number.isFinite(pt.lng) ? [pt.lat, pt.lng] : null;
      }).filter(Boolean);

      if (coords.length > 1) {
        let totalDist = 0;
        const segDists = [];
        for (let i = 0; i < coords.length - 1; i++) {
          const dLat = coords[i + 1][0] - coords[i][0];
          const dLng = coords[i + 1][1] - coords[i][1];
          const d = Math.sqrt(dLat * dLat + dLng * dLng);
          segDists.push(d);
          totalDist += d;
        }

        return [{
          routeIdx: 0,
          color: highlightColor || "#2b72e5",
          coords,
          totalDist,
          segDists,
          label: "Active Vehicle",
          shortLabel: "V1",
        }];
      }
    }

    return [];
  }, [result, depot, stops, highlightPath, highlightColor]);

  // Reset simulation when result or highlighted path changes
  useEffect(() => {
    setSimProgress(0);
    setSimPlaying(false);
  }, [result, highlightPath]);

  // Animation frame loop for continuous smooth motion
  useEffect(() => {
    if (!simPlaying || !vehicleRoutePaths.length) {
      lastTimeRef.current = null;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    const durationMs = 12000; // 12 seconds for a complete lap at 1x speed

    const stepAnim = (timestamp) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const dt = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      setSimProgress((prev) => {
        const next = prev + (dt / durationMs) * simSpeed;
        if (next >= 1) {
          // Loop around or complete
          return next % 1;
        }
        return next;
      });

      animFrameRef.current = requestAnimationFrame(stepAnim);
    };

    animFrameRef.current = requestAnimationFrame(stepAnim);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [simPlaying, simSpeed, vehicleRoutePaths.length]);

  // Render moving vehicle markers at current simProgress
  useEffect(() => {
    const vGroup = vehiclesLayerGroupRef.current;
    if (!vGroup) return;
    vGroup.clearLayers();

    if (!vehicleRoutePaths.length) return;

    vehicleRoutePaths.forEach(({ routeIdx, color, coords, totalDist, segDists, label, shortLabel }) => {
      if (coords.length < 2) return;
      if (selectedRoute !== null && selectedRoute !== routeIdx) return; // dim or hide unselected if desired

      // Find position along polyline according to simProgress
      let targetDist = simProgress * totalDist;
      let currLat = coords[0][0];
      let currLng = coords[0][1];
      let nextLat = coords[1][0];
      let nextLng = coords[1][1];
      let heading = 0;

      let accumulated = 0;
      for (let i = 0; i < segDists.length; i++) {
        const d = segDists[i];
        if (targetDist <= accumulated + d || i === segDists.length - 1) {
          const segT = d > 0 ? Math.min(1, Math.max(0, (targetDist - accumulated) / d)) : 0;
          currLat = coords[i][0] + (coords[i + 1][0] - coords[i][0]) * segT;
          currLng = coords[i][1] + (coords[i + 1][1] - coords[i][1]) * segT;
          nextLat = coords[i + 1][0];
          nextLng = coords[i + 1][1];

          // Compute rough angle in degrees
          const dY = coords[i + 1][0] - coords[i][0];
          const dX = coords[i + 1][1] - coords[i][1];
          heading = Math.round((Math.atan2(dX, dY) * 180) / Math.PI);
          break;
        }
        accumulated += d;
      }

      const vehicleHtml = `
        <div class="custom-vehicle-marker" style="--vehicle-color: ${color}; transform: rotate(${heading}deg);">
          <div class="vehicle-marker-pulse"></div>
          <div class="vehicle-marker-body">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
              <path d="M15 18H9" />
              <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
              <circle cx="17" cy="18" r="2" />
              <circle cx="7" cy="18" r="2" />
            </svg>
          </div>
          <span class="vehicle-marker-label" style="transform: rotate(${-heading}deg);">${shortLabel || `V${routeIdx + 1}`}</span>
        </div>
      `;

      const vIcon = L.divIcon({
        html: vehicleHtml,
        className: "leaflet-custom-vehicle-icon",
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });

      const vMarker = L.marker([currLat, currLng], { icon: vIcon, zIndexOffset: 1000 });
      vMarker.bindTooltip(`<b>${label || `Vehicle ${routeIdx + 1}`}</b><br/>En Route · ${Math.round(simProgress * 100)}% transit`, {
        direction: "top",
        offset: [0, -12],
      });
      vMarker.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        onSelectRoute?.(routeIdx);
      });

      vGroup.addLayer(vMarker);
    });
  }, [simProgress, vehicleRoutePaths, selectedRoute, onSelectRoute]);

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
        {/* Vehicle Dispatch Simulator Toolbar when routes are present */}
        {vehicleRoutePaths.length > 0 && (
          <div className="map-toolbar-group vehicle-sim-toolbar">
            <button
              type="button"
              className={`map-tool-btn sim-play-btn ${simPlaying ? "sim-active" : ""}`}
              onClick={() => setSimPlaying((prev) => !prev)}
              title={simPlaying ? "Pause vehicle movement" : "Simulate vehicles moving on routes"}
            >
              {simPlaying ? <Pause size={15} /> : <Play size={15} />}
            </button>
            <button
              type="button"
              className="map-tool-btn sim-speed-btn"
              onClick={() => setSimSpeed((prev) => (prev === 1 ? 2 : prev === 2 ? 4 : 1))}
              title="Toggle animation playback speed"
            >
              <span className="sim-speed-text">{simSpeed}×</span>
            </button>
            <button
              type="button"
              className="map-tool-btn"
              onClick={() => {
                setSimProgress(0);
                setSimPlaying(false);
              }}
              title="Reset vehicles to depot"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        )}

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

      {/* Moving Vehicles Live Status Banner */}
      {vehicleRoutePaths.length > 0 && (
        <div className="map-vehicle-tracker-badge">
          <Truck size={13} />
          <span>
            {simPlaying ? `Vehicles Moving (${simSpeed}×)` : "Vehicle Simulation"} · {Math.round(simProgress * 100)}% route completed
          </span>
          <button
            type="button"
            className="sim-badge-toggle"
            onClick={() => setSimPlaying((prev) => !prev)}
          >
            {simPlaying ? "Pause" : "Start Live"}
          </button>
        </div>
      )}

      {/* Click-to-pick location hint */}
      <div className="map-interaction-hint">
        <MapPin size={13} />
        <span>Click anywhere on the real map to select stop coordinates</span>
      </div>
    </div>
  );
}
