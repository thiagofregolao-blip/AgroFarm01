import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import EmpresaLayout from "@/components/empresa/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Users, Warehouse, CreditCard, FileText, AlertCircle, CheckCircle2, Clock, Plus } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const statusLabel: Record<string, { label: string; color: string }> = {
    draft: { label: "Rascunho", color: "bg-slate-100 text-slate-700" },
    pending_director: { label: "Aguard. Diretor", color: "bg-yellow-100 text-yellow-800" },
    approved: { label: "Aprovado", color: "bg-blue-100 text-blue-800" },
    pending_billing: { label: "Aguard. Faturamento", color: "bg-purple-100 text-purple-800" },
    pending_finance: { label: "Aguard. Financeiro", color: "bg-orange-100 text-orange-800" },
    invoiced: { label: "Faturado", color: "bg-green-100 text-green-800" },
    partially_invoiced: { label: "Fat. Parcial", color: "bg-teal-100 text-teal-800" },
    cancelled: { label: "Cancelado", color: "bg-red-100 text-red-800" },
};

export default function EmpresaDashboard() {
    const [, setLocation] = useLocation();
    const { user } = useAuth();

    const { data: orders = [] } = useQuery<any[]>({
        queryKey: ["/api/company/orders"],
        queryFn: async () => {
            const r = await fetch("/api/company/orders", { credentials: "include" });
            return r.json();
        },
        enabled: !!user,
    });

    const { data: pagares = [] } = useQuery<any[]>({
        queryKey: ["/api/company/pagares"],
        queryFn: async () => {
            const r = await fetch("/api/company/pagares", { credentials: "include" });
            return r.json();
        },
        enabled: !!user,
    });

    const { data: invoices = [] } = useQuery<any[]>({
        queryKey: ["/api/company/invoices"],
        queryFn: async () => {
            const r = await fetch("/api/company/invoices", { credentials: "include" });
            return r.json();
        },
        enabled: !!user,
    });

    const openOrders = orders.filter((o: any) => !["invoiced", "cancelled"].includes(o.status));
    const pendingApproval = orders.filter((o: any) => o.status === "pending_director");
    const pendingBilling = orders.filter((o: any) => ["approved", "pending_billing"].includes(o.status));
    const pendingPagares = pagares.filter((p: any) => p.status === "pendente");
    const unmatchedInvoices = invoices.filter((i: any) => i.reconciliationStatus === "unmatched");

    const recentOrders = [...orders].slice(0, 8);

    return (
        <EmpresaLayout>
            <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-slate-800">Dashboard Comercial</h1>
                    <Button onClick={() => setLocation("/empresa/pedidos")} className="bg-blue-600 hover:bg-blue-700">
                        <Plus className="h-4 w-4 mr-2" /> Novo Pedido
                    </Button>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/empresa/pedidos")}>
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-slate-500 text-sm">Pedidos em Aberto</p>
                                    <p className="text-3xl font-bold text-slate-800">{openOrders.length}</p>
                                </div>
                                <ShoppingCart className="h-8 w-8 text-blue-500 opacity-70" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/empresa/pedidos")}>
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-slate-500 text-sm">Aguard. Aprovação</p>
                                    <p className="text-3xl font-bold text-yellow-600">{pendingApproval.length}</p>
                                </div>
                                <Clock className="h-8 w-8 text-yellow-500 opacity-70" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/empresa/faturas")}>
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-slate-500 text-sm">Fat. Não Reconciliadas</p>
                                    <p className="text-3xl font-bold text-orange-600">{unmatchedInvoices.length}</p>
                                </div>
                                <AlertCircle className="h-8 w-8 text-orange-500 opacity-70" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/empresa/pagares")}>
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-slate-500 text-sm">Pagarés Pendentes</p>
                                    <p className="text-3xl font-bold text-red-600">{pendingPagares.length}</p>
                                </div>
                                <CreditCard className="h-8 w-8 text-red-500 opacity-70" />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Pending billing alert */}
                {pendingBilling.length > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
                        <FileText className="h-5 w-5 text-blue-600 flex-shrink-0" />
                        <p className="text-blue-800 text-sm">
                            <strong>{pendingBilling.length} pedido{pendingBilling.length > 1 ? "s" : ""}</strong> aprovado{pendingBilling.length > 1 ? "s" : ""} aguardando faturamento.
                        </p>
                        <Button size="sm" variant="outline" className="ml-auto border-blue-300 text-blue-700" onClick={() => setLocation("/empresa/pedidos")}>
                            Ver pedidos
                        </Button>
                    </div>
                )}

                {/* Recent Orders */}
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base">Pedidos Recentes</CardTitle>
                            <Button variant="ghost" size="sm" onClick={() => setLocation("/empresa/pedidos")}>Ver todos</Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {recentOrders.length === 0 ? (
                            <p className="text-slate-400 text-sm text-center py-8">Nenhum pedido encontrado</p>
                        ) : (
                            <div className="divide-y">
                                {recentOrders.map((order: any) => {
                                    const st = statusLabel[order.status] ?? { label: order.status, color: "bg-slate-100 text-slate-700" };
                                    return (
                                        <div
                                            key={order.id}
                                            className="flex items-center justify-between px-6 py-3 hover:bg-slate-50 cursor-pointer"
                                            onClick={() => setLocation("/empresa/pedidos")}
                                        >
                                            <div>
                                                <p className="font-medium text-sm">{order.orderNumber}</p>
                                                <p className="text-slate-500 text-xs">{order.clientName}</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm font-medium">
                                                    {order.currency === "USD" ? "$" : "₲"}{" "}
                                                    {parseFloat(order.totalAmountUsd ?? 0).toLocaleString("es-PY", { minimumFractionDigits: 2 })}
                                                </span>
                                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.color}`}>
                                                    {st.label}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </EmpresaLayout>
    );
}
