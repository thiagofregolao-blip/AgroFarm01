import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import FarmLayout from "@/components/fazenda/layout";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Warehouse, Map, Package, FileText, ArrowUpRight, ArrowDownRight, Loader2 } from "lucide-react";

export default function FarmDashboard() {
    const [, setLocation] = useLocation();
    const { user, isLoading } = useAuth();

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

    return (
        <FarmLayout>
            <div className="space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-3xl font-bold text-emerald-800">Olá, {user?.name} 👋</h1>
                    <p className="text-emerald-600 mt-1">Bem-vindo ao painel de gestão da sua fazenda</p>
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
