import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import FazendaLayout from "@/components/fazenda/layout";
import { useState, useMemo } from "react";
import { MapPin, BarChart3, TrendingUp, DollarSign, Droplets, ChevronDown, ChevronUp, Layers, Package } from "lucide-react";

const CATEGORY_COLORS: Record<string, string> = {
    herbicida: "#22c55e",
    fungicida: "#3b82f6",
    inseticida: "#ef4444",
    fertilizante: "#f59e0b",
    semente: "#eab308",
    adjuvante: "#a855f7",
    outro: "#64748b",
};

const CATEGORY_LABELS: Record<string, string> = {
    herbicida: "Herbicidas",
    fungicida: "Fungicidas",
    inseticida: "Inseticidas",
    fertilizante: "Fertilizantes",
    semente: "Sementes",
    adjuvante: "Adjuvantes",
    outro: "Outros",
};

const CATEGORY_EMOJI: Record<string, string> = {
    herbicida: "🌿",
    fungicida: "🍄",
    inseticida: "🐛",
    fertilizante: "🧪",
    semente: "🌱",
    adjuvante: "💧",
    outro: "📦",
};

function formatCurrency(val: number) {
    return val.toLocaleString("pt-BR", { style: "currency", currency: "USD" });
}

function BarHorizontal({ label, value, maxValue, color, suffix }: { label: string; value: number; maxValue: number; color: string; suffix?: string }) {
    const pct = maxValue > 0 ? (value / maxValue) * 100 : 0;
    return (
        <div className="space-y-1">
            <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400 truncate">{label}</span>
                <span className="font-semibold text-gray-900 dark:text-white">{suffix || formatCurrency(value)}</span>
            </div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: color }}
                />
            </div>
        </div>
    );
}

