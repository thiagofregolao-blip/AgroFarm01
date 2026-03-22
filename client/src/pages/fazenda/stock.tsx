import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import FarmLayout from "@/components/fazenda/layout";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Search, Warehouse, ArrowUpRight, ArrowDownRight, Plus, Camera, Package, Trash2, Pencil, RefreshCw, FileText, Building2, ArrowLeftRight, Upload, Fuel } from "lucide-react";
import { useState, useRef } from "react";
import { formatCurrency } from "@/lib/format-currency";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export default function FarmStock() {
    const [, setLocation] = useLocation();
    const queryClient = useQueryClient();
    const [search, setSearch] = useState("");
    const { toast } = useToast();

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

    const { data: properties = [] } = useQuery({
        queryKey: ["/api/farm/properties"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/properties"); return r.json(); },
        enabled: !!user,
    });

    const { data: depositsMain = [] } = useQuery({
        queryKey: ["/api/farm/deposits"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/deposits"); return r.json(); },
        enabled: !!user,
    });

    // Extrato filters
    const [extratoProduct, setExtratoProduct] = useState("");
    const [extratoType, setExtratoType] = useState("");
    const [extratoStartDate, setExtratoStartDate] = useState("");
    const [extratoEndDate, setExtratoEndDate] = useState("");

    const extratoQueryUrl = (() => {
        const params = new URLSearchParams();
        params.set("limit", "500");
        if (extratoProduct) params.set("productName", extratoProduct);
        if (extratoType) params.set("type", extratoType);
        if (extratoStartDate) params.set("startDate", extratoStartDate);
        if (extratoEndDate) params.set("endDate", extratoEndDate);
        return `/api/farm/stock/movements?${params.toString()}`;
    })();

    const { data: extratoMovements = [], isLoading: extratoLoading } = useQuery({
        queryKey: ["/api/farm/stock/movements/extrato", extratoProduct, extratoType, extratoStartDate, extratoEndDate],
        queryFn: async () => { const r = await apiRequest("GET", extratoQueryUrl); return r.json(); },
        enabled: !!user,
    });

    const productNames: string[] = Array.from(new Set(stock.map((s: any) => s.productName).filter(Boolean))) as string[];

    const deleteStock = useMutation({
        mutationFn: async (id: string) => {
            await apiRequest("DELETE", `/api/farm/stock/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/stock"] });
            toast({ title: "Produto excluído", description: "O item foi removido do estoque." });
        },
        onError: (err: any) => {
            toast({ title: "Erro", description: err.message, variant: "destructive" });
        }
    });

    const deleteDepositMutation = useMutation({
        mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/farm/deposits/${id}`); },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/deposits"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/stock"] });
            toast({ title: "Deposito removido" });
        },
        onError: (err: any) => { toast({ title: "Erro", description: err.message, variant: "destructive" }); },
    });

    // Transfer state
    const [transferProductId, setTransferProductId] = useState("");
    const [transferFromWarehouse, setTransferFromWarehouse] = useState("");
    const [transferToWarehouse, setTransferToWarehouse] = useState("");
    const [transferQty, setTransferQty] = useState("");
    const [transferNotes, setTransferNotes] = useState("");

    const transferMutation = useMutation({
        mutationFn: async () => {
            const res = await apiRequest("POST", "/api/farm/stock/transfer", {
                productId: transferProductId,
                fromWarehouseId: transferFromWarehouse || null,
                toWarehouseId: transferToWarehouse || null,
                quantity: transferQty,
                notes: transferNotes,
            });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/stock"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/stock/movements"] });
            toast({ title: "Transferencia realizada", description: "Estoque movimentado com sucesso." });
            setTransferProductId("");
            setTransferFromWarehouse("");
            setTransferToWarehouse("");
            setTransferQty("");
            setTransferNotes("");
        },
        onError: (err: any) => {
            toast({ title: "Erro na transferencia", description: err.message, variant: "destructive" });
        },
    });

    const handleTransfer = () => {
        if (!transferProductId) {
            toast({ title: "Selecione um produto", variant: "destructive" }); return;
        }
        const qty = parseFloat(transferQty);
        if (!qty || qty <= 0) {
            toast({ title: "Quantidade deve ser maior que zero", variant: "destructive" }); return;
        }
        if (transferFromWarehouse && transferFromWarehouse === transferToWarehouse) {
            toast({ title: "Deposito origem e destino devem ser diferentes", variant: "destructive" }); return;
        }
        // Check available stock for selected product in source warehouse
        const sourceItem = stock.find((s: any) =>
            s.productId === transferProductId &&
            (transferFromWarehouse ? String(s.propertyId) === transferFromWarehouse : !s.propertyId)
        );
        if (sourceItem && qty > parseFloat(sourceItem.quantity)) {
            toast({ title: "Quantidade excede estoque disponivel", description: `Disponivel: ${parseFloat(sourceItem.quantity).toFixed(2)}`, variant: "destructive" }); return;
        }
        transferMutation.mutate();
    };

    // Filter transfer movements
    const transferMovements = movements.filter((m: any) =>
        m.referenceType === "transfer" || (m.notes && m.notes.toLowerCase().includes("transferencia"))
    );

    const handleDelete = (id: string, name: string) => {
        if (confirm(`Tem certeza que deseja excluir '${name}' do estoque?`)) {
            deleteStock.mutate(id);
        }
    };

    const filtered = stock.filter((s: any) =>
        s.productName.toLowerCase().includes(search.toLowerCase()) ||
        (s.productCategory || "").toLowerCase().includes(search.toLowerCase())
    );

    // Group stock by deposit/property for warehouse view
    const stockByProperty: Record<string, any[]> = {};
    filtered.forEach((s: any) => {
        const prop = s.depositName || s.propertyName || "Sem deposito";
        if (!stockByProperty[prop]) stockByProperty[prop] = [];
        stockByProperty[prop].push(s);
    });

    const totalValue = stock.reduce((s: number, i: any) =>
        s + (parseFloat(i.quantity) * parseFloat(i.averageCost)), 0
    );

    return (
        <FarmLayout>
            <div className="space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-emerald-800">Depósito / Estoque</h1>
                        <p className="text-emerald-600 text-sm">
                            {stock.length} itens — Valor total: <strong>{formatCurrency(totalValue)}</strong>
                        </p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        <NewDepositDialog onSuccess={() => queryClient.invalidateQueries({ queryKey: ["/api/farm/deposits"] })} />
                        <DieselEntryDialog onSuccess={() => { queryClient.invalidateQueries({ queryKey: ["/api/farm/stock"] }); queryClient.invalidateQueries({ queryKey: ["/api/farm/stock/movements"] }); }} />
                        <ManualStockEntryDialog onSuccess={() => queryClient.invalidateQueries({ queryKey: ["/api/farm/stock"] })} />
                    </div>
                </div>

                <Tabs defaultValue="stock">
                    <TabsList>
                        <TabsTrigger value="stock">Estoque Atual</TabsTrigger>
                        <TabsTrigger value="deposits"><Building2 className="h-4 w-4 mr-1" />Depósitos</TabsTrigger>
                        <TabsTrigger value="movements">Movimentações</TabsTrigger>
                        <TabsTrigger value="extrato"><FileText className="h-4 w-4 mr-1" />Extrato</TabsTrigger>
                        <TabsTrigger value="transferencias"><ArrowLeftRight className="h-4 w-4 mr-1" />Transferencias</TabsTrigger>
                        <TabsTrigger value="diesel"><Fuel className="h-4 w-4 mr-1" />Diesel</TabsTrigger>
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
                                            <th className="text-left p-3 font-semibold text-emerald-800">Lote</th>
                                            <th className="text-left p-3 font-semibold text-emerald-800">Validade</th>
                                            <th className="text-right p-3 font-semibold text-emerald-800">Quantidade</th>
                                            <th className="text-right p-3 font-semibold text-emerald-800">Custo Médio</th>
                                            <th className="text-right p-3 font-semibold text-emerald-800">Valor Total</th>
                                            <th className="text-right p-3 font-semibold text-emerald-800">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map((s: any) => {
                                            const qty = parseFloat(s.quantity);
                                            const cost = parseFloat(s.averageCost);
                                            return (
                                                <tr key={s.id} className="border-t border-gray-100 hover:bg-emerald-50/30">
                                                    <td className="p-3">
                                                        <span className="font-medium">{s.productName}</span>
                                                        {s.activeIngredient && (
                                                            <p className="text-xs text-gray-500 mt-0.5">{s.activeIngredient}</p>
                                                        )}
                                                    </td>
                                                    <td className="p-3">
                                                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                                                            {s.productCategory || "—"}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-sm text-gray-600">{s.lote || "—"}</td>
                                                    <td className="p-3 text-sm text-gray-600">
                                                        {s.expiryDate ? new Date(s.expiryDate).toLocaleDateString("pt-BR") : "—"}
                                                    </td>
                                                    <td className="text-right p-3 font-mono">
                                                        <span className={qty <= 0 ? "text-red-600 font-bold" : ""}>
                                                            {qty.toFixed(2)} {s.productUnit}
                                                        </span>
                                                    </td>
                                                    <td className="text-right p-3 font-mono">{formatCurrency(cost)}</td>
                                                    <td className="text-right p-3 font-mono font-semibold">{formatCurrency(qty * cost)}</td>
                                                    <td className="text-right p-3">
                                                        <div className="flex justify-end gap-2">
                                                            <EditStockDialog stockItem={s} onSuccess={() => queryClient.invalidateQueries({ queryKey: ["/api/farm/stock"] })} />
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(s.id, s.productName)} disabled={deleteStock.isPending}>
                                                                {deleteStock.isPending && deleteStock.variables === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </TabsContent>

                    {/* Deposits tab - horizontal tabs per deposit */}
                    <TabsContent value="deposits" className="mt-4">
                        <DepositTabsView
                            depositsMain={depositsMain as any[]}
                            properties={properties as any[]}
                            stockByProperty={stockByProperty}
                            onDeleteDeposit={(depId: string, depName: string, hasItems: boolean) => {
                                if (hasItems) {
                                    if (!confirm(`O deposito "${depName}" tem produtos vinculados. Os produtos ficarao "Sem deposito". Tem certeza que deseja remover?`)) return;
                                } else {
                                    if (!confirm(`Tem certeza que deseja remover o deposito "${depName}"?`)) return;
                                }
                                deleteDepositMutation.mutate(depId);
                            }}
                            deletingDeposit={deleteDepositMutation.isPending}
                        />
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

                    {/* Extrato de Estoque tab */}
                    <TabsContent value="extrato" className="mt-4 space-y-4">
                        {/* Extrato filters */}
                        <Card className="border-emerald-100">
                            <CardContent className="py-3 px-4">
                                <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-end gap-2 sm:gap-3">
                                    <div className="w-full sm:min-w-[180px] sm:w-auto">
                                        <Label className="text-xs text-gray-500">Produto</Label>
                                        <Select value={extratoProduct} onValueChange={setExtratoProduct}>
                                            <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                                            <SelectContent>
                                                {productNames.map((p: string) => (
                                                    <SelectItem key={p} value={p}>{p}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="w-full sm:min-w-[130px] sm:w-auto">
                                        <Label className="text-xs text-gray-500">Tipo</Label>
                                        <Select value={extratoType} onValueChange={setExtratoType}>
                                            <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="entry">Entrada</SelectItem>
                                                <SelectItem value="exit">Saida</SelectItem>
                                                <SelectItem value="adjustment">Ajuste</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="w-full sm:min-w-[130px] sm:w-auto">
                                        <Label className="text-xs text-gray-500">Data Inicio</Label>
                                        <Input type="date" value={extratoStartDate} onChange={e => setExtratoStartDate(e.target.value)} className="h-9" />
                                    </div>
                                    <div className="w-full sm:min-w-[130px] sm:w-auto">
                                        <Label className="text-xs text-gray-500">Data Fim</Label>
                                        <Input type="date" value={extratoEndDate} onChange={e => setExtratoEndDate(e.target.value)} className="h-9" />
                                    </div>
                                    {(extratoProduct || extratoType || extratoStartDate || extratoEndDate) && (
                                        <Button variant="ghost" size="sm" className="h-9 text-red-500 hover:text-red-700" onClick={() => { setExtratoProduct(""); setExtratoType(""); setExtratoStartDate(""); setExtratoEndDate(""); }}>
                                            Limpar
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {extratoLoading ? (
                            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
                        ) : extratoMovements.length === 0 ? (
                            <Card className="border-emerald-100"><CardContent className="py-12 text-center">
                                <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                                <p className="text-gray-500">Nenhuma movimentação encontrada</p>
                            </CardContent></Card>
                        ) : (
                            <div className="bg-white rounded-xl border border-emerald-100 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-emerald-50">
                                            <tr>
                                                <th className="text-left p-3 font-semibold text-emerald-800 text-xs">Data</th>
                                                <th className="text-left p-3 font-semibold text-emerald-800 text-xs">Produto</th>
                                                <th className="text-left p-3 font-semibold text-emerald-800 text-xs">Tipo</th>
                                                <th className="text-right p-3 font-semibold text-emerald-800 text-xs">Quantidade</th>
                                                <th className="text-right p-3 font-semibold text-emerald-800 text-xs">Custo Unit.</th>
                                                <th className="text-left p-3 font-semibold text-emerald-800 text-xs">Referencia</th>
                                                <th className="text-left p-3 font-semibold text-emerald-800 text-xs">Notas</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {extratoMovements.map((m: any) => (
                                                <tr key={m.id} className="border-t border-gray-100 hover:bg-emerald-50/30">
                                                    <td className="p-3 whitespace-nowrap text-sm">{new Date(m.createdAt).toLocaleDateString("pt-BR")}</td>
                                                    <td className="p-3 font-medium">{m.productName}</td>
                                                    <td className="p-3">
                                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${m.type === "entry" ? "bg-green-50 text-green-700" : m.type === "exit" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
                                                            {m.type === "entry" ? "Entrada" : m.type === "exit" ? "Saida" : "Ajuste"}
                                                        </span>
                                                    </td>
                                                    <td className="text-right p-3 font-mono">
                                                        <span className={m.type === "entry" ? "text-green-600" : m.type === "exit" ? "text-red-600" : "text-amber-600"}>
                                                            {m.type === "entry" ? "+" : ""}{parseFloat(m.quantity).toFixed(2)}
                                                        </span>
                                                    </td>
                                                    <td className="text-right p-3 font-mono">{m.unitCost ? formatCurrency(m.unitCost) : "--"}</td>
                                                    <td className="p-3 text-gray-500 text-xs">{m.referenceType || "--"}</td>
                                                    <td className="p-3 text-gray-500 text-xs max-w-[200px] truncate">{m.notes || "--"}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="transferencias" className="mt-4 space-y-6">
                        <Card className="border-emerald-100">
                            <CardHeader>
                                <CardTitle className="text-emerald-800 flex items-center gap-2">
                                    <ArrowLeftRight className="h-5 w-5" /> Nova Transferencia
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="transfer-product">Produto</Label>
                                        <Select value={transferProductId} onValueChange={setTransferProductId}>
                                            <SelectTrigger id="transfer-product">
                                                <SelectValue placeholder="Selecione o produto" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {stock.map((s: any) => (
                                                    <SelectItem key={s.id} value={s.productId}>
                                                        {s.productName} ({parseFloat(s.quantity).toFixed(2)} {s.productUnit})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="transfer-qty">Quantidade</Label>
                                        <Input
                                            id="transfer-qty"
                                            type="number"
                                            min="0.01"
                                            step="0.01"
                                            placeholder="0.00"
                                            value={transferQty}
                                            onChange={e => setTransferQty(e.target.value)}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="transfer-from">Deposito Origem</Label>
                                        <Select value={transferFromWarehouse} onValueChange={setTransferFromWarehouse}>
                                            <SelectTrigger id="transfer-from">
                                                <SelectValue placeholder="Selecione origem" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Sem deposito</SelectItem>
                                                {properties.map((p: any) => (
                                                    <SelectItem key={p.id} value={String(p.id)}>
                                                        {p.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="transfer-to">Deposito Destino</Label>
                                        <Select value={transferToWarehouse} onValueChange={setTransferToWarehouse}>
                                            <SelectTrigger id="transfer-to">
                                                <SelectValue placeholder="Selecione destino" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Sem deposito</SelectItem>
                                                {properties.filter((p: any) => String(p.id) !== transferFromWarehouse).map((p: any) => (
                                                    <SelectItem key={p.id} value={String(p.id)}>
                                                        {p.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="transfer-notes">Observacao (opcional)</Label>
                                    <Input
                                        id="transfer-notes"
                                        placeholder="Motivo da transferencia..."
                                        value={transferNotes}
                                        onChange={e => setTransferNotes(e.target.value)}
                                    />
                                </div>

                                <Button
                                    onClick={handleTransfer}
                                    disabled={transferMutation.isPending}
                                    className="bg-emerald-700 hover:bg-emerald-800 text-white"
                                >
                                    {transferMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowLeftRight className="h-4 w-4 mr-2" />}
                                    Transferir
                                </Button>
                            </CardContent>
                        </Card>

                        <Card className="border-emerald-100">
                            <CardHeader>
                                <CardTitle className="text-emerald-800 text-base">Historico de Transferencias</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {transferMovements.length === 0 ? (
                                    <p className="text-gray-500 text-sm text-center py-6">Nenhuma transferencia registrada.</p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-emerald-50">
                                                <tr>
                                                    <th className="text-left p-3 font-semibold text-emerald-800">Data</th>
                                                    <th className="text-left p-3 font-semibold text-emerald-800">Produto</th>
                                                    <th className="text-center p-3 font-semibold text-emerald-800">Tipo</th>
                                                    <th className="text-right p-3 font-semibold text-emerald-800">Quantidade</th>
                                                    <th className="text-left p-3 font-semibold text-emerald-800">Deposito</th>
                                                    <th className="text-left p-3 font-semibold text-emerald-800">Observacao</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {transferMovements.map((m: any) => (
                                                    <tr key={m.id} className="border-t border-gray-100 hover:bg-emerald-50/30">
                                                        <td className="p-3 text-gray-600">{new Date(m.date || m.createdAt).toLocaleDateString("pt-BR")}</td>
                                                        <td className="p-3 font-medium">{m.productName || m.product_name || "--"}</td>
                                                        <td className="p-3 text-center">
                                                            {m.type === "entrada" || m.type === "entry" ? (
                                                                <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium">
                                                                    <ArrowDownRight className="h-3 w-3" /> Entrada
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 text-red-600 text-xs font-medium">
                                                                    <ArrowUpRight className="h-3 w-3" /> Saida
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="text-right p-3 font-mono">{parseFloat(m.quantity).toFixed(2)}</td>
                                                        <td className="p-3 text-gray-600">{m.warehouseName || m.warehouse_name || "--"}</td>
                                                        <td className="p-3 text-gray-500 text-xs max-w-[200px] truncate">{m.notes || "--"}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="diesel" className="mt-4 space-y-4">
                        {(() => {
                            const dieselStock = (stock as any[]).filter((s: any) =>
                                s.productCategory === "Combustível" || s.productName?.toLowerCase().includes("diesel")
                            );
                            const dieselMovements = (movements as any[]).filter((m: any) =>
                                m.productCategory === "Combustível" || m.productName?.toLowerCase().includes("diesel")
                            );
                            const totalDieselL = dieselStock.reduce((sum: number, s: any) => sum + (parseFloat(s.quantity) || 0), 0);
                            const totalDieselValue = dieselStock.reduce((sum: number, s: any) => sum + ((parseFloat(s.quantity) || 0) * (parseFloat(s.averageCost) || 0)), 0);

                            return (
                                <>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                        <Card className="border-emerald-100">
                                            <CardContent className="p-4 text-center">
                                                <Fuel className="h-8 w-8 text-amber-600 mx-auto mb-2" />
                                                <p className="text-2xl font-bold text-gray-900">{fmtNum(totalDieselL)} L</p>
                                                <p className="text-sm text-gray-500">Estoque Atual</p>
                                            </CardContent>
                                        </Card>
                                        <Card className="border-emerald-100">
                                            <CardContent className="p-4 text-center">
                                                <p className="text-2xl font-bold text-emerald-700 mt-4">{formatCurrency(totalDieselValue)}</p>
                                                <p className="text-sm text-gray-500">Valor em Estoque</p>
                                            </CardContent>
                                        </Card>
                                        <Card className="border-emerald-100">
                                            <CardContent className="p-4 text-center">
                                                <p className="text-2xl font-bold text-gray-900 mt-4">{dieselMovements.length}</p>
                                                <p className="text-sm text-gray-500">Movimentações</p>
                                            </CardContent>
                                        </Card>
                                    </div>

                                    <Card className="border-emerald-100">
                                        <CardHeader>
                                            <CardTitle className="text-emerald-800 flex items-center gap-2">
                                                <Fuel className="h-5 w-5" />
                                                Movimentações de Diesel
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            {dieselMovements.length === 0 ? (
                                                <div className="py-8 text-center">
                                                    <Fuel className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                                                    <p className="text-gray-500">Nenhuma movimentação de diesel registrada</p>
                                                    <p className="text-sm text-gray-400 mt-1">Use o botão "Adicionar Diesel" para cadastrar entradas</p>
                                                </div>
                                            ) : (
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-sm">
                                                        <thead>
                                                            <tr className="border-b border-gray-200">
                                                                <th className="text-left py-3 px-2 font-semibold text-emerald-700">Data</th>
                                                                <th className="text-left py-3 px-2 font-semibold text-emerald-700">Tipo</th>
                                                                <th className="text-right py-3 px-2 font-semibold text-emerald-700">Quantidade (L)</th>
                                                                <th className="text-right py-3 px-2 font-semibold text-emerald-700">Custo Unit.</th>
                                                                <th className="text-left py-3 px-2 font-semibold text-emerald-700">Equipamento</th>
                                                                <th className="text-left py-3 px-2 font-semibold text-emerald-700">Obs.</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {dieselMovements.map((m: any) => (
                                                                <tr key={m.id} className="border-b border-gray-100">
                                                                    <td className="py-2 px-2">{new Date(m.createdAt).toLocaleDateString("pt-BR")}</td>
                                                                    <td className="py-2 px-2">
                                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${m.type === "entry" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                                                                            {m.type === "entry" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                                                            {m.type === "entry" ? "Entrada" : "Saída"}
                                                                        </span>
                                                                    </td>
                                                                    <td className="py-2 px-2 text-right font-mono">{fmtNum(parseFloat(m.quantity))}</td>
                                                                    <td className="py-2 px-2 text-right font-mono">{m.unitCost ? formatCurrency(parseFloat(m.unitCost)) : "—"}</td>
                                                                    <td className="py-2 px-2">{m.equipmentName || "—"}</td>
                                                                    <td className="py-2 px-2 text-gray-500 truncate max-w-[200px]">{m.notes || "—"}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </>
                            );
                        })()}
                    </TabsContent>
                </Tabs>
            </div>
        </FarmLayout>
    );
}

function fmtNum(n: number, decimals = 2): string {
    return n.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

const CATEGORIES = [
    { value: "Herbicida", label: "Herbicida" },
    { value: "Fungicida", label: "Fungicida" },
    { value: "Inseticida", label: "Inseticida" },
    { value: "Fertilizante", label: "Fertilizante" },
    { value: "Semente", label: "Semente" },
    { value: "Adjuvante", label: "Adjuvante" },
    { value: "Outro", label: "Outro" },
];

const UNITS = ["LT", "KG", "UNI", "SC"];

function DieselEntryDialog({ onSuccess }: { onSuccess: () => void }) {
    const [open, setOpen] = useState(false);
    const { toast } = useToast();
    const [quantity, setQuantity] = useState("");
    const [unitCost, setUnitCost] = useState("");
    const [supplier, setSupplier] = useState("");
    const [depositId, setDepositId] = useState("");

    const { data: deposits = [] } = useQuery({
        queryKey: ["/api/farm/deposits"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/deposits"); return r.json(); },
    });

    const saveDiesel = useMutation({
        mutationFn: async () => {
            return apiRequest("POST", "/api/farm/stock", {
                name: "DIESEL",
                category: "Combustível",
                unit: "LT",
                quantity: parseFloat(quantity),
                unitCost: parseFloat(unitCost) || 0,
                depositId: depositId === "__none__" ? null : depositId || null,
            });
        },
        onSuccess: () => {
            toast({ title: "Diesel adicionado ao estoque!" });
            setOpen(false);
            setQuantity(""); setUnitCost(""); setSupplier(""); setDepositId("");
            onSuccess();
        },
        onError: (e: any) => {
            toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
        }
    });

    return (
        <Dialog open={open} onOpenChange={(o) => {
            setOpen(o);
            if (!o) { setQuantity(""); setUnitCost(""); setSupplier(""); setDepositId(""); }
        }}>
            <DialogTrigger asChild>
                <Button variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50">
                    <Fuel className="mr-2 h-4 w-4" /> Adicionar Diesel
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Fuel className="h-5 w-5 text-amber-600" />
                        Entrada de Diesel
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div>
                        <Label>Depósito</Label>
                        <Select value={depositId} onValueChange={setDepositId}>
                            <SelectTrigger><SelectValue placeholder="Selecione o depósito..." /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__none__">Sem depósito</SelectItem>
                                {(deposits as any[]).map((d: any) => (
                                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Quantidade (Litros) *</Label>
                            <Input
                                type="number"
                                step="any"
                                value={quantity}
                                onChange={e => setQuantity(e.target.value)}
                                placeholder="Ex: 5000"
                            />
                        </div>
                        <div>
                            <Label>Custo por Litro ($) *</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={unitCost}
                                onChange={e => setUnitCost(e.target.value)}
                                placeholder="Ex: 1.50"
                            />
                        </div>
                    </div>

                    {quantity && unitCost && (
                        <div className="bg-amber-50 p-3 rounded-lg text-sm">
                            <p className="text-amber-800 font-semibold">
                                Total: {formatCurrency(parseFloat(quantity) * parseFloat(unitCost))}
                            </p>
                        </div>
                    )}

                    <div>
                        <Label>Fornecedor (opcional)</Label>
                        <Input
                            value={supplier}
                            onChange={e => setSupplier(e.target.value)}
                            placeholder="Ex: Petrobras"
                        />
                    </div>

                    <Button
                        className="w-full bg-amber-600 hover:bg-amber-700 mt-2"
                        onClick={() => saveDiesel.mutate()}
                        disabled={saveDiesel.isPending || !quantity || parseFloat(quantity) <= 0}
                    >
                        {saveDiesel.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Confirmar Entrada de Diesel"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function ManualStockEntryDialog({ onSuccess }: { onSuccess: () => void }) {
    const [open, setOpen] = useState(false);
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const excelInputRef = useRef<HTMLInputElement>(null);

    const [name, setName] = useState("");
    const [category, setCategory] = useState("");
    const [unit, setUnit] = useState("");
    const [activeIngredient, setActiveIngredient] = useState("");
    const [quantity, setQuantity] = useState("");
    const [unitCost, setUnitCost] = useState("");
    const [lote, setLote] = useState("");
    const [expiryDate, setExpiryDate] = useState("");
    const [previewUrl, setPreviewUrl] = useState("");
    const [depositId, setDepositId] = useState("__none__");

    const { data: deposits = [] } = useQuery({
        queryKey: ["/api/farm/deposits"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/deposits"); return r.json(); },
    });

    const extractPhoto = useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData();
            formData.append("file", file);
            const res = await fetch("/api/farm/stock/extract-photo", {
                method: "POST",
                body: formData
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Falha ao analisar a foto");
            }
            return res.json();
        },
        onSuccess: (data: any) => {
            setName(data.name || "");
            setCategory(data.category || "");
            setUnit(data.unit || "LT");
            setActiveIngredient(data.activeIngredient || "");
            if (data.lote) setLote(data.lote);
            if (data.expiryDate) setExpiryDate(data.expiryDate);
            toast({ title: "Dados extraídos com sucesso!", description: "Revise e insira as quantidades." });
        },
        onError: (e) => {
            toast({ title: "Erro na IA", description: e.message, variant: "destructive" });
        }
    });

    const importExcel = useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData();
            formData.append("file", file);
            if (depositId !== "__none__") formData.append("depositId", depositId);
            const res = await fetch("/api/farm/stock/import-excel", {
                method: "POST",
                body: formData,
                credentials: "include",
            });
            if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Falha na importacao"); }
            return res.json();
        },
        onSuccess: (data: any) => {
            toast({ title: "Importacao concluida", description: `${data.imported} de ${data.total} produtos importados.` });
            setOpen(false);
            onSuccess();
        },
        onError: (e: any) => {
            toast({ title: "Erro na importacao", description: e.message, variant: "destructive" });
        },
    });

    const ingredientInputRef = useRef<HTMLInputElement>(null);
    const updateIngredients = useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData();
            formData.append("file", file);
            const res = await fetch("/api/farm/stock/update-ingredients", {
                method: "POST",
                body: formData,
                credentials: "include",
            });
            if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Falha ao atualizar"); }
            return res.json();
        },
        onSuccess: (data: any) => {
            toast({ title: "Ingredientes atualizados", description: `${data.updated} produtos atualizados de ${data.total} linhas.` });
            onSuccess();
        },
        onError: (e: any) => {
            toast({ title: "Erro ao atualizar ingredientes", description: e.message, variant: "destructive" });
        },
    });

    const saveStock = useMutation({
        mutationFn: async () => {
            return apiRequest("POST", "/api/farm/stock", {
                name,
                category,
                unit,
                activeIngredient,
                quantity: parseFloat(quantity),
                unitCost: parseFloat(unitCost),
                depositId: depositId === "__none__" ? null : depositId,
                lote: lote || null,
                expiryDate: expiryDate || null,
            });
        },
        onSuccess: () => {
            toast({ title: "Produto adicionado ao estoque!" });
            setOpen(false);
            onSuccess();
        },
        onError: (e: any) => {
            toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
        }
    });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setPreviewUrl(URL.createObjectURL(file));
            extractPhoto.mutate(file);
        }
    };

    const resetForm = () => {
        setName("");
        setCategory("");
        setUnit("");
        setActiveIngredient("");
        setQuantity("");
        setUnitCost("");
        setLote("");
        setExpiryDate("");
        setPreviewUrl("");
        setDepositId("__none__");
    };

    return (
        <Dialog open={open} onOpenChange={(o) => {
            setOpen(o);
            if (!o) resetForm();
        }}>
            <DialogTrigger asChild>
                <Button className="bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="mr-2 h-4 w-4" /> Adicionar Produto
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Entrada Avulsa no Estoque</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Deposito */}
                    <div>
                        <Label>Deposito</Label>
                        <Select value={depositId} onValueChange={setDepositId}>
                            <SelectTrigger><SelectValue placeholder="Selecione o deposito..." /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__none__">Sem deposito</SelectItem>
                                {(deposits as any[]).map((d: any) => (
                                    <SelectItem key={d.id} value={d.id}>
                                        {d.name} {d.depositType === "comercial" ? "(Comercial)" : "(Fazenda)"}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Hidden file inputs */}
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleFileChange} />
                    <input type="file" ref={excelInputRef} className="hidden" accept=".xlsx,.xls,.csv" onChange={(e) => { const file = e.target.files?.[0]; if (file) importExcel.mutate(file); e.target.value = ""; }} />
                    <input type="file" ref={ingredientInputRef} className="hidden" accept=".xlsx,.xls,.csv" onChange={(e) => { const file = e.target.files?.[0]; if (file) updateIngredients.mutate(file); e.target.value = ""; }} />

                    {/* Action buttons row */}
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="flex-1 h-10 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={extractPhoto.isPending}
                        >
                            {extractPhoto.isPending ? (
                                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Camera className="mr-1 h-3.5 w-3.5" />
                            )}
                            Foto (IA)
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="flex-1 h-10 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                            onClick={() => excelInputRef.current?.click()}
                            disabled={importExcel.isPending}
                        >
                            {importExcel.isPending ? (
                                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Upload className="mr-1 h-3.5 w-3.5" />
                            )}
                            Planilha
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="flex-1 h-10 text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
                            onClick={() => ingredientInputRef.current?.click()}
                            disabled={updateIngredients.isPending}
                        >
                            {updateIngredients.isPending ? (
                                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Upload className="mr-1 h-3.5 w-3.5" />
                            )}
                            Princ. Ativo
                        </Button>
                    </div>

                    {previewUrl && (
                        <div className="relative h-16 rounded-md overflow-hidden border">
                            <img src={previewUrl} className="w-full h-full object-cover opacity-50" />
                            <span className="absolute inset-0 flex items-center justify-center text-xs text-emerald-700 font-medium">Foto capturada</span>
                        </div>
                    )}

                    <hr className="my-1 border-emerald-100" />

                    {/* Formulário de Produto */}
                    <div className="space-y-3">
                        <Label className="text-emerald-800 font-semibold">Revise e Insira Quantidades</Label>

                        <div>
                            <Label>Nome do Produto *</Label>
                            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: SPHERE MAX" disabled={saveStock.isPending} />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Categoria</Label>
                                <Select value={category} onValueChange={setCategory}>
                                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                    <SelectContent>
                                        {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Unidade</Label>
                                <Select value={unit} onValueChange={setUnit}>
                                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                    <SelectContent>
                                        {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div>
                            <Label>Ingrediente Ativo <span className="text-gray-400 font-normal">(Opcional)</span></Label>
                            <Input value={activeIngredient} onChange={e => setActiveIngredient(e.target.value)} placeholder="Ex: Ciproconazol" disabled={saveStock.isPending} />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Quantidade Adicionada *</Label>
                                <Input type="number" step="0.01" min="0" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="Ex: 50" disabled={saveStock.isPending} />
                            </div>
                            <div>
                                <Label>Custo Unitário ($) *</Label>
                                <CurrencyInput value={unitCost} onValueChange={setUnitCost} disabled={saveStock.isPending} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Lote <span className="text-gray-400 font-normal">(Opcional)</span></Label>
                                <Input value={lote} onChange={e => setLote(e.target.value)} placeholder="Ex: PLN4I002" disabled={saveStock.isPending} />
                            </div>
                            <div>
                                <Label>Validade <span className="text-gray-400 font-normal">(Opcional)</span></Label>
                                <Input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} disabled={saveStock.isPending} />
                            </div>
                        </div>
                    </div>

                    <Button
                        className="w-full bg-emerald-600 hover:bg-emerald-700 mt-4"
                        onClick={() => saveStock.mutate()}
                        disabled={saveStock.isPending || extractPhoto.isPending || !name || !quantity || !unitCost}
                    >
                        {saveStock.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Package className="mr-2 h-4 w-4" />}
                        Confirmar Entrada no Estoque
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function NewDepositDialog({ onSuccess }: { onSuccess: () => void }) {
    const [open, setOpen] = useState(false);
    const [depositName, setDepositName] = useState("");
    const [depositType, setDepositType] = useState("fazenda");
    const [location, setLocation] = useState("");
    const { toast } = useToast();

    const createDeposit = useMutation({
        mutationFn: async () => {
            return apiRequest("POST", "/api/farm/deposits", {
                name: depositName,
                depositType,
                location: location || null,
            });
        },
        onSuccess: () => {
            toast({ title: "Deposito criado", description: `"${depositName}" foi adicionado.` });
            setDepositName("");
            setDepositType("fazenda");
            setLocation("");
            setOpen(false);
            onSuccess();
        },
        onError: (e: any) => {
            toast({ title: "Erro", description: e.message, variant: "destructive" });
        }
    });

    return (
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setDepositName(""); setDepositType("fazenda"); setLocation(""); } }}>
            <DialogTrigger asChild>
                <Button variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                    <Building2 className="mr-2 h-4 w-4" /> Novo Deposito
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>Novo Deposito / Armazem</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div>
                        <Label>Nome do Deposito *</Label>
                        <Input value={depositName} onChange={e => setDepositName(e.target.value)} placeholder="Ex: Armazem Central, Silo 1..." disabled={createDeposit.isPending} />
                    </div>
                    <div>
                        <Label>Tipo de Deposito *</Label>
                        <Select value={depositType} onValueChange={setDepositType}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="fazenda">Fazenda (uso proprio)</SelectItem>
                                <SelectItem value="comercial">Comercial (revenda)</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-1">
                            {depositType === "comercial" ? "Produtos deste deposito aparecerao nas vendas (Contas a Receber)" : "Produtos para uso interno da fazenda"}
                        </p>
                    </div>
                    <div>
                        <Label>Localizacao <span className="text-gray-400 font-normal">(Opcional)</span></Label>
                        <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Ex: Sede, Lote 5..." disabled={createDeposit.isPending} />
                    </div>
                    <Button
                        className="w-full bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => createDeposit.mutate()}
                        disabled={createDeposit.isPending || !depositName.trim()}
                    >
                        {createDeposit.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                        Criar Deposito
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function EditStockDialog({ stockItem, onSuccess }: { stockItem: any; onSuccess: () => void }) {
    const [open, setOpen] = useState(false);
    const { toast } = useToast();

    const { data: deposits = [] } = useQuery({
        queryKey: ["/api/farm/deposits"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/deposits"); return r.json(); },
    });

    const [productName, setProductName] = useState(stockItem.productName || "");
    const [productCategory, setProductCategory] = useState(stockItem.productCategory || "");
    const [productUnit, setProductUnit] = useState(stockItem.productUnit || "");
    const [quantity, setQuantity] = useState(stockItem.quantity.toString());
    const [averageCost, setAverageCost] = useState(stockItem.averageCost.toString());
    const [depositId, setDepositId] = useState(stockItem.depositId || "__none__");
    const [reason, setReason] = useState("");

    const updateStock = useMutation({
        mutationFn: async () => {
            return apiRequest("PUT", `/api/farm/stock/${stockItem.id}`, {
                quantity: parseFloat(quantity),
                averageCost: parseFloat(averageCost),
                reason,
                productName,
                productCategory,
                productUnit,
                depositId: depositId === "__none__" ? null : depositId,
            });
        },
        onSuccess: () => {
            toast({ title: "Estoque atualizado", description: "O ajuste foi registrado com sucesso." });
            setOpen(false);
            onSuccess();
        },
        onError: (e: any) => {
            toast({ title: "Erro na edição", description: e.message, variant: "destructive" });
        }
    });

    const resetForm = () => {
        setProductName(stockItem.productName || "");
        setProductCategory(stockItem.productCategory || "");
        setProductUnit(stockItem.productUnit || "");
        setQuantity(stockItem.quantity.toString());
        setAverageCost(stockItem.averageCost.toString());
        setDepositId(stockItem.depositId || "__none__");
        setReason("");
    };

    return (
        <Dialog open={open} onOpenChange={(o) => {
            setOpen(o);
            if (!o) resetForm();
        }}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-500 hover:text-amber-700 hover:bg-amber-50">
                    <Pencil className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Editar {stockItem.productName}</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div>
                        <Label>Nome do Produto</Label>
                        <Input value={productName} onChange={e => setProductName(e.target.value)} placeholder="Nome do produto" disabled={updateStock.isPending} />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label>Categoria</Label>
                            <Select value={productCategory} onValueChange={setProductCategory}>
                                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                <SelectContent>
                                    {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Unidade</Label>
                            <Select value={productUnit} onValueChange={setProductUnit}>
                                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                <SelectContent>
                                    {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div>
                        <Label>Deposito</Label>
                        <Select value={depositId} onValueChange={setDepositId}>
                            <SelectTrigger><SelectValue placeholder="Selecione o deposito..." /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__none__">Sem deposito</SelectItem>
                                {(deposits as any[]).map((d: any) => (
                                    <SelectItem key={d.id} value={d.id}>{d.name} {d.depositType === "comercial" || d.deposit_type === "comercial" ? "(Comercial)" : "(Fazenda)"}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <hr className="border-gray-200" />

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Quantidade Hoje</Label>
                            <Input type="number" step="0.01" value={quantity} onChange={e => setQuantity(e.target.value)} disabled={updateStock.isPending} />
                        </div>
                        <div>
                            <Label>Custo Medio ($)</Label>
                            <CurrencyInput value={averageCost} onValueChange={setAverageCost} disabled={updateStock.isPending} />
                        </div>
                    </div>

                    <div>
                        <Label>Motivo da Correcao *</Label>
                        <Input placeholder="Ex: Quebra, erro de recontagem..." value={reason} onChange={e => setReason(e.target.value)} disabled={updateStock.isPending} />
                    </div>

                    <Button
                        className="w-full bg-amber-600 hover:bg-amber-700 mt-4"
                        onClick={() => updateStock.mutate()}
                        disabled={updateStock.isPending || !quantity || !averageCost || !reason.trim()}
                    >
                        {updateStock.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        Aplicar Correcao
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ─── Deposit Tabs View (horizontal tabs instead of stacked cards) ────────────
function DepositTabsView({ depositsMain, properties, stockByProperty, onDeleteDeposit, deletingDeposit }: {
    depositsMain: any[]; properties: any[]; stockByProperty: Record<string, any[]>;
    onDeleteDeposit: (id: string, name: string, hasItems: boolean) => void; deletingDeposit: boolean;
}) {
    // Build deposit entries — only from real farmDeposits, not from properties
    const allDepositNames = new Set<string>();
    depositsMain.forEach((d: any) => allDepositNames.add(d.name));
    Object.keys(stockByProperty).forEach(k => allDepositNames.add(k));

    const depositEntries = Array.from(allDepositNames).map(name => {
        const items = stockByProperty[name] || [];
        const dep = depositsMain.find((d: any) => d.name === name);
        const depType = dep?.depositType || dep?.deposit_type || null;
        const depId = dep?.id || null;
        return { name, items, depType, depId };
    });
    depositEntries.sort((a, b) => {
        if (a.name === "Sem deposito") return 1;
        if (b.name === "Sem deposito") return -1;
        return b.items.length - a.items.length;
    });

    const [activeDeposit, setActiveDeposit] = useState(depositEntries[0]?.name || "");

    if (depositEntries.length === 0) return (
        <Card className="border-emerald-100"><CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Nenhum deposito cadastrado</p>
        </CardContent></Card>
    );

    const active = depositEntries.find(d => d.name === activeDeposit) || depositEntries[0];

    return (
        <div>
            {/* Horizontal tab buttons */}
            <div className="flex gap-2 overflow-x-auto pb-2 border-b border-gray-200">
                {depositEntries.map(({ name: depName, items: depItems, depType }) => (
                    <button key={depName} type="button"
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-t-lg text-sm font-medium whitespace-nowrap transition-colors ${
                            activeDeposit === depName
                                ? "bg-white border border-b-white border-gray-200 -mb-px text-emerald-700"
                                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                        }`}
                        onClick={() => setActiveDeposit(depName)}>
                        <Building2 className="h-4 w-4" />
                        {depName}
                        {depType && (
                            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium ${depType === "comercial" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>
                                {depType === "comercial" ? "COM" : "FAZ"}
                            </span>
                        )}
                        <span className="text-[10px] text-gray-400 ml-1">({depItems.length})</span>
                    </button>
                ))}
            </div>

            {/* Active deposit content */}
            <Card className="border-emerald-100 border-t-0 rounded-t-none">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-emerald-600" />
                        {active.name}
                        {active.depType && (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${active.depType === "comercial" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>
                                {active.depType === "comercial" ? "Comercial" : "Fazenda"}
                            </span>
                        )}
                        <span className="ml-auto text-sm font-normal text-gray-500">
                            {active.items.length > 0
                                ? `${active.items.length} itens — ${formatCurrency(active.items.reduce((s: number, i: any) => s + (parseFloat(i.quantity) * parseFloat(i.averageCost)), 0))}`
                                : "Vazio"}
                        </span>
                        {active.depId && active.name !== "Sem deposito" && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50"
                                onClick={() => onDeleteDeposit(active.depId, active.name, active.items.length > 0)}
                                disabled={deletingDeposit}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                    {active.items.length === 0 ? (
                        <p className="text-sm text-gray-400 py-6 text-center">Nenhum produto neste deposito. Use "Adicionar Produto" para dar entrada.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-emerald-50">
                                    <tr>
                                        <th className="text-left p-2 font-semibold text-emerald-800 text-xs">Produto</th>
                                        <th className="text-left p-2 font-semibold text-emerald-800 text-xs">Categoria</th>
                                        <th className="text-right p-2 font-semibold text-emerald-800 text-xs">Qtd</th>
                                        <th className="text-right p-2 font-semibold text-emerald-800 text-xs">Custo Medio</th>
                                        <th className="text-right p-2 font-semibold text-emerald-800 text-xs">Valor</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {active.items.map((s: any) => {
                                        const q = parseFloat(s.quantity);
                                        const c = parseFloat(s.averageCost);
                                        return (
                                            <tr key={s.id} className="border-t border-gray-100 hover:bg-emerald-50/30">
                                                <td className="p-2 font-medium">{s.productName}</td>
                                                <td className="p-2">
                                                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">{s.productCategory || "--"}</span>
                                                </td>
                                                <td className="text-right p-2 font-mono">{q.toFixed(2)} {s.productUnit}</td>
                                                <td className="text-right p-2 font-mono">{formatCurrency(c)}</td>
                                                <td className="text-right p-2 font-mono font-semibold">{formatCurrency(q * c)}</td>
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
    );
}
