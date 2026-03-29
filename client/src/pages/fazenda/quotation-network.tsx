import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import FarmLayout from "@/components/fazenda/layout";
import { TrendingUp, TrendingDown, Minus, ArrowDownUp, Package, Users, Search, Calculator, Loader2 } from "lucide-react";

export default function QuotationNetwork() {
    const [search, setSearch] = useState("");
    const [simProduct, setSimProduct] = useState("");
    const [simPrice, setSimPrice] = useState("");

    const { data, isLoading } = useQuery({
        queryKey: ["/api/farm/quotation-network"],
        queryFn: async () => (await apiRequest("GET", "/api/farm/quotation-network")).json(),
    });

    const simulate = useMutation({
        mutationFn: async () => {
            const res = await apiRequest("POST", "/api/farm/quotation-network/simulate", { productName: simProduct, offeredPrice: parseFloat(simPrice) });
            return res.json();
        },
    });

    const comparisons = data?.comparisons || [];
    const summary = data?.summary || {};

    const filtered = search
        ? comparisons.filter((c: any) => c.productName.toLowerCase().includes(search.toLowerCase()))
        : comparisons;

    const getStatusIcon = (status: string) => {
        if (status === "above") return <TrendingUp className="w-4 h-4 text-red-500" />;
        if (status === "below") return <TrendingDown className="w-4 h-4 text-emerald-500" />;
        if (status === "sem_dados") return <Minus className="w-4 h-4 text-gray-300" />;
        return <Minus className="w-4 h-4 text-amber-500" />;
    };

    const getStatusLabel = (c: any) => {
        if (c.status === "sem_dados") return <span className="text-gray-400 text-xs">Sem compra</span>;
        if (c.status === "above") return <span className="text-red-600 text-xs font-bold">{c.diffPercentage}% acima</span>;
        if (c.status === "below") return <span className="text-emerald-600 text-xs font-bold">{Math.abs(c.diffPercentage)}% abaixo</span>;
        return <span className="text-amber-600 text-xs font-bold">Na media</span>;
    };

    const fmt = (v: number | null) => v !== null ? `$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—";

    return (
        <FarmLayout>
            <div className="w-full space-y-6" style={{ fontFamily: "'Inter', sans-serif" }}>
                {/* Header */}
                <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    <div className="lg:col-span-4">
                        <p className="text-[10px] uppercase font-bold tracking-widest text-emerald-700 mb-1">INTELIGENCIA &gt; COTACOES</p>
                        <h1 className="text-4xl font-extrabold tracking-tight text-gray-900" style={{ fontFamily: "'Manrope', sans-serif" }}>Rede de Cotacao</h1>
                        <p className="text-gray-500 text-sm mt-3 leading-relaxed max-w-sm">Compare anonimamente seus precos com outros agricultores da regiao.</p>
                    </div>
                    <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {[
                            { label: "Produtos", value: summary.totalProducts || 0, icon: Package, color: "emerald-600" },
                            { label: "Agricultores", value: summary.totalFarmersInNetwork || 0, icon: Users, color: "blue-600" },
                            { label: "Acima Media", value: summary.aboveAverage || 0, icon: TrendingUp, color: "red-500" },
                            { label: "Abaixo Media", value: summary.belowAverage || 0, icon: TrendingDown, color: "emerald-500" },
                        ].map((card, i) => {
                            const Icon = card.icon;
                            return (
                                <div key={i} className={`bg-white rounded-xl shadow-sm border-l-4 border-${card.color} p-4`}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <Icon className={`h-4 w-4 text-${card.color}`} />
                                        <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400">{card.label}</span>
                                    </div>
                                    <p className="text-2xl font-extrabold text-gray-900">{card.value}</p>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* Simulador de Compra */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                    <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                        <Calculator className="w-4 h-4 text-emerald-600" />
                        Simulador de Compra
                    </h3>
                    <p className="text-xs text-gray-400 mb-4">Digite o produto e o preco oferecido para saber se e um bom negocio.</p>
                    <div className="flex flex-wrap gap-3 items-end">
                        <div className="flex-1 min-w-[200px]">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1">Produto</label>
                            <input value={simProduct} onChange={e => setSimProduct(e.target.value)} placeholder="Ex: ROUNDUP, GLIFOSATO..."
                                className="w-full h-11 px-4 bg-gray-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-emerald-200" />
                        </div>
                        <div className="w-[150px]">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1">Preco Oferecido ($)</label>
                            <input type="number" step="0.01" value={simPrice} onChange={e => setSimPrice(e.target.value)} placeholder="0.00"
                                className="w-full h-11 px-4 bg-gray-100 border-none rounded-lg text-sm font-bold focus:ring-2 focus:ring-emerald-200" />
                        </div>
                        <button onClick={() => simulate.mutate()} disabled={!simProduct || !simPrice || simulate.isPending}
                            className="h-11 px-6 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-40 flex items-center gap-2 cursor-pointer">
                            {simulate.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                            Simular
                        </button>
                    </div>

                    {/* Resultado do simulador */}
                    {simulate.data && (
                        <div className={`mt-4 p-4 rounded-xl ${simulate.data.found ? "bg-gray-50" : "bg-amber-50"}`}>
                            {simulate.data.found ? (
                                <div className="flex flex-wrap items-center gap-6">
                                    <div>
                                        <span className="text-2xl mr-2">{simulate.data.emoji}</span>
                                        <span className="text-sm font-bold text-gray-800">{simulate.data.productName}</span>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs text-gray-500">Seu preco: <strong className="text-gray-900">{fmt(simulate.data.offeredPrice)}</strong></p>
                                        <p className="text-xs text-gray-500">Media regiao: <strong className="text-gray-900">{fmt(simulate.data.averagePrice)}</strong></p>
                                        <p className="text-xs text-gray-500">Menor: <strong className="text-emerald-600">{fmt(simulate.data.minPrice)}</strong> | Maior: <strong className="text-red-600">{fmt(simulate.data.maxPrice)}</strong></p>
                                    </div>
                                    <div className="flex-1 min-w-[200px]">
                                        <p className={`text-sm font-bold ${simulate.data.diffPercentage > 5 ? "text-red-600" : simulate.data.diffPercentage < -5 ? "text-emerald-600" : "text-amber-600"}`}>
                                            {simulate.data.diffPercentage > 0 ? "+" : ""}{simulate.data.diffPercentage}% vs media
                                        </p>
                                        <p className="text-xs text-gray-600 mt-0.5">{simulate.data.verdict}</p>
                                        <p className="text-[10px] text-gray-400 mt-1">{simulate.data.totalSamples} amostras de {simulate.data.uniqueSuppliers} fornecedores</p>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-amber-700">{simulate.data.message}</p>
                            )}
                        </div>
                    )}
                </div>

                {/* Busca */}
                <div className="bg-gray-100 rounded-xl p-4 flex items-center gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar produto..."
                            className="w-full pl-10 pr-4 h-11 bg-white border-none rounded-lg text-sm shadow-sm focus:ring-2 focus:ring-emerald-200" />
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">{filtered.length} de {comparisons.length} produtos</span>
                </div>

                {/* Tabela */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
                ) : filtered.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-sm py-16 text-center">
                        <ArrowDownUp className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 font-semibold">Nenhum dado disponivel</p>
                        <p className="text-xs text-gray-400 mt-1">Importe faturas para popular o historico de precos</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-gray-50">
                                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">Produto</th>
                                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400 text-right">Seu Preco</th>
                                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400 text-right">Media</th>
                                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400 text-right">Menor</th>
                                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400 text-right">Maior</th>
                                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400 text-center">Amostras</th>
                                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filtered.map((c: any) => (
                                    <tr key={c.normalizedName} className="hover:bg-emerald-50/20 transition-colors">
                                        <td className="px-6 py-4">
                                            <p className="text-sm font-bold text-gray-900">{c.productName}</p>
                                            <p className="text-[10px] text-gray-400">{c.totalFarmers} agricultor{c.totalFarmers > 1 ? "es" : ""}</p>
                                        </td>
                                        <td className={`px-6 py-4 text-sm font-extrabold text-right ${c.myPrice ? (c.status === "above" ? "text-red-600" : c.status === "below" ? "text-emerald-600" : "text-amber-600") : "text-gray-300"}`}>
                                            {c.myPrice ? fmt(c.myPrice) : "—"}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-semibold text-gray-700 text-right">{fmt(c.averagePrice)}</td>
                                        <td className="px-6 py-4 text-sm font-semibold text-emerald-600 text-right">{fmt(c.minPrice)}</td>
                                        <td className="px-6 py-4 text-sm font-semibold text-red-500 text-right">{fmt(c.maxPrice)}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{c.totalSamples}</span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex items-center justify-center gap-1.5">
                                                {getStatusIcon(c.status)}
                                                {getStatusLabel(c)}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Privacidade */}
                <div className="flex items-center gap-2 text-xs text-gray-400 px-2">
                    <span>🔒</span>
                    <span><strong>Privacidade garantida:</strong> Todos os dados sao anonimos. Nenhum nome de agricultor e revelado.</span>
                </div>
            </div>
        </FarmLayout>
    );
}
