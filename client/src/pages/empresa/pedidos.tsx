import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import EmpresaLayout from "@/components/empresa/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Plus, Search, Eye, CheckCircle, XCircle, Send, Loader2, Trash2, AlertTriangle, FileCheck } from "lucide-react";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    draft: { label: "Rascunho", color: "bg-slate-100 text-slate-700" },
    pending_director: { label: "Aguard. Diretor", color: "bg-yellow-100 text-yellow-800" },
    pending_finance: { label: "Aguard. Financeiro", color: "bg-orange-100 text-orange-800" },
    pending_billing: { label: "Para Faturar", color: "bg-purple-100 text-purple-800" },
    invoiced: { label: "Faturado", color: "bg-green-100 text-green-800" },
    partially_invoiced: { label: "Fat. Parcial", color: "bg-teal-100 text-teal-800" },
    cancelled: { label: "Cancelado", color: "bg-red-100 text-red-800" },
};

const STATUS_TABS = [
    { key: "all", label: "Todos" },
    { key: "draft", label: "Rascunho" },
    { key: "pending_director", label: "Aguard. Diretor" },
    { key: "pending_finance", label: "Aguard. Financeiro" },
    { key: "pending_billing", label: "Para Faturar" },
    { key: "invoiced", label: "Faturado" },
    { key: "cancelled", label: "Cancelado" },
];

const api = (method: string, path: string, body?: any) =>
    fetch(path, {
        method,
        headers: body ? { "Content-Type": "application/json" } : {},
        credentials: "include",
        body: body ? JSON.stringify(body) : undefined,
    }).then(async r => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Erro ao processar requisição");
        return data;
    });

