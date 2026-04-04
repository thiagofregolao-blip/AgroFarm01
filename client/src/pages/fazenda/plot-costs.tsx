import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/format-currency";
import FazendaLayout from "@/components/fazenda/layout";
import { useState, useMemo, useEffect, useRef } from "react";
import { MapPin, BarChart3, TrendingUp, DollarSign, Layers, Package, X, Sprout, Activity } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, CartesianGrid } from "recharts";

const CATEGORY_COLORS: Record<string, string> = {
    herbicida: "#dc2626", fungicida: "#eab308", inseticida: "#2563eb",
    fertilizante: "#16a34a", semente: "#92400e", adjuvante: "#7c3aed",
    biologico: "#65a30d", combustivel: "#6b7280", outro: "#9ca3af",
};
const CATEGORY_LABELS: Record<string, string> = {
    herbicida: "Herbicidas", fungicida: "Fungicidas", inseticida: "Inseticidas",
    fertilizante: "Fertilizantes", semente: "Sementes", adjuvante: "Adjuvantes",
    biologico: "Biologicos", combustivel: "Combustivel", outro: "Outros",
};

function fmt(val: number, cur = "USD") { return formatCurrency(val, cur); }

// ── Mapa Leaflet read-only do talhão ─────────────────────────────────────────
interface LatLng { lat: number; lng: number; }

function PlotMap({ coordinates }: { coordinates: LatLng[] }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);

    useEffect(() => {
        if (!containerRef.current || coordinates.length < 3) return;

        let destroyed = false;

        (async () => {
            const L = (await import("leaflet")).default;
            await import("leaflet/dist/leaflet.css");

            if (destroyed || !containerRef.current) return;
            if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }

            const map = L.map(containerRef.current, {
                zoomControl: true,
                scrollWheelZoom: false,
                dragging: true,
                attributionControl: false,
            });

            // Esri World Imagery (satélite) — mesmo tile usado em Properties e Dashboard
            L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
                maxZoom: 20,
                attribution: "&copy; Esri",
            }).addTo(map);

            const latLngs = coordinates.map(c => [c.lat, c.lng] as [number, number]);
            const polygon = L.polygon(latLngs, {
                color: "#16a34a",
                weight: 2.5,
                fillColor: "#16a34a",
                fillOpacity: 0.25,
            }).addTo(map);

            map.fitBounds(polygon.getBounds(), { padding: [24, 24] });
            mapRef.current = map;
        })();

        return () => {
            destroyed = true;
            if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
        };
    }, [coordinates]);

    if (coordinates.length < 3) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <MapPin className="h-8 w-8 text-gray-300 mb-2" />
                <p className="text-xs text-gray-400 font-medium">Polígono não cadastrado</p>
            </div>
        );
    }

    return <div ref={containerRef} className="w-full h-full rounded-xl overflow-hidden" />;
}

