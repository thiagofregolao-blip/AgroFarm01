import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw";
import "leaflet-draw/dist/leaflet.draw.css";
import JSZip from "jszip";
import shp from "shpjs";

// Fix Leaflet default marker icon (broken in bundlers)
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";
// @ts-ignore
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

interface LatLng { lat: number; lng: number; }

interface PlotMapDrawProps {
    initialCoordinates?: LatLng[];
    onAreaCalculated: (areaHa: number) => void;
    onCoordinatesChange: (coords: LatLng[]) => void;
}

function calculateAreaHa(coords: LatLng[]): number {
    if (coords.length < 3) return 0;
    const latLngs = coords.map(c => L.latLng(c.lat, c.lng));
    const areaSqMeters = (L as any).GeometryUtil.geodesicArea(latLngs);
    return Math.round((areaSqMeters / 10000) * 100) / 100;
}

/** Parse KML XML string and extract first polygon coordinates */
function parseKmlCoordinates(kmlText: string): LatLng[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(kmlText, "text/xml");

    // Find all <coordinates> elements inside Polygon or LinearRing
    const coordElements = doc.getElementsByTagName("coordinates");
    if (coordElements.length === 0) return [];

    // Use the first coordinates block found (typically the outer boundary)
    for (let i = 0; i < coordElements.length; i++) {
        const text = (coordElements[i].textContent || "").trim();
        if (!text) continue;

        const coords: LatLng[] = [];
        // KML format: "lng,lat,alt lng,lat,alt ..." separated by whitespace
        const points = text.split(/\s+/).filter(Boolean);
        for (const point of points) {
            const parts = point.split(",");
            if (parts.length >= 2) {
                const lng = parseFloat(parts[0]);
                const lat = parseFloat(parts[1]);
                if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                    coords.push({ lat, lng });
                }
            }
        }
        // Remove last point if it's the same as the first (KML polygons close the ring)
        if (coords.length > 3) {
            const first = coords[0];
            const last = coords[coords.length - 1];
            if (Math.abs(first.lat - last.lat) < 0.000001 && Math.abs(first.lng - last.lng) < 0.000001) {
                coords.pop();
            }
        }
        if (coords.length >= 3) return coords;
    }
    return [];
}

/** Parse ISOXML — look for polygon coordinates in <Pln>/<LSG>/<PNT> elements */
function parseIsoxmlCoordinates(xmlText: string): LatLng[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, "text/xml");
    const coords: LatLng[] = [];

    // ISOXML uses PNT elements with A (lat) and B (lng) attributes
    const pntElements = doc.getElementsByTagName("PNT");
    for (let i = 0; i < pntElements.length; i++) {
        const lat = parseFloat(pntElements[i].getAttribute("C") || pntElements[i].getAttribute("A") || "");
        const lng = parseFloat(pntElements[i].getAttribute("D") || pntElements[i].getAttribute("B") || "");
        if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            coords.push({ lat, lng });
        }
    }

    // Also try GuidancePattern / Partfield boundaries
    if (coords.length === 0) {
        const plnElements = doc.getElementsByTagName("PLN");
        for (let i = 0; i < plnElements.length; i++) {
            const lsgList = plnElements[i].getElementsByTagName("LSG");
            for (let j = 0; j < lsgList.length; j++) {
                const pnts = lsgList[j].getElementsByTagName("PNT");
                for (let k = 0; k < pnts.length; k++) {
                    const lat = parseFloat(pnts[k].getAttribute("C") || pnts[k].getAttribute("A") || "");
                    const lng = parseFloat(pnts[k].getAttribute("D") || pnts[k].getAttribute("B") || "");
                    if (!isNaN(lat) && !isNaN(lng)) coords.push({ lat, lng });
                }
            }
        }
    }

    // Remove closing point if duplicated
    if (coords.length > 3) {
        const first = coords[0], last = coords[coords.length - 1];
        if (Math.abs(first.lat - last.lat) < 0.000001 && Math.abs(first.lng - last.lng) < 0.000001) {
            coords.pop();
        }
    }
    return coords;
}

