import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import EmpresaLayout from "@/components/empresa/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Plus, Search, Eye, CheckCircle, XCircle, Send, Loader2, Trash2 } from "lucide-react";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    draft: { label: "Rascunho", color: "bg-slate-100 text-slate-700" },
    pending_director: { label: "Aguard. Diretor", color: "bg-yellow-100 text-yellow-800" },
    approved: { label: "Aprovado", color: "bg-blue-100 text-blue-800" },
    pending_billing: { label: "Aguard. Faturamento", color: "bg-purple-100 text-purple-800" },
    pending_finance: { label: "Aguard. Financeiro", color: "bg-orange-100 text-orange-800" },
    invoiced: { label: "Faturado", color: "bg-green-100 text-green-800" },
    partially_invoiced: { label: "Fat. Parcial", color: "bg-teal-100 text-teal-800" },
    cancelled: { label: "Cancelado", color: "bg-red-100 text-red-800" },
};

const STATUS_TABS = [
    { key: "all", label: "Todos" },
    { key: "draft", label: "Rascunho" },
    { key: "pending_director", label: "Aguard. Diretor" },
    { key: "approved", label: "Aprovado" },
    { key: "pending_billing", label: "Para Faturar" },
    { key: "invoiced", label: "Faturado" },
];

const api = (method: string, path: string, body?: any) =>
    fetch(path, {
        method,
        headers: body ? { "Content-Type": "application/json" } : {},
        credentials: "include",
        body: body ? JSON.stringify(body) : undefined,
    }).then(r => r.json());

