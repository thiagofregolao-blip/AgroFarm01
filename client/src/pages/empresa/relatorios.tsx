import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import EmpresaLayout from "@/components/empresa/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download, TrendingUp, Package, Users, DollarSign, BarChart2, AlertCircle } from "lucide-react";
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
    PieChart, Pie, Cell,
} from "recharts";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316"];

const fmt = (v: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);

function EmptyState({ message }: { message: string }) {
    return (
        <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400 py-10">
            <BarChart2 className="w-10 h-10 opacity-30" />
            <p className="text-sm">{message}</p>
        </div>
    );
}

export default function EmpresaRelatorios() {
    const [startDate, setStartDate] = useState(
        new Date(new Date().setMonth(new Date().getMonth() - 6)).toISOString().split("T")[0]
    );
    const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
    const [rtvId, setRtvId] = useState<string>("all");

    const { data: team = [] } = useQuery<any[]>({
        queryKey: ["/api/company/team"],
        queryFn: async () => {
            const r = await fetch("/api/company/team", { credentials: "include" });
            if (!r.ok) return [];
            return r.json();
        },
    });

    const { data: dashboardData, isLoading, error } = useQuery<any>({
        queryKey: ["/api/company/admin-reports/dashboard", startDate, endDate, rtvId],
        queryFn: async () => {
            const params = new URLSearchParams({ startDate, endDate });
            if (rtvId !== "all") params.append("rtvId", rtvId);
            const r = await fetch(`/api/company/admin-reports/dashboard?${params}`, { credentials: "include" });
            if (!r.ok) {
                const err = await r.json().catch(() => ({}));
                throw new Error(err.error ?? "Erro ao carregar relatórios");
            }
            return r.json();
        },
    });

    const kpis = dashboardData?.kpis ?? { totalRevenue: 0, totalOrders: 0, averageTicket: 0 };
    const salesByRtv: any[] = dashboardData?.salesByRtv ?? [];
    const topProducts: any[] = dashboardData?.topProducts ?? [];
    const topClients: any[] = dashboardData?.topClients ?? [];
    const rtvs = team.filter((u: any) => u.role === "rtv");

    return (
        <EmpresaLayout>
        <div className="p-6 max-w-7xl mx-auto space-y-6">

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl font-bold text-slate-800 tracking-tight">Relatórios Gerenciais</h1>
                    <p className="text-sm text-slate-500">Visão analítica de vendas, produtos e clientes</p>
                </div>
                <Button onClick={() => window.print()} variant="outline" size="sm" className="gap-2 self-start sm:self-auto print:hidden">
                    <Download className="h-4 w-4" /> Exportar / Imprimir
                </Button>
            </div>

            {/* Filtros */}
            <Card className="print:hidden">
                <CardContent className="p-4 flex flex-col sm:flex-row gap-4 items-end">
                    <div className="space-y-1.5 flex-1">
                        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Data Inicial</label>
                        <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    </div>
                    <div className="space-y-1.5 flex-1">
                        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Data Final</label>
                        <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                    </div>
                    <div className="space-y-1.5 flex-1">
                        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Consultor / RTV</label>
                        <Select value={rtvId} onValueChange={setRtvId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Todos os RTVs" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos os RTVs</SelectItem>
                                {rtvs.map((t: any) => (
                                    <SelectItem key={t.userId} value={t.userId}>{t.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Erro de acesso */}
            {error && (
                <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    {(error as Error).message}
                </div>
            )}

            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                    { label: "Receita Total", value: fmt(kpis.totalRevenue), icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-50" },
                    { label: "Pedidos Aprovados/Faturados", value: kpis.totalOrders, icon: Package, color: "text-blue-600", bg: "bg-blue-50" },
                    { label: "Ticket Médio", value: fmt(kpis.averageTicket), icon: TrendingUp, color: "text-amber-600", bg: "bg-amber-50" },
                ].map((kpi) => {
                    const Icon = kpi.icon;
                    return (
                        <Card key={kpi.label} className="border border-slate-200 shadow-sm">
                            <CardContent className="p-5 flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-slate-500 font-medium mb-1">{kpi.label}</p>
                                    <p className="text-2xl font-bold text-slate-800">
                                        {isLoading
                                            ? <span className="inline-block w-24 h-7 bg-slate-100 rounded animate-pulse" />
                                            : kpi.value}
                                    </p>
                                </div>
                                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${kpi.bg}`}>
                                    <Icon className={`w-5 h-5 ${kpi.color}`} />
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Abas */}
            <Tabs defaultValue="vendas" className="w-full">
                <TabsList className="print:hidden">
                    <TabsTrigger value="vendas" className="gap-2">
                        <DollarSign className="w-4 h-4" /> Vendas
                    </TabsTrigger>
                    <TabsTrigger value="produtos" className="gap-2">
                        <Package className="w-4 h-4" /> Produtos
                    </TabsTrigger>
                    <TabsTrigger value="clientes" className="gap-2">
                        <Users className="w-4 h-4" /> Clientes
                    </TabsTrigger>
                </TabsList>

                {/* ── VENDAS ── */}
                <TabsContent value="vendas" className="pt-4">
                    <Card className="border border-slate-200 shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base font-semibold text-slate-800">Ranking de Vendas por RTV</CardTitle>
                        </CardHeader>
                        <CardContent className="h-[360px]">
                            {isLoading ? (
                                <div className="h-full flex items-center justify-center">
                                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : salesByRtv.length === 0 ? (
                                <EmptyState message="Nenhuma venda encontrada no período selecionado." />
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={salesByRtv} layout="vertical" margin={{ top: 5, right: 40, left: 10, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                        <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                                            tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                                        <YAxis dataKey="rtvName" type="category" width={110}
                                            tick={{ fontSize: 12, fill: "#475569" }} axisLine={false} tickLine={false} />
                                        <Tooltip
                                            formatter={(v: number) => [fmt(v), "Faturamento"]}
                                            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                                        />
                                        <Bar dataKey="totalAmountUsd" fill="#3b82f6" radius={[0, 6, 6, 0]} name="Faturamento" />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ── PRODUTOS ── */}
                <TabsContent value="produtos" className="pt-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <Card className="border border-slate-200 shadow-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base font-semibold text-slate-800">Curva ABC — Top 10 Produtos</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {isLoading ? (
                                    <div className="space-y-3">
                                        {[...Array(5)].map((_, i) => <div key={i} className="h-8 bg-slate-100 rounded animate-pulse" />)}
                                    </div>
                                ) : topProducts.length === 0 ? (
                                    <EmptyState message="Nenhum produto vendido no período." />
                                ) : (
                                    <div className="space-y-2">
                                        {topProducts.map((p: any, i: number) => (
                                            <div key={p.productId} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                                                <div className="flex items-center gap-3">
                                                    <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0
                                                        ${i < 3 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
                                                        {i + 1}
                                                    </span>
                                                    <span className="text-sm text-slate-700 font-medium truncate max-w-[180px]">{p.productName}</span>
                                                </div>
                                                <div className="text-right flex-shrink-0">
                                                    <div className="text-sm font-semibold text-slate-800">{fmt(Number(p.totalAmountUsd))}</div>
                                                    <div className="text-xs text-slate-400">{Number(p.totalQuantity).toFixed(2)} un.</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="border border-slate-200 shadow-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base font-semibold text-slate-800">Participação no Faturamento</CardTitle>
                            </CardHeader>
                            <CardContent className="h-[300px]">
                                {isLoading ? (
                                    <div className="h-full flex items-center justify-center">
                                        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                    </div>
                                ) : topProducts.length === 0 ? (
                                    <EmptyState message="Sem dados suficientes para o gráfico." />
                                ) : (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={topProducts.slice(0, 6)}
                                                cx="50%" cy="50%"
                                                innerRadius={60} outerRadius={100}
                                                paddingAngle={4}
                                                dataKey="totalAmountUsd"
                                                nameKey="productName"
                                                label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                                                labelLine={false}
                                            >
                                                {topProducts.slice(0, 6).map((_: any, i: number) => (
                                                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                formatter={(v: number, name: string) => [fmt(v), name]}
                                                contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e8f0" }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* ── CLIENTES ── */}
                <TabsContent value="clientes" className="pt-4">
                    <Card className="border border-slate-200 shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base font-semibold text-slate-800">Top 10 Clientes por Volume de Compras</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? (
                                <div className="space-y-3">
                                    {[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />)}
                                </div>
                            ) : topClients.length === 0 ? (
                                <EmptyState message="Nenhum cliente realizou compras no período." />
                            ) : (
                                <div className="rounded-lg border border-slate-100 overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                                            <tr>
                                                <th className="px-4 py-3 text-left font-semibold">#</th>
                                                <th className="px-4 py-3 text-left font-semibold">Cliente</th>
                                                <th className="px-4 py-3 text-right font-semibold">Pedidos</th>
                                                <th className="px-4 py-3 text-right font-semibold">Volume (USD)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {topClients.map((c: any, i: number) => (
                                                <tr key={c.clientId} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-4 py-3 text-slate-400 font-medium">#{i + 1}</td>
                                                    <td className="px-4 py-3 text-slate-800 font-medium">{c.clientName ?? "—"}</td>
                                                    <td className="px-4 py-3 text-right text-slate-600">{c.orderCount}</td>
                                                    <td className="px-4 py-3 text-right font-semibold text-emerald-600">{fmt(Number(c.totalAmountUsd))}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <style>{`@media print { .print\\:hidden { display: none !important; } }`}</style>
        </div>
        </EmpresaLayout>
    );
}