/** Extract coordinates from a GeoJSON FeatureCollection (from Shapefile) */
function parseGeoJsonCoordinates(geojson: any): LatLng[] {
    const features = geojson.features || (Array.isArray(geojson) ? geojson.flatMap((g: any) => g.features || []) : []);
    for (const feature of features) {
        const geom = feature.geometry;
        if (!geom) continue;

        let ring: number[][] | undefined;
        if (geom.type === "Polygon") {
            ring = geom.coordinates[0]; // outer ring
        } else if (geom.type === "MultiPolygon") {
            ring = geom.coordinates[0]?.[0]; // first polygon, outer ring
        }

        if (ring && ring.length >= 3) {
            const coords = ring.map(([lng, lat]: number[]) => ({ lat, lng }));
            // Remove closing point
            const first = coords[0], last = coords[coords.length - 1];
            if (coords.length > 3 && Math.abs(first.lat - last.lat) < 0.000001 && Math.abs(first.lng - last.lng) < 0.000001) {
                coords.pop();
            }
            if (coords.length >= 3) return coords;
        }
    }
    return [];
}

/** Read a KML, KMZ, Shapefile (.zip), or ISOXML file and return polygon coordinates */
async function readMapFile(file: File): Promise<LatLng[]> {
    const ext = file.name.toLowerCase().split(".").pop();

    if (ext === "kmz") {
        const zip = await JSZip.loadAsync(file);
        const kmlFile = Object.keys(zip.files).find(name => name.toLowerCase().endsWith(".kml"));
        if (!kmlFile) throw new Error("Nenhum arquivo .kml encontrado dentro do KMZ");
        const kmlText = await zip.files[kmlFile].async("text");
        return parseKmlCoordinates(kmlText);
    } else if (ext === "kml") {
        const kmlText = await file.text();
        return parseKmlCoordinates(kmlText);
    } else if (ext === "zip") {
        // Shapefile ZIP → parse with shpjs → GeoJSON
        const buffer = await file.arrayBuffer();
        const geojson = await shp(buffer);
        return parseGeoJsonCoordinates(geojson);
    } else if (ext === "xml") {
        // ISOXML
        const xmlText = await file.text();
        const coords = parseIsoxmlCoordinates(xmlText);
        if (coords.length === 0) {
            // Maybe it's a KML saved as .xml
            const kmlCoords = parseKmlCoordinates(xmlText);
            if (kmlCoords.length >= 3) return kmlCoords;
        }
        return coords;
    } else if (ext === "shp") {
        throw new Error("Envie o Shapefile compactado em .zip (com .shp, .shx e .dbf juntos)");
    } else {
        throw new Error(`Formato não suportado: .${ext}. Use KML, KMZ, Shapefile (.zip) ou ISOXML (.xml)`);
    }
}

