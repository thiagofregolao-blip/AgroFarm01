import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import FarmLayout from "@/components/fazenda/layout";
import { Satellite, MapPin, Leaf, TrendingUp, Cloud, AlertTriangle, RefreshCw } from "lucide-react";

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

    return (
        <FarmLayout>
            <div style={{ padding: 24 }}>
                {/* Header */}
                <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                        <h1 style={{ fontSize: 24, fontWeight: 700, display: "flex", alignItems: "center", gap: 10, margin: 0 }}>
                            <Leaf size={28} color="#367C2B" />
                            Campos NDVI
                        </h1>
                        <p style={{ color: "#6B7280", margin: "4px 0 0", fontSize: 14 }}>
                            Monitoramento de vegetação via Sentinel-2
                        </p>
                    </div>
                </div>

                {/* Main Content Area - Split View on Desktop, Stack on Mobile */}
                <div className="flex flex-col lg:flex-row gap-6">

                    {/* Left List: Plot Selection */}
                    <div className="w-full lg:w-1/3 flex flex-col gap-3">
                        {loadingPlots ? (
                            <div style={{ padding: 40, color: "#6B7280", textAlign: "center" }}>Carregando talhões...</div>
                        ) : plots.length === 0 ? (
                            <div style={{ padding: 40, color: "#6B7280", textAlign: "center", background: "#fff", borderRadius: 16 }}>
                                <MapPin size={48} color="#D1D5DB" style={{ margin: "0 auto 12px" }} />
                                <div>Nenhum talhão cadastrado com coordenadas</div>
                            </div>
                        ) : plots.map((plot: any) => (
                            <div key={plot.id}
                                onClick={() => {
                                    setSelectedPlot(plot);
                                    if (plot.hasCoordinates && (!activePolygonId || activePolygonId !== plot.ndviPolygonId)) {
                                        registerMutation.mutate(plot.id);
                                    }
                                }}
                                className={`flex items-center justify-between p-3 cursor-pointer rounded-2xl transition-all duration-200 border-2 ${selectedPlot?.id === plot.id ? "bg-emerald-50 border-emerald-500 shadow-sm" : "bg-white border-transparent hover:border-gray-200 shadow-sm"
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    {/* Icon / Mini map placeholder */}
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${plot.hasCoordinates ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                                        {plot.hasCoordinates ? <MapPin size={20} /> : <AlertTriangle size={20} />}
                                    </div>

                                    <div className="flex flex-col">
                                        <span className="font-semibold text-gray-900 text-[15px]">{plot.name}</span>
                                        <span className="text-sm text-gray-500">{plot.areaHa} ha {plot.crop ? `• ${plot.crop}` : ''}</span>
                                    </div>
                                </div>

                                {/* Status / NDVI indicator */}
                                <div className="flex flex-col items-end gap-1">
                                    {!plot.hasCoordinates && (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">Sem GPS</span>
                                    )}
                                    {plot.hasCoordinates && selectedPlot?.id === plot.id && registerMutation.isPending && (
                                        <RefreshCw size={16} className="animate-spin text-emerald-600" />
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Right Panel: Selected Plot Details */}
                    <div className="w-full lg:w-2/3">
                        {!selectedPlot ? (
                            <div className="hidden lg:flex flex-col items-center justify-center h-full min-h-[400px] text-gray-400 bg-white rounded-3xl border border-gray-100">
                                <Leaf size={64} className="mb-4 text-emerald-100" />
                                <span className="text-lg font-medium text-gray-600">Selecione um campo</span>
                                <span className="text-sm">Clique em um talhão na lista para analisar a vegetação</span>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4">
                                {registerMutation.isError && (
                                    <div className="p-4 bg-red-50 rounded-2xl text-red-600 flex items-center gap-3 text-sm font-medium border border-red-100">
                                        <AlertTriangle size={18} />
                                        <span>Erro ao registrar polígono. Verifique a chave API ou as coordenadas.</span>
                                    </div>
                                )}

                                {/* NDVI Results */}
                                {activePolygonId && (
                                    <>
                                        {/* Summary card */}
                                        {latestNdvi && (
                                            <div style={{
                                                background: "#fff", borderRadius: 12, border: "1px solid #E5E7EB",
                                                padding: 24, marginBottom: 24,
                                                display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap",
                                            }}>
                                                <div style={{
                                                    width: 80, height: 80, borderRadius: "50%",
                                                    background: latestNdvi.healthColor,
                                                    display: "flex", flexDirection: "column" as const, alignItems: "center", justifyContent: "center",
                                                    color: "#fff",
                                                }}>
                                                    <div style={{ fontSize: 22, fontWeight: 800 }}>{latestNdvi.mean.toFixed(2)}</div>
                                                    <div style={{ fontSize: 9, fontWeight: 600 }}>NDVI</div>
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: 20, fontWeight: 700, color: latestNdvi.healthColor }}>
                                                        {latestNdvi.healthLabel}
                                                    </div>
                                                    <div style={{ fontSize: 13, color: "#6B7280" }}>
                                                        Última leitura: {latestNdvi.dateFormatted} • Fonte: {latestNdvi.source}
                                                    </div>
                                                    <div style={{ fontSize: 12, color: "#9CA3AF", display: "flex", gap: 12, marginTop: 4 }}>
                                                        <span>Min: {latestNdvi.min.toFixed(3)}</span>
                                                        <span>Mediana: {latestNdvi.median.toFixed(3)}</span>
                                                        <span>Max: {latestNdvi.max.toFixed(3)}</span>
                                                        <span><Cloud size={12} style={{ verticalAlign: "text-bottom" }} /> {latestNdvi.cloudCover}% nuvens</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* NDVI History Chart (simple bar chart) */}
                                        {loadingHistory ? (
                                            <div style={{ padding: 40, textAlign: "center", color: "#6B7280" }}>Carregando histórico NDVI...</div>
                                        ) : ndviHistory.length > 0 && (
                                            <div style={{
                                                background: "#fff", borderRadius: 12, border: "1px solid #E5E7EB",
                                                padding: 24, marginBottom: 24,
                                            }}>
                                                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                                                    <TrendingUp size={18} color="#367C2B" />
                                                    Evolução NDVI
                                                </h3>
                                                <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 200, overflow: "auto" }}>
                                                    {ndviHistory.map((d: any, i: number) => {
                                                        const heightPct = Math.max(d.mean * 100, 5);
                                                        const info = getNdviInfo(d.mean);
                                                        return (
                                                            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "0 0 auto", minWidth: 32 }}>
                                                                <div style={{ fontSize: 9, color: "#6B7280", marginBottom: 4 }}>{d.mean.toFixed(2)}</div>
                                                                <div style={{
                                                                    width: 24, height: `${heightPct * 2}px`, maxHeight: 180,
                                                                    background: info.color, borderRadius: "4px 4px 0 0",
                                                                    transition: "height 0.3s ease",
                                                                }} />
                                                                <div style={{ fontSize: 8, color: "#9CA3AF", marginTop: 4, transform: "rotate(-45deg)", transformOrigin: "center", whiteSpace: "nowrap" }}>
                                                                    {d.dateFormatted}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* Satellite Images */}
                                        {loadingImages ? (
                                            <div style={{ padding: 40, textAlign: "center", color: "#6B7280" }}>Carregando imagens...</div>
                                        ) : ndviImages.length > 0 && (
                                            <div style={{
                                                background: "#fff", borderRadius: 12, border: "1px solid #E5E7EB",
                                                padding: 24,
                                            }}>
                                                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                                                    <Satellite size={18} color="#367C2B" />
                                                    Imagens do Satélite
                                                </h3>
                                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 16 }}>
                                                    {ndviImages.slice(0, 6).map((img: any, i: number) => (
                                                        <div key={i} style={{ borderRadius: 12, overflow: "hidden", border: "1px solid #E5E7EB" }}>
                                                            {img.ndviUrl ? (
                                                                <img src={img.ndviUrl} alt={`NDVI ${img.dateFormatted}`}
                                                                    style={{ width: "100%", height: 180, objectFit: "cover" }} />
                                                            ) : img.truecolorUrl ? (
                                                                <img src={img.truecolorUrl} alt={`Satélite ${img.dateFormatted}`}
                                                                    style={{ width: "100%", height: 180, objectFit: "cover" }} />
                                                            ) : (
                                                                <div style={{ height: 180, background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", color: "#9CA3AF" }}>
                                                                    Sem imagem
                                                                </div>
                                                            )}
                                                            <div style={{ padding: "8px 12px", fontSize: 12 }}>
                                                                <div style={{ fontWeight: 600, color: "#111827" }}>{img.dateFormatted}</div>
                                                                <div style={{ color: "#6B7280" }}>
                                                                    <Cloud size={11} style={{ verticalAlign: "text-bottom" }} /> {img.cloudCover}% nuvens
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* No polygon selected info */}
                                {!activePolygonId && !selectedPlot && plots.length > 0 && (
                                    <div style={{
                                        textAlign: "center", padding: 60, color: "#6B7280",
                                        background: "#F9FAFB", borderRadius: 12,
                                    }}>
                                        <Satellite size={48} color="#D1D5DB" style={{ marginBottom: 12 }} />
                                        <div style={{ fontSize: 16, fontWeight: 600 }}>Selecione um talhão</div>
                                        <div style={{ fontSize: 13, marginTop: 4 }}>
                                            Clique em um talhão acima para analisar o índice NDVI via satélite
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </FarmLayout>
    );
}
