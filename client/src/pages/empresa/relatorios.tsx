import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
    Tabs, TabsContent, TabsList, TabsTrigger 
} from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download, TrendingUp, Package, Users, DollarSign, Calendar } from "lucide-react";
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
    PieChart, Pie, Cell, Legend
} from "recharts";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

// Componente para evitar hidratação SSR / renderizar os charts com segurança
function ClientOnly({ children }: { children: React.ReactNode }) {
    const [mounted, setMounted] = useState(false);
    useState(() => { setMounted(true); });
    return mounted ? <>{children}</> : null;
}

export default function EmpresaRelatorios() {
    const [startDate, setStartDate] = useState(
        new Date(new Date().getFullYear(), new Date().getMonth() - 6, 1).toISOString().split('T')[0]
    );
    const [endDate, setEndDate] = useState(
        new Date().toISOString().split('T')[0]
    );
    const [rtvId, setRtvId] = useState<string>("all");

    // Buscar lista de RTVs para o filtro
    const { data: team = [] } = useQuery<any[]>({
        queryKey: ["/api/company/team"],
        queryFn: async () => {
            const r = await fetch("/api/company/team", { credentials: "include" });
            if (!r.ok) return [];
            return r.json();
        }
    });

    // Buscar dados do dashboard
    const { data: dashboardData, isLoading } = useQuery<any>({
        queryKey: ["/api/company/admin-reports/dashboard", startDate, endDate, rtvId],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (startDate) params.append("startDate", startDate);
            if (endDate) params.append("endDate", endDate);
            if (rtvId && rtvId !== "all") params.append("rtvId", rtvId);
            
            const r = await fetch(`/api/company/admin-reports/dashboard?${params.toString()}`, { 
                credentials: "include" 
            });
            if (!r.ok) throw new Error("Falha ao carregar relatórios");
            return r.json();
        }
    });

    const kpis = dashboardData?.kpis || { totalRevenue: 0, totalOrders: 0, averageTicket: 0 };
    const salesByRtv = dashboardData?.salesByRtv || [];
    const topProducts = dashboardData?.topProducts || [];
    const topClients = dashboardData?.topClients || [];

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Relatórios Gerenciais</h1>
                    <p className="text-slate-500">Visão analítica de vendas, produtos e clientes</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={handlePrint} variant="outline" className="gap-2 printable-hide">
                        <Download className="h-4 w-4" /> Exportar / Imprimir
                    </Button>
                </div>
            </div>

            {/* Painel de Filtros */}
            <Card className="printable-hide bg-slate-50 border-slate-200">
                <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-end">
                    <div className="space-y-2 flex-1">
                        <label className="text-sm font-medium text-slate-700">Data Inicial</label>
                        <Input 
                            type="date" 
                            value={startDate} 
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2 flex-1">
                        <label className="text-sm font-medium text-slate-700">Data Final</label>
                        <Input 
                            type="date" 
                            value={endDate} 
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2 flex-1">
                        <label className="text-sm font-medium text-slate-700">Consultor / RTV</label>
                        <Select value={rtvId} onValueChange={setRtvId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Todos os RTVs" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos os RTVs</SelectItem>
                                {team.filter(u => u.role === "rtv" || u.role === "consultor").map(t => (
                                    <SelectItem key={t.userId} value={t.userId}>{t.userName}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Receita Total</CardTitle>
                        <DollarSign className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(kpis.totalRevenue)}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Pedidos Faturados/Aprovados</CardTitle>
                        <Package className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{kpis.totalOrders}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Ticket Médio</CardTitle>
                        <TrendingUp className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(kpis.averageTicket)}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Abas */}
            <Tabs defaultValue="vendas" className="w-full">
                <TabsList className="grid w-full grid-cols-3 printable-hide">
                    <TabsTrigger value="vendas"><DollarSign className="w-4 h-4 mr-2"/> Vendas</TabsTrigger>
                    <TabsTrigger value="produtos"><Package className="w-4 h-4 mr-2"/> Produtos</TabsTrigger>
                    <TabsTrigger value="clientes"><Users className="w-4 h-4 mr-2"/> Clientes</TabsTrigger>
                </TabsList>
                
                {isLoading ? (
                    <div className="py-12 flex justify-center"><div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent" /></div>
                ) : (
                    <>
                        <TabsContent value="vendas" className="space-y-6 pt-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Ranking de Vendas por RTV</CardTitle>
                                </CardHeader>
                                <CardContent className="h-[400px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={salesByRtv} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                            <XAxis type="number" tickFormatter={(value) => `$${(value/1000).toFixed(0)}k`} />
                                            <YAxis dataKey="rtvName" type="category" width={100} />
                                            <Tooltip 
                                                formatter={(value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)}
                                                labelStyle={{ color: '#333' }}
                                            />
                                            <Bar dataKey="totalAmountUsd" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Faturamento (USD)" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="produtos" className="space-y-6 pt-4">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Curva ABC - Top 10 Produtos (Receita)</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            {topProducts.map((produto: any, index: number) => (
                                                <div key={produto.productId} className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                                                    <div className="flex items-center gap-3">
                                                        <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${index < 3 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                                                            {index + 1}
                                                        </span>
                                                        <span className="font-medium text-sm text-slate-700 truncate max-w-[200px]">{produto.productName}</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="font-semibold text-slate-900">
                                                            {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(produto.totalAmountUsd)}
                                                        </div>
                                                        <div className="text-xs text-slate-500">{Number(produto.totalQuantity).toFixed(2)} un. vendidas</div>
                                                    </div>
                                                </div>
                                            ))}
                                            {topProducts.length === 0 && <p className="text-center text-slate-500 py-4">Nenhum dado encontrado no período.</p>}
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Participação no Faturamento</CardTitle>
                                    </CardHeader>
                                    <CardContent className="h-[300px]">
                                        {topProducts.length > 0 ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={topProducts.slice(0, 5)} // Pega só os top 5 pro gráfico n ficar poluído
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={60}
                                                        outerRadius={100}
                                                        fill="#8884d8"
                                                        paddingAngle={5}
                                                        dataKey="totalAmountUsd"
                                                        nameKey="productName"
                                                        label={({ name, percent }) => `${name.substring(0, 10)}... (${(percent * 100).toFixed(0)}%)`}
                                                    >
                                                        {topProducts.slice(0, 5).map((entry: any, index: number) => (
                                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip formatter={(value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <div className="h-full flex items-center justify-center text-slate-500">Sem dados suficientes</div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>

                        <TabsContent value="clientes" className="space-y-6 pt-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Top 10 Clientes (Maior Volume de Compras)</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="rounded-md border">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-slate-50 border-b">
                                                <tr>
                                                    <th className="px-4 py-3 font-medium text-slate-500">Posição</th>
                                                    <th className="px-4 py-3 font-medium text-slate-500">Cliente</th>
                                                    <th className="px-4 py-3 font-medium text-slate-500 text-right">Qtd. Pedidos</th>
                                                    <th className="px-4 py-3 font-medium text-slate-500 text-right">Volume Total (USD)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {topClients.map((client: any, index: number) => (
                                                    <tr key={client.clientId} className="border-b last:border-0 hover:bg-slate-50">
                                                        <td className="px-4 py-3 font-medium">#{index + 1}</td>
                                                        <td className="px-4 py-3">{client.clientName}</td>
                                                        <td className="px-4 py-3 text-right">{client.orderCount}</td>
                                                        <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                                                            {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(client.totalAmountUsd)}
                                                        </td>
                                                    </tr>
                                                ))}
                                                {topClients.length === 0 && (
                                                    <tr>
                                                        <td colSpan={4} className="text-center py-8 text-slate-500">Nenhum cliente comprou nesse período.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </>
                )}
            </Tabs>
            
            <style>{`
                @media print {
                    .printable-hide { display: none !important; }
                    body { background: white; }
                }
            `}</style>
        </div>
    );
}
