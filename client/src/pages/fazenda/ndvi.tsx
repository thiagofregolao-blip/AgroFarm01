import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import FarmLayout from "@/components/fazenda/layout";
import { Satellite, MapPin, Leaf, Cloud, AlertTriangle, RefreshCw, ChevronLeft } from "lucide-react";
import { MapContainer, TileLayer, Polygon, ImageOverlay, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// Helper component to auto-zoom the map to the polygon bounds
function MapUpdater({ bounds }: { bounds: [[number, number], [number, number]] | null }) {
    const map = useMap();
    useEffect(() => {
        if (bounds) {
            map.fitBounds(bounds, { padding: [50, 50] });
        }
    }, [bounds, map]);
    return null;
}

// NDVI color scale
const ndviColors = [
    { min: 0, max: 0.15, color: "#DC2626", label: "Crítico" },
    { min: 0.15, max: 0.3, color: "#F97316", label: "Estresse" },
    { min: 0.3, max: 0.5, color: "#EAB308", label: "Moderado" },
    { min: 0.5, max: 0.7, color: "#22C55E", label: "Saudável" },
    { min: 0.7, max: 1.0, color: "#15803D", label: "Excelente" },
];

function getNdviInfo(value: number) {
    return ndviColors.find(c => value >= c.min && value < c.max) || ndviColors[ndviColors.length - 1];
}

export default function NdviPage() {
    const queryClient = useQueryClient();
    const [selectedPlot, setSelectedPlot] = useState<any>(null);
    const [activePolygonId, setActivePolygonId] = useState<string>("");

    // Fetch plots
    const { data: plots = [], isLoading: loadingPlots } = useQuery({
        queryKey: ["/api/farm/ndvi/plots"],
        queryFn: async () => {
            const res = await fetch("/api/farm/ndvi/plots", { credentials: "include" });
            if (!res.ok) throw new Error("Failed");
            return res.json();
        },
    });

    // Register polygon mutation
    const registerMutation = useMutation({
        mutationFn: async (plotId: string) => {
            const res = await fetch(`/api/farm/ndvi/${plotId}/register`, {
                method: "POST",
                credentials: "include",
            });
            if (!res.ok) throw new Error("Failed");
            return res.json();
        },
        onSuccess: (data) => {
            setActivePolygonId(data.polygonId);
        },
    });

    // Fetch NDVI history
    const { data: ndviHistory = [], isLoading: loadingHistory } = useQuery({
        queryKey: ["/api/farm/ndvi/history", activePolygonId],
        queryFn: async () => {
            const res = await fetch(`/api/farm/ndvi/${activePolygonId}/history`, { credentials: "include" });
            if (!res.ok) throw new Error("Failed");
            return res.json();
        },
        enabled: !!activePolygonId,
    });

    // Fetch NDVI images
    const { data: ndviImages = [], isLoading: loadingImages } = useQuery({
        queryKey: ["/api/farm/ndvi/images", activePolygonId],
        queryFn: async () => {
            const res = await fetch(`/api/farm/ndvi/${activePolygonId}/images`, { credentials: "include" });
            if (!res.ok) throw new Error("Failed");
            return res.json();
        },
        enabled: !!activePolygonId,
    });

    const latestNdvi = ndviHistory.length > 0 ? ndviHistory[ndviHistory.length - 1] : null;

    // Filter cloud-free days state
    const [hideClouds, setHideClouds] = useState(false);

    // Selected historic date state (if null, will default to latest)
    const [selectedHistoryDate, setSelectedHistoryDate] = useState<string | null>(null);

    // Get the currently active NDVI data block based on selection or fallback to latest
    const activeData = useMemo(() => {
        if (!selectedHistoryDate) return latestNdvi;
        return ndviHistory.find((d: any) => d.dt === selectedHistoryDate) || latestNdvi;
    }, [selectedHistoryDate, latestNdvi, ndviHistory]);

    // Active Image Overlay 
    const activeImage = useMemo(() => {
        if (!activeData || ndviImages.length === 0) return null;
        // The images logic assumes dt matches dateFormatted or something similar
        // Agromonitoring groups images by dt. We can match by dateFormatted or dt.
        // Assuming ndviImages uses the exact same timestamp logic or date string:
        return ndviImages.find((img: any) => img.dateFormatted === activeData.dateFormatted) || ndviImages[0];
    }, [activeData, ndviImages]);

    // Calculate Polygon and Bounds for Map
    const { positions, bounds } = useMemo(() => {
        if (!selectedPlot || !selectedPlot.coordinates || selectedPlot.coordinates.length < 3) {
            return { positions: [], bounds: null };
        }
        const coords = selectedPlot.coordinates;
        const pts: [number, number][] = coords.map((c: any) => [c.lat, c.lng]);

        const lats = pts.map(p => p[0]);
        const lngs = pts.map(p => p[1]);
        const b: [[number, number], [number, number]] = [
            [Math.min(...lats), Math.min(...lngs)],
            [Math.max(...lats), Math.max(...lngs)]
        ];
        return { positions: pts, bounds: b };
    }, [selectedPlot]);


    // ========== RENDER: LIST VIEW (MASTER) ==========
    if (!selectedPlot) {
        return (
            <FarmLayout>
                <div className="max-w-3xl mx-auto space-y-4">
                    {/* Header Limpo */}
                    <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                                <Leaf size={20} />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900 leading-tight">Campos</h1>
                                <p className="text-xs text-gray-500">{plots.length} áreas cadastradas</p>
                            </div>
                        </div>
                        {/* Botão sutil para Legenda ou Opções (Mocape) */}
                        <div className="text-emerald-700 font-medium text-sm flex gap-2">
                            <span>{plots.reduce((acc: number, p: any) => acc + (p.areaHa || 0), 0).toFixed(0)} ha Totais</span>
                        </div>
                    </div>

                    {/* Lista Contínua de Talhões */}
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
                                    onClick={() => {
                                        setSelectedPlot(plot);
                                        // Auto-trigger registration/fetch if missing or mismatch
                                        if (plot.hasCoordinates && (!activePolygonId || activePolygonId !== plot.ndviPolygonId)) {
                                            registerMutation.mutate(plot.id);
                                        }
                                        setSelectedHistoryDate(null); // Reset history selection
                                    }}
                                    className="flex items-center justify-between bg-white p-4 rounded-3xl shadow-sm border border-gray-100 hover:border-emerald-200 hover:shadow-md transition-all cursor-pointer"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-14 h-14 rounded-2xl shrink-0 flex items-center justify-center shadow-inner
                                            ${plot.hasCoordinates ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-gray-50 text-gray-400 border border-gray-100'}`}>
                                            {plot.hasCoordinates ? <MapPin size={24} /> : <AlertTriangle size={24} />}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-900 text-lg leading-tight">{plot.name}</h3>
                                            <p className="text-sm text-gray-500 mt-0.5">{plot.areaHa} ha {plot.propertyName ? `• ${plot.propertyName}` : ''}</p>
                                        </div>
                                    </div>

                                    {/* Indicador de Status Direita */}
                                    <div className="flex flex-col items-end">
                                        {!plot.hasCoordinates ? (
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">Sem GPS</span>
                                        ) : (
                                            /* Mockup de Espaço para última leitura NDVI na lista (OneSoil tem isso) */
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-semibold text-gray-700">Analise</span>
                                                <div className="w-16 h-2 rounded-full overflow-hidden bg-gradient-to-r from-red-500 via-yellow-400 to-green-600 relative">
                                                    {/* This is a visual representation since we don't have the last NDVI value prefetched for all plots */}
                                                    <div className="absolute top-0 bottom-0 w-1 bg-black/60 shadow-sm" style={{ left: '50%' }}></div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </FarmLayout>
        );
    }

    // ========== RENDER: DETAIL VIEW (FULLSCREEN MODAL) ==========
    return (
        <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col pt-safe">
            {/* Nav Header Flutuante */}
            <div className="absolute top-4 left-4 right-4 z-40 flex items-center justify-between">
                <button
                    onClick={() => { setSelectedPlot(null); setActivePolygonId(""); }}
                    className="w-10 h-10 bg-white/90 backdrop-blur rounded-full flex items-center justify-center shadow-lg border border-gray-100/50 hover:bg-white transition-colors"
                >
                    <ChevronLeft size={24} className="text-gray-800 -ml-1" />
                </button>
                <div className="bg-white/90 backdrop-blur px-4 py-2 rounded-full shadow-lg border border-gray-100/50 flex flex-col items-center">
                    <span className="font-bold text-sm text-gray-900 leading-tight">{selectedPlot.name}</span>
                    <span className="text-[10px] text-gray-500">{selectedPlot.areaHa} ha</span>
                </div>
                <div className="w-10 h-10" /> {/* Spacer */}
            </div>

            {/* ERROR STATE */}
            {registerMutation.isError && (
                <div className="absolute top-20 left-4 right-4 z-40 p-4 bg-red-50 text-red-600 border border-red-200 rounded-2xl shadow-lg flex items-center gap-3 text-sm font-bold">
                    <AlertTriangle size={20} /> Falha ao registrar na API Meteorológica.
                </div>
            )}

            {/* MAP AREA (Takes most of the screen) */}
            <div className="flex-1 relative bg-blue-50/50">
                {(registerMutation.isPending || loadingImages || loadingHistory) ? (
                    <div className="absolute inset-0 z-30 bg-gray-100/50 backdrop-blur-sm flex flex-col items-center justify-center">
                        <RefreshCw className="w-10 h-10 text-emerald-600 animate-spin mb-4" />
                        <span className="text-sm font-medium text-emerald-800">Processando satélite...</span>
                    </div>
                ) : null}

                {bounds ? (
                    <MapContainer
                        center={bounds[0]}
                        zoom={15}
                        zoomControl={false}
                        className="w-full h-full"
                    >
                        {/* Satellite Base Layer */}
                        <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxNativeZoom={19} maxZoom={22} />

                        {/* Always draw polygon bounds */}
                        <Polygon
                            positions={positions}
                            pathOptions={{ color: '#000', weight: 2, fillOpacity: activeImage?.ndviUrl ? 0 : 0.1, fillColor: '#367C2B' }}
                        />

                        {/* Overlay the dynamic Image over the bounds */}
                        {activeImage?.ndviUrl && (
                            <ImageOverlay
                                url={activeImage.ndviUrl}
                                bounds={bounds}
                                opacity={0.8}
                            />
                        )}

                        <MapUpdater bounds={bounds} />
                    </MapContainer>
                ) : (
                    <div className="h-full w-full flex items-center justify-center text-gray-500">
                        Map bounds not found
                    </div>
                )}

                {/* Floating Legend Bottom Left */}
                <div className="absolute bottom-6 left-4 z-30 bg-white/90 backdrop-blur py-2 px-1.5 rounded-full shadow-xl border border-white/50 flex flex-col items-center gap-1">
                    <span className="text-[9px] font-bold text-gray-700 mb-1">NDVI</span>
                    <div className="w-3 h-24 rounded-full bg-gradient-to-t from-red-600 via-yellow-400 to-green-700"></div>
                </div>

                {/* Optional floating data pill Right Bottom */}
                {activeData && (
                    <div className="absolute bottom-6 right-4 z-30 bg-white/90 backdrop-blur px-3 py-2 rounded-2xl shadow-xl border border-white/50 flex flex-col items-end">
                        <span className="text-[10px] text-gray-500">Média {activeData.dateFormatted}</span>
                        <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-black" style={{ color: activeData.healthColor }}>{activeData.mean.toFixed(2)}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md text-white font-bold" style={{ backgroundColor: activeData.healthColor }}>
                                {activeData.healthLabel}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* HISTORY CAROUSEL (Bottom Panel) */}
            <div className="h-44 bg-white rounded-t-3xl -mt-6 z-40 shadow-[0_-4px_24px_rgba(0,0,0,0.05)] flex flex-col">
                <div className="px-6 pt-5 pb-3 flex items-center justify-between">
                    <h3 className="font-bold text-lg text-gray-900">Histórico NDVI</h3>
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                        <input
                            type="checkbox"
                            className="bg-gray-100 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                            checked={hideClouds}
                            onChange={(e) => setHideClouds(e.target.checked)}
                        />
                        <span className="text-gray-600">Ocultar nuvens</span>
                    </label>
                </div>

                {/* Scrollable Horizontal Layout */}
                <div className="flex-1 overflow-x-auto overflow-y-hidden px-4 pb-4 scrollbar-hide flex gap-3 snap-x snap-mandatory items-end">
                    {ndviHistory.length === 0 && !loadingHistory ? (
                        <div className="w-full text-center text-gray-400 text-sm mt-4">Nenhum histórico disponível para esta área.</div>
                    ) : (
                        ndviHistory
                            .filter((d: any) => hideClouds ? d.cloudCover <= 20 : true)
                            .map((dataObj: any) => {
                                const isSelected = (selectedHistoryDate === dataObj.dt) || (!selectedHistoryDate && dataObj.dt === latestNdvi?.dt);
                                // A mock bar height based on the mean
                                const heightPct = Math.max(dataObj.mean * 100, 15);

                                return (
                                    <button
                                        key={dataObj.dt}
                                        onClick={() => setSelectedHistoryDate(dataObj.dt)}
                                        className={`snap-center shrink-0 w-24 flex flex-col items-center justify-end rounded-2xl pt-2 pb-3 transition-all
                                            ${isSelected ? 'bg-gray-900 shadow-xl border border-gray-800 transform -translate-y-1' : 'bg-gray-50 hover:bg-gray-100 border border-gray-100/50'}`}
                                    >
                                        <div className="flex flex-col items-center gap-1 w-full">
                                            {/* Visual representation of data quality/clouds */}
                                            {dataObj.cloudCover > 20 && !isSelected && (
                                                <Cloud size={14} className="text-gray-300 absolute top-2 right-2" />
                                            )}

                                            {/* Dynamic Bar */}
                                            <div className="w-10 rounded-full flex flex-col justify-end items-center bg-gray-200/50 overflow-hidden" style={{ height: '60px' }}>
                                                <div
                                                    style={{ height: `${heightPct}%`, backgroundColor: dataObj.healthColor }}
                                                    className="w-full rounded-full transition-all duration-500"
                                                />
                                            </div>

                                            {/* Text Data */}
                                            <span className={`text-[11px] font-bold mt-2 ${isSelected ? 'text-white' : 'text-gray-600'}`}>
                                                {dataObj.dateFormatted.replace(' de ', '/').split('/')[0]} {dataObj.dateFormatted.replace(' de ', '/').split('/')[1]?.substring(0, 3)}
                                            </span>

                                            {isSelected ? (
                                                <span className="text-[14px] font-black" style={{ color: dataObj.healthColor }}>
                                                    {dataObj.mean.toFixed(2)}
                                                </span>
                                            ) : (
                                                <div className="w-4 h-1 rounded-full bg-gray-300 mt-1"></div>
                                            )}
                                        </div>
                                    </button>
                                )
                            })
                    )}
                </div>
            </div>
        </div>
    );
}
