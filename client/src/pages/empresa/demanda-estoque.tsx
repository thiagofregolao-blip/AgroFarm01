import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import EmpresaLayout from "@/components/empresa/layout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, Search, AlertTriangle, TrendingDown, CheckCircle2, Clock } from "lucide-react";

const api = (method: string, path: string) =>
    fetch(path, { method, credentials: "include" })
        .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "Erro"); return d; });

const fmt = (v: any) => parseFloat(v ?? "0").toLocaleString("es-PY", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function daysSince(dateStr: string | null): number | null {
    if (!dateStr) return null;
    const diff = Date.now() - new Date(dateStr).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export default function EmpresaDemandaEstoque() {
    const { user } = useAuth();
    const qc = useQueryClient();
    const [search, setSearch] = useState("");
    const [filterCoverage, setFilterCoverage] = useState("all");

    const { data: items = [], isLoading } = useQuery<any[]>({
        queryKey: ["/api/company/demand-vs-stock"],
        queryFn: () => api("GET", "/api/company/demand-vs-stock"),
        enabled: !!user,
    });

    const { refreshing } = usePullToRefresh(() => qc.invalidateQueries({ queryKey: ["/api/company/demand-vs-stock"] }));

    const filtered = items.filter((item: any) => {
        const matchSearch = !search || item.productName?.toLowerCase().includes(search.toLowerCase());
        const pct = parseFloat(item.coveragePct ?? "100");
        if (filterCoverage === "critical" && pct >= 50) return false;
        if (filterCoverage === "low" && (pct < 50 || pct >= 100)) return false;
        if (filterCoverage === "ok" && pct < 100) return false;
        return matchSearch;
    });

    // Summary cards
    const totalProducts = items.length;
    const criticalCount = items.filter((i: any) => parseFloat(i.coveragePct ?? "100") < 50).length;
    const lowCount = items.filter((i: any) => { const p = parseFloat(i.coveragePct ?? "100"); return p >= 50 && p < 100; }).length;
    const okCount = items.filter((i: any) => parseFloat(i.coveragePct ?? "100") >= 100).length;

    return (
        <EmpresaLayout>
            {refreshing && (
                <div className="fixed top-0 inset-x-0 z-50 flex justify-center pt-2 pointer-events-none">
                    <div className="bg-blue-600 text-white text-xs px-3 py-1 rounded-full flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" /> Atualizando...
                    </div>
                </div>
            )}
            <div className="p-6 space-y-4">
                <h1 className="text-2xl font-bold text-slate-800">Demanda vs Estoque</h1>
                <p className="text-sm text-slate-500">
                    Confronto entre o estoque atual e os pedidos ativos (não faturados). Produtos com menor cobertura aparecem primeiro.
                </p>

                {/* Summary cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Card className="p-3 text-center">
                        <p className="text-2xl font-bold text-slate-800">{totalProducts}</p>
                        <p className="text-xs text-slate-500">Total Produtos</p>
                    </Card>
                    <Card className="p-3 text-center border-red-200 bg-red-50">
                        <div className="flex items-center justify-center gap-1">
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                            <p className="text-2xl font-bold text-red-600">{criticalCount}</p>
                        </div>
                        <p className="text-xs text-red-600">Critico (&lt;50%)</p>
                    </Card>
                    <Card className="p-3 text-center border-amber-200 bg-amber-50">
                        <div className="flex items-center justify-center gap-1">
                            <TrendingDown className="h-4 w-4 text-amber-600" />
                            <p className="text-2xl font-bold text-amber-600">{lowCount}</p>
                        </div>
                        <p className="text-xs text-amber-600">Baixo (50-99%)</p>
                    </Card>
                    <Card className="p-3 text-center border-green-200 bg-green-50">
                        <div className="flex items-center justify-center gap-1">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <p className="text-2xl font-bold text-green-600">{okCount}</p>
                        </div>
                        <p className="text-xs text-green-600">OK (100%)</p>
                    </Card>
                </div>

                {/* Filters */}
                <div className="flex gap-3 items-center flex-wrap">
                    <div className="relative max-w-xs flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <Input placeholder="Buscar produto..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <Select value={filterCoverage} onValueChange={setFilterCoverage}>
                        <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                            <SelectItem value="critical">Critico (&lt;50%)</SelectItem>
                            <SelectItem value="low">Baixo (50-99%)</SelectItem>
                            <SelectItem value="ok">OK (100%)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                        {items.length === 0 ? "Nenhum produto com demanda ou estoque" : "Nenhum produto corresponde ao filtro"}
                    </div>
                ) : (
                    <Card className="overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm min-w-[700px]">
                                <thead>
                                    <tr className="text-slate-500 text-xs border-b bg-slate-50">
                                        <th className="text-left px-3 py-2">Produto</th>
                                        <th className="text-right px-3 py-2">Estoque</th>
                                        <th className="text-right px-3 py-2">Demanda</th>
                                        <th className="text-right px-3 py-2">Disponível</th>
                                        <th className="text-right px-3 py-2">Nec. Compra</th>
                                        <th className="text-center px-3 py-2">Cobertura</th>
                                        <th className="text-right px-3 py-2">Un.</th>
                                        <th className="text-right px-3 py-2">Pedidos</th>
                                        <th className="text-right px-3 py-2 hidden md:table-cell">Alerta</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {filtered.map((item: any) => {
                                        const pct = parseFloat(item.coveragePct ?? "100");
                                        const needToBuy = parseFloat(item.needToBuy ?? "0");
                                        const days = daysSince(item.oldestOrderDate);
                                        const isCritical = pct < 50;
                                        const isLow = pct >= 50 && pct < 100;
                                        return (
                                            <tr key={item.productId} className={isCritical ? "bg-red-50" : isLow ? "bg-amber-50/50" : ""}>
                                                <td className="px-3 py-2">
                                                    <span className="font-medium">{item.productName}</span>
                                                    {item.category && (
                                                        <span className="ml-2 text-xs text-slate-400 capitalize">{item.category}</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 text-right font-semibold">
                                                    {fmt(item.totalStock)}
                                                </td>
                                                <td className="px-3 py-2 text-right font-semibold text-blue-700">
                                                    {fmt(item.totalDemand)}
                                                </td>
                                                <td className={`px-3 py-2 text-right font-semibold ${parseFloat(item.available ?? "0") === 0 ? "text-red-600" : "text-green-700"}`}>
                                                    {fmt(item.available)}
                                                </td>
                                                <td className={`px-3 py-2 text-right font-bold ${needToBuy > 0 ? "text-red-600" : "text-slate-300"}`}>
                                                    {needToBuy > 0 ? fmt(item.needToBuy) : "—"}
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <div className="w-16 bg-slate-200 rounded-full h-2">
                                                            <div
                                                                className={`h-2 rounded-full ${isCritical ? "bg-red-500" : isLow ? "bg-amber-500" : "bg-green-500"}`}
                                                                style={{ width: `${Math.min(100, pct)}%` }}
                                                            />
                                                        </div>
                                                        <span className={`text-xs font-bold min-w-[40px] ${isCritical ? "text-red-600" : isLow ? "text-amber-600" : "text-green-600"}`}>
                                                            {pct}%
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2 text-right text-slate-500">{item.unit}</td>
                                                <td className="px-3 py-2 text-right text-slate-600">{item.orderCount}</td>
                                                <td className="px-3 py-2 text-right hidden md:table-cell">
                                                    {days !== null && needToBuy > 0 && days >= 3 ? (
                                                        <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium">
                                                            <Clock className="h-3 w-3" />
                                                            {days}d sem atender
                                                        </span>
                                                    ) : days !== null && needToBuy > 0 ? (
                                                        <span className="text-xs text-amber-600">{days}d</span>
                                                    ) : (
                                                        <span className="text-xs text-slate-300">—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                )}
            </div>
        </EmpresaLayout>
    );
}
