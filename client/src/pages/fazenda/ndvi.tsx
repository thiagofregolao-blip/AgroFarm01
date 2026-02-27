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
                <div style={{ marginBottom: 24 }}>
                    <h1 style={{ fontSize: 24, fontWeight: 700, display: "flex", alignItems: "center", gap: 10, margin: 0 }}>
                        <Satellite size={28} color="#367C2B" />
                        Monitoramento por Satélite
                    </h1>
                    <p style={{ color: "#6B7280", margin: "4px 0 0", fontSize: 14 }}>
                        Índice de vegetação NDVI dos seus talhões via Sentinel-2 e Landsat 8
                    </p>
                </div>

                {/* NDVI Legend */}
                <div style={{
                    display: "flex", gap: 8, marginBottom: 24, padding: "12px 16px",
                    background: "#F9FAFB", borderRadius: 12, flexWrap: "wrap", alignItems: "center",
                }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", marginRight: 8 }}>Escala NDVI:</span>
                    {ndviColors.map((c, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <div style={{ width: 16, height: 16, borderRadius: 4, background: c.color }} />
                            <span style={{ fontSize: 11, color: "#374151" }}>{c.label} ({c.min}–{c.max})</span>
                        </div>
                    ))}
                </div>

                {/* Plot Selection */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16, marginBottom: 24 }}>
                    {loadingPlots ? (
                        <div style={{ padding: 40, color: "#6B7280" }}>Carregando talhões...</div>
                    ) : plots.length === 0 ? (
                        <div style={{ padding: 40, color: "#6B7280", gridColumn: "1 / -1", textAlign: "center" }}>
                            <MapPin size={48} color="#D1D5DB" style={{ marginBottom: 12 }} />
                            <div>Nenhum talhão cadastrado com coordenadas</div>
                            <div style={{ fontSize: 13, marginTop: 4 }}>
                                Cadastre talhões com polígono de coordenadas para ativar o monitoramento
                            </div>
                        </div>
                    ) : plots.map((plot: any) => (
                        <div key={plot.id}
                            onClick={() => setSelectedPlot(plot)}
                            style={{
                                background: selectedPlot?.id === plot.id ? "#367C2B08" : "#fff",
                                border: selectedPlot?.id === plot.id ? "2px solid #367C2B" : "1px solid #E5E7EB",
                                borderRadius: 12, padding: 16, cursor: "pointer",
                                transition: "all 0.2s ease",
                            }}
                        >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: 15, color: "#111827" }}>{plot.name}</div>
                                    <div style={{ fontSize: 12, color: "#6B7280" }}>{plot.propertyName}</div>
                                </div>
                                <span style={{
                                    fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 12,
                                    background: plot.hasCoordinates ? "#367C2B15" : "#DC262615",
                                    color: plot.hasCoordinates ? "#367C2B" : "#DC2626",
                                }}>
                                    {plot.hasCoordinates ? "GPS ✓" : "Sem GPS"}
                                </span>
                            </div>
                            <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 13, color: "#374151" }}>
                                {plot.areaHa && <span>📐 {plot.areaHa} ha</span>}
                                {plot.crop && <span>🌱 {plot.crop}</span>}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Selected plot actions */}
                {selectedPlot && selectedPlot.hasCoordinates && (
                    <div style={{
                        background: "#fff", borderRadius: 12, border: "1px solid #E5E7EB",
                        padding: 20, marginBottom: 24,
                    }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                            <div>
                                <div style={{ fontSize: 16, fontWeight: 700 }}>
                                    <Leaf size={18} color="#367C2B" style={{ verticalAlign: "text-bottom", marginRight: 6 }} />
                                    {selectedPlot.name}
                                </div>
                                <div style={{ fontSize: 13, color: "#6B7280" }}>{selectedPlot.propertyName} • {selectedPlot.areaHa} ha</div>
                            </div>
                            <button
                                onClick={() => registerMutation.mutate(selectedPlot.id)}
                                disabled={registerMutation.isPending}
                                style={{
                                    background: "#367C2B", color: "#fff", border: "none", borderRadius: 8,
                                    padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer",
                                    display: "flex", alignItems: "center", gap: 8,
                                    opacity: registerMutation.isPending ? 0.7 : 1,
                                }}
                            >
                                {registerMutation.isPending ? (
                                    <><RefreshCw size={16} className="animate-spin" /> Registrando...</>
                                ) : (
                                    <><Satellite size={16} /> Analisar NDVI</>
                                )}
                            </button>
                        </div>

                        {registerMutation.isError && (
                            <div style={{ marginTop: 12, padding: "8px 12px", background: "#FEF2F2", borderRadius: 8, fontSize: 13, color: "#DC2626", display: "flex", alignItems: "center", gap: 8 }}>
                                <AlertTriangle size={16} />
                                Erro ao registrar polígono. Verifique a chave API.
                            </div>
                        )}
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
        </FarmLayout>
    );
}
