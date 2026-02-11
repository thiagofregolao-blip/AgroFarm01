import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw";
import "leaflet-draw/dist/leaflet.draw.css";

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

export default function PlotMapDraw({ initialCoordinates, onAreaCalculated, onCoordinatesChange }: PlotMapDrawProps) {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const polygonLayerRef = useRef<L.Polygon | null>(null);
    const timersRef = useRef<number[]>([]);
    const [isReady, setIsReady] = useState(false);
    const [hasPolygon, setHasPolygon] = useState(!!initialCoordinates?.length);

    const updatePolygon = useCallback((coords: LatLng[]) => {
        onCoordinatesChange(coords);
        setHasPolygon(coords.length >= 3);
        onAreaCalculated(calculateAreaHa(coords));
    }, [onAreaCalculated, onCoordinatesChange]);

    useEffect(() => {
        if (!mapContainerRef.current || mapRef.current) return;
        const container = mapContainerRef.current;

        const initTimer = window.setTimeout(() => {
            if (!container || !document.body.contains(container)) return;

            let center: L.LatLngExpression = [-22.35, -55.85];
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
                    🖱️ Clique no ícone de polígono <span style={{ color: "#16a34a", fontWeight: "bold" }}>(◇)</span> à esquerda para desenhar
                </div>
            )}
        </div>
    );
}
