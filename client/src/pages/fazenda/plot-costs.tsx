import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import FazendaLayout from "@/components/fazenda/layout";
import { useState, useMemo } from "react";
import { MapPin, BarChart3, TrendingUp, DollarSign, Layers, Package, ChevronDown, ChevronUp } from "lucide-react";
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

function fmt(val: number) { return `$${Math.round(val).toLocaleString("pt-BR")}`; }

export default function PlotCosts() {
    const [selectedSeason, setSelectedSeason] = useState<string>("");
    const [selectedProperty, setSelectedProperty] = useState<string>("");
    const [expandedPlot, setExpandedPlot] = useState<string | null>(null);

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

    // Category donut data
    const categoryData = Object.entries(categoryTotals)
        .map(([cat, cost]) => ({ name: CATEGORY_LABELS[cat] || cat, value: cost as number, color: CATEGORY_COLORS[cat] || CATEGORY_COLORS.outro, key: cat }))
        .sort((a, b) => b.value - a.value);

    // Monthly evolution (from plot application dates)
    const monthlyEvolution = useMemo(() => {
        const m: Record<string, number> = {};
        const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        for (const plot of filtered) {
            for (const prod of (plot.products || [])) {
                // Use appliedAt if available, otherwise spread evenly
                const cost = prod.totalCost || 0;
                // Since we don't have individual dates here, distribute by plot
                const key = "Total";
                if (!m[key]) m[key] = 0;
                m[key] += cost;
            }
        }
        // Build per-plot monthly approximation
        const perPlot = sorted.map((p: any) => ({
            name: p.plotName?.length > 12 ? p.plotName.slice(0, 12) + ".." : p.plotName,
            cost: Math.round(p.totalCost),
            perHa: Math.round(p.costPerHa),
        }));
        return perPlot;
    }, [filtered, sorted]);

    return (
        <FazendaLayout>
            <div className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Custo por Talhao</h1>
                    <p className="text-sm text-gray-500 mt-1">Analise de custos de insumos aplicados</p>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-32"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div></div>
                ) : (
                    <>
                        {/* KPI Cards — com cores */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-white rounded-xl p-5 shadow-sm border-l-4 border-l-orange-500">
                                <div className="flex items-center gap-2 text-xs text-gray-500 mb-1"><DollarSign className="h-3.5 w-3.5 text-orange-500" /> Custo Total</div>
                                <p className="text-2xl font-black text-gray-900">{fmt(filteredTotalCost)}</p>
                            </div>
                            <div className="bg-white rounded-xl p-5 shadow-sm border-l-4 border-l-emerald-500">
                                <div className="flex items-center gap-2 text-xs text-gray-500 mb-1"><TrendingUp className="h-3.5 w-3.5 text-emerald-500" /> Custo/ha</div>
                                <p className="text-2xl font-black text-gray-900">{filteredTotalArea > 0 ? fmt(filteredTotalCost / filteredTotalArea) : "—"}</p>
                            </div>
                            <div className="bg-white rounded-xl p-5 shadow-sm border-l-4 border-l-blue-500">
                                <div className="flex items-center gap-2 text-xs text-gray-500 mb-1"><Layers className="h-3.5 w-3.5 text-blue-500" /> Area Total</div>
                                <p className="text-2xl font-black text-gray-900">{filteredTotalArea.toFixed(1)} ha</p>
                            </div>
                            <div className="bg-white rounded-xl p-5 shadow-sm border-l-4 border-l-purple-500">
                                <div className="flex items-center gap-2 text-xs text-gray-500 mb-1"><MapPin className="h-3.5 w-3.5 text-purple-500" /> Talhoes</div>
                                <p className="text-2xl font-black text-gray-900">{filtered.length}</p>
                            </div>
                        </div>

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
                            <div className="text-center py-20 bg-white rounded-xl shadow-sm"><MapPin className="h-12 w-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">Nenhuma aplicacao registrada</p></div>
                        ) : (
                            <>
                                {/* ROW: Grafico evolucao + Donut categorias */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {/* Grafico de custo por talhao (barras verticais) */}
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
                                                    <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={50} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}K`} />
                                                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)", padding: "8px 14px" }}
                                                        formatter={(v: number) => [fmt(v), "Custo"]} />
                                                    <Area type="monotone" dataKey="cost" stroke="#16a34a" strokeWidth={2.5} fill="url(#costGrad)" dot={{ r: 4, fill: "#16a34a" }} />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    {/* Donut de categorias GRANDE */}
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

                                {/* Distribuicao % — barra full-width */}
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

                                {/* Ranking de Talhoes — tabela full-width */}
                                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                                    <div className="px-6 py-4 border-b border-gray-100">
                                        <h3 className="font-bold text-gray-900 flex items-center gap-2"><BarChart3 className="h-4 w-4 text-orange-500" /> Ranking de Custos</h3>
                                    </div>
                                    <div>
                                        {sorted.map((plot: any, idx: number) => {
                                            const isOpen = expandedPlot === plot.plotId;
                                            return (
                                                <div key={plot.plotId} className={`border-b border-gray-50 ${idx === 0 ? "" : ""}`}>
                                                    <button className="w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors text-left cursor-pointer"
                                                        onClick={() => setExpandedPlot(isOpen ? null : plot.plotId)}>
                                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${idx === 0 ? "bg-yellow-500" : idx === 1 ? "bg-gray-400" : idx === 2 ? "bg-amber-700" : "bg-gray-200 text-gray-500"}`}>
                                                            {idx + 1}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-bold text-sm text-gray-900">{plot.plotName}</p>
                                                            <p className="text-xs text-gray-400">{plot.propertyName} • {plot.plotAreaHa.toFixed(1)} ha{plot.plotCrop ? ` • ${plot.plotCrop}` : ""}</p>
                                                        </div>
                                                        <div className="text-right shrink-0">
                                                            <p className="font-black text-base text-orange-600">{fmt(plot.totalCost)}</p>
                                                            <p className="text-[11px] text-gray-400">{fmt(plot.costPerHa)}/ha</p>
                                                        </div>
                                                        <div className="shrink-0 text-gray-300">{isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</div>
                                                    </button>
                                                    {isOpen && (
                                                        <div className="px-6 pb-4 space-y-2 bg-gray-50/50">
                                                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Produtos aplicados</p>
                                                            {(plot.products || []).map((prod: any) => (
                                                                <div key={prod.productId} className="flex items-center gap-3 bg-white rounded-lg p-3 border border-gray-100">
                                                                    {prod.imageUrl ? (
                                                                        <img src={prod.imageUrl} alt="" className="w-8 h-8 rounded-lg object-contain bg-white border" />
                                                                    ) : (
                                                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: (CATEGORY_COLORS[prod.category] || "#9ca3af") + "20" }}>
                                                                            <Package className="w-4 h-4" style={{ color: CATEGORY_COLORS[prod.category] || "#9ca3af" }} />
                                                                        </div>
                                                                    )}
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-sm font-medium text-gray-900 truncate">{prod.productName}</p>
                                                                        <p className="text-[11px] text-gray-400">{prod.quantity.toFixed(1)} {prod.productUnit}{prod.dosePerHa ? ` • dose: ${prod.dosePerHa.toFixed(1)}/ha` : ""}</p>
                                                                    </div>
                                                                    <div className="text-right shrink-0">
                                                                        <p className="text-sm font-bold" style={{ color: CATEGORY_COLORS[prod.category] || "#6b7280" }}>{fmt(prod.totalCost)}</p>
                                                                        {prod.unitCost > 0 && <p className="text-[10px] text-gray-400">{fmt(prod.unitCost)}/{prod.productUnit}</p>}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                            {(!plot.products || plot.products.length === 0) && <p className="text-sm text-gray-400 py-2">Sem produtos</p>}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </>
                        )}
                    </>
                )}
            </div>
        </FazendaLayout>
    );
}
