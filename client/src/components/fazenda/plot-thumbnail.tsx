import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface LatLng { lat: number; lng: number; }

interface PlotThumbnailProps {
    coordinates: LatLng[];
    name: string;
    areaHa: string | number;
    onClick?: () => void;
    onMenuClick?: (e: React.MouseEvent) => void;
}

export default function PlotThumbnail({ coordinates, name, areaHa, onClick, onMenuClick }: PlotThumbnailProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);

    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;
        const el = containerRef.current;

        const timer = window.setTimeout(() => {
            if (!el || !document.body.contains(el)) return;

            const bounds = L.latLngBounds(coordinates.map(c => [c.lat, c.lng] as L.LatLngTuple));

            const map = L.map(el, {
                center: bounds.getCenter(),
                zoom: 15,
                zoomControl: false,
                dragging: false,
                touchZoom: false,
                scrollWheelZoom: false,
                doubleClickZoom: false,
                boxZoom: false,
                keyboard: false,
                attributionControl: false,
            });

            // Google Maps Satellite
            L.tileLayer("https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}", {
                maxZoom: 20,
            }).addTo(map);

            // Draw polygon
            L.polygon(
                coordinates.map(c => [c.lat, c.lng] as L.LatLngTuple),
                { color: "#facc15", fillColor: "#facc15", fillOpacity: 0.35, weight: 2 }
            ).addTo(map);

            map.fitBounds(bounds, { padding: [20, 20] });
            mapRef.current = map;

            // Invalidate size after render
            setTimeout(() => { try { map.invalidateSize(); } catch (_) { } }, 300);
        }, 200);

        return () => {
            window.clearTimeout(timer);
            if (mapRef.current) {
                try { mapRef.current.remove(); } catch (_) { }
                mapRef.current = null;
            }
        };
    }, []);

    return (
        <div
            onClick={onClick}
            style={{
                position: "relative",
                width: "100%",
                paddingBottom: "75%", // 4:3 aspect ratio
                borderRadius: 12,
                overflow: "hidden",
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            }}
        >
            {/* Mini Map */}
            <div
                ref={containerRef}
                style={{ position: "absolute", inset: 0, zIndex: 1 }}
            />

            {/* Bottom gradient overlay with name */}
            <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 2,
                background: "linear-gradient(transparent, rgba(0,0,0,0.7))",
                padding: "24px 12px 10px 12px",
                display: "flex", alignItems: "flex-end", justifyContent: "space-between",
            }}>
                <div>
                    <p style={{ color: "white", fontWeight: 700, fontSize: 15, margin: 0, textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>
                        {name}
                    </p>
                    <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, margin: 0, textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>
                        ({areaHa} ha)
                    </p>
                </div>
                {onMenuClick && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onMenuClick(e); }}
                        style={{
                            background: "none", border: "none", color: "white", cursor: "pointer",
                            fontSize: 20, padding: "4px 8px", lineHeight: 1,
                        }}
                    >⋮</button>
                )}
            </div>
        </div>
    );
}