// ── Modal de detalhes do talhão ───────────────────────────────────────────────
function PlotDetailModal({ plot, onClose }: { plot: any; onClose: () => void }) {
    const coords: LatLng[] = useMemo(() => {
        if (!plot.plotCoordinates) return [];
        try { return JSON.parse(plot.plotCoordinates); } catch { return []; }
    }, [plot.plotCoordinates]);

    const hasMap = coords.length >= 3;

    const categoryBreakdown = useMemo(() => {
        const m: Record<string, number> = {};
        for (const prod of plot.products || []) {
            const cat = prod.category || "outro";
            m[cat] = (m[cat] || 0) + prod.totalCost;
        }
        return Object.entries(m)
            .map(([cat, cost]) => ({ cat, cost: cost as number, color: CATEGORY_COLORS[cat] || CATEGORY_COLORS.outro, label: CATEGORY_LABELS[cat] || cat }))
            .sort((a, b) => b.cost - a.cost);
    }, [plot.products]);

    // Prevent body scroll while modal is open
    useEffect(() => {
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = ""; };
    }, []);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

            {/* Modal card */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">

                {/* Header */}
                <div className="flex items-start justify-between p-6 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
                    <div>
                        <p className="text-[10px] uppercase font-bold tracking-widest text-emerald-700 mb-0.5">
                            {plot.propertyName}
                        </p>
                        <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight" style={{ fontFamily: "'Manrope', sans-serif" }}>
                            {plot.plotName}
                        </h2>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <span className="text-sm text-gray-500 flex items-center gap-1">
                                <Layers className="h-3.5 w-3.5 text-gray-400" />
                                {plot.plotAreaHa.toFixed(1)} ha
                            </span>
                            {plot.plotCrop && (
                                <span className="text-sm text-gray-500 flex items-center gap-1">
                                    <Sprout className="h-3.5 w-3.5 text-emerald-500" />
                                    {plot.plotCrop}
                                </span>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors shrink-0 ml-4"
                        aria-label="Fechar"
                    >
                        <X className="h-4 w-4 text-gray-600" />
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    {/* Mapa */}
                    <div className={`w-full ${hasMap ? "h-52" : "h-24"}`}>
                        <PlotMap coordinates={coords} />
                    </div>

                    {/* KPIs */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-orange-50 rounded-xl p-4 border border-orange-100">
                            <div className="flex items-center gap-1.5 mb-1.5">
                                <DollarSign className="h-3.5 w-3.5 text-orange-600" />
                                <span className="text-[10px] uppercase font-bold tracking-wider text-orange-500">Custo Total</span>
                            </div>
                            <p className="text-xl font-extrabold text-gray-900" style={{ fontFamily: "'Manrope', sans-serif" }}>
                                {fmt(plot.totalCost)}
                            </p>
                        </div>
                        <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                            <div className="flex items-center gap-1.5 mb-1.5">
                                <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600">Custo/ha</span>
                            </div>
                            <p className="text-xl font-extrabold text-gray-900" style={{ fontFamily: "'Manrope', sans-serif" }}>
                                {fmt(plot.costPerHa)}
                            </p>
                        </div>
                        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                            <div className="flex items-center gap-1.5 mb-1.5">
                                <Activity className="h-3.5 w-3.5 text-blue-600" />
                                <span className="text-[10px] uppercase font-bold tracking-wider text-blue-600">Aplicações</span>
                            </div>
                            <p className="text-xl font-extrabold text-gray-900" style={{ fontFamily: "'Manrope', sans-serif" }}>
                                {plot.applicationCount ?? (plot.products?.length ?? 0)}
                            </p>
                        </div>
                    </div>

                    {/* Barra de categorias */}
                    {categoryBreakdown.length > 0 && plot.totalCost > 0 && (
                        <div>
                            <p className="text-[10px] uppercase font-bold tracking-wider text-gray-400 mb-2">Distribuição por Categoria</p>
                            <div className="h-4 rounded-full overflow-hidden flex">
                                {categoryBreakdown.map(({ cat, cost, color }) => (
                                    <div
                                        key={cat}
                                        className="h-full transition-all"
                                        style={{ width: `${(cost / plot.totalCost) * 100}%`, backgroundColor: color }}
                                        title={`${CATEGORY_LABELS[cat] || cat}: ${fmt(cost)}`}
                                    />
                                ))}
                            </div>
                            <div className="flex flex-wrap gap-3 mt-2">
                                {categoryBreakdown.map(({ cat, cost, color, label }) => (
                                    <div key={cat} className="flex items-center gap-1.5 text-[11px]">
                                        <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: color }} />
                                        <span className="text-gray-500">{label}</span>
                                        <span className="font-bold text-gray-700">{((cost / plot.totalCost) * 100).toFixed(0)}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Produtos aplicados */}
                    <div>
                        <p className="text-[10px] uppercase font-bold tracking-wider text-gray-400 mb-2">Produtos Aplicados</p>
                        <div className="space-y-2">
                            {(plot.products || []).map((prod: any) => (
                                <div key={prod.productId} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 border border-gray-100">
                                    {prod.imageUrl ? (
                                        <img src={prod.imageUrl} alt="" className="w-9 h-9 rounded-lg object-contain bg-white border border-gray-100 shrink-0" />
                                    ) : (
                                        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: (CATEGORY_COLORS[prod.category] || "#9ca3af") + "20" }}>
                                            <Package className="w-4 h-4" style={{ color: CATEGORY_COLORS[prod.category] || "#9ca3af" }} />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-gray-900 truncate">{prod.productName}</p>
                                        <p className="text-[11px] text-gray-400">
                                            {prod.quantity.toFixed(1)} {prod.productUnit}
                                            {prod.dosePerHa ? ` • ${prod.dosePerHa.toFixed(1)}/ha` : ""}
                                        </p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-sm font-bold" style={{ color: CATEGORY_COLORS[prod.category] || "#6b7280" }}>
                                            {fmt(prod.totalCost)}
                                        </p>
                                        {prod.unitCost > 0 && (
                                            <p className="text-[10px] text-gray-400">{fmt(prod.unitCost)}/{prod.productUnit}</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {(!plot.products || plot.products.length === 0) && (
                                <p className="text-sm text-gray-400 text-center py-4">Sem produtos registrados</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function PlotCosts() {
    const [selectedSeason, setSelectedSeason] = useState<string>("");
    const [selectedProperty, setSelectedProperty] = useState<string>("");
    const [modalPlot, setModalPlot] = useState<any | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: ["/api/farm/plot-costs", selectedSeason],
        queryFn: async () => {
            const url = selectedSeason ? `/api/farm/plot-costs?seasonId=${selectedSeason}` : "/api/farm/plot-costs";
            return (await apiRequest("GET", url)).json();
        },
    });

    const plots = data?.plots || [];
    const categoryTotals = data?.categoryTotals || {};
    const totalCost = data?.totalCost || 0;
    const seasons = data?.seasons || [];

    const properties = useMemo(() => {
        const m: Record<string, string> = {};
        for (const p of plots) m[p.propertyId] = p.propertyName;
        return Object.entries(m).map(([id, name]) => ({ id, name }));
    }, [plots]);

    const filtered = selectedProperty ? plots.filter((p: any) => p.propertyId === selectedProperty) : plots;
    const filteredTotalCost = filtered.reduce((s: number, p: any) => s + p.totalCost, 0);
    const filteredTotalArea = filtered.reduce((s: number, p: any) => s + p.plotAreaHa, 0);
    const sorted = [...filtered].sort((a: any, b: any) => b.totalCost - a.totalCost);

    const categoryData = Object.entries(categoryTotals)
        .map(([cat, cost]) => ({ name: CATEGORY_LABELS[cat] || cat, value: cost as number, color: CATEGORY_COLORS[cat] || CATEGORY_COLORS.outro, key: cat }))
        .sort((a, b) => b.value - a.value);

    const monthlyEvolution = useMemo(() => {
        return sorted.map((p: any) => ({
            name: p.plotName?.length > 12 ? p.plotName.slice(0, 12) + ".." : p.plotName,
            cost: Math.round(p.totalCost),
            perHa: Math.round(p.costPerHa),
        }));
    }, [sorted]);

    return (
        <FazendaLayout>
            <div className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
                {/* HEADER + KPIs */}
                <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    <div className="lg:col-span-4">
                        <p className="text-[10px] uppercase font-bold tracking-widest text-emerald-700 mb-1">PRODUCAO &gt; CUSTOS</p>
                        <h1 className="text-4xl font-extrabold tracking-tight text-gray-900" style={{ fontFamily: "'Manrope', sans-serif" }}>Custo por Talhao</h1>
                        <p className="text-gray-500 text-sm mt-3 leading-relaxed max-w-sm">Analise de custos de insumos aplicados por talhao e safra.</p>
                    </div>
                    <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-white rounded-xl shadow-sm border-l-4 border-emerald-600 p-5">
                            <div className="flex items-center gap-2 mb-2">
                                <DollarSign className="h-4 w-4 text-emerald-700" />
                                <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Custo Total</span>
                            </div>
                            <p className="text-2xl font-extrabold text-gray-900" style={{ fontFamily: "'Manrope', sans-serif" }}>{fmt(filteredTotalCost)}</p>
                            <p className="text-xs text-gray-400 mt-1">{filteredTotalArea.toFixed(1)} ha de area total</p>
                        </div>
                        <div className="bg-white rounded-xl shadow-sm border-l-4 border-emerald-800 p-5">
                            <div className="flex items-center gap-2 mb-2">
                                <TrendingUp className="h-4 w-4 text-emerald-700" />
                                <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Custo/ha</span>
                            </div>
                            <p className="text-2xl font-extrabold text-gray-900" style={{ fontFamily: "'Manrope', sans-serif" }}>{filteredTotalArea > 0 ? fmt(filteredTotalCost / filteredTotalArea) : "—"}</p>
                            <p className="text-xs text-gray-400 mt-1">media por hectare</p>
                        </div>
                        <div className="bg-white rounded-xl shadow-sm border-l-4 border-red-500 p-5">
                            <div className="flex items-center gap-2 mb-2">
                                <MapPin className="h-4 w-4 text-red-500" />
                                <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Talhoes</span>
                            </div>
                            <p className="text-2xl font-extrabold text-gray-900" style={{ fontFamily: "'Manrope', sans-serif" }}>{filtered.length}</p>
                            <p className="text-xs text-gray-400 mt-1">com aplicacoes registradas</p>
                        </div>
                    </div>
                </section>

                {isLoading ? (
                    <div className="flex items-center justify-center py-32">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" />
                    </div>
                ) : (
                    <>
                        {/* Filtros */}
                        <div className="flex flex-wrap gap-2">
                            {seasons.length > 0 && (
                                <>
                                    <button onClick={() => setSelectedSeason("")}
                                        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer ${!selectedSeason ? "bg-emerald-600 text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"}`}>
                                        Todas safras
                                    </button>
                                    {seasons.map((s: any) => (
                                        <button key={s.id} onClick={() => setSelectedSeason(selectedSeason === s.id ? "" : s.id)}
                                            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer ${selectedSeason === s.id ? "bg-emerald-600 text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"}`}>
                                            {s.name}{s.crop ? ` (${s.crop})` : ""}
                                        </button>
                                    ))}
                                </>
                            )}
                            {properties.length > 1 && properties.map(p => (
                                <button key={p.id} onClick={() => setSelectedProperty(selectedProperty === p.id ? "" : p.id)}
                                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer ${selectedProperty === p.id ? "bg-orange-500 text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"}`}>
                                    {p.name}
                                </button>
                            ))}
                        </div>

                        {filtered.length === 0 ? (
                            <div className="text-center py-20 bg-white rounded-xl shadow-sm">
                                <MapPin className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                                <p className="text-gray-500">Nenhuma aplicacao registrada</p>
                            </div>
                        ) : (
                            <>
                                {/* Gráficos */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <div className="bg-white rounded-xl p-6 shadow-sm">
                                        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                                            <BarChart3 className="h-4 w-4 text-emerald-600" /> Custo por Talhao
                                        </h3>
                                        <div className="h-[250px]">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={monthlyEvolution}>
                                                    <defs><linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#16a34a" stopOpacity={0.3} /><stop offset="95%" stopColor="#16a34a" stopOpacity={0} /></linearGradient></defs>
                                                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f0f0f0" />
                                                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                                                    <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={50} tickFormatter={(v: number) => v >= 1000000 ? `${(v / 1000000).toFixed(0)}M` : `${(v / 1000).toFixed(0)}K`} />
                                                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)", padding: "8px 14px" }}
                                                        formatter={(v: number) => [fmt(v), "Custo"]} />
                                                    <Area type="monotone" dataKey="cost" stroke="#16a34a" strokeWidth={2.5} fill="url(#costGrad)" dot={{ r: 4, fill: "#16a34a" }} />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-xl p-6 shadow-sm">
                                        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                                            <Package className="h-4 w-4 text-blue-600" /> Custo por Categoria
                                        </h3>
                                        <div className="flex items-center gap-6">
                                            <div className="relative w-[180px] h-[180px] shrink-0">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <PieChart>
                                                        <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={50} paddingAngle={2} strokeWidth={0}>
                                                            {categoryData.map((e, i) => <Cell key={i} fill={e.color} />)}
                                                        </Pie>
                                                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 10, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}
                                                            formatter={(v: number) => [fmt(v), ""]} />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                                                    <span className="text-xl font-black text-gray-900">{fmt(totalCost)}</span>
                                                    <span className="text-[9px] uppercase font-bold tracking-widest text-gray-400">Total</span>
                                                </div>
                                            </div>
                                            <div className="flex-1 space-y-2.5">
                                                {categoryData.map(cat => {
                                                    const pct = totalCost > 0 ? ((cat.value / totalCost) * 100).toFixed(1) : "0";
                                                    return (
                                                        <div key={cat.key} className="flex items-center gap-2">
                                                            <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: cat.color }} />
                                                            <span className="text-sm font-medium text-gray-700 flex-1">{cat.name}</span>
                                                            <span className="text-sm font-black text-gray-900">{fmt(cat.value)}</span>
                                                            <span className="text-[10px] text-gray-400 w-10 text-right">{pct}%</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Barra de distribuição */}
                                {totalCost > 0 && (
                                    <div className="bg-white rounded-xl p-5 shadow-sm">
                                        <h3 className="font-bold text-gray-900 mb-3 text-sm">Distribuicao por Categoria</h3>
                                        <div className="h-5 rounded-full overflow-hidden flex">
                                            {categoryData.map(cat => {
                                                const pct = (cat.value / totalCost) * 100;
                                                return <div key={cat.key} className="h-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: cat.color }} title={`${cat.name}: ${pct.toFixed(1)}%`} />;
                                            })}
                                        </div>
                                        <div className="flex flex-wrap gap-4 mt-2">
                                            {categoryData.map(cat => (
                                                <div key={cat.key} className="flex items-center gap-1.5 text-[11px]">
                                                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: cat.color }} />
                                                    <span className="text-gray-500">{cat.name}</span>
                                                    <span className="font-bold text-gray-700">{((cat.value / totalCost) * 100).toFixed(0)}%</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Ranking — clicar abre modal */}
                                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                                    <div className="px-6 py-4 border-b border-gray-100">
                                        <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                            <BarChart3 className="h-4 w-4 text-orange-500" /> Ranking de Custos
                                        </h3>
                                    </div>
                                    <div>
                                        {sorted.map((plot: any, idx: number) => (
                                            <button
                                                key={plot.plotId}
                                                className="w-full flex items-center gap-4 px-6 py-4 hover:bg-emerald-50/60 active:bg-emerald-100/60 transition-colors text-left cursor-pointer border-b border-gray-50 last:border-b-0 group"
                                                onClick={() => setModalPlot(plot)}
                                            >
                                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${idx === 0 ? "bg-yellow-500" : idx === 1 ? "bg-gray-400" : idx === 2 ? "bg-amber-700" : "bg-gray-200 text-gray-500"}`}>
                                                    {idx + 1}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-sm text-gray-900 group-hover:text-emerald-700 transition-colors">{plot.plotName}</p>
                                                    <p className="text-xs text-gray-400">{plot.propertyName} • {plot.plotAreaHa.toFixed(1)} ha{plot.plotCrop ? ` • ${plot.plotCrop}` : ""}</p>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <p className="font-black text-base text-orange-600">{fmt(plot.totalCost)}</p>
                                                    <p className="text-[11px] text-gray-400">{fmt(plot.costPerHa)}/ha</p>
                                                </div>
                                                <MapPin className="h-4 w-4 text-gray-300 group-hover:text-emerald-500 transition-colors shrink-0" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </>
                )}
            </div>

            {/* Modal */}
            {modalPlot && (
                <PlotDetailModal plot={modalPlot} onClose={() => setModalPlot(null)} />
            )}
        </FazendaLayout>
    );
}
