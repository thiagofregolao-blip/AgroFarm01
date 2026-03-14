import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/format-currency";
import { useAuth } from "@/hooks/use-auth";
import FarmLayout from "@/components/fazenda/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Receipt, Loader2, AlertTriangle, CheckCircle, Clock, Download, CheckSquare, PlusCircle, Trash2, Pencil, History } from "lucide-react";

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

    // ─── Filtered list ─────────────────────────────────────────────────────
    const filtered = (items as any[]).filter((i: any) => {
        const today = new Date();
        const isOverdue = (i.status === "aberto" || i.status === "parcial") && new Date(i.dueDate) < today;
        const statusCheck =
            filterStatus === "todos" ? true :
            filterStatus === "vencido" ? isOverdue :
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
    const totalVencido = (items as any[]).filter((i: any) => (i.status === "aberto" || i.status === "parcial") && new Date(i.dueDate) < new Date())
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

                {/* Tabs: Contas / Pagamento */}
                <Tabs defaultValue="contas">
                    <TabsList className="bg-emerald-50 text-emerald-800">
                        <TabsTrigger value="contas">Contas</TabsTrigger>
                        <TabsTrigger value="pagamento">Pagamento</TabsTrigger>
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
                                        {filtered.map((item: any) => {
                                            const isOverdue = (item.status === "aberto" || item.status === "parcial") && new Date(item.dueDate) < new Date();
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
                                                            <Button variant="outline" size="sm" className="h-7 text-xs border-blue-200 text-blue-600 hover:bg-blue-50"
                                                                onClick={() => setEditingItem(item)}>
                                                                <Pencil className="h-3 w-3 mr-1" />Editar
                                                            </Button>
                                                        )}
                                                        <Button variant="ghost" size="sm" className="text-red-500 h-7 text-xs"
                                                            onClick={() => { if (confirm(`Remover conta "${item.supplier}" - ${formatCurrency(item.totalAmount, item.currency || "USD")}?`)) del.mutate(item.id); }}
                                                            aria-label="Remover">
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </TabsContent>

                    {/* ── PAGAMENTO TAB ──────────────────────────────────────── */}
                    <TabsContent value="pagamento" className="space-y-6 mt-4">
                        <PagamentoTab
                            items={items as any[]}
                            suppliers={suppliers as any[]}
                            accounts={accounts as any[]}
                            onPay={(id, data) => pay.mutate({ id, data })}
                            paying={pay.isPending}
                        />
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

// ─── Pagamento Tab Component ──────────────────────────────────────────────────
function PagamentoTab({ items, suppliers, accounts, onPay, paying }: {
    items: any[]; suppliers: any[]; accounts: any[]; onPay: (id: string, data: any) => void; paying: boolean;
}) {
    const [selectedSupplier, setSelectedSupplier] = useState("");
    const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
    const [paymentRows, setPaymentRows] = useState<{ accountId: string; amount: string; paymentMethod: string }[]>([
        { accountId: "", amount: "", paymentMethod: "transferencia" },
    ]);

    // Cheque fields
    const [chequeBanco, setChequeBanco] = useState("");
    const [chequeNumero, setChequeNumero] = useState("");
    const [chequeTipo, setChequeTipo] = useState("proprio");

    const pendingForSupplier = items.filter((i: any) =>
        i.supplier === selectedSupplier && i.status !== "pago"
    );

    const checkedItems = pendingForSupplier.filter((i: any) => checkedIds.has(i.id));
    const totalChecked = checkedItems.reduce((s: number, i: any) =>
        s + parseFloat(i.totalAmount) - parseFloat(i.paidAmount || 0), 0
    );

    const totalAllocated = paymentRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const allRowsValid = paymentRows.every(r => r.accountId && parseFloat(r.amount) > 0);
    const hasChequeMethod = paymentRows.some(r => r.paymentMethod === "cheque");

    const toggleCheck = (id: string) => {
        setCheckedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const addRow = () => setPaymentRows(prev => [...prev, { accountId: "", amount: "", paymentMethod: "transferencia" }]);
    const removeRow = (idx: number) => { if (paymentRows.length > 1) setPaymentRows(prev => prev.filter((_, i) => i !== idx)); };
    const updateRow = (idx: number, field: string, value: string) => {
        setPaymentRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
    };

    // Auto-fill total when items are checked
    const handleAutoFill = () => {
        if (paymentRows.length === 1) {
            setPaymentRows([{ ...paymentRows[0], amount: totalChecked.toFixed(2) }]);
        }
    };

    async function handleConfirmPayment() {
        if (checkedIds.size === 0 || !allRowsValid) return;
        for (const item of checkedItems) {
            const remaining = parseFloat(item.totalAmount) - parseFloat(item.paidAmount || 0);
            const payload: any = {
                accountId: paymentRows[0].accountId,
                amount: remaining.toFixed(2),
                paymentMethod: paymentRows[0].paymentMethod,
                supplier: item.supplier,
                accountRows: paymentRows.length > 1 ? paymentRows.map(r => ({
                    accountId: r.accountId,
                    amount: (remaining * (parseFloat(r.amount) / totalAllocated)).toFixed(2),
                })) : undefined,
            };
            if (hasChequeMethod && chequeBanco && chequeNumero) {
                payload.cheque = { banco: chequeBanco, numero: chequeNumero, tipo: chequeTipo };
            }
            onPay(item.id, payload);
        }
        setCheckedIds(new Set());
    }

    // Payment history: recently paid items
    const recentPaid = items
        .filter((i: any) => i.status === "pago")
        .sort((a: any, b: any) => new Date(b.updatedAt || b.dueDate).getTime() - new Date(a.updatedAt || a.dueDate).getTime())
        .slice(0, 10);

    return (
        <div className="space-y-6">
            {/* Supplier select */}
            <Card className="border-emerald-100">
                <CardContent className="p-4 space-y-4">
                    <div>
                        <Label className="font-semibold">Selecione o Fornecedor</Label>
                        <Select value={selectedSupplier} onValueChange={v => { setSelectedSupplier(v); setCheckedIds(new Set()); }}>
                            <SelectTrigger className="w-full max-w-md mt-1"><SelectValue placeholder="Selecione um fornecedor..." /></SelectTrigger>
                            <SelectContent>
                                {suppliers.map((s: any) => (
                                    <SelectItem key={s.id || s.name} value={s.name}>{s.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Pending accounts for supplier */}
                    {selectedSupplier && (
                        pendingForSupplier.length === 0 ? (
                            <p className="text-sm text-gray-500">Nenhuma conta pendente para este fornecedor.</p>
                        ) : (
                            <div className="space-y-2">
                                <p className="text-sm font-medium text-gray-700">{pendingForSupplier.length} conta(s) pendente(s):</p>
                                <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                                    {pendingForSupplier.map((item: any) => {
                                        const remaining = parseFloat(item.totalAmount) - parseFloat(item.paidAmount || 0);
                                        return (
                                            <label key={item.id} className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 ${checkedIds.has(item.id) ? "bg-amber-50" : ""}`}>
                                                <input type="checkbox" className="rounded" checked={checkedIds.has(item.id)} onChange={() => toggleCheck(item.id)} />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium">{item.description || "Sem descricao"}</p>
                                                    <p className="text-xs text-gray-500">
                                                        Parcela {item.installmentNumber}/{item.totalInstallments} - Venc: {new Date(item.dueDate).toLocaleDateString("pt-BR")}
                                                    </p>
                                                </div>
                                                <span className="text-sm font-mono font-semibold text-red-600">{formatCurrency(remaining, item.currency || "USD")}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                                {checkedIds.size > 0 && (
                                    <div className="flex items-center justify-between p-2 bg-amber-50 rounded-lg border border-amber-200">
                                        <span className="text-sm font-medium text-amber-800">{checkedIds.size} conta(s) selecionada(s)</span>
                                        <span className="text-sm font-bold text-amber-800">Total: {formatCurrency(totalChecked)}</span>
                                    </div>
                                )}
                            </div>
                        )
                    )}
                </CardContent>
            </Card>

            {/* Payment form */}
            {checkedIds.size > 0 && (
                <Card className="border-emerald-100">
                    <CardContent className="p-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <Label className="font-semibold text-emerald-800">Forma de Pagamento</Label>
                            <Button type="button" variant="outline" size="sm" className="h-7 text-xs border-emerald-200 text-emerald-700" onClick={addRow}>
                                <PlusCircle className="mr-1 h-3 w-3" /> Adicionar metodo
                            </Button>
                        </div>
                        {paymentRows.map((row, idx) => (
                            <div key={idx} className="p-3 border border-gray-200 rounded-lg space-y-2 bg-white">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-gray-500">Metodo {idx + 1}</span>
                                    {paymentRows.length > 1 && (
                                        <button type="button" onClick={() => removeRow(idx)} className="text-red-400 hover:text-red-600">
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <div>
                                        <Label className="text-xs">Conta Bancaria *</Label>
                                        <Select value={row.accountId} onValueChange={v => updateRow(idx, "accountId", v)}>
                                            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                            <SelectContent>
                                                {accounts.map((a: any) => (
                                                    <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label className="text-xs">Valor *</Label>
                                        <Input type="number" step="0.01" className="h-8 text-sm" value={row.amount} onChange={e => updateRow(idx, "amount", e.target.value)} placeholder="0.00" />
                                    </div>
                                    <div>
                                        <Label className="text-xs">Metodo</Label>
                                        <Select value={row.paymentMethod} onValueChange={v => updateRow(idx, "paymentMethod", v)}>
                                            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="transferencia">Transferencia</SelectItem>
                                                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                                                <SelectItem value="cheque">Cheque</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Cheque fields */}
                        {hasChequeMethod && (
                            <div className="space-y-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                                <p className="text-xs font-semibold text-blue-700">Dados do Cheque</p>
                                <div className="grid grid-cols-3 gap-2">
                                    <div><Label className="text-xs">Banco *</Label><Input className="h-8 text-sm" value={chequeBanco} onChange={e => setChequeBanco(e.target.value)} placeholder="Nome do banco" /></div>
                                    <div><Label className="text-xs">Numero *</Label><Input className="h-8 text-sm" value={chequeNumero} onChange={e => setChequeNumero(e.target.value)} placeholder="000000" /></div>
                                    <div><Label className="text-xs">Tipo</Label>
                                        <Select value={chequeTipo} onValueChange={setChequeTipo}>
                                            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="proprio">Proprio</SelectItem>
                                                <SelectItem value="terceiro">Terceiro</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        )}

                        {paymentRows.length > 1 && (
                            <p className={`text-xs font-medium ${Math.abs(totalAllocated - totalChecked) < 0.01 ? "text-green-600" : "text-amber-600"}`}>
                                Total alocado: {formatCurrency(totalAllocated)} / Total selecionado: {formatCurrency(totalChecked)}
                            </p>
                        )}

                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="text-xs" onClick={handleAutoFill}>
                                Preencher valor total
                            </Button>
                            <Button className="flex-1 bg-green-600 hover:bg-green-700"
                                disabled={paying || !allRowsValid || checkedIds.size === 0 || (hasChequeMethod && (!chequeBanco || !chequeNumero))}
                                onClick={handleConfirmPayment}>
                                {paying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckSquare className="mr-2 h-4 w-4" />}
                                Confirmar Pagamento ({checkedIds.size} conta(s))
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Payment history */}
            <Card className="border-emerald-100">
                <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <History className="h-4 w-4 text-emerald-600" />
                        <h3 className="font-semibold text-emerald-800">Historico de Pagamentos</h3>
                    </div>
                    {recentPaid.length === 0 ? (
                        <p className="text-sm text-gray-500">Nenhum pagamento registrado.</p>
                    ) : (
                        <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                            {recentPaid.map((item: any) => (
                                <div key={item.id} className="flex items-center justify-between p-3">
                                    <div>
                                        <p className="text-sm font-medium">{item.supplier}</p>
                                        <p className="text-xs text-gray-500">{item.description || "Sem descricao"} - {new Date(item.updatedAt || item.dueDate).toLocaleDateString("pt-BR")}</p>
                                    </div>
                                    <span className="text-sm font-mono font-semibold text-green-600">{formatCurrency(item.totalAmount, item.currency || "USD")}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function EditAPForm({ item, seasons, onSave, saving }: any) {
    const [supplier, setSupplier] = useState(item.supplier || "");
    const [description, setDescription] = useState(item.description || "");
    const [totalAmount, setTotalAmount] = useState(String(item.totalAmount || ""));
    const [dueDate, setDueDate] = useState(item.dueDate ? new Date(item.dueDate).toISOString().split("T")[0] : "");
    const [seasonId, setSeasonId] = useState(item.seasonId || item.season_id || "__none__");

    return (
        <form onSubmit={(e) => {
            e.preventDefault();
            onSave({ supplier, description, totalAmount, dueDate, seasonId: seasonId === "__none__" ? null : seasonId || null });
        }} className="space-y-4">
            <div><Label>Fornecedor *</Label><Input value={supplier} onChange={e => setSupplier(e.target.value)} required /></div>
            <div><Label>Descricao</Label><Input value={description} onChange={e => setDescription(e.target.value)} /></div>
            <div><Label>Valor Total ($) *</Label><Input type="number" step="0.01" value={totalAmount} onChange={e => setTotalAmount(e.target.value)} required /></div>
            <div><Label>Vencimento *</Label><Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} required /></div>
            {(seasons || []).length > 0 && (
                <div>
                    <Label>Safra (opcional)</Label>
                    <Select value={seasonId} onValueChange={setSeasonId}>
                        <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__none__">Nenhuma</SelectItem>
                            {seasons.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            )}
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={saving || !supplier || !totalAmount || !dueDate}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Salvar Alteracoes"}
            </Button>
        </form>
    );
}
