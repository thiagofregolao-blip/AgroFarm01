import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/format-currency";
import { useAuth } from "@/hooks/use-auth";
import FarmLayout from "@/components/fazenda/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, HandCoins, Loader2, Download, CheckSquare, Square, CheckCheck, PlusCircle, Trash2, Pencil, History } from "lucide-react";

// ─── CSV export ────────────────────────────────────────────────────────────
function exportToCSV(data: any[], filename: string) {
    if (!data.length) return;
    const headers = ["Comprador", "Fornecedor", "Descricao", "Vencimento", "Status", "Valor Total", "Recebido", "Saldo"];
    const rows = data.map((i: any) => [
        i.buyer,
        i.supplierName || "",
        i.description || "",
        new Date(i.dueDate).toLocaleDateString("pt-BR"),
        i.status,
        formatCurrency(i.totalAmount),
        formatCurrency(i.receivedAmount || 0),
        formatCurrency(parseFloat(i.totalAmount) - parseFloat(i.receivedAmount || 0)),
    ]);
    const csv = [headers, ...rows].map(r => r.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}

const STATUS_COLORS: Record<string, string> = {
    pendente: "bg-blue-100 text-blue-700",
    parcial: "bg-amber-100 text-amber-700",
    recebido: "bg-green-100 text-green-700",
    vencido: "bg-red-100 text-red-700",
};

function badge(s: string) {
    const label: Record<string, string> = { pendente: "Pendente", parcial: "Parcial", recebido: "Recebido", vencido: "Vencido" };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[s] || STATUS_COLORS.pendente}`}>{label[s] || s}</span>;
}

export default function AccountsReceivable() {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [openCreate, setOpenCreate] = useState(false);
    const [receivingItem, setReceivingItem] = useState<any>(null);
    const [editingItem, setEditingItem] = useState<any>(null);
    const { user } = useAuth();

    // Filters
    const [filterStatus, setFilterStatus] = useState("todos");
    const [filterBuyer, setFilterBuyer] = useState("");
    const [filterFrom, setFilterFrom] = useState("");
    const [filterTo, setFilterTo] = useState("");

    // Bulk selection
    const [selected, setSelected] = useState<Set<string>>(new Set());

    const { data: items = [], isLoading } = useQuery({
        queryKey: ["/api/farm/accounts-receivable"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/accounts-receivable"); return r.json(); },
        enabled: !!user,
    });
    const { data: accounts = [] } = useQuery({
        queryKey: ["/api/farm/cash-accounts"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/cash-accounts"); return r.json(); },
        enabled: !!user,
    });
    const { data: suppliers = [] } = useQuery({
        queryKey: ["/api/farm/suppliers"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/suppliers"); return r.json(); },
        enabled: !!user,
    });

    // Enrich status: vencido if dueDate past and not received
    const enriched = useMemo(() => (items as any[]).map((i: any) => {
        const isPast = new Date(i.dueDate) < new Date() && i.status !== "recebido";
        const supplierObj = (suppliers as any[]).find((s: any) => String(s.id) === String(i.supplier_id || i.supplierId));
        return {
            ...i,
            status: isPast && i.status === "pendente" ? "vencido" : i.status,
            supplierName: supplierObj?.name || i.supplierName || "",
        };
    }), [items, suppliers]);

    const filtered = useMemo(() => enriched.filter((i: any) => {
        if (filterStatus !== "todos" && i.status !== filterStatus) return false;
        if (filterBuyer && !i.buyer.toLowerCase().includes(filterBuyer.toLowerCase())) return false;
        if (filterFrom && new Date(i.dueDate) < new Date(filterFrom)) return false;
        if (filterTo && new Date(i.dueDate) > new Date(filterTo)) return false;
        return true;
    }), [enriched, filterStatus, filterBuyer, filterFrom, filterTo]);

    const totalPendente = enriched.filter((i: any) => i.status !== "recebido").reduce((s: number, i: any) => s + parseFloat(i.totalAmount) - parseFloat(i.receivedAmount || 0), 0);
    const totalRecebido = enriched.filter((i: any) => i.status === "recebido").reduce((s: number, i: any) => s + parseFloat(i.totalAmount), 0);
    const totalVencido = enriched.filter((i: any) => i.status === "vencido").reduce((s: number, i: any) => s + parseFloat(i.totalAmount) - parseFloat(i.receivedAmount || 0), 0);

    const save = useMutation({
        mutationFn: async (data: any) => apiRequest("POST", "/api/farm/accounts-receivable", data),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/farm/accounts-receivable"] }); toast({ title: "Conta registrada" }); setOpenCreate(false); },
    });

    const editMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: any }) => apiRequest("PUT", `/api/farm/accounts-receivable/${id}`, data),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/farm/accounts-receivable"] }); toast({ title: "Conta atualizada" }); setEditingItem(null); },
        onError: () => toast({ title: "Erro ao atualizar", variant: "destructive" }),
    });

    const receive = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: any }) => {
            const { paymentRows, cheques, buyerName } = data;
            const totalAmount = paymentRows.reduce((s: number, r: any) => s + parseFloat(r.amount || 0), 0);

            const createdCheques: any[] = [];
            for (const ch of (cheques || [])) {
                const r = await apiRequest("POST", "/api/farm/cheques", {
                    type: "recebido",
                    chequeNumber: String(ch.numero || ""),
                    bank: String(ch.banco || ""),
                    holder: String(ch.titular || ""),
                    amount: String(ch.valor || "0"),
                    currency: String(ch.currency || "USD"),
                    issueDate: ch.emissao ? new Date(ch.emissao).toISOString() : new Date().toISOString(),
                    dueDate: ch.vencimento ? new Date(ch.vencimento).toISOString() : null,
                    relatedReceivableId: String(id),
                });
                const created = await r.json();
                createdCheques.push(created);
            }

            for (const row of paymentRows) {
                await apiRequest("POST", `/api/farm/accounts-receivable/${id}/receive`, {
                    accountId: row.accountId,
                    amount: row.amount,
                    paymentMethod: row.paymentMethod,
                });
            }

            const paymentMethods = paymentRows.map((row: any, idx: number) => ({
                method: row.paymentMethod,
                accountId: row.accountId,
                amount: row.amount,
                chequeId: row.paymentMethod === "cheque" && createdCheques[idx] ? createdCheques[idx].id : undefined,
            }));

            const item = (items as any[]).find((i: any) => i.id === id);
            const remaining = item ? parseFloat(item.totalAmount) - parseFloat(item.receivedAmount || 0) : totalAmount;
            const paymentType = totalAmount >= remaining ? "total" : "parcial";

            const receiptRes = await apiRequest("POST", "/api/farm/receipts", {
                type: "recebimento",
                entity: buyerName,
                totalAmount: totalAmount.toFixed(2),
                paymentType,
                paymentMethods,
                invoiceRefs: [{ receivableId: id, amount: totalAmount.toFixed(2) }],
            });
            return receiptRes.json();
        },
        onSuccess: (receipt: any) => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/accounts-receivable"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/cash-accounts"] });
            toast({ title: `Recebimento registrado! Recibo #${receipt?.receipt_number || receipt?.receiptNumber || ""}` });
            setReceivingItem(null);
        },
    });
    const del = useMutation({
        mutationFn: async (id: string) => apiRequest("DELETE", `/api/farm/accounts-receivable/${id}`),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/farm/accounts-receivable"] }); toast({ title: "Removido" }); },
    });

    // Bulk: mark selected as received
    function handleBulkReceive() {
        if (!accounts.length) { toast({ title: "Cadastre uma conta bancaria primeiro", variant: "destructive" }); return; }
        const defaultAcc = (accounts as any[])[0];
        const todo = filtered.filter((i: any) => selected.has(i.id) && i.status !== "recebido");
        Promise.all(todo.map((i: any) =>
            apiRequest("POST", `/api/farm/accounts-receivable/${i.id}/receive`, {
                accountId: defaultAcc.id,
                amount: (parseFloat(i.totalAmount) - parseFloat(i.receivedAmount || 0)).toFixed(2),
                paymentMethod: "transferencia",
            })
        )).then(() => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/accounts-receivable"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/cash-accounts"] });
            toast({ title: `${todo.length} contas marcadas como recebidas!` });
            setSelected(new Set());
        });
    }

    function toggleAll() {
        if (selected.size === filtered.length) setSelected(new Set());
        else setSelected(new Set(filtered.map((i: any) => i.id)));
    }

    function toggleOne(id: string) {
        const n = new Set(selected);
        n.has(id) ? n.delete(id) : n.add(id);
        setSelected(n);
    }

    return (
        <FarmLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-emerald-800">Contas a Receber</h1>
                        <p className="text-sm text-emerald-600">
                            A receber: <strong className="text-blue-600">{formatCurrency(totalPendente)}</strong>
                            {totalVencido > 0 && <> - Vencido: <strong className="text-red-600">{formatCurrency(totalVencido)}</strong></>}
                            {" "} - Recebido: <strong className="text-green-600">{formatCurrency(totalRecebido)}</strong>
                        </p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        {selected.size > 0 && (
                            <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleBulkReceive}>
                                <CheckCheck className="mr-2 h-4 w-4" /> Receber {selected.size} selecionados
                            </Button>
                        )}
                        <Button variant="outline" className="border-emerald-200 text-emerald-700" onClick={() => exportToCSV(filtered, "contas_receber.csv")}>
                            <Download className="mr-2 h-4 w-4" /> CSV
                        </Button>
                        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
                            <DialogTrigger asChild>
                                <Button className="bg-emerald-600 hover:bg-emerald-700"><Plus className="mr-2 h-4 w-4" /> Nova Conta</Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                                <DialogHeader><DialogTitle>Nova Conta a Receber</DialogTitle></DialogHeader>
                                <form onSubmit={(e: any) => {
                                    e.preventDefault();
                                    const fd = new FormData(e.target);
                                    save.mutate({
                                        buyer: fd.get("buyer"),
                                        description: fd.get("description"),
                                        totalAmount: fd.get("totalAmount"),
                                        dueDate: fd.get("dueDate"),
                                        supplier_id: fd.get("supplier_id") || null,
                                    });
                                }} className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><Label>Comprador *</Label><Input name="buyer" required /></div>
                                        <div>
                                            <Label>Fornecedor / Cliente</Label>
                                            <select name="supplier_id" className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background">
                                                <option value="">Nenhum</option>
                                                {(suppliers as any[]).map((s: any) => (
                                                    <option key={s.id} value={s.id}>{s.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <div><Label>Descricao</Label><Input name="description" /></div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><Label>Valor ($) *</Label><Input name="totalAmount" type="number" step="0.01" required /></div>
                                        <div><Label>Vencimento *</Label><Input name="dueDate" type="date" required /></div>
                                    </div>
                                    <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={save.isPending}>
                                        {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Registrar
                                    </Button>
                                </form>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

                {/* Tabs: Contas / Recebimento */}
                <Tabs defaultValue="contas">
                    <TabsList className="bg-emerald-50 text-emerald-800">
                        <TabsTrigger value="contas">Contas</TabsTrigger>
                        <TabsTrigger value="recebimento">Recebimento</TabsTrigger>
                    </TabsList>

                    {/* ── CONTAS TAB ────────────────────────────────────────── */}
                    <TabsContent value="contas" className="space-y-4 mt-4">
                        {/* Filter bar */}
                        <Card className="border-emerald-100">
                            <CardContent className="p-3">
                                <div className="flex flex-wrap gap-3 items-end">
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Status</p>
                                        <div className="flex gap-1">
                                            {["todos", "pendente", "vencido", "parcial", "recebido"].map(s => (
                                                <button key={s} onClick={() => setFilterStatus(s)}
                                                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors capitalize ${filterStatus === s ? "bg-emerald-600 text-white border-emerald-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                                                    {s === "todos" ? "Todos" : s.charAt(0).toUpperCase() + s.slice(1)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Comprador</p>
                                        <Input placeholder="Buscar..." value={filterBuyer} onChange={e => setFilterBuyer(e.target.value)} className="h-8 text-sm w-36" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Vencimento de</p>
                                        <Input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} className="h-8 text-sm w-36" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">ate</p>
                                        <Input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} className="h-8 text-sm w-36" />
                                    </div>
                                    {(filterStatus !== "todos" || filterBuyer || filterFrom || filterTo) && (
                                        <button onClick={() => { setFilterStatus("todos"); setFilterBuyer(""); setFilterFrom(""); setFilterTo(""); }}
                                            className="text-xs text-red-500 hover:underline mt-4">Limpar</button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {isLoading ? (
                            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
                        ) : filtered.length === 0 ? (
                            <Card className="border-emerald-100"><CardContent className="py-12 text-center">
                                <HandCoins className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                                <p className="text-gray-500">Nenhuma conta a receber encontrada</p>
                            </CardContent></Card>
                        ) : (
                            <div className="bg-white rounded-xl border border-emerald-100 overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-emerald-50">
                                        <tr>
                                            <th className="p-3 w-8">
                                                <button onClick={toggleAll}>
                                                    {selected.size === filtered.length && filtered.length > 0
                                                        ? <CheckSquare className="h-4 w-4 text-emerald-600" />
                                                        : <Square className="h-4 w-4 text-gray-400" />}
                                                </button>
                                            </th>
                                            <th className="text-left p-3 font-semibold text-emerald-800">Comprador</th>
                                            <th className="text-left p-3 font-semibold text-emerald-800">Fornecedor</th>
                                            <th className="text-left p-3 font-semibold text-emerald-800">Descricao</th>
                                            <th className="text-left p-3 font-semibold text-emerald-800">Vencimento</th>
                                            <th className="text-left p-3 font-semibold text-emerald-800">Status</th>
                                            <th className="text-right p-3 font-semibold text-emerald-800">Valor</th>
                                            <th className="text-right p-3 font-semibold text-emerald-800">Recebido</th>
                                            <th className="text-right p-3 font-semibold text-emerald-800">Saldo</th>
                                            <th className="p-3" />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map((item: any) => (
                                            <tr key={item.id} className={`border-t border-gray-100 hover:bg-gray-50 ${selected.has(item.id) ? "bg-blue-50" : ""}`}>
                                                <td className="p-3">
                                                    <button onClick={() => toggleOne(item.id)}>
                                                        {selected.has(item.id)
                                                            ? <CheckSquare className="h-4 w-4 text-blue-600" />
                                                            : <Square className="h-4 w-4 text-gray-300" />}
                                                    </button>
                                                </td>
                                                <td className="p-3 font-medium">{item.buyer}</td>
                                                <td className="p-3 text-gray-600">{item.supplierName || "--"}</td>
                                                <td className="p-3 text-gray-600 max-w-[200px] truncate">{item.description || "--"}</td>
                                                <td className="p-3">{new Date(item.dueDate).toLocaleDateString("pt-BR")}</td>
                                                <td className="p-3">{badge(item.status)}</td>
                                                <td className="text-right p-3 font-mono font-semibold">{formatCurrency(item.totalAmount)}</td>
                                                <td className="text-right p-3 font-mono text-green-600">{formatCurrency(item.receivedAmount || 0)}</td>
                                                <td className={`text-right p-3 font-mono font-semibold ${(parseFloat(item.totalAmount) - parseFloat(item.receivedAmount || 0)) > 0 ? "text-red-600" : "text-green-600"}`}>
                                                    {formatCurrency(parseFloat(item.totalAmount) - parseFloat(item.receivedAmount || 0))}
                                                </td>
                                                <td className="p-3 flex gap-1 justify-end">
                                                    {item.status !== "recebido" && (
                                                        <Button variant="outline" size="sm" className="h-7 text-xs border-blue-200 text-blue-600 hover:bg-blue-50"
                                                            onClick={() => setEditingItem(item)}>
                                                            <Pencil className="h-3 w-3 mr-1" />Editar
                                                        </Button>
                                                    )}
                                                    {item.status !== "recebido" &&
                                                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700 h-7 text-xs" onClick={() => setReceivingItem(item)}>Cobrar</Button>}
                                                    <Button variant="ghost" size="sm" className="text-red-500 h-7 text-xs"
                                                        onClick={() => { if (confirm(`Remover conta a receber "${item.buyer}" - ${formatCurrency(item.totalAmount)}?`)) del.mutate(item.id); }}
                                                        aria-label="Remover"><Trash2 className="h-3 w-3" /></Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <div className="p-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-sm text-gray-600">
                                    <span>{filtered.length} registros</span>
                                    <span>Total filtrado: <strong>{formatCurrency(filtered.reduce((s: number, i: any) => s + parseFloat(i.totalAmount), 0))}</strong></span>
                                </div>
                            </div>
                        )}
                    </TabsContent>

                    {/* ── RECEBIMENTO TAB ──────────────────────────────────── */}
                    <TabsContent value="recebimento" className="space-y-6 mt-4">
                        <RecebimentoTab
                            items={enriched}
                            suppliers={suppliers as any[]}
                            accounts={accounts as any[]}
                            onReceive={(id, data) => receive.mutate({ id, data })}
                            receiving={receive.isPending}
                        />
                    </TabsContent>
                </Tabs>

                {/* Receive Dialog (for individual item via Cobrar button) */}
                <Dialog open={!!receivingItem} onOpenChange={(o) => !o && setReceivingItem(null)}>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader><DialogTitle>Receber Pagamento</DialogTitle></DialogHeader>
                        {receivingItem && <ReceiveForm item={receivingItem} accounts={accounts} onReceive={(data: any) => receive.mutate({ id: receivingItem.id, data })} saving={receive.isPending} />}
                    </DialogContent>
                </Dialog>

                {/* Edit Dialog */}
                <Dialog open={!!editingItem} onOpenChange={(o) => !o && setEditingItem(null)}>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader><DialogTitle>Editar Conta a Receber</DialogTitle></DialogHeader>
                        {editingItem && <EditARForm item={editingItem} suppliers={suppliers as any[]}
                            onSave={(data: any) => editMutation.mutate({ id: editingItem.id, data })}
                            saving={editMutation.isPending} />}
                    </DialogContent>
                </Dialog>
            </div>
        </FarmLayout>
    );
}

// ─── Edit AR Form ──────────────────────────────────────────────────────────
function EditARForm({ item, suppliers, onSave, saving }: any) {
    const [buyer, setBuyer] = useState(item.buyer || "");
    const [description, setDescription] = useState(item.description || "");
    const [totalAmount, setTotalAmount] = useState(String(item.totalAmount || ""));
    const [dueDate, setDueDate] = useState(item.dueDate ? new Date(item.dueDate).toISOString().split("T")[0] : "");
    const [supplierId, setSupplierId] = useState(String(item.supplier_id || item.supplierId || ""));

    return (
        <form onSubmit={(e) => {
            e.preventDefault();
            onSave({ buyer, description, totalAmount, dueDate, supplier_id: supplierId || null });
        }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div><Label>Comprador *</Label><Input value={buyer} onChange={e => setBuyer(e.target.value)} required /></div>
                <div>
                    <Label>Fornecedor / Cliente</Label>
                    <Select value={supplierId} onValueChange={setSupplierId}>
                        <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="">Nenhum</SelectItem>
                            {suppliers.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <div><Label>Descricao</Label><Input value={description} onChange={e => setDescription(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-4">
                <div><Label>Valor ($) *</Label><Input type="number" step="0.01" value={totalAmount} onChange={e => setTotalAmount(e.target.value)} required /></div>
                <div><Label>Vencimento *</Label><Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} required /></div>
            </div>
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={saving || !buyer || !totalAmount || !dueDate}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Salvar Alteracoes"}
            </Button>
        </form>
    );
}

// ─── Recebimento Tab ───────────────────────────────────────────────────────
function RecebimentoTab({ items, suppliers, accounts, onReceive, receiving }: {
    items: any[]; suppliers: any[]; accounts: any[]; onReceive: (id: string, data: any) => void; receiving: boolean;
}) {
    const [selectedClient, setSelectedClient] = useState("");
    const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
    const [paymentRows, setPaymentRows] = useState<{ accountId: string; amount: string; paymentMethod: string }[]>([
        { accountId: "", amount: "", paymentMethod: "transferencia" },
    ]);

    // Cheque fields
    const [chequeBanco, setChequeBanco] = useState("");
    const [chequeNumero, setChequeNumero] = useState("");
    const [chequeTitular, setChequeTitular] = useState("");
    const [chequeValor, setChequeValor] = useState("");

    const pendingForClient = items.filter((i: any) =>
        (i.buyer === selectedClient || i.supplierName === selectedClient) && i.status !== "recebido"
    );

    const checkedItems = pendingForClient.filter((i: any) => checkedIds.has(i.id));
    const totalChecked = checkedItems.reduce((s: number, i: any) =>
        s + parseFloat(i.totalAmount) - parseFloat(i.receivedAmount || 0), 0
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

    const handleAutoFill = () => {
        if (paymentRows.length === 1) {
            setPaymentRows([{ ...paymentRows[0], amount: totalChecked.toFixed(2) }]);
        }
    };

    async function handleConfirmReceive() {
        if (checkedIds.size === 0 || !allRowsValid) return;
        const cheques = hasChequeMethod && chequeBanco && chequeNumero ? [{
            banco: chequeBanco, numero: chequeNumero, titular: chequeTitular,
            valor: chequeValor || totalChecked.toFixed(2), currency: "USD",
            emissao: new Date().toISOString().split("T")[0], vencimento: "",
        }] : [];
        for (const item of checkedItems) {
            const remaining = parseFloat(item.totalAmount) - parseFloat(item.receivedAmount || 0);
            onReceive(item.id, {
                paymentRows: paymentRows.map(r => ({
                    ...r,
                    amount: paymentRows.length === 1 ? remaining.toFixed(2) :
                        (remaining * (parseFloat(r.amount) / totalAllocated)).toFixed(2),
                })),
                cheques,
                buyerName: item.buyer,
            });
        }
        setCheckedIds(new Set());
    }

    // Unique client/buyer names for the select
    const clientNames = Array.from(new Set([
        ...items.map((i: any) => i.buyer).filter(Boolean),
        ...suppliers.map((s: any) => s.name).filter(Boolean),
    ])) as string[];

    // Payment history
    const recentReceived = items
        .filter((i: any) => i.status === "recebido")
        .sort((a: any, b: any) => new Date(b.updatedAt || b.dueDate).getTime() - new Date(a.updatedAt || a.dueDate).getTime())
        .slice(0, 10);

    return (
        <div className="space-y-6">
            {/* Client select */}
            <Card className="border-emerald-100">
                <CardContent className="p-4 space-y-4">
                    <div>
                        <Label className="font-semibold">Selecione o Cliente / Comprador</Label>
                        <Select value={selectedClient} onValueChange={v => { setSelectedClient(v); setCheckedIds(new Set()); }}>
                            <SelectTrigger className="w-full max-w-md mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                            <SelectContent>
                                {clientNames.map((name: string) => (
                                    <SelectItem key={name} value={name}>{name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {selectedClient && (
                        pendingForClient.length === 0 ? (
                            <p className="text-sm text-gray-500">Nenhuma conta pendente para este cliente.</p>
                        ) : (
                            <div className="space-y-2">
                                <p className="text-sm font-medium text-gray-700">{pendingForClient.length} conta(s) pendente(s):</p>
                                <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                                    {pendingForClient.map((item: any) => {
                                        const remaining = parseFloat(item.totalAmount) - parseFloat(item.receivedAmount || 0);
                                        return (
                                            <label key={item.id} className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 ${checkedIds.has(item.id) ? "bg-blue-50" : ""}`}>
                                                <input type="checkbox" className="rounded" checked={checkedIds.has(item.id)} onChange={() => toggleCheck(item.id)} />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium">{item.buyer} - {item.description || "Sem descricao"}</p>
                                                    <p className="text-xs text-gray-500">Venc: {new Date(item.dueDate).toLocaleDateString("pt-BR")}</p>
                                                </div>
                                                <span className="text-sm font-mono font-semibold text-blue-600">{formatCurrency(remaining)}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                                {checkedIds.size > 0 && (
                                    <div className="flex items-center justify-between p-2 bg-blue-50 rounded-lg border border-blue-200">
                                        <span className="text-sm font-medium text-blue-800">{checkedIds.size} conta(s) selecionada(s)</span>
                                        <span className="text-sm font-bold text-blue-800">Total: {formatCurrency(totalChecked)}</span>
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
                            <Label className="font-semibold text-emerald-800">Forma de Recebimento</Label>
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
                                                    <SelectItem key={a.id} value={String(a.id)}>{a.name} ({a.currency})</SelectItem>
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
                            <div className="space-y-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                                <p className="text-xs font-semibold text-amber-700">Dados do Cheque</p>
                                <div className="grid grid-cols-2 gap-2">
                                    <div><Label className="text-xs">Banco *</Label><Input className="h-8 text-sm" value={chequeBanco} onChange={e => setChequeBanco(e.target.value)} placeholder="Nome do banco" /></div>
                                    <div><Label className="text-xs">Numero *</Label><Input className="h-8 text-sm" value={chequeNumero} onChange={e => setChequeNumero(e.target.value)} placeholder="000000" /></div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div><Label className="text-xs">Titular</Label><Input className="h-8 text-sm" value={chequeTitular} onChange={e => setChequeTitular(e.target.value)} placeholder="Nome do titular" /></div>
                                    <div><Label className="text-xs">Valor</Label><Input type="number" step="0.01" className="h-8 text-sm" value={chequeValor} onChange={e => setChequeValor(e.target.value)} placeholder="0.00" /></div>
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
                            <Button className="flex-1 bg-blue-600 hover:bg-blue-700"
                                disabled={receiving || !allRowsValid || checkedIds.size === 0 || (hasChequeMethod && (!chequeBanco || !chequeNumero))}
                                onClick={handleConfirmReceive}>
                                {receiving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckSquare className="mr-2 h-4 w-4" />}
                                Confirmar Recebimento ({checkedIds.size} conta(s))
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
                        <h3 className="font-semibold text-emerald-800">Historico de Recebimentos</h3>
                    </div>
                    {recentReceived.length === 0 ? (
                        <p className="text-sm text-gray-500">Nenhum recebimento registrado.</p>
                    ) : (
                        <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                            {recentReceived.map((item: any) => (
                                <div key={item.id} className="flex items-center justify-between p-3">
                                    <div>
                                        <p className="text-sm font-medium">{item.buyer}</p>
                                        <p className="text-xs text-gray-500">{item.description || "Sem descricao"} - {new Date(item.updatedAt || item.dueDate).toLocaleDateString("pt-BR")}</p>
                                    </div>
                                    <span className="text-sm font-mono font-semibold text-green-600">{formatCurrency(item.totalAmount)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

// ─── Receive Form (for individual item dialog) ────────────────────────────
function ReceiveForm({ item, accounts, onReceive, saving }: any) {
    const remaining = parseFloat(item.totalAmount) - parseFloat(item.receivedAmount || 0);

    const [paymentRows, setPaymentRows] = useState<{ accountId: string; amount: string; paymentMethod: string }[]>([
        { accountId: "", amount: remaining.toFixed(2), paymentMethod: "transferencia" },
    ]);

    const [chequeBanco, setChequeBanco] = useState("");
    const [chequeTitular, setChequeTitular] = useState("");
    const [chequeNumero, setChequeNumero] = useState("");
    const [chequeValor, setChequeValor] = useState("");
    const [chequeCurrency, setChequeCurrency] = useState("USD");
    const [chequeEmissao, setChequeEmissao] = useState(new Date().toISOString().split("T")[0]);
    const [chequeVencimento, setChequeVencimento] = useState("");
    const [cheques, setCheques] = useState<{ banco: string; titular: string; numero: string; valor: string; currency: string; emissao: string; vencimento: string }[]>([]);

    const hasChequeMethod = paymentRows.some(r => r.paymentMethod === "cheque");
    const totalRows = paymentRows.reduce((s, r) => s + parseFloat(r.amount || "0"), 0);

    function updateRow(idx: number, field: string, value: string) {
        const next = [...paymentRows];
        (next[idx] as any)[field] = value;
        setPaymentRows(next);
    }
    function addRow() {
        setPaymentRows([...paymentRows, { accountId: "", amount: "0", paymentMethod: "transferencia" }]);
    }
    function removeRow(idx: number) {
        if (paymentRows.length <= 1) return;
        setPaymentRows(paymentRows.filter((_, i) => i !== idx));
    }

    function addCheque() {
        if (!chequeBanco || !chequeNumero || !chequeValor) return;
        setCheques([...cheques, { banco: chequeBanco, titular: chequeTitular, numero: chequeNumero, valor: chequeValor, currency: chequeCurrency, emissao: chequeEmissao, vencimento: chequeVencimento }]);
        setChequeBanco(""); setChequeTitular(""); setChequeNumero(""); setChequeValor(""); setChequeCurrency("USD");
        setChequeEmissao(new Date().toISOString().split("T")[0]); setChequeVencimento("");
    }
    function removeCheque(idx: number) {
        setCheques(cheques.filter((_, i) => i !== idx));
    }

    const allRowsValid = paymentRows.every(r => r.accountId && parseFloat(r.amount) > 0);

    return (
        <form onSubmit={(e) => {
            e.preventDefault();
            onReceive({ paymentRows, cheques, buyerName: item.buyer });
        }} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div className="p-3 bg-gray-50 rounded-lg text-sm">
                <p>Comprador: <strong>{item.buyer}</strong></p>
                <p>Valor Total: {formatCurrency(item.totalAmount)}</p>
                <p>Ja Recebido: {formatCurrency(item.receivedAmount || 0)}</p>
                <p className="text-lg font-bold text-blue-600">Restante: {formatCurrency(remaining)}</p>
            </div>

            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Distribuicao do Pagamento</Label>
                    <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addRow}>
                        <PlusCircle className="mr-1 h-3 w-3" /> Adicionar Conta
                    </Button>
                </div>
                {paymentRows.map((row, idx) => (
                    <div key={idx} className="p-3 border border-gray-200 rounded-lg space-y-2 bg-white">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-500">Pagamento {idx + 1}</span>
                            {paymentRows.length > 1 && (
                                <button type="button" onClick={() => removeRow(idx)} className="text-red-400 hover:text-red-600">
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>
                        <div>
                            <Label className="text-xs">Conta Bancaria *</Label>
                            <Select value={row.accountId} onValueChange={v => updateRow(idx, "accountId", v)}>
                                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                <SelectContent>
                                    {(accounts as any[]).map((a: any) => (
                                        <SelectItem key={a.id} value={String(a.id)}>{a.name} ({a.currency})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <Label className="text-xs">Valor</Label>
                                <Input type="number" step="0.01" className="h-8 text-sm" value={row.amount} onChange={e => updateRow(idx, "amount", e.target.value)} />
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
                {totalRows > 0 && (
                    <p className={`text-xs font-medium ${Math.abs(totalRows - remaining) < 0.01 ? "text-green-600" : "text-amber-600"}`}>
                        Total distribuido: {formatCurrency(totalRows)} / Restante: {formatCurrency(remaining)}
                    </p>
                )}
            </div>

            {hasChequeMethod && (
                <div className="space-y-3 p-3 border border-amber-200 rounded-lg bg-amber-50/50">
                    <Label className="text-sm font-semibold">Dados do Cheque</Label>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <Label className="text-xs">Banco *</Label>
                            <Input className="h-8 text-sm" value={chequeBanco} onChange={e => setChequeBanco(e.target.value)} placeholder="Nome do banco" />
                        </div>
                        <div>
                            <Label className="text-xs">Titular</Label>
                            <Input className="h-8 text-sm" value={chequeTitular} onChange={e => setChequeTitular(e.target.value)} placeholder="Nome do titular" />
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <div>
                            <Label className="text-xs">Numero do Cheque *</Label>
                            <Input className="h-8 text-sm" value={chequeNumero} onChange={e => setChequeNumero(e.target.value)} />
                        </div>
                        <div>
                            <Label className="text-xs">Valor *</Label>
                            <Input type="number" step="0.01" className="h-8 text-sm" value={chequeValor} onChange={e => setChequeValor(e.target.value)} />
                        </div>
                        <div>
                            <Label className="text-xs">Moeda</Label>
                            <Select value={chequeCurrency} onValueChange={setChequeCurrency}>
                                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="USD">USD</SelectItem>
                                    <SelectItem value="PYG">PYG</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <Label className="text-xs">Data Emissao</Label>
                            <Input type="date" className="h-8 text-sm" value={chequeEmissao} onChange={e => setChequeEmissao(e.target.value)} />
                        </div>
                        <div>
                            <Label className="text-xs">Data Vencimento</Label>
                            <Input type="date" className="h-8 text-sm" value={chequeVencimento} onChange={e => setChequeVencimento(e.target.value)} />
                        </div>
                    </div>
                    <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addCheque}>
                        <PlusCircle className="mr-1 h-3 w-3" /> Agregar Cheque
                    </Button>

                    {cheques.length > 0 && (
                        <div className="space-y-1 mt-2">
                            <p className="text-xs font-medium text-gray-500">Cheques agregados:</p>
                            {cheques.map((ch, idx) => (
                                <div key={idx} className="flex items-center justify-between bg-white p-2 rounded border border-gray-200 text-xs">
                                    <span>#{ch.numero} - {ch.banco} - {formatCurrency(ch.valor, ch.currency)}</span>
                                    <button type="button" onClick={() => removeCheque(idx)} className="text-red-400 hover:text-red-600">
                                        <Trash2 className="h-3 w-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={saving || !allRowsValid}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Confirmar Recebimento
            </Button>
        </form>
    );
}
