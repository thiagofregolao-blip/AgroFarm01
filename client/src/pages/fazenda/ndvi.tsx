import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import FarmLayout from "@/components/fazenda/layout";
import {
    ChevronLeft, ChevronDown, Layers, Maximize2, Minimize2,
    Leaf, MapPin, AlertTriangle, RefreshCw, Check, Cloud, Satellite
} from "lucide-react";
import { MapContainer, TileLayer, Polygon, ImageOverlay, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

function MapUpdater({ bounds }: { bounds: [[number, number], [number, number]] | null }) {
    const map = useMap();
    useEffect(() => {
        if (bounds) map.fitBounds(bounds, { padding: [30, 30] });
    }, [bounds, map]);
    return null;
}

function MapResizer({ trigger }: { trigger: any }) {
    const map = useMap();
    useEffect(() => {
        const t = setTimeout(() => {
            map.invalidateSize();
        }, 300);
        return () => clearTimeout(t);
    }, [trigger, map]);
    return null;
}

const NDVI_SCALE = [
    { min: 0, max: 0.15, color: "#DC2626", label: "Crítico" },
    { min: 0.15, max: 0.3, color: "#F97316", label: "Estresse" },
    { min: 0.3, max: 0.5, color: "#EAB308", label: "Moderado" },
    { min: 0.5, max: 0.7, color: "#22C55E", label: "Saudável" },
    { min: 0.7, max: 1.0, color: "#15803D", label: "Excelente" },
];

const LAYER_OPTIONS = [
    { value: "ndvi", label: "NDVI" },
    { value: "ndvi_contrast", label: "NDVI com contraste" },
    { value: "evi", label: "EVI" },
    { value: "truecolor", label: "Cor Real" },
    { value: "falsecolor", label: "Falsa Cor" },
];

const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function formatShortDate(isoDate: string): string {
    const parts = isoDate.split("T")[0].split("-");
    const day = parseInt(parts[2]);
    const monthIdx = parseInt(parts[1]) - 1;
    return `${day} de ${MONTHS_SHORT[monthIdx]}.`;
}

export default function NdviPage() {
    const [selectedPlot, setSelectedPlot] = useState<any>(null);
    const [activePolygonId, setActivePolygonId] = useState("");
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [hideClouds, setHideClouds] = useState(false);
    const [layerType, setLayerType] = useState("ndvi_contrast");
    const [showLayerMenu, setShowLayerMenu] = useState(false);
    const [isMapExpanded, setIsMapExpanded] = useState(false);

    const { data: plots = [], isLoading: loadingPlots } = useQuery({
        queryKey: ["/api/farm/ndvi/plots"],
        queryFn: async () => {
            const res = await fetch("/api/farm/ndvi/plots", { credentials: "include" });
            if (!res.ok) throw new Error("Failed");
            return res.json();
        },
    });

    const registerMutation = useMutation({
        mutationFn: async (plotId: string) => {
            const res = await fetch(`/api/farm/ndvi/${plotId}/register`, { method: "POST", credentials: "include" });
            if (!res.ok) throw new Error("Failed");
            return res.json();
        },
        onSuccess: (data) => setActivePolygonId(data.polygonId),
    });

    const { data: ndviHistory = [], isLoading: loadingHistory } = useQuery({
        queryKey: ["/api/farm/ndvi/history", activePolygonId],
        queryFn: async () => {
            const res = await fetch(`/api/farm/ndvi/${activePolygonId}/history`, { credentials: "include" });
            if (!res.ok) throw new Error("Failed");
            return res.json();
        },
        enabled: !!activePolygonId,
    });

    const { data: ndviImages = [], isLoading: loadingImages } = useQuery({
        queryKey: ["/api/farm/ndvi/images", activePolygonId],
        queryFn: async () => {
            const res = await fetch(`/api/farm/ndvi/${activePolygonId}/images`, { credentials: "include" });
            if (!res.ok) throw new Error("Failed");
            return res.json();
        },
        enabled: !!activePolygonId,
    });

    // Merge history + images by date and calculate deltas
    const timeline = useMemo(() => {
        if (!ndviHistory.length) return [];
        const imageMap = new Map<string, any>();
        ndviImages.forEach((img: any) => imageMap.set(img.dateFormatted, img));

        return ndviHistory.map((h: any, i: number) => {
            const img = imageMap.get(h.dateFormatted);
            const mean = h.mean ?? 0;
            const prevMean = i > 0 ? (ndviHistory[i - 1].mean ?? null) : null;
            return {
                ...h,
                mean,
                ndviUrl: img?.ndviUrl || null,
                ndviContrastUrl: img?.ndviContrastUrl || null,
                truecolorUrl: img?.truecolorUrl || null,
                falsecolorUrl: img?.falsecolorUrl || null,
                eviUrl: img?.eviUrl || null,
                delta: prevMean !== null ? Math.round((mean - prevMean) * 100) / 100 : null,
                shortDate: formatShortDate(h.date),
            };
        });
    }, [ndviHistory, ndviImages]);

    const visibleTimeline = useMemo(() => {
        return hideClouds ? timeline.filter((t: any) => t.cloudCover <= 20) : timeline;
    }, [timeline, hideClouds]);

    const activeEntry = useMemo(() => {
        if (!visibleTimeline.length) return null;
        if (selectedDate) {
            return visibleTimeline.find((t: any) => t.date === selectedDate) || visibleTimeline[visibleTimeline.length - 1];
        }
        return visibleTimeline[visibleTimeline.length - 1];
    }, [selectedDate, visibleTimeline]);

    const activeDate = useMemo(() => {
        if (!activeEntry) return null;
        return activeEntry.date.split("T")[0];
    }, [activeEntry]);

    const { data: overlayData, isFetching: fetchingOverlay } = useQuery({
        queryKey: ["/api/farm/ndvi/overlay", selectedPlot?.id, activeDate, layerType],
        queryFn: async () => {
            const res = await fetch(
                `/api/farm/ndvi/${selectedPlot.id}/image?date=${activeDate}&layer=${layerType}`,
                { credentials: "include" }
            );
            if (!res.ok) return { imageUrl: null };
            return res.json();
        },
        enabled: !!selectedPlot?.id && !!activeDate,
        staleTime: 10 * 60 * 1000,
        placeholderData: (prev: any) => prev,
    });

    const overlayUrl = overlayData?.imageUrl || null;

    const { positions, bounds } = useMemo(() => {
        if (!selectedPlot?.coordinates || selectedPlot.coordinates.length < 3) {
            return { positions: [], bounds: null };
        }
        const pts: [number, number][] = selectedPlot.coordinates.map((c: any) => [c.lat, c.lng]);
        const lats = pts.map((p) => p[0]);
        const lngs = pts.map((p) => p[1]);
        return {
            positions: pts,
            bounds: [
                [Math.min(...lats), Math.min(...lngs)],
                [Math.max(...lats), Math.max(...lngs)],
            ] as [[number, number], [number, number]],
        };
    }, [selectedPlot]);

    const handleSelectPlot = useCallback(
        (plot: any) => {
            setSelectedPlot(plot);
            setSelectedDate(null);
            setLayerType("ndvi_contrast");
            if (plot.hasCoordinates) registerMutation.mutate(plot.id);
        },
        [registerMutation]
    );

    const handleBack = useCallback(() => {
        setSelectedPlot(null);
        setActivePolygonId("");
        setSelectedDate(null);
        setShowLayerMenu(false);
        setIsMapExpanded(false);
    }, []);

    const currentLayerLabel = LAYER_OPTIONS.find((o) => o.value === layerType)?.label || "NDVI";
    const isLoading = registerMutation.isPending || loadingHistory;
    const showNdviLegend = layerType !== "truecolor" && layerType !== "falsecolor";

    // ===== LIST VIEW =====
    if (!selectedPlot) {
        return (
            <FarmLayout>
                <div className="max-w-3xl mx-auto space-y-4">
                    <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                                <Leaf size={20} />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">Campos</h1>
                                <p className="text-xs text-gray-500">{plots.length} talhões cadastrados</p>
                            </div>
                        </div>
                        <span className="text-emerald-700 font-medium text-sm">
                            {plots.reduce((acc: number, p: any) => acc + (Number(p.areaHa) || 0), 0).toFixed(0)} ha
                        </span>
                    </div>

                    <div className="space-y-3">
                        {loadingPlots ? (
                            <div className="py-12 text-center text-gray-500 animate-pulse">Carregando talhões...</div>
                        ) : plots.length === 0 ? (
                            <div className="py-16 text-center bg-white rounded-3xl border border-gray-100 text-gray-400">
                                <MapPin size={48} className="mx-auto mb-4 text-gray-200" />
                                <p>Nenhum talhão cadastrado</p>
                            </div>
                        ) : (
                            plots.map((plot: any) => (
                                <div
                                    key={plot.id}
                                    onClick={() => handleSelectPlot(plot)}
                                    className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-gray-100 hover:border-emerald-200 hover:shadow-md transition-all cursor-pointer"
                                >
                                    <div className="flex items-center gap-4">
                                        <div
                                            className={`w-12 h-12 rounded-xl shrink-0 flex items-center justify-center ${
                                                plot.hasCoordinates
                                                    ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                                                    : "bg-gray-50 text-gray-400 border border-gray-100"
                                            }`}
                                        >
                                            {plot.hasCoordinates ? <Satellite size={22} /> : <AlertTriangle size={22} />}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-900 text-base">{plot.name}</h3>
                                            <p className="text-sm text-gray-500">
                                                {plot.areaHa} ha {plot.propertyName ? `· ${plot.propertyName}` : ""}
                                            </p>
                                        </div>
                                    </div>
                                    {!plot.hasCoordinates ? (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">Sem GPS</span>
                                    ) : (
                                        <div className="w-16 h-2 rounded-full bg-gradient-to-r from-red-500 via-yellow-400 to-green-600" />
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </FarmLayout>
        );
    }

    // ===== DETAIL VIEW (OneSoil style) =====
    return (
        <div className="min-h-screen bg-gray-50">
            {/* ─── Sticky Header ─── */}
            {!isMapExpanded && (
                <div
                    className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm"
                    style={{ paddingTop: "max(env(safe-area-inset-top), 0px)" }}
                >
                    <div className="flex items-center gap-3 px-4 py-3">
                        <button
                            onClick={handleBack}
                            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                        >
                            <ChevronLeft size={20} className="text-gray-700" />
                        </button>
                        <div className="flex-1 min-w-0">
                            <h1 className="font-bold text-lg text-gray-900 truncate leading-tight">{selectedPlot.name}</h1>
                            <p className="text-xs text-gray-500">{selectedPlot.areaHa} ha</p>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Initial Loading ─── */}
            {isLoading && (
                <div className="flex flex-col items-center justify-center py-24 gap-3">
                    <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
                    <span className="text-sm text-gray-400">Processando dados de satélite...</span>
                </div>
            )}

            {/* ─── Error ─── */}
            {registerMutation.isError && (
                <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2 text-sm font-medium">
                    <AlertTriangle size={18} /> Falha ao conectar ao satélite.
                </div>
            )}

            {/* ═══ MAP CARD ═══ */}
            {!isLoading && bounds && (
                <div
                    className={`overflow-hidden ${
                        isMapExpanded
                            ? "fixed inset-0 z-[9999] rounded-none"
                            : "relative mx-3 mt-3 rounded-2xl shadow-lg"
                    }`}
                    style={isMapExpanded ? undefined : { height: "50vh", minHeight: 280, maxHeight: 500 }}
                >
                    <MapContainer
                        center={bounds[0]}
                        zoom={15}
                        zoomControl={false}
                        className="w-full h-full"
                        style={{ background: "#111827" }}
                    >
                        <TileLayer
                            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                            maxNativeZoom={19}
                            maxZoom={22}
                        />
                        <Polygon
                            positions={positions}
                            pathOptions={{
                                color: "#fff",
                                weight: 2,
                                fillOpacity: overlayUrl ? 0 : 0.12,
                                fillColor: "#22c55e",
                                dashArray: overlayUrl ? undefined : "6 4",
                            }}
                        />
                        {overlayUrl && <ImageOverlay url={overlayUrl} bounds={bounds} opacity={0.85} />}
                        <MapUpdater bounds={bounds} />
                        <MapResizer trigger={isMapExpanded} />
                    </MapContainer>

                    {/* Fullscreen floating header */}
                    {isMapExpanded && (
                        <div
                            className="absolute top-0 left-0 right-0 z-[1000] pointer-events-none"
                            style={{ paddingTop: "max(env(safe-area-inset-top), 12px)" }}
                        >
                            <div className="flex items-center justify-between px-4 pt-1">
                                <button
                                    onClick={() => setIsMapExpanded(false)}
                                    className="pointer-events-auto w-10 h-10 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center text-white shadow-lg"
                                >
                                    <ChevronLeft size={22} />
                                </button>
                                <div className="bg-black/50 backdrop-blur-md px-5 py-2 rounded-2xl shadow-lg">
                                    <h2 className="text-white font-bold text-sm text-center">{selectedPlot.name}</h2>
                                    <p className="text-white/50 text-[10px] text-center">{selectedPlot.areaHa} ha</p>
                                </div>
                                <button
                                    onClick={() => setIsMapExpanded(false)}
                                    className="pointer-events-auto w-10 h-10 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center text-white shadow-lg"
                                >
                                    <Minimize2 size={17} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Layer Selector */}
                    <div className={`absolute z-[1000] left-3 ${isMapExpanded ? "top-16" : "top-3"}`}>
                        <div className="relative">
                            <button
                                onClick={() => setShowLayerMenu(!showLayerMenu)}
                                className="flex items-center gap-2 bg-black/50 backdrop-blur-md text-white pl-3 pr-2.5 py-2 rounded-xl shadow-lg active:scale-95 transition-transform"
                            >
                                <Layers size={15} className="text-white/70" />
                                <span className="text-[13px] font-medium">{currentLayerLabel}</span>
                                <ChevronDown
                                    size={14}
                                    className={`text-white/50 transition-transform ${showLayerMenu ? "rotate-180" : ""}`}
                                />
                            </button>
                            {showLayerMenu && (
                                <>
                                    <div className="fixed inset-0 z-[999]" onClick={() => setShowLayerMenu(false)} />
                                    <div className="absolute top-full left-0 mt-2 z-[1001] bg-gray-900/95 backdrop-blur-xl rounded-xl shadow-2xl border border-white/10 overflow-hidden min-w-[210px]">
                                        {LAYER_OPTIONS.map((opt) => (
                                            <button
                                                key={opt.value}
                                                onClick={() => {
                                                    setLayerType(opt.value);
                                                    setShowLayerMenu(false);
                                                }}
                                                className={`w-full flex items-center justify-between px-4 py-3 text-left text-[13px] transition-colors ${
                                                    layerType === opt.value
                                                        ? "bg-white/10 text-white font-semibold"
                                                        : "text-white/60 hover:bg-white/5 hover:text-white"
                                                }`}
                                            >
                                                <span>{opt.label}</span>
                                                {layerType === opt.value && <Check size={15} className="text-emerald-400" />}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Fullscreen Toggle */}
                    <div className={`absolute z-[1000] right-3 ${isMapExpanded ? "top-16" : "top-3"}`}>
                        <button
                            onClick={() => setIsMapExpanded(!isMapExpanded)}
                            className="w-10 h-10 bg-black/50 backdrop-blur-md rounded-xl flex items-center justify-center text-white shadow-lg active:scale-95 transition-transform"
                        >
                            {isMapExpanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
                        </button>
                    </div>

                    {/* NDVI Legend */}
                    {showNdviLegend && (
                        <div className="absolute bottom-3 left-3 z-[1000]">
                            <div className="bg-black/40 backdrop-blur-md rounded-xl px-2 py-2 flex flex-col items-center">
                                <span className="text-[7px] font-bold text-white/70 tracking-wider mb-1">NDVI</span>
                                <div className="w-[8px] h-20 rounded-full bg-gradient-to-t from-red-600 via-yellow-400 to-green-700 border border-white/15" />
                            </div>
                        </div>
                    )}

                    {/* Stats Badge */}
                    {activeEntry && showNdviLegend && (
                        <div className="absolute bottom-3 right-3 z-[1000]">
                            <div className="bg-black/40 backdrop-blur-md px-3 py-2 rounded-xl">
                                <p className="text-[8px] text-white/40 mb-0.5">Média {activeEntry.dateFormatted}</p>
                                <div className="flex items-baseline gap-1.5">
                                    <span className="text-xl font-black leading-none" style={{ color: activeEntry.healthColor }}>
                                        {(activeEntry.mean ?? 0).toFixed(2)}
                                    </span>
                                    <span
                                        className="text-[8px] px-1.5 py-0.5 rounded-md text-white font-bold"
                                        style={{ backgroundColor: activeEntry.healthColor }}
                                    >
                                        {activeEntry.healthLabel}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Overlay Loading */}
                    {fetchingOverlay && !isLoading && (
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[999]">
                            <div className="bg-black/50 backdrop-blur-md p-3 rounded-xl">
                                <RefreshCw className="w-6 h-6 text-white animate-spin" />
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ═══ HISTORY SECTION ═══ */}
            {!isLoading && !isMapExpanded && (
                <div className="px-4 mt-5" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 24px)" }}>
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-[15px] text-gray-900">Histórico</h3>
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] text-gray-400">Ocultar dias nublados</span>
                            <button
                                onClick={() => setHideClouds(!hideClouds)}
                                className={`relative inline-flex h-[22px] w-[40px] items-center rounded-full transition-colors ${
                                    hideClouds ? "bg-emerald-500" : "bg-gray-300"
                                }`}
                            >
                                <span
                                    className={`inline-block h-[16px] w-[16px] transform rounded-full bg-white shadow-sm transition-transform ${
                                        hideClouds ? "translate-x-[20px]" : "translate-x-[3px]"
                                    }`}
                                />
                            </button>
                        </div>
                    </div>

                    <div className="flex gap-2.5 overflow-x-auto pb-4 scrollbar-hide">
                        {visibleTimeline.length === 0 ? (
                            <div className="w-full flex items-center justify-center text-gray-400 text-sm py-4">
                                {ndviHistory.length === 0
                                    ? "Nenhum dado disponível"
                                    : "Todos os dias filtrados (muitas nuvens)"}
                            </div>
                        ) : (
                            visibleTimeline.map((entry: any) => {
                                const isSelected = selectedDate
                                    ? entry.date === selectedDate
                                    : entry.date === visibleTimeline[visibleTimeline.length - 1]?.date;

                                return (
                                    <button
                                        key={entry.date}
                                        onClick={() => setSelectedDate(entry.date)}
                                        className={`snap-center shrink-0 w-[78px] flex flex-col rounded-xl overflow-hidden transition-all border-2 ${
                                            isSelected
                                                ? "border-blue-500 shadow-lg shadow-blue-500/20"
                                                : "border-transparent hover:border-gray-200"
                                        }`}
                                    >
                                        {/* Thumbnail */}
                                        <div className="w-full aspect-[4/5] bg-gray-200 relative overflow-hidden">
                                            {entry.ndviUrl ? (
                                                <img
                                                    src={entry.ndviContrastUrl || entry.ndviUrl}
                                                    alt=""
                                                    className="w-full h-full object-cover"
                                                    loading="lazy"
                                                />
                                            ) : (
                                                <div className="w-full h-full bg-gradient-to-br from-emerald-800/20 to-amber-700/15 flex items-center justify-center">
                                                    <Leaf size={14} className="text-emerald-600/40" />
                                                </div>
                                            )}
                                            {entry.cloudCover > 20 && (
                                                <div className="absolute top-1 right-1 bg-white/80 rounded-full p-[2px]">
                                                    <Cloud size={8} className="text-gray-500" />
                                                </div>
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div className="w-full px-1 py-1.5 bg-white text-center">
                                            <p className="text-[9px] text-gray-400 leading-tight truncate">
                                                {entry.shortDate}
                                            </p>
                                            <p
                                                className="text-[12px] font-bold mt-0.5 leading-tight"
                                                style={{ color: entry.healthColor || "#666" }}
                                            >
                                                {(entry.mean ?? 0).toFixed(2)}
                                            </p>
                                            {entry.delta != null && (
                                                <p
                                                    className={`text-[9px] font-semibold leading-tight ${
                                                        entry.delta >= 0 ? "text-emerald-500" : "text-red-500"
                                                    }`}
                                                >
                                                    {entry.delta >= 0 ? "+" : ""}
                                                    {(entry.delta ?? 0).toFixed(2)}
                                                </p>
                                            )}
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
