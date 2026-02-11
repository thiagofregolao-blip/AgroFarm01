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

interface LatLng {
    lat: number;
    lng: number;
}

interface PlotMapDrawProps {
    initialCoordinates?: LatLng[];
    onAreaCalculated: (areaHa: number) => void;
    onCoordinatesChange: (coords: LatLng[]) => void;
}

// Calculate area of polygon in hectares using geodesic formula
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
    const [isReady, setIsReady] = useState(false);
    const [hasPolygon, setHasPolygon] = useState(!!initialCoordinates?.length);

    const updatePolygon = useCallback((coords: LatLng[]) => {
        onCoordinatesChange(coords);
        setHasPolygon(coords.length >= 3);
        const area = calculateAreaHa(coords);
        onAreaCalculated(area);
    }, [onAreaCalculated, onCoordinatesChange]);

    useEffect(() => {
        if (!mapContainerRef.current || mapRef.current) return;

        // Delay initialization to allow Dialog animation to complete
        const initTimer = setTimeout(() => {
            if (!mapContainerRef.current) return;

            // Default center (Paraguay/Brazil farming area)
            let center: L.LatLngExpression = [-22.35, -55.85];
            let zoom = 13;

            if (initialCoordinates && initialCoordinates.length > 0) {
                const bounds = L.latLngBounds(initialCoordinates.map(c => [c.lat, c.lng] as L.LatLngTuple));
                center = bounds.getCenter();
                zoom = 15;
            }

            const map = L.map(mapContainerRef.current!, {
                center,
                zoom,
                zoomControl: true,
            });

            // Esri World Imagery (satellite) — free, no API key
            L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
                attribution: "Tiles &copy; Esri",
                maxZoom: 19,
            }).addTo(map);

            // Labels overlay
            L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", {
                maxZoom: 19,
            }).addTo(map);

            // Feature group for drawn items
            const drawnItems = new L.FeatureGroup();
            map.addLayer(drawnItems);

            // Draw control
            const drawControl = new (L.Control as any).Draw({
                draw: {
                    polygon: {
                        allowIntersection: false,
                        shapeOptions: {
                            color: "#22c55e",
                            fillColor: "#22c55e",
                            fillOpacity: 0.3,
                            weight: 3,
                        },
                    },
                    polyline: false,
                    circle: false,
                    circlemarker: false,
                    marker: false,
                    rectangle: false,
                },
                edit: {
                    featureGroup: drawnItems,
                    edit: true,
                    remove: true,
                },
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

            // On polygon created
            map.on((L as any).Draw.Event.CREATED, (e: any) => {
                drawnItems.clearLayers();
                const layer = e.layer;
                drawnItems.addLayer(layer);
                polygonLayerRef.current = layer;
                const latLngs = layer.getLatLngs()[0] as L.LatLng[];
                const coords = latLngs.map((ll: L.LatLng) => ({ lat: ll.lat, lng: ll.lng }));
                updatePolygon(coords);
            });

            // On polygon edited
            map.on((L as any).Draw.Event.EDITED, (e: any) => {
                e.layers.eachLayer((layer: any) => {
                    const latLngs = layer.getLatLngs()[0] as L.LatLng[];
                    const coords = latLngs.map((ll: L.LatLng) => ({ lat: ll.lat, lng: ll.lng }));
                    updatePolygon(coords);
                });
            });

            // On polygon deleted
            map.on((L as any).Draw.Event.DELETED, () => {
                polygonLayerRef.current = null;
                updatePolygon([]);
            });

            mapRef.current = map;
            setIsReady(true);

            // Force map to recalculate its size after dialog animation
            setTimeout(() => {
                map.invalidateSize();
            }, 100);

            // Additional invalidateSize calls to handle slow animations
            setTimeout(() => map.invalidateSize(), 300);
            setTimeout(() => map.invalidateSize(), 600);

        }, 200); // Wait 200ms for dialog open animation

        return () => {
            clearTimeout(initTimer);
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, []);

    // Also invalidateSize on window resize
    useEffect(() => {
        const handleResize = () => {
            if (mapRef.current) mapRef.current.invalidateSize();
        };
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    return (
        <div className="relative w-full h-full min-h-[400px]">
            <div ref={mapContainerRef} className="absolute inset-0 z-0" style={{ height: "100%", width: "100%" }} />
            {!isReady && (
                <div className="absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center z-10">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto mb-2"></div>
                        <p className="text-gray-500 text-sm">Carregando mapa de satélite...</p>
                    </div>
                </div>
            )}
            {/* Instruction overlay */}
            {isReady && !hasPolygon && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-md text-sm text-gray-700 z-[1000] pointer-events-none">
                    🖱️ Clique no ícone de polígono <span className="font-bold text-emerald-600">(◇)</span> à esquerda para desenhar
                </div>
            )}
        </div>
    );
}