function PlotCostCard({ plot, maxCost }: { plot: any; maxCost: number }) {
    const [expanded, setExpanded] = useState(false);
    const pct = maxCost > 0 ? (plot.totalCost / maxCost) * 100 : 0;

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            {/* Header */}
            <button
                className="w-full text-left p-4 space-y-2"
                onClick={() => setExpanded(!expanded)}
            >
                {/* Row 1: Icon + Name + Chevron */}
                <div className="flex items-center gap-3">
                    {/* Cost indicator ring — compact */}
                    <div className="relative w-10 h-10 shrink-0">
                        <svg viewBox="0 0 36 36" className="w-10 h-10 transform -rotate-90">
                            <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="3.5" className="text-gray-200 dark:text-gray-700" />
                            <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="3.5"
                                stroke={`url(#grad-${plot.plotId})`} strokeDasharray={`${pct} ${100 - pct}`} strokeLinecap="round"
                                className="transition-all duration-700" />
                            <defs>
                                <linearGradient id={`grad-${plot.plotId}`}><stop offset="0%" stopColor="#f97316" /><stop offset="100%" stopColor="#ef4444" /></linearGradient>
                            </defs>
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <MapPin className="w-4 h-4 text-orange-500" />
                        </div>
                    </div>

                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-base text-gray-900 dark:text-white truncate">{plot.plotName}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {plot.propertyName} • {plot.plotAreaHa.toFixed(1)} ha
                            {plot.plotCrop && <span> • {plot.plotCrop}</span>}
                        </p>
                    </div>

                    <div className="shrink-0 text-gray-400">
                        {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </div>
                </div>

                {/* Row 2: Cost info */}
                <div className="flex items-center justify-between pl-[52px]">
                    <p className="text-lg font-bold text-orange-600 dark:text-orange-400">{formatCurrency(plot.totalCost)}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">{formatCurrency(plot.costPerHa)}/ha</p>
                </div>
            </button>

            {/* Expanded: product breakdown */}
            {expanded && (
                <div className="border-t border-gray-200 dark:border-gray-700 p-5 space-y-4 bg-gray-50 dark:bg-gray-800/50">
                    <div className="flex items-center gap-2 mb-3">
                        <Package className="h-4 w-4 text-orange-500" />
                        <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300">Produtos aplicados</h4>
                    </div>

                    {/* Mini bar chart per product */}
                    {plot.products.map((prod: any) => {
                        const color = CATEGORY_COLORS[prod.category] || CATEGORY_COLORS.outro;
                        return (
                            <div key={prod.productId} className="bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-200 dark:border-gray-700">
                                <div className="flex items-center gap-3 mb-2">
                                    {prod.imageUrl ? (
                                        <img src={prod.imageUrl} alt="" className="w-8 h-8 rounded-lg object-contain bg-white border" />
                                    ) : (
                                        <span className="text-lg">{CATEGORY_EMOJI[prod.category] || "📦"}</span>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{prod.productName}</p>
                                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                            {prod.quantity.toFixed(1)} {prod.productUnit}
                                            {prod.dosePerHa && (
                                                <span className="text-blue-500"> • dose: {prod.dosePerHa.toFixed(1)} {prod.productUnit}/ha</span>
                                            )}
                                        </p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="font-bold text-sm" style={{ color }}>{formatCurrency(prod.totalCost)}</p>
                                        {prod.unitCost > 0 && (
                                            <p className="text-[10px] text-gray-500">{formatCurrency(prod.unitCost)}/{prod.productUnit}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-500"
                                        style={{ width: `${plot.totalCost > 0 ? Math.max((prod.totalCost / plot.totalCost) * 100, 2) : 0}%`, backgroundColor: color }}
                                    />
                                </div>
                            </div>
                        );
                    })}

                    {plot.products.length === 0 && (
                        <p className="text-sm text-gray-400 text-center py-4">Nenhum produto aplicado</p>
                    )}
                </div>
            )}
        </div>
    );
}

export default function PlotCosts() {
    const [selectedProperty, setSelectedProperty] = useState<string>("");

    const { data, isLoading } = useQuery({
        queryKey: ["/api/farm/plot-costs"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/farm/plot-costs");
            return res.json();
        },
    });

    const plots = data?.plots || [];
    const categoryTotals = data?.categoryTotals || {};
    const totalCost = data?.totalCost || 0;
    const totalArea = data?.totalArea || 0;

    const properties = useMemo(() => {
        const props: Record<string, string> = {};
        for (const p of plots) {
            props[p.propertyId] = p.propertyName;
        }
        return Object.entries(props).map(([id, name]) => ({ id, name }));
    }, [plots]);

    const filtered = selectedProperty
        ? plots.filter((p: any) => p.propertyId === selectedProperty)
        : plots;

    const filteredTotalCost = filtered.reduce((s: number, p: any) => s + p.totalCost, 0);
    const filteredTotalArea = filtered.reduce((s: number, p: any) => s + p.plotAreaHa, 0);
    const maxCost = Math.max(...filtered.map((p: any) => p.totalCost), 1);

    // Sort by cost descending
    const sorted = [...filtered].sort((a: any, b: any) => b.totalCost - a.totalCost);

    // Category chart data
    const categoryEntries = Object.entries(categoryTotals)
        .map(([cat, cost]) => ({ cat, cost: cost as number, label: CATEGORY_LABELS[cat] || cat, color: CATEGORY_COLORS[cat] || CATEGORY_COLORS.outro }))
        .sort((a, b) => b.cost - a.cost);
    const maxCatCost = Math.max(...categoryEntries.map(c => c.cost), 1);

    return (
        <FazendaLayout>
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-orange-50 dark:from-gray-900 dark:to-gray-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {/* Header */}
                    <div className="mb-8">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
                                <TrendingUp className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Custo por Talhão</h1>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Análise de custos de insumos aplicados</p>
                            </div>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="flex items-center justify-center py-32">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
                        </div>
                    ) : plots.length === 0 ? (
                        <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
                            <MapPin className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-400">Nenhuma aplicação registrada</h3>
                            <p className="text-sm text-gray-400 mt-1">Registre saídas no PDV para ver os custos aqui</p>
                        </div>
                    ) : (
                        <>
                            {/* KPI Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                                <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
                                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
                                        <DollarSign className="h-4 w-4 text-orange-500" />
                                        <span>Custo Total</span>
                                    </div>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(filteredTotalCost)}</p>
                                </div>
                                <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
                                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
                                        <TrendingUp className="h-4 w-4 text-emerald-500" />
                                        <span>Custo/ha</span>
                                    </div>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{filteredTotalArea > 0 ? formatCurrency(filteredTotalCost / filteredTotalArea) : "—"}</p>
                                </div>
                                <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
                                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
                                        <Layers className="h-4 w-4 text-blue-500" />
                                        <span>Área Total</span>
                                    </div>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{filteredTotalArea.toFixed(1)} ha</p>
                                </div>
                                <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
                                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
                                        <MapPin className="h-4 w-4 text-purple-500" />
                                        <span>Talhões</span>
                                    </div>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{filtered.length}</p>
                                </div>
                            </div>

                            {/* Filter by property */}
                            {properties.length > 1 && (
                                <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
                                    <button
                                        onClick={() => setSelectedProperty("")}
                                        className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${!selectedProperty ? "bg-orange-500 text-white shadow-md" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"}`}
                                    >Todas propriedades</button>
                                    {properties.map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => setSelectedProperty(selectedProperty === p.id ? "" : p.id)}
                                            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${selectedProperty === p.id ? "bg-orange-500 text-white shadow-md" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"}`}
                                        >🌾 {p.name}</button>
                                    ))}
                                </div>
                            )}

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                {/* Left: Plot cards */}
                                <div className="lg:col-span-2 space-y-4">
                                    <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                        <BarChart3 className="h-5 w-5 text-orange-500" />
                                        Ranking de Custos
                                    </h2>
                                    {sorted.map((plot: any, idx: number) => (
                                        <div key={plot.plotId} className="relative">
                                            {idx < 3 && (
                                                <div className={`absolute -top-2 -left-2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white z-10 shadow-md ${idx === 0 ? "bg-yellow-500" : idx === 1 ? "bg-gray-400" : "bg-amber-700"}`}>
                                                    {idx + 1}º
                                                </div>
                                            )}
                                            <PlotCostCard plot={plot} maxCost={maxCost} />
                                        </div>
                                    ))}
                                </div>

                                {/* Right: Category breakdown */}
                                <div className="space-y-6">
                                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                                        <h3 className="font-bold text-gray-900 dark:text-white mb-5 flex items-center gap-2">
                                            <Droplets className="h-5 w-5 text-blue-500" />
                                            Custo por Categoria
                                        </h3>
                                        <div className="space-y-4">
                                            {categoryEntries.map(cat => (
                                                <BarHorizontal
                                                    key={cat.cat}
                                                    label={`${CATEGORY_EMOJI[cat.cat] || "📦"} ${cat.label}`}
                                                    value={cat.cost}
                                                    maxValue={maxCatCost}
                                                    color={cat.color}
                                                />
                                            ))}
                                        </div>
                                        {categoryEntries.length === 0 && (
                                            <p className="text-sm text-gray-400 text-center py-4">Sem dados</p>
                                        )}
                                    </div>

                                    {/* Donut-style category breakdown */}
                                    {totalCost > 0 && (
                                        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                                            <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                                <BarChart3 className="h-5 w-5 text-purple-500" />
                                                Distribuição %
                                            </h3>
                                            {/* Simple stacked bar as a visual */}
                                            <div className="h-6 rounded-full overflow-hidden flex mb-4">
                                                {categoryEntries.map((cat, i) => {
                                                    const pct = (cat.cost / totalCost) * 100;
                                                    return (
                                                        <div
                                                            key={cat.cat}
                                                            className="h-full transition-all duration-500"
                                                            style={{ width: `${pct}%`, backgroundColor: cat.color }}
                                                            title={`${cat.label}: ${pct.toFixed(1)}%`}
                                                        />
                                                    );
                                                })}
                                            </div>
                                            <div className="space-y-2">
                                                {categoryEntries.map(cat => {
                                                    const pct = (cat.cost / totalCost) * 100;
                                                    return (
                                                        <div key={cat.cat} className="flex items-center justify-between text-sm">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                                                                <span className="text-gray-600 dark:text-gray-400">{cat.label}</span>
                                                            </div>
                                                            <span className="font-semibold text-gray-900 dark:text-white">{pct.toFixed(1)}%</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Cost per hectare ranking */}
                                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                                        <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                            <TrendingUp className="h-5 w-5 text-emerald-500" />
                                            Custo/ha por Talhão
                                        </h3>
                                        <div className="space-y-3">
                                            {[...filtered].sort((a: any, b: any) => b.costPerHa - a.costPerHa).map((plot: any) => {
                                                const maxPerHa = Math.max(...filtered.map((p: any) => p.costPerHa), 1);
                                                return (
                                                    <BarHorizontal
                                                        key={plot.plotId}
                                                        label={plot.plotName}
                                                        value={plot.costPerHa}
                                                        maxValue={maxPerHa}
                                                        color="#10b981"
                                                    />
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </FazendaLayout>
    );
}
