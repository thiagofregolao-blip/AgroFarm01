import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import FarmLayout from "@/components/fazenda/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, TrendingUp, Wheat, DollarSign, BarChart3 } from "lucide-react";

export default function Produtividade() {
    const { user } = useAuth();
    const [seasonId, setSeasonId] = useState("todos");
    const [plotId, setPlotId] = useState("todos");

    const { data: seasons = [] } = useQuery({
        queryKey: ["/api/farm/seasons"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/seasons"); return r.json(); },
        enabled: !!user,
    });

    const { data: plots = [] } = useQuery({
        queryKey: ["/api/farm/plots"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/plots"); return r.json(); },
        enabled: !!user,
    });

    const { data: productivity = [], isLoading } = useQuery({
        queryKey: ["/api/farm/productivity", seasonId, plotId],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (seasonId !== "todos") params.set("seasonId", seasonId);
            if (plotId !== "todos") params.set("plotId", plotId);
            const r = await apiRequest("GET", `/api/farm/productivity?${params.toString()}`);
            return r.json();
        },
        enabled: !!user,
    });

    // Summary calculations
    const totalProduction = productivity.reduce((sum: number, p: any) => sum + (parseFloat(p.total_production_ton) || 0), 0);
    const avgProductivity = productivity.length > 0
        ? productivity.reduce((sum: number, p: any) => sum + (parseFloat(p.productivity_ton_ha) || 0), 0) / productivity.length
        : 0;
    const totalCost = productivity.reduce((sum: number, p: any) => sum + (parseFloat(p.total_cost) || 0), 0);

    function getProductivityColor(tonHa: number): string {
        if (tonHa >= 3.5) return "text-green-700 bg-green-50";
        if (tonHa >= 2.5) return "text-yellow-700 bg-yellow-50";
        return "text-red-700 bg-red-50";
    }

    return (
        <FarmLayout>
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Produtividade por Talhao</h1>
                        <p className="text-sm text-gray-500 mt-1">Analise de producao, custos e eficiencia por talhao</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <Select value={seasonId} onValueChange={setSeasonId}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Safra" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="todos">Todas as Safras</SelectItem>
                                {seasons.map((s: any) => (
                                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={plotId} onValueChange={setPlotId}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Talhao" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="todos">Todos os Talhoes</SelectItem>
                                {plots.map((p: any) => (
                                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-green-100 rounded-xl">
                                    <Wheat className="w-6 h-6 text-green-700" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Producao Total</p>
                                    <p className="text-2xl font-bold text-gray-900">{totalProduction.toFixed(2)} ton</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-blue-100 rounded-xl">
                                    <TrendingUp className="w-6 h-6 text-blue-700" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Media Produtividade</p>
                                    <p className="text-2xl font-bold text-gray-900">{avgProductivity.toFixed(2)} ton/ha</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-orange-100 rounded-xl">
                                    <DollarSign className="w-6 h-6 text-orange-700" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Custo Total</p>
                                    <p className="text-2xl font-bold text-gray-900">USD {totalCost.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Table */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-emerald-600" />
                            Detalhamento por Talhao
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                            </div>
                        ) : productivity.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">
                                <Wheat className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                <p className="text-lg font-medium">Sem dados de produtividade</p>
                                <p className="text-sm mt-1">Registre romaneios com talhao para visualizar</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-200">
                                            <th className="text-left py-3 px-2 font-semibold text-gray-600">Talhao</th>
                                            <th className="text-left py-3 px-2 font-semibold text-gray-600">Propriedade</th>
                                            <th className="text-left py-3 px-2 font-semibold text-gray-600">Safra</th>
                                            <th className="text-left py-3 px-2 font-semibold text-gray-600">Cultura</th>
                                            <th className="text-right py-3 px-2 font-semibold text-gray-600">Romaneios</th>
                                            <th className="text-right py-3 px-2 font-semibold text-gray-600">Producao (ton)</th>
                                            <th className="text-right py-3 px-2 font-semibold text-gray-600">Area (ha)</th>
                                            <th className="text-right py-3 px-2 font-semibold text-gray-600">Prod. (ton/ha)</th>
                                            <th className="text-right py-3 px-2 font-semibold text-gray-600">Custo Total</th>
                                            <th className="text-right py-3 px-2 font-semibold text-gray-600">Custo/ha</th>
                                            <th className="text-right py-3 px-2 font-semibold text-gray-600">Custo/ton</th>
                                            <th className="text-right py-3 px-2 font-semibold text-gray-600">Media Hist.</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {productivity.map((p: any, i: number) => {
                                            const tonHa = parseFloat(p.productivity_ton_ha) || 0;
                                            const colorClass = getProductivityColor(tonHa);
                                            return (
                                                <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                                    <td className="py-3 px-2 font-medium text-gray-900">{p.plot_name || "-"}</td>
                                                    <td className="py-3 px-2 text-gray-600">{p.property_name || "-"}</td>
                                                    <td className="py-3 px-2 text-gray-600">{p.season_name || "-"}</td>
                                                    <td className="py-3 px-2 text-gray-600">{p.crop || "-"}</td>
                                                    <td className="py-3 px-2 text-right text-gray-700">{p.total_romaneios}</td>
                                                    <td className="py-3 px-2 text-right font-medium text-gray-900">
                                                        {parseFloat(p.total_production_ton || 0).toFixed(2)}
                                                    </td>
                                                    <td className="py-3 px-2 text-right text-gray-700">
                                                        {parseFloat(p.area_ha || 0).toFixed(1)}
                                                    </td>
                                                    <td className="py-3 px-2 text-right">
                                                        <span className={`inline-block px-2 py-0.5 rounded-lg text-xs font-bold ${colorClass}`}>
                                                            {tonHa.toFixed(2)}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-2 text-right text-gray-700">
                                                        {parseFloat(p.total_cost || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="py-3 px-2 text-right text-gray-700">
                                                        {parseFloat(p.cost_per_ha || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="py-3 px-2 text-right text-gray-700">
                                                        {parseFloat(p.cost_per_ton || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="py-3 px-2 text-right text-gray-500">
                                                        {p.avg_production_ton} ton ({p.seasons_count} safra{p.seasons_count > 1 ? "s" : ""})
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </FarmLayout>
    );
}
