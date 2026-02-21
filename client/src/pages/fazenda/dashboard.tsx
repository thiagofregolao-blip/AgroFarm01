import { useState, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import FarmLayout from "@/components/fazenda/layout";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Warehouse, Map, Package, FileText, ArrowUpRight, ArrowDownRight,
    Loader2, Building2, ChevronDown, ChevronUp, Calendar, RefreshCw
} from "lucide-react";

export default function FarmDashboard() {
    const [, setLocation] = useLocation();
    const { user, isLoading } = useAuth();
    const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null);
    const queryClient = useQueryClient();

    // Pull-to-refresh state
    const [refreshing, setRefreshing] = useState(false);
    const [pullDistance, setPullDistance] = useState(0);
    const touchStartY = useRef(0);
    const isPulling = useRef(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const PULL_THRESHOLD = 80;

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        setPullDistance(0);
        await queryClient.invalidateQueries({ queryKey: ["/api/farm/stock"] });
        await queryClient.invalidateQueries({ queryKey: ["/api/farm/properties"] });
        await queryClient.invalidateQueries({ queryKey: ["/api/farm/stock/movements"] });
        await queryClient.invalidateQueries({ queryKey: ["/api/farm/invoices"] });
        await queryClient.invalidateQueries({ queryKey: ["/api/farm/invoices/summary/by-supplier"] });
        // Small delay for visual feedback
        await new Promise(r => setTimeout(r, 600));
        setRefreshing(false);
    }, [queryClient]);

    const onTouchStart = useCallback((e: React.TouchEvent) => {
        const scrollTop = containerRef.current?.closest('main')?.scrollTop || 0;
        if (scrollTop <= 5) {
            touchStartY.current = e.touches[0].clientY;
            isPulling.current = true;
        }
    }, []);

    const onTouchMove = useCallback((e: React.TouchEvent) => {
        if (!isPulling.current || refreshing) return;
        const distance = e.touches[0].clientY - touchStartY.current;
        if (distance > 0) {
            setPullDistance(Math.min(distance * 0.5, PULL_THRESHOLD + 20));
        }
    }, [refreshing]);

    const onTouchEnd = useCallback(() => {
        if (!isPulling.current) return;
        isPulling.current = false;
        if (pullDistance >= PULL_THRESHOLD && !refreshing) {
            handleRefresh();
        } else {
            setPullDistance(0);
        }
    }, [pullDistance, refreshing, handleRefresh]);

    const { data: stock = [] } = useQuery({
        queryKey: ["/api/farm/stock"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/farm/stock");
            return res.json();
        },
        enabled: !!user,
    });

    const { data: properties = [] } = useQuery({
        queryKey: ["/api/farm/properties"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/farm/properties");
            return res.json();
        },
        enabled: !!user,
    });

    const { data: movements = [] } = useQuery({
        queryKey: ["/api/farm/stock/movements"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/farm/stock/movements?limit=10");
            return res.json();
        },
        enabled: !!user,
    });

    const { data: invoices = [] } = useQuery({
        queryKey: ["/api/farm/invoices"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/farm/invoices");
            return res.json();
        },
        enabled: !!user,
    });

    const { data: supplierSummary = [] } = useQuery<any[]>({
        queryKey: ["/api/farm/invoices/summary/by-supplier"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/farm/invoices/summary/by-supplier");
            return res.json();
        },
        enabled: !!user,
    });

    if (isLoading) {
        return (
            <FarmLayout>
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                </div>
            </FarmLayout>
        );
    }

    const totalStockValue = stock.reduce((sum: number, s: any) =>
        sum + (parseFloat(s.quantity) * parseFloat(s.averageCost)), 0
    );

    const pendingInvoices = invoices.filter((i: any) => i.status === "pending").length;

    function formatDate(d: string | null) {
        if (!d) return "—";
        try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return "—"; }
    }

    function formatCurrency(val: number | string, currency?: string) {
        const num = typeof val === "string" ? parseFloat(val) : val;
        const symbol = currency === "PYG" ? "₲" : "$";
        return `${symbol}${num.toLocaleString("en", { minimumFractionDigits: 2 })}`;
    }

    return (
        <FarmLayout>
            <div
                ref={containerRef}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                className="space-y-6"
            >
                {/* Pull-to-refresh indicator */}
                {(pullDistance > 0 || refreshing) && (
                    <div
                        className="flex items-center justify-center transition-all duration-200 overflow-hidden"
                        style={{ height: refreshing ? 48 : pullDistance }}
                    >
                        <div className={`flex items-center gap-2 text-emerald-600 ${refreshing ? "animate-pulse" : ""}`}>
                            <RefreshCw
                                className={`h-5 w-5 transition-transform duration-300 ${refreshing ? "animate-spin" : ""}`}
                                style={{ transform: refreshing ? undefined : `rotate(${(pullDistance / PULL_THRESHOLD) * 360}deg)` }}
                            />
                            <span className="text-sm font-medium">
                                {refreshing ? "Atualizando..." : pullDistance >= PULL_THRESHOLD ? "Solte para atualizar" : "Puxe para atualizar"}
                            </span>
                        </div>
                    </div>
                )}

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-emerald-800">Olá, {user?.name} 👋</h1>
                        <p className="text-emerald-600 mt-1">Bem-vindo ao painel de gestão da sua fazenda</p>
                    </div>
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors text-sm font-medium disabled:opacity-50"
                        title="Atualizar dados"
                    >
                        <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                        Atualizar
                    </button>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card
                        className="cursor-pointer hover:shadow-lg transition-shadow border-emerald-100"
                        onClick={() => setLocation("/fazenda/estoque")}
                    >
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-500">Itens em Estoque</p>
                                    <p className="text-2xl font-bold text-emerald-800">{stock.length}</p>
                                </div>
                                <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                                    <Warehouse className="h-6 w-6 text-emerald-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card
                        className="cursor-pointer hover:shadow-lg transition-shadow border-emerald-100"
                        onClick={() => setLocation("/fazenda/propriedades")}
                    >
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-500">Propriedades</p>
                                    <p className="text-2xl font-bold text-emerald-800">{properties.length}</p>
                                </div>
                                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                                    <Map className="h-6 w-6 text-blue-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-emerald-100">
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-500">Valor em Estoque</p>
                                    <p className="text-2xl font-bold text-emerald-800">
                                        ${totalStockValue.toLocaleString("en", { minimumFractionDigits: 2 })}
                                    </p>
                                </div>
                                <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                                    <Package className="h-6 w-6 text-amber-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card
                        className="cursor-pointer hover:shadow-lg transition-shadow border-emerald-100"
                        onClick={() => setLocation("/fazenda/faturas")}
                    >
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-500">Faturas Pendentes</p>
                                    <p className="text-2xl font-bold text-orange-600">{pendingInvoices}</p>
                                </div>
                                <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
                                    <FileText className="h-6 w-6 text-orange-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Supplier Summary Cards */}
                {supplierSummary.length > 0 && (
                    <div>
                        <h2 className="text-lg font-bold text-emerald-800 mb-4 flex items-center gap-2">
                            <Building2 className="h-5 w-5" />
                            Contas por Fornecedor
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {supplierSummary.map((s: any) => {
                                const isExpanded = expandedSupplier === s.supplier;
                                return (
                                    <Card key={s.supplier} className="border-gray-200 hover:shadow-md transition-shadow overflow-hidden">
                                        {/* Card Header */}
                                        <div
                                            className="p-5 cursor-pointer"
                                            onClick={() => setExpandedSupplier(isExpanded ? null : s.supplier)}
                                        >
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                                                        <Building2 className="h-5 w-5 text-indigo-600" />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold text-gray-800 text-sm">{s.supplier}</h3>
                                                        <p className="text-xs text-gray-400">{s.invoiceCount} fatura{s.invoiceCount > 1 ? "s" : ""}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-lg font-bold text-emerald-700">
                                                        {formatCurrency(s.totalAmount, s.invoices[0]?.currency)}
                                                    </p>
                                                    {isExpanded ? (
                                                        <ChevronUp className="h-4 w-4 text-gray-400 ml-auto" />
                                                    ) : (
                                                        <ChevronDown className="h-4 w-4 text-gray-400 ml-auto" />
                                                    )}
                                                </div>
                                            </div>

                                            {/* Quick product list (always visible) */}
                                            <div className="flex flex-wrap gap-1.5">
                                                {(() => {
                                                    const allProducts = s.invoices.flatMap((inv: any) =>
                                                        inv.items.map((it: any) => it.productName)
                                                    );
                                                    const unique = [...new Set(allProducts)] as string[];
                                                    const show = unique.slice(0, 4);
                                                    const rest = unique.length - show.length;
                                                    return (
                                                        <>
                                                            {show.map((name: string) => (
                                                                <span key={name} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full truncate max-w-[160px]">
                                                                    {name}
                                                                </span>
                                                            ))}
                                                            {rest > 0 && (
                                                                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                                                                    +{rest}
                                                                </span>
                                                            )}
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        </div>

                                        {/* Expanded detail */}
                                        {isExpanded && (
                                            <div className="border-t border-gray-100 bg-gray-50/50 p-4 space-y-3">
                                                {s.invoices.map((inv: any) => (
                                                    <div key={inv.id} className="bg-white rounded-lg p-3 border border-gray-100">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div className="flex items-center gap-2">
                                                                <FileText className="h-3.5 w-3.5 text-gray-400" />
                                                                <span className="text-xs font-medium text-gray-700">
                                                                    #{inv.invoiceNumber || "—"}
                                                                </span>
                                                                <span className={`text-xs px-1.5 py-0.5 rounded ${inv.status === "confirmed"
                                                                    ? "bg-green-100 text-green-700"
                                                                    : "bg-yellow-100 text-yellow-700"
                                                                    }`}>
                                                                    {inv.status === "confirmed" ? "Confirmada" : "Pendente"}
                                                                </span>
                                                            </div>
                                                            <span className="text-sm font-semibold text-gray-700">
                                                                {formatCurrency(inv.totalAmount, inv.currency)}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2">
                                                            <Calendar className="h-3 w-3" />
                                                            {formatDate(inv.issueDate)}
                                                        </div>
                                                        <div className="space-y-1">
                                                            {inv.items.map((it: any, idx: number) => (
                                                                <div key={idx} className="flex items-center justify-between text-xs">
                                                                    <span className="text-gray-600 truncate mr-2">{it.productName}</span>
                                                                    <span className="text-gray-500 whitespace-nowrap">
                                                                        {parseFloat(it.quantity).toFixed(0)} {it.unit} — {formatCurrency(it.totalPrice, inv.currency)}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </Card>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Recent Movements */}
                <Card className="border-emerald-100">
                    <CardHeader>
                        <CardTitle className="text-emerald-800">Últimas Movimentações</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {movements.length === 0 ? (
                            <p className="text-gray-500 text-sm py-4 text-center">Nenhuma movimentação registrada</p>
                        ) : (
                            <div className="space-y-3">
                                {movements.map((m: any) => (
                                    <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                                        {m.type === "entry" ? (
                                            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                                                <ArrowUpRight className="h-4 w-4 text-green-600" />
                                            </div>
                                        ) : (
                                            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                                                <ArrowDownRight className="h-4 w-4 text-red-600" />
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-sm truncate">{m.productName}</p>
                                            <p className="text-xs text-gray-500">{m.notes}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className={`font-semibold text-sm ${m.type === "entry" ? "text-green-600" : "text-red-600"}`}>
                                                {m.type === "entry" ? "+" : ""}{parseFloat(m.quantity).toFixed(2)}
                                            </p>
                                            <p className="text-xs text-gray-400">
                                                {new Date(m.createdAt).toLocaleDateString("pt-BR")}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </FarmLayout>
    );
}