export default function EmpresaPedidos() {
    const { user } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Cargo do usuário dentro da empresa
    const { data: company } = useQuery<any>({
        queryKey: ["/api/company/me"],
        queryFn: () => api("GET", "/api/company/me"),
        enabled: !!user,
    });
    const companyRole: string = company?.role ?? "";
    const [search, setSearch] = useState("");
    const [activeTab, setActiveTab] = useState("all");
    const [showForm, setShowForm] = useState(false);
    const [formTab, setFormTab] = useState("dados");
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

    const { data: availableByProduct = [] } = useQuery<any[]>({
        queryKey: ["/api/company/stock/available-by-product"],
        queryFn: () => api("GET", "/api/company/stock/available-by-product"),
        enabled: showForm,
    });

    const createOrder = useMutation({
        mutationFn: (data: any) => api("POST", "/api/company/orders", data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/company/orders"] });
            setShowForm(false);
            setFormTab("dados");
            setOrderItems([]);
            setForm({ clientId: "", priceListId: "", paymentType: "credito", freightPayer: "cliente", deliveryLocation: "", paymentLocation: "", dueDate: "", agriculturalYear: "", zafra: "", culture: "", observations: "", currency: "USD" });
            toast({ title: "Pedido criado com sucesso" });
        },
        onError: (e: any) => toast({ title: "Erro ao criar pedido", description: e.message, variant: "destructive" }),
    });

    const invalidateOrders = () => queryClient.invalidateQueries({ queryKey: ["/api/company/orders"] });
    const onErr = (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" });

    const submitOrder = useMutation({
        mutationFn: (id: string) => api("POST", `/api/company/orders/${id}/submit`),
        onSuccess: () => { invalidateOrders(); toast({ title: "Pedido enviado para o diretor" }); },
        onError: onErr,
    });

    const approveOrder = useMutation({
        mutationFn: (id: string) => api("POST", `/api/company/orders/${id}/approve`),
        onSuccess: () => { invalidateOrders(); toast({ title: "Pedido aprovado — enviado para faturamento" }); },
        onError: onErr,
    });

    const rejectOrder = useMutation({
        mutationFn: (id: string) => api("POST", `/api/company/orders/${id}/reject`),
        onSuccess: () => { invalidateOrders(); toast({ title: "Pedido rejeitado" }); },
        onError: onErr,
    });

    const toFinance = useMutation({
        mutationFn: (id: string) => api("POST", `/api/company/orders/${id}/to-finance`),
        onSuccess: () => { invalidateOrders(); toast({ title: "Enviado para análise de crédito" }); },
        onError: onErr,
    });

    const financeApprove = useMutation({
        mutationFn: (id: string) => api("POST", `/api/company/orders/${id}/finance-approve`),
        onSuccess: () => { invalidateOrders(); toast({ title: "Crédito liberado — pedido para faturamento" }); },
        onError: onErr,
    });

    const financeReject = useMutation({
        mutationFn: (id: string) => api("POST", `/api/company/orders/${id}/finance-reject`),
        onSuccess: () => { invalidateOrders(); toast({ title: "Crédito bloqueado — pedido cancelado" }); },
        onError: onErr,
    });

    const markBilled = useMutation({
        mutationFn: (id: string) => api("POST", `/api/company/orders/${id}/mark-billed`),
        onSuccess: () => { invalidateOrders(); toast({ title: "Pedido marcado como faturado" }); },
        onError: onErr,
    });

    const handleAddItem = () => {
        if (!newItem.productName) {
            toast({ title: "Informe o nome do produto", variant: "destructive" });
            return;
        }
        if (!newItem.quantity || parseFloat(newItem.quantity) <= 0) {
            toast({ title: "Informe a quantidade", variant: "destructive" });
            return;
        }
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
        // RTV só vê os próprios pedidos
        if (companyRole === "rtv" && o.consultantId !== user?.id) return false;
        const matchSearch = !search || o.orderNumber.toLowerCase().includes(search.toLowerCase()) || (o.clientName ?? "").toLowerCase().includes(search.toLowerCase());
        const matchTab = activeTab === "all" || o.status === activeTab;
        return matchSearch && matchTab;
    });

    return (
        <EmpresaLayout>
            <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-slate-800">Pedidos de Venda</h1>
                    <Button onClick={() => { setShowForm(true); setFormTab("dados"); }} className="bg-blue-600 hover:bg-blue-700">
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
                                                    <div className="flex gap-1 flex-wrap justify-end">
                                                        <Button size="sm" variant="ghost" onClick={() => setDetailOrder(order)}>
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                        {/* RTV: envia rascunho para diretor */}
                                                        {order.status === "draft" && companyRole === "rtv" && (
                                                            <Button size="sm" variant="ghost" className="text-blue-600" title="Enviar para diretor" onClick={() => submitOrder.mutate(order.id)}>
                                                                <Send className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                        {/* DIRETOR: aprovar → faturamento | enviar financeiro | rejeitar */}
                                                        {order.status === "pending_director" && ["director", "admin_empresa"].includes(companyRole) && (
                                                            <>
                                                                <Button size="sm" variant="ghost" className="text-green-600" title="Aprovar" onClick={() => approveOrder.mutate(order.id)}>
                                                                    <CheckCircle className="h-4 w-4" />
                                                                </Button>
                                                                <Button size="sm" variant="ghost" className="text-orange-500" title="Verificar crédito" onClick={() => toFinance.mutate(order.id)}>
                                                                    <AlertTriangle className="h-4 w-4" />
                                                                </Button>
                                                                <Button size="sm" variant="ghost" className="text-red-500" title="Rejeitar" onClick={() => rejectOrder.mutate(order.id)}>
                                                                    <XCircle className="h-4 w-4" />
                                                                </Button>
                                                            </>
                                                        )}
                                                        {/* FINANCEIRO: liberar ou bloquear crédito */}
                                                        {order.status === "pending_finance" && ["financeiro", "admin_empresa"].includes(companyRole) && (
                                                            <>
                                                                <Button size="sm" variant="ghost" className="text-green-600" title="Liberar crédito" onClick={() => financeApprove.mutate(order.id)}>
                                                                    <CheckCircle className="h-4 w-4" />
                                                                </Button>
                                                                <Button size="sm" variant="ghost" className="text-red-500" title="Bloquear crédito" onClick={() => financeReject.mutate(order.id)}>
                                                                    <XCircle className="h-4 w-4" />
                                                                </Button>
                                                            </>
                                                        )}
                                                        {/* FATURISTA: marcar como faturado manualmente */}
                                                        {order.status === "pending_billing" && ["faturista", "admin_empresa"].includes(companyRole) && (
                                                            <Button size="sm" variant="ghost" className="text-purple-600" title="Marcar como faturado" onClick={() => markBilled.mutate(order.id)}>
                                                                <FileCheck className="h-4 w-4" />
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
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto w-[95vw] p-4 md:p-6">
                    <DialogHeader>
                        <DialogTitle>Novo Pedido de Venda</DialogTitle>
                    </DialogHeader>

                    <Tabs value={formTab} onValueChange={setFormTab} className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="dados" className="text-xs md:text-sm">1. Dados do Pedido</TabsTrigger>
                            <TabsTrigger value="itens" disabled={!form.clientId} className="text-xs md:text-sm">2. Itens do Pedido</TabsTrigger>
                        </TabsList>

                        <TabsContent value="dados" className="space-y-4 mt-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="col-span-1 md:col-span-2">
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
                                <div className="col-span-1 md:col-span-2">
                                    <Label>Observações</Label>
                                    <Input value={form.observations} onChange={e => setForm(p => ({ ...p, observations: e.target.value }))} />
                                </div>
                            </div>

                            <div className="flex justify-end pt-4 border-t">
                                <Button
                                    className="bg-slate-800 hover:bg-slate-900 w-full md:w-auto"
                                    onClick={() => setFormTab("itens")}
                                    disabled={!form.clientId}
                                >
                                    Avançar para Itens <Search className="ml-2 h-4 w-4 hidden md:block" />
                                </Button>
                            </div>
                        </TabsContent>

                        <TabsContent value="itens" className="space-y-4 mt-4">
                            {/* Items Grid */}
                            <div className="border rounded-lg p-2 md:p-3 space-y-3">
                                <p className="font-medium text-sm hidden md:block">Itens do Pedido</p>
                                <div className="hidden md:grid grid-cols-12 gap-2 text-xs font-medium text-slate-500 px-1">
                                    <span className="col-span-4">Produto</span>
                                    <span className="col-span-2">Qtd</span>
                                    <span className="col-span-1">Un.</span>
                                    <span className="col-span-2">Preço U$</span>
                                    <span className="col-span-2">Total U$</span>
                                    <span className="col-span-1 border"></span>
                                </div>
                                {orderItems.map((item, idx) => (
                                    <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 text-sm items-center bg-slate-50 border md:border-none rounded p-2 md:px-1 md:py-1 mb-2 md:mb-0 relative">
                                        <div className="col-span-1 md:col-span-4 pr-6 md:pr-0">
                                            <span className="font-medium md:font-normal block truncate">{item.productName}</span>
                                        </div>
                                        <div className="grid grid-cols-3 md:contents gap-2 mt-1 md:mt-0">
                                            <div className="col-span-1 md:col-span-2">
                                                <span className="text-xs text-slate-400 block md:hidden">Qtd</span>
                                                {item.quantity}
                                            </div>
                                            <div className="col-span-1">
                                                <span className="text-xs text-slate-400 block md:hidden">Un</span>
                                                {item.unit}
                                            </div>
                                            <div className="col-span-1 md:col-span-2">
                                                <span className="text-xs text-slate-400 block md:hidden">Preço</span>
                                                ${parseFloat(item.unitPriceUsd).toLocaleString("es-PY")}
                                            </div>
                                        </div>
                                        <div className="col-span-1 md:col-span-2 mt-1 md:mt-0 font-medium md:font-normal">
                                            <span className="text-xs text-slate-400 mr-2 md:hidden">Total:</span>
                                            ${parseFloat(item.totalPriceUsd).toLocaleString("es-PY")}
                                        </div>
                                        <button className="absolute top-2 right-2 md:static col-span-1 text-red-400 hover:text-red-600 md:text-right" onClick={() => setOrderItems(prev => prev.filter((_, i) => i !== idx))}>
                                            <Trash2 className="h-4 w-4 md:h-3.5 md:w-3.5" />
                                        </button>
                                    </div>
                                ))}

                                {/* Add item row */}
                                <div className="grid grid-cols-2 md:grid-cols-12 gap-2 items-end mt-4 pt-4 border-t border-dashed">
                                    <div className="col-span-2 md:col-span-4">
                                        <Label className="md:hidden text-xs">Produto</Label>
                                        <datalist id="products-list">
                                            {(products as any[]).map((p: any) => <option key={p.id} value={p.name} data-id={p.id} />)}
                                        </datalist>
                                        <Input
                                            className="h-10 md:h-8 text-sm md:text-xs"
                                            placeholder="Nome do produto..."
                                            list="products-list"
                                            value={newItem.productName}
                                            onChange={e => {
                                                const val = e.target.value;
                                                const match = (products as any[]).find((p: any) => p.name === val);
                                                if (match) {
                                                    handleProductSelect(match.id);
                                                } else {
                                                    setNewItem(prev => ({ ...prev, productName: val, productId: "", productCode: "" }));
                                                }
                                            }}
                                        />
                                        {newItem.productId && (() => {
                                            const avail = (availableByProduct as any[]).find((a: any) => a.productId === newItem.productId);
                                            if (!avail) return null;
                                            const qty = parseFloat(avail.available);
                                            return (
                                                <span className={`text-xs mt-0.5 block ${qty < 0 ? "text-red-500" : qty === 0 ? "text-slate-400" : "text-green-600"}`}>
                                                    Disp: {qty.toLocaleString("es-PY", { minimumFractionDigits: 2 })} {avail.unit}
                                                </span>
                                            );
                                        })()}
                                    </div>
                                    <div className="col-span-1 md:col-span-2">
                                        <Label className="md:hidden text-xs">Qtd</Label>
                                        <Input className="h-10 md:h-8 text-sm md:text-xs" type="number" step="0.01" placeholder="Qtd" value={newItem.quantity} onChange={e => setNewItem(p => ({ ...p, quantity: e.target.value }))} />
                                        {newItem.productId && newItem.quantity && (() => {
                                            const avail = (availableByProduct as any[]).find((a: any) => a.productId === newItem.productId);
                                            if (!avail) return null;
                                            const excede = parseFloat(newItem.quantity) > parseFloat(avail.available);
                                            return excede ? <span className="text-xs text-orange-500 block mt-0.5">Acima</span> : null;
                                        })()}
                                    </div>
                                    <div className="col-span-1 md:col-span-1">
                                        <Label className="md:hidden text-xs">Un</Label>
                                        <Input className="h-10 md:h-8 text-sm md:text-xs" placeholder="Un" value={newItem.unit} onChange={e => setNewItem(p => ({ ...p, unit: e.target.value }))} />
                                    </div>
                                    <div className="col-span-1 md:col-span-2">
                                        <Label className="md:hidden text-xs">Preço U$</Label>
                                        <Input className="h-10 md:h-8 text-sm md:text-xs" type="number" step="0.01" placeholder="Preço" value={newItem.unitPriceUsd} onChange={e => setNewItem(p => ({ ...p, unitPriceUsd: e.target.value }))} />
                                    </div>
                                    <div className="hidden md:block col-span-2 text-xs text-slate-500 text-right">
                                        {newItem.quantity && newItem.unitPriceUsd ? (parseFloat(newItem.quantity) * parseFloat(newItem.unitPriceUsd)).toLocaleString("es-PY", { minimumFractionDigits: 2 }) : "—"}
                                    </div>
                                    <div className="col-span-1 md:col-span-1">
                                        <Button size="sm" variant="outline" className="h-10 md:h-8 w-full border-blue-200 text-blue-600" onClick={handleAddItem}>
                                            <Plus className="h-4 w-4 md:h-3 md:w-3" />
                                        </Button>
                                    </div>
                                </div>
                                {orderItems.length === 0 && (
                                    <p className="text-xs text-slate-400 text-center pt-2">Selecione o produto, preencha os dados e clique no +</p>
                                )}
                                {orderItems.length > 0 && (
                                    <div className="text-right text-base text-blue-600 font-semibold border-t pt-3 pb-1 mt-3">
                                        Total do Pedido: $ {totalUsd.toLocaleString("es-PY", { minimumFractionDigits: 2 })}
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2 justify-between md:justify-end pt-4 border-t mt-4">
                                <Button variant="outline" onClick={() => setFormTab("dados")}>Voltar</Button>
                                <Button
                                    className="bg-blue-600 hover:bg-blue-700"
                                    disabled={!form.clientId || orderItems.length === 0 || createOrder.isPending}
                                    onClick={() => createOrder.mutate({ ...form, items: orderItems.map(i => ({ ...i, totalPriceUsd: i.totalPriceUsd })) })}
                                >
                                    {createOrder.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                    Salvar Pedido
                                </Button>
                            </div>
                        </TabsContent>
                    </Tabs>
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
