import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import FarmLayout from "@/components/fazenda/layout";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Warehouse, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function FarmStock() {
    const [, setLocation] = useLocation();
    const [search, setSearch] = useState("");

    const { user } = useAuth();

    const { data: stock = [], isLoading } = useQuery({
        queryKey: ["/api/farm/stock"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/stock"); return r.json(); },
        enabled: !!user,
    });

    const { data: movements = [] } = useQuery({
        queryKey: ["/api/farm/stock/movements"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/stock/movements?limit=100"); return r.json(); },
        enabled: !!user,
    });

    const filtered = stock.filter((s: any) =>
        s.productName.toLowerCase().includes(search.toLowerCase()) ||
        (s.productCategory || "").toLowerCase().includes(search.toLowerCase())
    );

    const totalValue = stock.reduce((s: number, i: any) =>
        s + (parseFloat(i.quantity) * parseFloat(i.averageCost)), 0
    );

    return (
        <FarmLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-emerald-800">Depósito / Estoque</h1>
                    <p className="text-emerald-600 text-sm">
                        {stock.length} itens — Valor total: <strong>${totalValue.toLocaleString("en", { minimumFractionDigits: 2 })}</strong>
                    </p>
                </div>

                <Tabs defaultValue="stock">
                    <TabsList>
                        <TabsTrigger value="stock">Estoque Atual</TabsTrigger>
                        <TabsTrigger value="movements">Movimentações</TabsTrigger>
                    </TabsList>

                    <TabsContent value="stock" className="mt-4">
                        <div className="relative mb-4">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input className="pl-10" placeholder="Buscar produto..." value={search} onChange={e => setSearch(e.target.value)} />
                        </div>

                        {isLoading ? (
                            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
                        ) : filtered.length === 0 ? (
                            <Card className="border-emerald-100"><CardContent className="py-12 text-center">
                                <Warehouse className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                                <p className="text-gray-500">Estoque vazio</p>
                            </CardContent></Card>
                        ) : (
                            <div className="bg-white rounded-xl border border-emerald-100 overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-emerald-50">
                                        <tr>
                                            <th className="text-left p-3 font-semibold text-emerald-800">Produto</th>
                                            <th className="text-left p-3 font-semibold text-emerald-800">Categoria</th>
                                            <th className="text-right p-3 font-semibold text-emerald-800">Quantidade</th>
                                            <th className="text-right p-3 font-semibold text-emerald-800">Custo Médio</th>
                                            <th className="text-right p-3 font-semibold text-emerald-800">Valor Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map((s: any) => {
                                            const qty = parseFloat(s.quantity);
                                            const cost = parseFloat(s.averageCost);
                                            return (
                                                <tr key={s.id} className="border-t border-gray-100 hover:bg-emerald-50/30">
                                                    <td className="p-3 font-medium">{s.productName}</td>
                                                    <td className="p-3">
                                                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                                                            {s.productCategory || "—"}
                                                        </span>
                                                    </td>
                                                    <td className="text-right p-3 font-mono">
                                                        <span className={qty <= 0 ? "text-red-600 font-bold" : ""}>
                                                            {qty.toFixed(2)} {s.productUnit}
                                                        </span>
                                                    </td>
                                                    <td className="text-right p-3 font-mono">${cost.toFixed(2)}</td>
                                                    <td className="text-right p-3 font-mono font-semibold">${(qty * cost).toFixed(2)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="movements" className="mt-4">
                        {movements.length === 0 ? (
                            <Card className="border-emerald-100"><CardContent className="py-12 text-center">
                                <p className="text-gray-500">Nenhuma movimentação registrada</p>
                            </CardContent></Card>
                        ) : (
                            <div className="space-y-2">
                                {movements.map((m: any) => (
                                    <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg bg-white border border-gray-100">
                                        {m.type === "entry" ? (
                                            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                                                <ArrowUpRight className="h-4 w-4 text-green-600" />
                                            </div>
                                        ) : (
                                            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                                                <ArrowDownRight className="h-4 w-4 text-red-600" />
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-sm">{m.productName}</p>
                                            <p className="text-xs text-gray-500">{m.notes} • {m.referenceType}</p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className={`font-semibold text-sm font-mono ${m.type === "entry" ? "text-green-600" : "text-red-600"}`}>
                                                {m.type === "entry" ? "+" : ""}{parseFloat(m.quantity).toFixed(2)}
                                            </p>
                                            <p className="text-xs text-gray-400">{new Date(m.createdAt).toLocaleDateString("pt-BR")}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </div>
        </FarmLayout>
    );
}
