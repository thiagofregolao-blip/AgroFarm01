import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/format-currency";
import { onEnterNext } from "@/lib/enter-navigation";
import { useAuth } from "@/hooks/use-auth";
import FarmLayout from "@/components/fazenda/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Receipt, Loader2, AlertTriangle, CheckCircle, Clock, Download, CheckSquare, PlusCircle, Trash2, Pencil, History, Search, CreditCard, RefreshCw } from "lucide-react";

// ─── CSV export utility ──────────────────────────────────────────────────────
function exportToCSV(data: any[], filename: string) {
    if (!data.length) return;
    const headers = ["Fornecedor", "Descricao", "Parcela", "Vencimento", "Status", "Valor Total", "Pago"];
    const rows = data.map((i: any) => [
        i.supplier,
        i.description || "",
        `${i.installmentNumber}/${i.totalInstallments}`,
        new Date(i.dueDate).toLocaleDateString("pt-BR"),
        i.status,
        formatCurrency(i.totalAmount, i.currency || "USD"),
        formatCurrency(i.paidAmount || 0, i.currency || "USD"),
    ]);
    const csv = [headers, ...rows].map(r => r.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}

export default function AccountsPayable() {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [editingItem, setEditingItem] = useState<any>(null);
    const { user } = useAuth();
    const backfillDone = useRef(false);

    // ─── Filters ───────────────────────────────────────────────────────────
    const [pageSize, setPageSize] = useState(15);
    const [filterStatus, setFilterStatus] = useState("todos");
    const [filterFrom, setFilterFrom] = useState("");
    const [filterTo, setFilterTo] = useState("");
    const [filterSupplier, setFilterSupplier] = useState("todos");
    const [filterSeason, setFilterSeason] = useState("todos");

    const { data: items = [], isLoading } = useQuery({
        queryKey: ["/api/farm/accounts-payable"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/accounts-payable"); return r.json(); },
        enabled: !!user,
    });

    // Auto-backfill
    useEffect(() => {
        if (!user || backfillDone.current) return;
        backfillDone.current = true;
        apiRequest("POST", "/api/farm/accounts-payable/backfill-invoices")
            .then(r => r.json())
            .then(result => { if (result.created > 0) queryClient.invalidateQueries({ queryKey: ["/api/farm/accounts-payable"] }); })
            .catch(() => { });
    }, [user]);

    const { data: accounts = [] } = useQuery({
        queryKey: ["/api/farm/cash-accounts"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/cash-accounts"); return r.json(); },
        enabled: !!user,
    });

    const { data: seasons = [] } = useQuery({
        queryKey: ["/api/farm/seasons"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/seasons"); return r.json(); },
        enabled: !!user,
    });

    const { data: suppliers = [] } = useQuery({
        queryKey: ["/api/farm/suppliers"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/suppliers"); return r.json(); },
        enabled: !!user,
    });

    // Compare date-only (strip time) to avoid timezone false-overdue
    function isItemOverdue(item: any) {
        if (item.status === "pago") return false;
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const due = new Date(item.dueDate); due.setHours(0, 0, 0, 0);
        return (item.status === "aberto" || item.status === "parcial") && due < today;
    }

    // ─── Filtered list ─────────────────────────────────────────────────────
    const filtered = (items as any[]).filter((i: any) => {
        const overdue = isItemOverdue(i);
        const statusCheck =
            filterStatus === "todos" ? true :
            filterStatus === "vencido" ? overdue :
            i.status === filterStatus;
        const dateCheck =
            (!filterFrom || new Date(i.dueDate) >= new Date(filterFrom)) &&
            (!filterTo || new Date(i.dueDate) <= new Date(filterTo));
        const supplierCheck = filterSupplier === "todos" || i.supplier === filterSupplier;
        const seasonCheck = filterSeason === "todos" || String(i.season_id || i.seasonId || "") === filterSeason;
        return statusCheck && dateCheck && supplierCheck && seasonCheck;
    });

    const totalAberto = (items as any[]).filter((i: any) => i.status === "aberto" || i.status === "parcial")
        .reduce((s: number, i: any) => s + parseFloat(i.totalAmount) - parseFloat(i.paidAmount || 0), 0);
    const totalVencido = (items as any[]).filter((i: any) => isItemOverdue(i))
        .reduce((s: number, i: any) => s + parseFloat(i.totalAmount) - parseFloat(i.paidAmount || 0), 0);

    const pay = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: any }) => {
            const result = await apiRequest("POST", `/api/farm/accounts-payable/${id}/pay`, data);
            if (data.cheque && data.paymentMethod === "cheque") {
                await apiRequest("POST", "/api/farm/cheques", {
                    banco: data.cheque.banco,
                    numero: data.cheque.numero,
                    tipo: data.cheque.tipo,
                    valor: data.amount,
                    fornecedor: data.supplier || "",
                    accountPayableId: id,
                    accountId: data.accountId || (data.accountRows?.[0]?.accountId),
                });
            }
            return result;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/accounts-payable"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/cash-accounts"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/cash-transactions"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/cash-summary"] });
            toast({ title: "Pagamento registrado no Fluxo de Caixa!" });
        },
    });

    const del = useMutation({
        mutationFn: async (id: string) => apiRequest("DELETE", `/api/farm/accounts-payable/${id}`),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/farm/accounts-payable"] }); toast({ title: "Removido" }); },
    });

    const editMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: any }) => apiRequest("PUT", `/api/farm/accounts-payable/${id}`, data),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/farm/accounts-payable"] }); toast({ title: "Atualizado" }); setEditingItem(null); },
        onError: () => toast({ title: "Erro ao atualizar", variant: "destructive" }),
    });

    const statusBadge = (s: string) => {
        const map: any = {
            aberto: { bg: "bg-blue-100 text-blue-700", icon: <Clock className="h-3 w-3" />, label: "Aberto" },
            parcial: { bg: "bg-amber-100 text-amber-700", icon: <AlertTriangle className="h-3 w-3" />, label: "Parcial" },
            pago: { bg: "bg-green-100 text-green-700", icon: <CheckCircle className="h-3 w-3" />, label: "Pago" },
            vencido: { bg: "bg-red-100 text-red-700", icon: <AlertTriangle className="h-3 w-3" />, label: "Vencido" },
        };
        const cfg = map[s] || map.aberto;
        return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg}`}>{cfg.icon} {cfg.label}</span>;
    };

    return (
        <FarmLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-emerald-800">Contas a Pagar</h1>
                        <p className="text-sm text-emerald-600">
                            A pagar: <strong className="text-red-600">{formatCurrency(totalAberto)}</strong>
                            {totalVencido > 0 && <span className="ml-2 text-red-600">Vencido: {formatCurrency(totalVencido)}</span>}
                        </p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        <Button variant="outline" size="sm" className="border-emerald-200 text-emerald-700" onClick={() => queryClient.invalidateQueries()}>
                            <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
                        </Button>
                        <Button variant="outline" className="border-emerald-200 text-emerald-700" onClick={() => exportToCSV(filtered, "contas-a-pagar.csv")}>
                            <Download className="mr-2 h-4 w-4" /> Exportar CSV
                        </Button>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        { label: "Total em Aberto", value: totalAberto, color: "text-blue-700" },
                        { label: "Vencidos", value: totalVencido, color: "text-red-600" },
                        { label: "Total de Titulos", value: (items as any[]).length, color: "text-gray-700", isCurrency: false },
                        { label: "Pagos", value: (items as any[]).filter((i: any) => i.status === "pago").length, color: "text-green-700", isCurrency: false },
                    ].map((c, idx) => (
                        <Card key={idx} className="border-emerald-100"><CardContent className="p-4">
                            <p className="text-xs text-gray-500">{c.label}</p>
                            <p className={`text-xl font-bold ${c.color}`}>
                                {c.isCurrency !== false ? formatCurrency(c.value as number) : c.value}
                            </p>
                        </CardContent></Card>
                    ))}
                </div>

                {/* Tabs: Contas / Pagamento / Historico */}
                <Tabs defaultValue="contas">
                    <TabsList className="bg-emerald-50 border border-emerald-200 p-1 h-10">
                        <TabsTrigger value="contas" className="text-sm font-semibold data-[state=active]:bg-emerald-600 data-[state=active]:text-white px-5">Contas</TabsTrigger>
                        <TabsTrigger value="pagamento" className="text-sm font-semibold data-[state=active]:bg-emerald-600 data-[state=active]:text-white px-5">Pagamento</TabsTrigger>
                        <TabsTrigger value="historico" className="text-sm font-semibold data-[state=active]:bg-emerald-600 data-[state=active]:text-white px-5">Historico</TabsTrigger>
                    </TabsList>

                    {/* ── CONTAS TAB ─────────────────────────────────────────── */}
                    <TabsContent value="contas" className="space-y-4 mt-4">
                        {/* Filters */}
                        <Card className="border-emerald-100">
                            <CardContent className="p-4">
                                <div className="flex flex-wrap gap-3 items-end">
                                    <div>
                                        <Label className="text-xs text-gray-500">Status</Label>
                                        <Select value={filterStatus} onValueChange={setFilterStatus}>
                                            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="todos">Todos</SelectItem>
                                                <SelectItem value="aberto">Aberto</SelectItem>
                                                <SelectItem value="parcial">Parcial</SelectItem>
                                                <SelectItem value="pago">Pago</SelectItem>
                                                <SelectItem value="vencido">Vencido</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label className="text-xs text-gray-500">Vencimento de</Label>
                                        <Input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} className="w-36" />
                                    </div>
                                    <div>
                                        <Label className="text-xs text-gray-500">ate</Label>
                                        <Input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} className="w-36" />
                                    </div>
                                    <div>
                                        <Label className="text-xs text-gray-500">Fornecedor</Label>
                                        <Select value={filterSupplier} onValueChange={setFilterSupplier}>
                                            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="todos">Todos</SelectItem>
                                                {(suppliers as any[]).map((s: any) => (
                                                    <SelectItem key={s.id || s.name} value={s.name}>{s.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label className="text-xs text-gray-500">Safra</Label>
                                        <Select value={filterSeason} onValueChange={setFilterSeason}>
                                            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="todos">Todas</SelectItem>
                                                {(seasons as any[]).map((s: any) => (
                                                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <Button variant="ghost" size="sm" className="text-gray-500" onClick={() => { setFilterStatus("todos"); setFilterFrom(""); setFilterTo(""); setFilterSupplier("todos"); setFilterSeason("todos"); }}>
                                        Limpar
                                    </Button>
                                    <span className="text-xs text-gray-400 ml-auto self-center">{filtered.length} de {(items as any[]).length} registros</span>
                                </div>
                            </CardContent>
                        </Card>

                        {isLoading ? (
                            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
                        ) : filtered.length === 0 ? (
                            <Card className="border-emerald-100"><CardContent className="py-12 text-center">
                                <Receipt className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                                <p className="text-gray-500">Nenhuma conta a pagar</p>
                            </CardContent></Card>
                        ) : (
                            <div className="bg-white rounded-xl border border-emerald-100 overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-emerald-50">
                                        <tr>
                                            <th className="text-left p-3 font-semibold text-emerald-800">Fornecedor</th>
                                            <th className="text-left p-3 font-semibold text-emerald-800">Descricao</th>
                                            <th className="text-left p-3 font-semibold text-emerald-800">Parcela</th>
                                            <th className="text-left p-3 font-semibold text-emerald-800">Vencimento</th>
                                            <th className="text-left p-3 font-semibold text-emerald-800">Status</th>
                                            <th className="text-right p-3 font-semibold text-emerald-800">Valor</th>
                                            <th className="text-right p-3 font-semibold text-emerald-800">Pago</th>
                                            <th className="p-3"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.slice(0, pageSize).map((item: any) => {
                                            const due = new Date(item.dueDate); due.setHours(0, 0, 0, 0);
                                            const today = new Date(); today.setHours(0, 0, 0, 0);
                                            const isOverdue = (item.status === "aberto" || item.status === "parcial") && due < today;
                                            return (
                                                <tr key={item.id} className={`border-t border-gray-100 ${isOverdue ? "bg-red-50" : ""}`}>
                                                    <td className="p-3 font-medium">{item.supplier}</td>
                                                    <td className="p-3 text-gray-600 max-w-[200px] truncate">{item.description || "--"}</td>
                                                    <td className="p-3">{item.installmentNumber}/{item.totalInstallments}</td>
                                                    <td className="p-3">{new Date(item.dueDate).toLocaleDateString("pt-BR")}</td>
                                                    <td className="p-3">{statusBadge(isOverdue && item.status !== "pago" ? "vencido" : item.status)}</td>
                                                    <td className="text-right p-3 font-mono font-semibold">{formatCurrency(item.totalAmount, item.currency || "USD")}</td>
                                                    <td className="text-right p-3 font-mono text-green-600">{formatCurrency(item.paidAmount || 0, item.currency || "USD")}</td>
                                                    <td className="p-3 flex gap-1">
                                                        {item.status !== "pago" && (
                                                            <>
                                                                <Button variant="outline" size="sm" className="h-7 text-xs border-blue-200 text-blue-600 hover:bg-blue-50"
                                                                    onClick={() => setEditingItem(item)}>
                                                                    <Pencil className="h-3 w-3 mr-1" />Editar
                                                                </Button>
                                                                <Button variant="ghost" size="sm" className="text-red-500 h-7 text-xs"
                                                                    onClick={() => { if (confirm(`Remover conta "${item.supplier}" - ${formatCurrency(item.totalAmount, item.currency || "USD")}?`)) del.mutate(item.id); }}
                                                                    aria-label="Remover">
                                                                    <Trash2 className="h-3 w-3" />
                                                                </Button>
                                                            </>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                                {filtered.length > pageSize && (
                                    <div className="flex items-center justify-center gap-3 p-3 border-t border-gray-100">
                                        <span className="text-xs text-gray-400">Mostrando {pageSize} de {filtered.length}</span>
                                        <Select value={String(pageSize)} onValueChange={v => setPageSize(parseInt(v))}>
                                            <SelectTrigger className="w-24 h-7 text-xs"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="15">15</SelectItem>
                                                <SelectItem value="30">30</SelectItem>
                                                <SelectItem value="50">50</SelectItem>
                                                <SelectItem value="100">100</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </div>
                        )}
                    </TabsContent>

                    {/* ── PAGAMENTO TAB ──────────────────────────────────────── */}
                    <TabsContent value="pagamento" className="space-y-4 mt-4">
                        <PagamentoTab
                            items={items as any[]}
                            accounts={accounts as any[]}
                            seasons={seasons as any[]}
                            onPay={(id, data) => pay.mutate({ id, data })}
                            paying={pay.isPending}
                        />
                    </TabsContent>

                    {/* ── HISTORICO TAB ──────────────────────────────────────── */}
                    <TabsContent value="historico" className="mt-4">
                        <HistoricoTab items={items as any[]} />
                    </TabsContent>
                </Tabs>

                {/* Edit Dialog */}
                <Dialog open={!!editingItem} onOpenChange={(o) => !o && setEditingItem(null)}>
                    <DialogContent className="max-w-md">
                        <DialogHeader><DialogTitle>Editar Conta a Pagar</DialogTitle></DialogHeader>
                        {editingItem && <EditAPForm item={editingItem} seasons={seasons}
                            onSave={(data: any) => editMutation.mutate({ id: editingItem.id, data })}
                            saving={editMutation.isPending} />}
                    </DialogContent>
                </Dialog>
            </div>
        </FarmLayout>
    );
}

// ─── Pagamento Tab ────────────────────────────────────────────────────────────
function PagamentoTab({ items, accounts, seasons, onPay, paying }: {
    items: any[]; accounts: any[]; seasons: any[]; onPay: (id: string, data: any) => void; paying: boolean;
}) {
    const [searchTerm, setSearchTerm] = useState("");
    const [filterDateFrom, setFilterDateFrom] = useState("");
    const [filterDateTo, setFilterDateTo] = useState("");
    const [filterSeason, setFilterSeason] = useState("todos");
    const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
    const [payModalOpen, setPayModalOpen] = useState(false);

    // Payment modal state
    const [paymentRows, setPaymentRows] = useState<{ accountId: string; amount: string; paymentMethod: string }[]>([
        { accountId: "", amount: "", paymentMethod: "transferencia" },
    ]);
    const [chequeBanco, setChequeBanco] = useState("");
    const [chequeNumero, setChequeNumero] = useState("");
    const [chequeTipo, setChequeTipo] = useState("proprio");

    // Filter pending items
    const pendingItems = items.filter((i: any) => i.status !== "pago");
    const filteredPending = pendingItems.filter((i: any) => {
        const termMatch = !searchTerm ||
            i.supplier?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            i.description?.toLowerCase().includes(searchTerm.toLowerCase());
        const dateFromMatch = !filterDateFrom || new Date(i.dueDate) >= new Date(filterDateFrom);
        const dateToMatch = !filterDateTo || new Date(i.dueDate) <= new Date(filterDateTo);
        const seasonMatch = filterSeason === "todos" || String(i.season_id || i.seasonId || "") === filterSeason;
        return termMatch && dateFromMatch && dateToMatch && seasonMatch;
    });

    const checkedItems = filteredPending.filter((i: any) => checkedIds.has(i.id));
    const totalChecked = checkedItems.reduce((s: number, i: any) =>
        s + parseFloat(i.totalAmount) - parseFloat(i.paidAmount || 0), 0
    );

    const toggleCheck = (id: string) => {
        setCheckedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        if (checkedIds.size === filteredPending.length) {
            setCheckedIds(new Set());
        } else {
            setCheckedIds(new Set(filteredPending.map((i: any) => i.id)));
        }
    };

    const totalAllocated = paymentRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const allRowsValid = paymentRows.every(r => r.accountId && parseFloat(r.amount) > 0);
    const hasChequeMethod = paymentRows.some(r => r.paymentMethod === "cheque");

    const addRow = () => setPaymentRows(prev => [...prev, { accountId: "", amount: "", paymentMethod: "transferencia" }]);
    const removeRow = (idx: number) => { if (paymentRows.length > 1) setPaymentRows(prev => prev.filter((_, i) => i !== idx)); };
    const updateRow = (idx: number, field: string, value: string) => {
        setPaymentRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
    };

    function openPayModal() {
        setPaymentRows([{ accountId: "", amount: totalChecked.toFixed(2), paymentMethod: "transferencia" }]);
        setChequeBanco(""); setChequeNumero(""); setChequeTipo("proprio");
        setPayModalOpen(true);
    }

    async function handleConfirmPayment() {
        if (checkedIds.size === 0 || !allRowsValid) return;

        // Total the user actually wants to pay across all selected items
        const totalToPay = totalAllocated;
        // Sum of remaining balances of all selected items
        const totalRemaining = checkedItems.reduce((s: number, i: any) =>
            s + parseFloat(i.totalAmount) - parseFloat(i.paidAmount || 0), 0);

        for (const item of checkedItems) {
            const itemRemaining = parseFloat(item.totalAmount) - parseFloat(item.paidAmount || 0);
            // Proportional share of totalToPay for this item, capped at item's remaining balance
            const proportion = totalRemaining > 0 ? itemRemaining / totalRemaining : 0;
            const itemPayAmount = Math.min(itemRemaining, totalToPay * proportion);

            const payload: any = {
                accountId: paymentRows[0].accountId,
                amount: itemPayAmount.toFixed(2),
                paymentMethod: paymentRows[0].paymentMethod,
                supplier: item.supplier,
                // For multi-account split, distribute each item's share proportionally across accounts
                accountRows: paymentRows.length > 1 ? paymentRows.map(r => ({
                    accountId: r.accountId,
                    amount: (itemPayAmount * (parseFloat(r.amount) / totalToPay)).toFixed(2),
                })) : undefined,
            };
            if (hasChequeMethod && chequeBanco && chequeNumero) {
                payload.cheque = { banco: chequeBanco, numero: chequeNumero, tipo: chequeTipo };
            }
            onPay(item.id, payload);
        }
        setCheckedIds(new Set());
        setPayModalOpen(false);
    }

    const isOverdue = (item: any) => {
        if (item.status === "pago") return false;
        const due = new Date(item.dueDate); due.setHours(0, 0, 0, 0);
        const today = new Date(); today.setHours(0, 0, 0, 0);
        return (item.status === "aberto" || item.status === "parcial") && due < today;
    };

    return (
        <>
            {/* Filters + Pay button */}
            <Card className="border-emerald-100">
                <CardContent className="p-4">
                    <div className="flex flex-wrap gap-3 items-end">
                        <div className="flex-1 min-w-[200px]">
                            <Label className="text-xs text-gray-500">Buscar</Label>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                                <Input
                                    placeholder="Fornecedor ou descricao..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                        </div>
                        <div>
                            <Label className="text-xs text-gray-500">Vencimento de</Label>
                            <Input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="w-36" />
                        </div>
                        <div>
                            <Label className="text-xs text-gray-500">ate</Label>
                            <Input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="w-36" />
                        </div>
                        <div>
                            <Label className="text-xs text-gray-500">Safra</Label>
                            <Select value={filterSeason} onValueChange={setFilterSeason}>
                                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todos">Todas</SelectItem>
                                    {seasons.map((s: any) => (
                                        <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button
                            className="bg-green-600 hover:bg-green-700"
                            disabled={checkedIds.size === 0}
                            onClick={openPayModal}
                        >
                            <CreditCard className="mr-2 h-4 w-4" />
                            Realizar Pagamento {checkedIds.size > 0 && `(${checkedIds.size})`}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Pending items list with checkboxes */}
            {filteredPending.length === 0 ? (
                <Card className="border-emerald-100"><CardContent className="py-12 text-center">
                    <Receipt className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">Nenhuma conta pendente encontrada</p>
                </CardContent></Card>
            ) : (
                <div className="bg-white rounded-xl border border-emerald-100 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-emerald-50">
                            <tr>
                                <th className="p-3 w-10">
                                    <input
                                        type="checkbox"
                                        className="rounded"
                                        checked={checkedIds.size === filteredPending.length && filteredPending.length > 0}
                                        onChange={toggleAll}
                                    />
                                </th>
                                <th className="text-left p-3 font-semibold text-emerald-800">Fornecedor</th>
                                <th className="text-left p-3 font-semibold text-emerald-800">Descricao</th>
                                <th className="text-left p-3 font-semibold text-emerald-800">Parcela</th>
                                <th className="text-left p-3 font-semibold text-emerald-800">Vencimento</th>
                                <th className="text-left p-3 font-semibold text-emerald-800">Status</th>
                                <th className="text-right p-3 font-semibold text-emerald-800">Saldo</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredPending.map((item: any) => {
                                const remaining = parseFloat(item.totalAmount) - parseFloat(item.paidAmount || 0);
                                const overdue = isOverdue(item);
                                return (
                                    <tr
                                        key={item.id}
                                        className={`border-t border-gray-100 cursor-pointer transition-colors ${checkedIds.has(item.id) ? "bg-amber-50" : overdue ? "bg-red-50 hover:bg-red-100" : "hover:bg-gray-50"}`}
                                        onClick={() => toggleCheck(item.id)}
                                    >
                                        <td className="p-3" onClick={e => e.stopPropagation()}>
                                            <input type="checkbox" className="rounded" checked={checkedIds.has(item.id)} onChange={() => toggleCheck(item.id)} />
                                        </td>
                                        <td className="p-3 font-medium">{item.supplier}</td>
                                        <td className="p-3 text-gray-600 max-w-[200px] truncate">{item.description || "--"}</td>
                                        <td className="p-3">{item.installmentNumber}/{item.totalInstallments}</td>
                                        <td className="p-3">{new Date(item.dueDate).toLocaleDateString("pt-BR")}</td>
                                        <td className="p-3">
                                            {overdue
                                                ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700"><AlertTriangle className="h-3 w-3" /> Vencido</span>
                                                : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700"><Clock className="h-3 w-3" /> {item.status === "parcial" ? "Parcial" : "Aberto"}</span>
                                            }
                                        </td>
                                        <td className="text-right p-3 font-mono font-semibold text-red-600">{formatCurrency(remaining, item.currency || "USD")}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {checkedIds.size > 0 && (
                        <div className="flex items-center justify-between px-4 py-3 bg-amber-50 border-t border-amber-200">
                            <span className="text-sm font-medium text-amber-800">{checkedIds.size} conta(s) selecionada(s)</span>
                            <span className="text-sm font-bold text-amber-800">Total: {formatCurrency(totalChecked)}</span>
                        </div>
                    )}
                </div>
            )}

            {/* Payment Modal */}
            <Dialog open={payModalOpen} onOpenChange={setPayModalOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
                    <DialogHeader className="px-6 pt-5 pb-3 border-b">
                        <DialogTitle>Realizar Pagamento</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                        {/* Resumo das contas selecionadas */}
                        <div className="bg-gray-50 rounded-lg border p-3">
                            <p className="text-xs font-semibold text-gray-500 mb-2">Contas selecionadas ({checkedItems.length})</p>
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                                {checkedItems.map((item: any) => {
                                    const remaining = parseFloat(item.totalAmount) - parseFloat(item.paidAmount || 0);
                                    return (
                                        <div key={item.id} className="flex items-center justify-between text-sm">
                                            <span className="text-gray-700">{item.supplier} - {item.description || "Sem descricao"} ({item.installmentNumber}/{item.totalInstallments})</span>
                                            <span className="font-mono font-semibold text-red-600">{formatCurrency(remaining, item.currency || "USD")}</span>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
                                <span className="text-sm font-bold text-gray-800">Total a pagar</span>
                                <span className="text-lg font-bold text-red-600">{formatCurrency(totalChecked)}</span>
                            </div>
                        </div>

                        {/* Forma de pagamento */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label className="font-semibold text-emerald-800">Forma de Pagamento</Label>
                                <Button type="button" variant="outline" size="sm" className="h-7 text-xs border-emerald-200 text-emerald-700" onClick={addRow}>
                                    <PlusCircle className="mr-1 h-3 w-3" /> Adicionar metodo
                                </Button>
                            </div>
                            {paymentRows.map((row, idx) => (
                                <div key={idx} className="grid grid-cols-3 gap-3 items-end">
                                    <div>
                                        <Label className="text-xs text-gray-500">Conta Bancaria *</Label>
                                        <Select value={row.accountId} onValueChange={v => updateRow(idx, "accountId", v)}>
                                            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                            <SelectContent>
                                                {accounts.map((a: any) => (
                                                    <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label className="text-xs text-gray-500">Valor *</Label>
                                        <CurrencyInput value={row.amount} onValueChange={v => updateRow(idx, "amount", v)} />
                                    </div>
                                    <div className="flex gap-2 items-end">
                                        <div className="flex-1">
                                            <Label className="text-xs text-gray-500">Metodo</Label>
                                            <Select value={row.paymentMethod} onValueChange={v => updateRow(idx, "paymentMethod", v)}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="transferencia">Transferencia</SelectItem>
                                                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                                                    <SelectItem value="cheque">Cheque</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        {paymentRows.length > 1 && (
                                            <Button type="button" variant="ghost" size="sm" className="text-red-400 hover:text-red-600 h-10" onClick={() => removeRow(idx)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Cheque fields */}
                        {hasChequeMethod && (
                            <div className="grid grid-cols-3 gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                                <div><Label className="text-xs text-blue-700">Banco *</Label><Input value={chequeBanco} onChange={e => setChequeBanco(e.target.value)} placeholder="Nome do banco" /></div>
                                <div><Label className="text-xs text-blue-700">Numero *</Label><Input value={chequeNumero} onChange={e => setChequeNumero(e.target.value)} placeholder="000000" /></div>
                                <div><Label className="text-xs text-blue-700">Tipo</Label>
                                    <Select value={chequeTipo} onValueChange={setChequeTipo}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="proprio">Proprio</SelectItem>
                                            <SelectItem value="terceiro">Terceiro</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        )}

                        {paymentRows.length > 1 && (
                            <p className={`text-xs font-medium ${Math.abs(totalAllocated - totalChecked) < 0.01 ? "text-green-600" : "text-amber-600"}`}>
                                Total alocado: {formatCurrency(totalAllocated)} / Total selecionado: {formatCurrency(totalChecked)}
                            </p>
                        )}
                    </div>

                    {/* Footer fixo */}
                    <div className="px-6 py-3 border-t bg-gray-50 flex items-center justify-end gap-3">
                        <Button variant="outline" onClick={() => setPayModalOpen(false)}>Cancelar</Button>
                        <Button
                            className="bg-green-600 hover:bg-green-700"
                            disabled={paying || !allRowsValid || checkedIds.size === 0 || (hasChequeMethod && (!chequeBanco || !chequeNumero))}
                            onClick={handleConfirmPayment}
                        >
                            {paying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckSquare className="mr-2 h-4 w-4" />}
                            Confirmar Pagamento ({checkedIds.size} conta(s))
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

// ─── Historico Tab ────────────────────────────────────────────────────────────
function HistoricoTab({ items }: { items: any[] }) {
    const [searchTerm, setSearchTerm] = useState("");
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    const paidItems = items
        .filter((i: any) => i.status === "pago")
        .sort((a: any, b: any) => new Date(b.paidDate || b.updatedAt || b.dueDate).getTime() - new Date(a.paidDate || a.updatedAt || a.dueDate).getTime());

    const filteredPaid = paidItems.filter((i: any) =>
        !searchTerm || i.supplier?.toLowerCase().includes(searchTerm.toLowerCase()) || i.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Group by date + supplier (same-batch payments)
    const groups: { key: string; date: string; supplier: string; items: any[]; total: number; currency: string }[] = [];
    const groupMap = new Map<string, typeof groups[0]>();
    for (const item of filteredPaid) {
        const dateStr = new Date(item.paidDate || item.updatedAt || item.dueDate).toLocaleDateString("pt-BR");
        const key = `${dateStr}|${item.supplier}`;
        if (!groupMap.has(key)) {
            const g = { key, date: dateStr, supplier: item.supplier, items: [], total: 0, currency: item.currency || "USD" };
            groupMap.set(key, g);
            groups.push(g);
        }
        const g = groupMap.get(key)!;
        g.items.push(item);
        g.total += parseFloat(item.paidAmount || item.totalAmount || 0);
    }

    const toggleGroup = (key: string) => setExpandedGroups(prev => {
        const next = new Set(prev);
        next.has(key) ? next.delete(key) : next.add(key);
        return next;
    });

    return (
        <div className="space-y-4">
            <Card className="border-emerald-100">
                <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Buscar no historico..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <span className="text-xs text-gray-400">{groups.length} grupo(s) / {filteredPaid.length} pagamento(s)</span>
                    </div>
                </CardContent>
            </Card>

            {groups.length === 0 ? (
                <Card className="border-emerald-100"><CardContent className="py-12 text-center">
                    <History className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">Nenhum pagamento registrado</p>
                </CardContent></Card>
            ) : (
                <div className="space-y-2">
                    {groups.map(group => (
                        <Card key={group.key} className="border-emerald-100 overflow-hidden">
                            <div
                                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                                onClick={() => toggleGroup(group.key)}
                            >
                                <div className="flex items-center gap-3">
                                    <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
                                    <div>
                                        <p className="font-semibold text-gray-800">{group.supplier}</p>
                                        <p className="text-xs text-gray-500">{group.date} · {group.items.length} titulo(s)</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="font-mono font-bold text-green-600 text-sm">{formatCurrency(group.total, group.currency)}</span>
                                    <span className="text-xs text-gray-400">{expandedGroups.has(group.key) ? "▲" : "▼"}</span>
                                </div>
                            </div>
                            {expandedGroups.has(group.key) && (
                                <div className="border-t border-gray-100">
                                    <table className="w-full text-sm">
                                        <tbody>
                                            {group.items.map((item: any) => (
                                                <tr key={item.id} className="border-t border-gray-50">
                                                    <td className="px-4 py-2 text-gray-600 max-w-[250px] truncate">{item.description || "--"}</td>
                                                    <td className="px-4 py-2 text-gray-500">{item.installmentNumber}/{item.totalInstallments}</td>
                                                    <td className="text-right px-4 py-2 font-mono text-green-600">{formatCurrency(item.paidAmount || item.totalAmount, item.currency || "USD")}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}

function EditAPForm({ item, seasons, onSave, saving }: any) {
    const [supplier, setSupplier] = useState(item.supplier || "");
    const [description, setDescription] = useState(item.description || "");
    const [totalAmount, setTotalAmount] = useState(String(item.totalAmount || ""));
    const [dueDate, setDueDate] = useState(item.dueDate ? new Date(item.dueDate).toISOString().split("T")[0] : "");
    const [seasonId, setSeasonId] = useState(String(item.seasonId || item.season_id || "__none__"));

    const handleSave = () => {
        if (!supplier || !totalAmount || !dueDate || saving) return;
        onSave({ supplier, description, totalAmount, dueDate, seasonId: seasonId === "__none__" ? null : seasonId || null });
    };

    return (
        <div className="space-y-4" onKeyDown={onEnterNext as any}>
            <div><Label>Fornecedor *</Label><Input value={supplier} onChange={e => setSupplier(e.target.value)} /></div>
            <div><Label>Descricao</Label><Input value={description} onChange={e => setDescription(e.target.value)} /></div>
            <div><Label>Valor Total ($) *</Label><CurrencyInput value={totalAmount} onValueChange={setTotalAmount} /></div>
            <div><Label>Vencimento *</Label><Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></div>
            {(seasons || []).length > 0 && (
                <div>
                    <Label>Safra (opcional)</Label>
                    <Select value={String(seasonId)} onValueChange={setSeasonId}>
                        <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__none__">Nenhuma</SelectItem>
                            {seasons.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            )}
            <Button type="button" className="w-full bg-blue-600 hover:bg-blue-700" disabled={saving || !supplier || !totalAmount || !dueDate}
                onClick={handleSave}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Salvar Alteracoes"}
            </Button>
        </div>
    );
}