export default function PlotMapDraw({ initialCoordinates, onAreaCalculated, onCoordinatesChange }: PlotMapDrawProps) {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const polygonLayerRef = useRef<L.Polygon | null>(null);
    const drawnItemsRef = useRef<L.FeatureGroup | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const timersRef = useRef<number[]>([]);
    const [isReady, setIsReady] = useState(false);
    const [hasPolygon, setHasPolygon] = useState(!!initialCoordinates?.length);
    const [gpsLoading, setGpsLoading] = useState(false);
    const [importLoading, setImportLoading] = useState(false);
    const [showCoordInput, setShowCoordInput] = useState(false);
    const [coordText, setCoordText] = useState("");

    const updatePolygon = useCallback((coords: LatLng[]) => {
        onCoordinatesChange(coords);
        setHasPolygon(coords.length >= 3);
        onAreaCalculated(calculateAreaHa(coords));
    }, [onAreaCalculated, onCoordinatesChange]);

    // Get user's GPS location and fly to it
    const goToMyLocation = useCallback(() => {
        if (!mapRef.current) return;
        if (!navigator.geolocation) {
            alert("Seu navegador não suporta geolocalização.");
            return;
        }
        setGpsLoading(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setGpsLoading(false);
                if (mapRef.current) {
                    mapRef.current.flyTo([pos.coords.latitude, pos.coords.longitude], 16, { duration: 1.5 });
                }
            },
            (err) => {
                setGpsLoading(false);
                alert("Não foi possível obter sua localização. Verifique as permissões do navegador.");
                console.error("GPS error:", err);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    }, []);

    // Parse coordinate text and fly to it
    const goToCoordinates = useCallback(() => {
        if (!mapRef.current || !coordText.trim()) return;
        // Supports formats: "-25.2637, -54.3378" or "-25.2637 -54.3378"
        const parts = coordText.replace(/[,;]/g, " ").trim().split(/\s+/).filter(Boolean);
        if (parts.length >= 2) {
            const lat = parseFloat(parts[0]);
            const lng = parseFloat(parts[1]);
            if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                mapRef.current.flyTo([lat, lng], 16, { duration: 1.5 });
                setShowCoordInput(false);
                setCoordText("");
                return;
            }
        }
        alert("Coordenadas inválidas. Use o formato: -25.2637, -54.3378");
    }, [coordText]);

    // Import KML/KMZ file and load polygon on map
    const handleFileImport = useCallback(async (file: File) => {
        if (!mapRef.current || !drawnItemsRef.current) return;
        setImportLoading(true);
        try {
            const coords = await readMapFile(file);
            if (coords.length < 3) {
                alert("Nenhum polígono válido encontrado no arquivo. Verifique se o arquivo KML/KMZ contém áreas delimitadas.");
                return;
            }

            // Clear existing polygon
            drawnItemsRef.current.clearLayers();

            // Create new polygon from imported coordinates
            const polygon = L.polygon(
                coords.map(c => [c.lat, c.lng] as L.LatLngTuple),
                { color: "#22c55e", fillColor: "#22c55e", fillOpacity: 0.3, weight: 3 }
            );
            drawnItemsRef.current.addLayer(polygon);
            polygonLayerRef.current = polygon;

            // Zoom to polygon
            mapRef.current.fitBounds(polygon.getBounds(), { padding: [50, 50] });

            // Update coordinates and area
            updatePolygon(coords);
        } catch (err: any) {
            console.error("KML/KMZ import error:", err);
            alert(`Erro ao importar arquivo: ${err.message || "Formato inválido"}`);
        } finally {
            setImportLoading(false);
        }
    }, [updatePolygon]);

    useEffect(() => {
        if (!mapContainerRef.current || mapRef.current) return;
        const container = mapContainerRef.current;

        const initTimer = window.setTimeout(() => {
            if (!container || !document.body.contains(container)) return;
            if (!container.offsetWidth || !container.offsetHeight) return;

            // Default center: try to use user's saved farm location or Paraguay/PR region
            let center: L.LatLngExpression = [-25.2637, -54.3378]; // Región Este, Paraguay
            let zoom = 13;
            if (initialCoordinates && initialCoordinates.length > 0) {
                const bounds = L.latLngBounds(initialCoordinates.map(c => [c.lat, c.lng] as L.LatLngTuple));
                center = bounds.getCenter();
                zoom = 15;
            }

            const map = L.map(container, { center, zoom, zoomControl: true });

            // Google Maps Satellite tiles
            L.tileLayer("https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}", {
                maxZoom: 20,
                attribution: '&copy; Google Maps',
            }).addTo(map);

            // Google Maps labels overlay
            L.tileLayer("https://mt1.google.com/vt/lyrs=h&x={x}&y={y}&z={z}", {
                maxZoom: 20,
            }).addTo(map);

            // Draw tools
            const drawnItems = new L.FeatureGroup();
            map.addLayer(drawnItems);
            drawnItemsRef.current = drawnItems;

            const drawControl = new (L.Control as any).Draw({
                position: "topleft",
                draw: {
                    polygon: {
                        allowIntersection: false,
                        shapeOptions: { color: "#22c55e", fillColor: "#22c55e", fillOpacity: 0.3, weight: 3 },
                    },
                    polyline: false, circle: false, circlemarker: false, marker: false, rectangle: false,
                },
                edit: { featureGroup: drawnItems },
            });
            map.addControl(drawControl);

            // Load initial polygon
            if (initialCoordinates && initialCoordinates.length > 0) {
                const polygon = L.polygon(
                    initialCoordinates.map(c => [c.lat, c.lng] as L.LatLngTuple),
                    { color: "#22c55e", fillColor: "#22c55e", fillOpacity: 0.3, weight: 3 }
                );
                drawnItems.addLayer(polygon);
                polygonLayerRef.current = polygon;
                map.fitBounds(polygon.getBounds(), { padding: [50, 50] });
            } else {
                // If no initial coordinates, try to get GPS location automatically
                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                        (pos) => {
                            map.flyTo([pos.coords.latitude, pos.coords.longitude], 15, { duration: 1.5 });
                        },
                        () => { }, // Silently fail — will use default center
                        { enableHighAccuracy: true, timeout: 5000 }
                    );
                }
            }

            // Events
            map.on((L as any).Draw.Event.CREATED, (e: any) => {
                drawnItems.clearLayers();
                drawnItems.addLayer(e.layer);
                polygonLayerRef.current = e.layer;
                const latLngs = e.layer.getLatLngs()[0] as L.LatLng[];
                updatePolygon(latLngs.map((ll: L.LatLng) => ({ lat: ll.lat, lng: ll.lng })));
            });
            map.on((L as any).Draw.Event.EDITED, (e: any) => {
                e.layers.eachLayer((layer: any) => {
                    const latLngs = layer.getLatLngs()[0] as L.LatLng[];
                    updatePolygon(latLngs.map((ll: L.LatLng) => ({ lat: ll.lat, lng: ll.lng })));
                });
            });
            map.on((L as any).Draw.Event.DELETED, () => {
                polygonLayerRef.current = null;
                updatePolygon([]);
            });

            mapRef.current = map;
            setIsReady(true);

            // Safe invalidateSize
            [200, 500, 1000, 2000].forEach(ms => {
                const t = window.setTimeout(() => {
                    try { map.invalidateSize(); } catch (_) { }
                }, ms);
                timersRef.current.push(t);
            });
        }, 800);

        timersRef.current.push(initTimer);
        return () => {
            timersRef.current.forEach(t => window.clearTimeout(t));
            timersRef.current = [];
            if (mapRef.current) {
                try { mapRef.current.remove(); } catch (_) { }
                mapRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        const h = () => { try { mapRef.current?.invalidateSize(); } catch (_) { } };
        window.addEventListener("resize", h);
        return () => window.removeEventListener("resize", h);
    }, []);

    return (
        <div style={{ position: "relative", width: "100%", height: "100%", minHeight: 400 }}>
            <div ref={mapContainerRef} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%", zIndex: 1, background: "#d1d5db" }} />

            {!isReady && (
                <div style={{ position: "absolute", inset: 0, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "#e5e7eb" }}>
                    <div style={{ textAlign: "center" }}>
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto mb-2" />
                        <p style={{ color: "#6b7280", fontSize: 14 }}>Carregando Google Maps...</p>
                    </div>
                </div>
            )}

            {isReady && !hasPolygon && (
                <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 1000, pointerEvents: "none", background: "rgba(255,255,255,0.9)", padding: "6px 16px", borderRadius: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.15)", fontSize: 14, color: "#374151" }}>
                    🖱️ Desenhe o polígono <span style={{ color: "#16a34a", fontWeight: "bold" }}>(◇)</span> ou importe arquivo <span style={{ color: "#16a34a", fontWeight: "bold" }}>(📂)</span>
                </div>
            )}

            {/* GPS + Coordinate + Import buttons */}
            {isReady && (
                <div style={{ position: "absolute", bottom: 24, right: 12, zIndex: 1000, display: "flex", flexDirection: "column", gap: 8 }}>
                    {/* KML/KMZ Import Button */}
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept=".kml,.kmz,.zip,.xml,.shp"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileImport(file);
                            e.target.value = "";
                        }}
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={importLoading}
                        style={{
                            width: 44, height: 44, borderRadius: "50%",
                            background: "white", border: "2px solid #d1d5db",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                            cursor: importLoading ? "wait" : "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 18, transition: "all 0.2s",
                        }}
                        title="Importar mapa (KML, KMZ, Shapefile, ISOXML)"
                    >
                        {importLoading ? (
                            <span style={{ display: "inline-block", animation: "spin 1s linear infinite", fontSize: 16 }}>⏳</span>
                        ) : "📂"}
                    </button>

                    {/* GPS Button */}
                    <button
                        onClick={goToMyLocation}
                        disabled={gpsLoading}
                        style={{
                            width: 44, height: 44, borderRadius: "50%",
                            background: "white", border: "2px solid #d1d5db",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                            cursor: gpsLoading ? "wait" : "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 20, transition: "all 0.2s",
                        }}
                        title="Ir para minha localização GPS"
                    >
                        {gpsLoading ? (
                            <span style={{ display: "inline-block", animation: "spin 1s linear infinite", fontSize: 18 }}>⏳</span>
                        ) : "📍"}
                    </button>

                    {/* Coordinate input toggle */}
                    <button
                        onClick={() => setShowCoordInput(!showCoordInput)}
                        style={{
                            width: 44, height: 44, borderRadius: "50%",
                            background: showCoordInput ? "#059669" : "white",
                            color: showCoordInput ? "white" : "#374151",
                            border: "2px solid #d1d5db",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                            cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 18, transition: "all 0.2s",
                        }}
                        title="Inserir coordenadas manualmente"
                    >
                        🧭
                    </button>
                </div>
            )}

            {/* Coordinate input panel */}
            {showCoordInput && (
                <div style={{
                    position: "absolute", bottom: 80, right: 60, zIndex: 1001,
                    background: "white", borderRadius: 12,
                    boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
                    padding: 16, width: 280,
                }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
                        📍 Ir para coordenadas
                    </p>
                    <input
                        type="text"
                        value={coordText}
                        onChange={(e) => setCoordText(e.target.value)}
                        placeholder="Ex: -25.2637, -54.3378"
                        onKeyDown={(e) => { if (e.key === "Enter") goToCoordinates(); }}
                        style={{
                            width: "100%", padding: "8px 12px", border: "1px solid #d1d5db",
                            borderRadius: 8, fontSize: 14, outline: "none",
                            marginBottom: 8,
                        }}
                        autoFocus
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                        <button
                            onClick={goToCoordinates}
                            style={{
                                flex: 1, padding: "8px 12px", background: "#059669",
                                color: "white", border: "none", borderRadius: 8,
                                fontWeight: 600, fontSize: 13, cursor: "pointer",
                            }}
                        >
                            Ir ao local
                        </button>
                        <button
                            onClick={() => { setShowCoordInput(false); setCoordText(""); }}
                            style={{
                                padding: "8px 12px", background: "#f3f4f6",
                                color: "#6b7280", border: "none", borderRadius: 8,
                                fontSize: 13, cursor: "pointer",
                            }}
                        >
                            Fechar
                        </button>
                    </div>
                    <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>
                        Dica: Copie do Google Maps clicando no local
                    </p>
                </div>
            )}
        </div>
    );
}