export default function EmpresaPedidos() {
    const { user } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [search, setSearch] = useState("");
    const [activeTab, setActiveTab] = useState("all");
    const [showForm, setShowForm] = useState(false);
    const [detailOrder, setDetailOrder] = useState<any>(null);

    // Form state
    const [form, setForm] = useState({
        clientId: "", priceListId: "", paymentType: "credito",
        freightPayer: "cliente", deliveryLocation: "", paymentLocation: "",
        dueDate: "", agriculturalYear: "", zafra: "", culture: "",
        observations: "", currency: "USD",
    });
    const [orderItems, setOrderItems] = useState<any[]>([]);
    const [newItem, setNewItem] = useState({ productId: "", productName: "", productCode: "", quantity: "", unit: "SC", unitPriceUsd: "", warehouseId: "" });

    const { data: orders = [], isLoading } = useQuery<any[]>({
        queryKey: ["/api/company/orders"],
        queryFn: () => api("GET", "/api/company/orders"),
        enabled: !!user,
    });

    const { data: clients = [] } = useQuery<any[]>({
        queryKey: ["/api/company/clients"],
        queryFn: () => api("GET", "/api/company/clients"),
        enabled: !!user,
    });

    const { data: priceLists = [] } = useQuery<any[]>({
        queryKey: ["/api/company/price-lists"],
        queryFn: () => api("GET", "/api/company/price-lists"),
        enabled: !!user,
    });

    const { data: products = [] } = useQuery<any[]>({
        queryKey: ["/api/company/products"],
        queryFn: () => api("GET", "/api/company/products"),
        enabled: !!user,
    });

    const { data: warehouses = [] } = useQuery<any[]>({
        queryKey: ["/api/company/warehouses"],
        queryFn: () => api("GET", "/api/company/warehouses"),
        enabled: !!user,
    });

    const { data: priceListDetail } = useQuery<any>({
        queryKey: ["/api/company/price-lists", form.priceListId],
        queryFn: () => api("GET", `/api/company/price-lists/${form.priceListId}`),
        enabled: !!form.priceListId,
    });

    const createOrder = useMutation({
        mutationFn: (data: any) => api("POST", "/api/company/orders", data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/company/orders"] });
            setShowForm(false);
            setOrderItems([]);
            setForm({ clientId: "", priceListId: "", paymentType: "credito", freightPayer: "cliente", deliveryLocation: "", paymentLocation: "", dueDate: "", agriculturalYear: "", zafra: "", culture: "", observations: "", currency: "USD" });
            toast({ title: "Pedido criado com sucesso" });
        },
        onError: () => toast({ title: "Erro ao criar pedido", variant: "destructive" }),
    });

    const submitOrder = useMutation({
        mutationFn: (id: string) => api("POST", `/api/company/orders/${id}/submit`),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/company/orders"] }); toast({ title: "Pedido enviado para aprovação" }); },
    });

    const approveOrder = useMutation({
        mutationFn: (id: string) => api("POST", `/api/company/orders/${id}/approve`),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/company/orders"] }); toast({ title: "Pedido aprovado" }); },
        onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
    });

    const rejectOrder = useMutation({
        mutationFn: (id: string) => api("POST", `/api/company/orders/${id}/reject`),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/company/orders"] }); toast({ title: "Pedido cancelado" }); },
    });

    const toFinance = useMutation({
        mutationFn: (id: string) => api("POST", `/api/company/orders/${id}/to-finance`),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/company/orders"] }); toast({ title: "Enviado para financeiro" }); },
    });

    const financeApprove = useMutation({
        mutationFn: (id: string) => api("POST", `/api/company/orders/${id}/finance-approve`),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/company/orders"] }); toast({ title: "Crédito aprovado" }); },
    });

    const handleAddItem = () => {
        if (!newItem.productName || !newItem.quantity) return;
        const qty = parseFloat(newItem.quantity);
        const price = parseFloat(newItem.unitPriceUsd || "0");
        setOrderItems(prev => [...prev, { ...newItem, quantity: qty, unitPriceUsd: price, totalPriceUsd: qty * price }]);
        setNewItem({ productId: "", productName: "", productCode: "", quantity: "", unit: "SC", unitPriceUsd: "", warehouseId: "" });
    };

    const handleProductSelect = (productId: string) => {
        const product = products.find((p: any) => p.id === productId);
        if (!product) return;
        let price = "";
        if (priceListDetail?.items) {
            const plItem = priceListDetail.items.find((i: any) => i.productId === productId || i.productName?.toUpperCase() === product.name?.toUpperCase());
            if (plItem) price = plItem.priceUsd ?? "";
        }
        setNewItem(prev => ({ ...prev, productId, productName: product.name, productCode: product.code ?? "", unit: product.unit ?? "SC", unitPriceUsd: price }));
    };

    const totalUsd = orderItems.reduce((acc, i) => acc + (i.totalPriceUsd ?? 0), 0);

    const filtered = orders.filter((o: any) => {
        const matchSearch = !search || o.orderNumber.toLowerCase().includes(search.toLowerCase()) || (o.clientName ?? "").toLowerCase().includes(search.toLowerCase());
        const matchTab = activeTab === "all" || o.status === activeTab;
        return matchSearch && matchTab;
    });

    return (
        <EmpresaLayout>
            <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-slate-800">Pedidos de Venda</h1>
                    <Button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700">
                        <Plus className="h-4 w-4 mr-2" /> Novo Pedido
                    </Button>
                </div>

                {/* Filter bar */}
                <div className="flex gap-3 items-center">
                    <div className="relative flex-1 max-w-xs">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <Input placeholder="Buscar pedido ou cliente..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="flex-wrap h-auto gap-1">
                        {STATUS_TABS.map(t => (
                            <TabsTrigger key={t.key} value={t.key} className="text-xs">{t.label}</TabsTrigger>
                        ))}
                    </TabsList>

                    <TabsContent value={activeTab} className="mt-3">
                        {isLoading ? (
                            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
                        ) : filtered.length === 0 ? (
                            <div className="text-center py-12 text-slate-400">Nenhum pedido encontrado</div>
                        ) : (
                            <div className="space-y-2">
                                {filtered.map((order: any) => {
                                    const st = STATUS_LABELS[order.status] ?? { label: order.status, color: "bg-slate-100 text-slate-700" };
                                    return (
                                        <Card key={order.id} className="hover:shadow-sm transition-shadow">
                                            <CardContent className="p-4">
                                                <div className="flex items-center justify-between gap-4">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="font-semibold text-sm">{order.orderNumber}</span>
                                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.color}`}>{st.label}</span>
                                                            {order.paymentType && (
                                                                <span className="text-xs text-slate-500 capitalize">{order.paymentType}</span>
                                                            )}
                                                        </div>
                                                        <p className="text-slate-600 text-sm mt-0.5">{order.clientName}</p>
                                                        {order.culture && <p className="text-slate-400 text-xs">{order.agriculturalYear} — {order.culture}</p>}
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="font-semibold text-sm">
                                                            {order.currency === "USD" ? "$ " : "₲ "}
                                                            {parseFloat(order.totalAmountUsd ?? 0).toLocaleString("es-PY", { minimumFractionDigits: 2 })}
                                                        </p>
                                                        <p className="text-slate-400 text-xs">{new Date(order.createdAt).toLocaleDateString("es-PY")}</p>
                                                    </div>
                                                    <div className="flex gap-1">
                                                        <Button size="sm" variant="ghost" onClick={() => setDetailOrder(order)}>
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                        {order.status === "draft" && (
                                                            <Button size="sm" variant="ghost" className="text-blue-600" onClick={() => submitOrder.mutate(order.id)}>
                                                                <Send className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                        {order.status === "pending_director" && (
                                                            <>
                                                                <Button size="sm" variant="ghost" className="text-green-600" onClick={() => approveOrder.mutate(order.id)}>
                                                                    <CheckCircle className="h-4 w-4" />
                                                                </Button>
                                                                <Button size="sm" variant="ghost" className="text-red-500" onClick={() => rejectOrder.mutate(order.id)}>
                                                                    <XCircle className="h-4 w-4" />
                                                                </Button>
                                                            </>
                                                        )}
                                                        {order.status === "approved" && (
                                                            <Button size="sm" variant="ghost" className="text-orange-600" onClick={() => toFinance.mutate(order.id)}>
                                                                Financeiro
                                                            </Button>
                                                        )}
                                                        {order.status === "pending_finance" && (
                                                            <Button size="sm" variant="ghost" className="text-green-600" onClick={() => financeApprove.mutate(order.id)}>
                                                                Liberar
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </div>

            {/* Order Detail Dialog */}
            <Dialog open={!!detailOrder} onOpenChange={() => setDetailOrder(null)}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Pedido {detailOrder?.orderNumber}</DialogTitle>
                    </DialogHeader>
                    {detailOrder && (
                        <div className="space-y-4 text-sm">
                            <div className="grid grid-cols-2 gap-3">
                                <div><span className="text-slate-500">Cliente:</span><p className="font-medium">{detailOrder.clientName}</p></div>
                                <div><span className="text-slate-500">Status:</span><p className="font-medium capitalize">{STATUS_LABELS[detailOrder.status]?.label}</p></div>
                                <div><span className="text-slate-500">Pagamento:</span><p className="font-medium capitalize">{detailOrder.paymentType}</p></div>
                                <div><span className="text-slate-500">Frete:</span><p className="font-medium capitalize">{detailOrder.freightPayer}</p></div>
                                {detailOrder.culture && <div><span className="text-slate-500">Cultura:</span><p className="font-medium">{detailOrder.culture}</p></div>}
                                {detailOrder.agriculturalYear && <div><span className="text-slate-500">Año Agrícola:</span><p className="font-medium">{detailOrder.agriculturalYear}</p></div>}
                                {detailOrder.dueDate && <div><span className="text-slate-500">Vencimento:</span><p className="font-medium">{new Date(detailOrder.dueDate).toLocaleDateString("es-PY")}</p></div>}
                            </div>
                            {detailOrder.observations && (
                                <div><span className="text-slate-500">Observações:</span><p className="mt-1 text-slate-700 bg-slate-50 rounded p-2">{detailOrder.observations}</p></div>
                            )}
                            <DetailOrderItems orderId={detailOrder.id} />
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* New Order Dialog */}
            <Dialog open={showForm} onOpenChange={setShowForm}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Novo Pedido de Venda</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                                <Label>Cliente *</Label>
                                <Select value={form.clientId} onValueChange={v => setForm(p => ({ ...p, clientId: v }))}>
                                    <SelectTrigger><SelectValue placeholder="Selecionar cliente..." /></SelectTrigger>
                                    <SelectContent>
                                        {clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name} {c.ruc ? `— ${c.ruc}` : ""}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Tabela de Preços</Label>
                                <Select value={form.priceListId} onValueChange={v => setForm(p => ({ ...p, priceListId: v }))}>
                                    <SelectTrigger><SelectValue placeholder="Selecionar tabela..." /></SelectTrigger>
                                    <SelectContent>
                                        {priceLists.filter((pl: any) => pl.isActive).map((pl: any) => <SelectItem key={pl.id} value={pl.id}>{pl.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Tipo de Pagamento</Label>
                                <Select value={form.paymentType} onValueChange={v => setForm(p => ({ ...p, paymentType: v }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="contado">Contado</SelectItem>
                                        <SelectItem value="credito">Crédito</SelectItem>
                                        <SelectItem value="anticipado">Anticipado</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Frete</Label>
                                <Select value={form.freightPayer} onValueChange={v => setForm(p => ({ ...p, freightPayer: v }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="cliente">Cliente</SelectItem>
                                        <SelectItem value="company">Empresa</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Año Agrícola</Label>
                                <Input value={form.agriculturalYear} onChange={e => setForm(p => ({ ...p, agriculturalYear: e.target.value }))} placeholder="2025/26" />
                            </div>
                            <div>
                                <Label>Cultura</Label>
                                <Input value={form.culture} onChange={e => setForm(p => ({ ...p, culture: e.target.value }))} placeholder="Soja, Milho..." />
                            </div>
                            <div>
                                <Label>Zafra</Label>
                                <Input value={form.zafra} onChange={e => setForm(p => ({ ...p, zafra: e.target.value }))} />
                            </div>
                            <div>
                                <Label>Vencimento</Label>
                                <Input type="date" value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} />
                            </div>
                            <div>
                                <Label>Local de Entrega</Label>
                                <Input value={form.deliveryLocation} onChange={e => setForm(p => ({ ...p, deliveryLocation: e.target.value }))} />
                            </div>
                            <div>
                                <Label>Local de Pagamento</Label>
                                <Input value={form.paymentLocation} onChange={e => setForm(p => ({ ...p, paymentLocation: e.target.value }))} />
                            </div>
                            <div className="col-span-2">
                                <Label>Observações</Label>
                                <Input value={form.observations} onChange={e => setForm(p => ({ ...p, observations: e.target.value }))} />
                            </div>
                        </div>

                        {/* Items */}
                        <div className="border rounded-lg p-3 space-y-3">
                            <p className="font-medium text-sm">Itens do Pedido</p>
                            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-slate-500 px-1">
                                <span className="col-span-4">Produto</span>
                                <span className="col-span-2">Qtd</span>
                                <span className="col-span-1">Un.</span>
                                <span className="col-span-2">Preço U$</span>
                                <span className="col-span-2">Total U$</span>
                                <span className="col-span-1">Dep.</span>
                            </div>
                            {orderItems.map((item, idx) => (
                                <div key={idx} className="grid grid-cols-12 gap-2 text-sm items-center bg-slate-50 rounded px-1 py-1">
                                    <span className="col-span-4 truncate">{item.productName}</span>
                                    <span className="col-span-2">{item.quantity}</span>
                                    <span className="col-span-1">{item.unit}</span>
                                    <span className="col-span-2">{parseFloat(item.unitPriceUsd).toLocaleString("es-PY")}</span>
                                    <span className="col-span-2">{parseFloat(item.totalPriceUsd).toLocaleString("es-PY")}</span>
                                    <button className="col-span-1 text-red-400 hover:text-red-600" onClick={() => setOrderItems(prev => prev.filter((_, i) => i !== idx))}>
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            ))}
                            {/* Add item row */}
                            <div className="grid grid-cols-12 gap-2 items-end">
                                <div className="col-span-4">
                                    <Select value={newItem.productId} onValueChange={handleProductSelect}>
                                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Produto..." /></SelectTrigger>
                                        <SelectContent>
                                            {products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="col-span-2">
                                    <Input className="h-8 text-xs" placeholder="Qtd" value={newItem.quantity} onChange={e => setNewItem(p => ({ ...p, quantity: e.target.value }))} />
                                </div>
                                <div className="col-span-1">
                                    <Input className="h-8 text-xs" placeholder="Un" value={newItem.unit} onChange={e => setNewItem(p => ({ ...p, unit: e.target.value }))} />
                                </div>
                                <div className="col-span-2">
                                    <Input className="h-8 text-xs" placeholder="Preço" value={newItem.unitPriceUsd} onChange={e => setNewItem(p => ({ ...p, unitPriceUsd: e.target.value }))} />
                                </div>
                                <div className="col-span-2 text-xs text-slate-500 text-right">
                                    {newItem.quantity && newItem.unitPriceUsd ? (parseFloat(newItem.quantity) * parseFloat(newItem.unitPriceUsd)).toLocaleString("es-PY", { minimumFractionDigits: 2 }) : "—"}
                                </div>
                                <div className="col-span-1">
                                    <Button size="sm" variant="outline" className="h-8 w-full" onClick={handleAddItem}>
                                        <Plus className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                            {orderItems.length > 0 && (
                                <div className="text-right text-sm font-semibold border-t pt-2">
                                    Total: $ {totalUsd.toLocaleString("es-PY", { minimumFractionDigits: 2 })}
                                </div>
                            )}
                        </div>

                        <div className="flex gap-2 justify-end">
                            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                            <Button
                                className="bg-blue-600 hover:bg-blue-700"
                                disabled={!form.clientId || orderItems.length === 0 || createOrder.isPending}
                                onClick={() => createOrder.mutate({ ...form, items: orderItems.map(i => ({ ...i, totalPriceUsd: i.totalPriceUsd })) })}
                            >
                                {createOrder.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                Salvar Pedido
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </EmpresaLayout>
    );
}

function DetailOrderItems({ orderId }: { orderId: string }) {
    const { data } = useQuery<any>({
        queryKey: ["/api/company/orders", orderId],
        queryFn: () => fetch(`/api/company/orders/${orderId}`, { credentials: "include" }).then(r => r.json()),
    });
    if (!data?.items) return <div className="text-slate-400 text-xs text-center py-4">Carregando itens...</div>;
    return (
        <div>
            <p className="font-medium mb-2">Itens</p>
            <table className="w-full text-xs">
                <thead>
                    <tr className="text-slate-500 border-b">
                        <th className="text-left py-1">Produto</th>
                        <th className="text-right py-1">Qtd</th>
                        <th className="text-right py-1">Un.</th>
                        <th className="text-right py-1">Preço U$</th>
                        <th className="text-right py-1">Total U$</th>
                        <th className="text-right py-1">Fat.</th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {data.items.map((item: any) => (
                        <tr key={item.id}>
                            <td className="py-1">{item.productName} {item.productCode ? <span className="text-slate-400">({item.productCode})</span> : null}</td>
                            <td className="text-right">{parseFloat(item.quantity).toLocaleString("es-PY")}</td>
                            <td className="text-right">{item.unit}</td>
                            <td className="text-right">{parseFloat(item.unitPriceUsd ?? 0).toLocaleString("es-PY", { minimumFractionDigits: 2 })}</td>
                            <td className="text-right font-medium">{parseFloat(item.totalPriceUsd ?? 0).toLocaleString("es-PY", { minimumFractionDigits: 2 })}</td>
                            <td className="text-right">{parseFloat(item.invoicedQuantity ?? 0).toLocaleString("es-PY")}</td>
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr className="border-t font-semibold">
                        <td colSpan={4} className="text-right py-1">Total:</td>
                        <td className="text-right">$ {data.items.reduce((acc: number, i: any) => acc + parseFloat(i.totalPriceUsd ?? 0), 0).toLocaleString("es-PY", { minimumFractionDigits: 2 })}</td>
                        <td></td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
}
