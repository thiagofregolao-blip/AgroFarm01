import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw";
import "leaflet-draw/dist/leaflet.draw.css";

interface LatLng {
    lat: number;
    lng: number;
}

interface PlotMapDrawProps {
    initialCoordinates?: LatLng[];
    onAreaCalculated: (areaHa: number) => void;
    onCoordinatesChange: (coords: LatLng[]) => void;
}

// Calculate area of polygon in hectares using Shoelace formula with geodesic correction
function calculateAreaHa(coords: LatLng[]): number {
    if (coords.length < 3) return 0;

    // Use Leaflet's built-in geodesic area calculation
    const latLngs = coords.map(c => L.latLng(c.lat, c.lng));
    const areaSqMeters = L.GeometryUtil.geodesicArea(latLngs);
    // Convert m² to hectares (1 ha = 10,000 m²)
    return Math.round((areaSqMeters / 10000) * 100) / 100;
}

export default function PlotMapDraw({ initialCoordinates, onAreaCalculated, onCoordinatesChange }: PlotMapDrawProps) {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const polygonLayerRef = useRef<L.Polygon | null>(null);
    const drawControlRef = useRef<any>(null);
    const [isReady, setIsReady] = useState(false);

    const updatePolygon = useCallback((coords: LatLng[]) => {
        onCoordinatesChange(coords);
        const area = calculateAreaHa(coords);
        onAreaCalculated(area);
    }, [onAreaCalculated, onCoordinatesChange]);

    useEffect(() => {
        if (!mapContainerRef.current || mapRef.current) return;

        // Default center (Paraguay - farming area)
        let center: L.LatLngExpression = [-22.35, -55.85];
        let zoom = 13;

        if (initialCoordinates && initialCoordinates.length > 0) {
            const bounds = L.latLngBounds(initialCoordinates.map(c => [c.lat, c.lng] as L.LatLngTuple));
            center = bounds.getCenter();
            zoom = 15;
        }

        const map = L.map(mapContainerRef.current, {
            center,
            zoom,
            zoomControl: true,
        });

        // Esri World Imagery (satellite) — free tier
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
        drawControlRef.current = drawControl;

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
        map.on(L.Draw.Event.CREATED, (e: any) => {
            // Remove existing polygon
            drawnItems.clearLayers();

            const layer = e.layer;
            drawnItems.addLayer(layer);
            polygonLayerRef.current = layer;

            const latLngs = layer.getLatLngs()[0] as L.LatLng[];
            const coords = latLngs.map((ll: L.LatLng) => ({ lat: ll.lat, lng: ll.lng }));
            updatePolygon(coords);
        });

        // On polygon edited
        map.on(L.Draw.Event.EDITED, (e: any) => {
            e.layers.eachLayer((layer: any) => {
                const latLngs = layer.getLatLngs()[0] as L.LatLng[];
                const coords = latLngs.map((ll: L.LatLng) => ({ lat: ll.lat, lng: ll.lng }));
                updatePolygon(coords);
            });
        });

        // On polygon deleted
        map.on(L.Draw.Event.DELETED, () => {
            polygonLayerRef.current = null;
            updatePolygon([]);
        });

        mapRef.current = map;
        setIsReady(true);

        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, []);

    return (
        <div className="relative w-full h-full min-h-[400px]">
            <div ref={mapContainerRef} className="absolute inset-0 rounded-xl overflow-hidden z-0" />
            {!isReady && (
                <div className="absolute inset-0 bg-gray-200 animate-pulse rounded-xl flex items-center justify-center z-10">
                    <p className="text-gray-500">Carregando mapa...</p>
                </div>
            )}
            {/* Instruction overlay */}
            {isReady && !polygonLayerRef.current && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-md text-sm text-gray-700 z-[1000] pointer-events-none">
                    🖱️ Clique no ícone de polígono <span className="font-bold text-emerald-600">(◇)</span> para desenhar a área
                </div>
            )}
        </div>
    );
}
