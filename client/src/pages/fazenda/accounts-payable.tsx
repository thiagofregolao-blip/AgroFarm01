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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Receipt, Loader2, AlertTriangle, CheckCircle, Clock, Download, CheckSquare, PlusCircle, Trash2, Pencil } from "lucide-react";

// ─── CSV export utility ──────────────────────────────────────────────────────
function exportToCSV(data: any[], filename: string) {
    if (!data.length) return;
    const headers = ["Fornecedor", "Descrição", "Parcela", "Vencimento", "Status", "Valor Total", "Pago"];
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
    const [openCreate, setOpenCreate] = useState(false);
    const [payingItem, setPayingItem] = useState<any>(null);
    const [editingItem, setEditingItem] = useState<any>(null);
    const { user } = useAuth();
    const backfillDone = useRef(false);

    // ─── Filters ───────────────────────────────────────────────────────────
    const [filterStatus, setFilterStatus] = useState("todos");
    const [filterFrom, setFilterFrom] = useState("");
    const [filterTo, setFilterTo] = useState("");
    const [filterSupplier, setFilterSupplier] = useState("todos");
    const [filterSeason, setFilterSeason] = useState("todos");

    // ─── Bulk selection ────────────────────────────────────────────────────
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkPaying, setBulkPaying] = useState(false);
    const [bulkAccountId, setBulkAccountId] = useState("");

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

    const save = useMutation({
        mutationFn: async (data: any) => apiRequest("POST", "/api/farm/accounts-payable", data),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/farm/accounts-payable"] }); toast({ title: "Conta(s) registrada(s)" }); setOpenCreate(false); },
    });

    const pay = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: any }) => {
            const result = await apiRequest("POST", `/api/farm/accounts-payable/${id}/pay`, data);
            // If cheque data is present, also create cheque record
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
            setPayingItem(null);
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

    // ─── Bulk pay ──────────────────────────────────────────────────────────
    async function handleBulkPay() {
        if (!bulkAccountId || selectedIds.size === 0) return;
        setBulkPaying(true);
        const toastId = toast({ title: `Pagando ${selectedIds.size} contas...` });
        try {
            for (const id of Array.from(selectedIds)) {
                const item = (items as any[]).find((i: any) => i.id === id);
                if (!item || item.status === "pago") continue;
                const remaining = parseFloat(item.totalAmount) - parseFloat(item.paidAmount || 0);
                await apiRequest("POST", `/api/farm/accounts-payable/${id}/pay`, {
                    accountId: bulkAccountId,
                    amount: remaining.toFixed(2),
                    paymentMethod: "transferencia",
                });
            }
            queryClient.invalidateQueries({ queryKey: ["/api/farm/accounts-payable"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/cash-accounts"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/cash-transactions"] });
            toast({ title: `✅ ${selectedIds.size} contas pagas com sucesso!` });
            setSelectedIds(new Set());
            setBulkAccountId("");
        } catch {
            toast({ title: "Erro ao pagar contas em lote", variant: "destructive" });
        } finally {
            setBulkPaying(false);
        }
    }

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const selectAll = () => {
        const eligible = filtered.filter((i: any) => i.status !== "pago").map((i: any) => i.id);
        setSelectedIds(new Set(eligible));
    };

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
                        <h1 className="text-2xl font-bold text-emerald-800">📋 Contas a Pagar</h1>
                        <p className="text-sm text-emerald-600">
                            A pagar: <strong className="text-red-600">{formatCurrency(totalAberto)}</strong>
                            {totalVencido > 0 && <span className="ml-2 text-red-600">Vencido: {formatCurrency(totalVencido)}</span>}
                        </p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        <Button variant="outline" className="border-emerald-200 text-emerald-700" onClick={() => exportToCSV(filtered, "contas-a-pagar.csv")}>
                            <Download className="mr-2 h-4 w-4" /> Exportar CSV
                        </Button>
                        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
                            <DialogTrigger asChild>
                                <Button className="bg-emerald-600 hover:bg-emerald-700"><Plus className="mr-2 h-4 w-4" /> Nova Conta</Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader><DialogTitle>Nova Conta a Pagar</DialogTitle></DialogHeader>
                                <APForm seasons={seasons} onSave={(data: any) => save.mutate(data)} saving={save.isPending} />
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        { label: "Total em Aberto", value: totalAberto, color: "text-blue-700" },
                        { label: "Vencidos", value: totalVencido, color: "text-red-600" },
                        { label: "Total de Títulos", value: (items as any[]).length, color: "text-gray-700", isCurrency: false },
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

                {/* ── Filters ─────────────────────────────────────────────── */}
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

                {/* ── Bulk pay bar ─────────────────────────────────────────── */}
                {selectedIds.size > 0 && (
                    <Card className="border-amber-200 bg-amber-50">
                        <CardContent className="p-3 flex flex-wrap gap-3 items-center">
                            <span className="text-sm font-medium text-amber-800">{selectedIds.size} conta(s) selecionada(s)</span>
                            <Select value={bulkAccountId} onValueChange={setBulkAccountId}>
                                <SelectTrigger className="w-48 bg-white"><SelectValue placeholder="Selecione a conta..." /></SelectTrigger>
                                <SelectContent>{(accounts as any[]).map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                            </Select>
                            <Button className="bg-green-600 hover:bg-green-700" disabled={!bulkAccountId || bulkPaying} onClick={handleBulkPay}>
                                {bulkPaying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckSquare className="mr-2 h-4 w-4" />}
                                Marcar como Pagos
                            </Button>
                            <Button variant="ghost" size="sm" className="text-gray-500" onClick={() => setSelectedIds(new Set())}>Cancelar</Button>
                        </CardContent>
                    </Card>
                )}

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
                                    <th className="p-3 w-8">
                                        <input type="checkbox" className="rounded" onChange={e => e.target.checked ? selectAll() : setSelectedIds(new Set())} checked={selectedIds.size > 0 && selectedIds.size === filtered.filter((i: any) => i.status !== "pago").length} />
                                    </th>
                                    <th className="text-left p-3 font-semibold text-emerald-800">Fornecedor</th>
                                    <th className="text-left p-3 font-semibold text-emerald-800">Descrição</th>
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
                                    const isSelected = selectedIds.has(item.id);
                                    return (
                                        <tr key={item.id} className={`border-t border-gray-100 ${isOverdue ? "bg-red-50" : ""} ${isSelected ? "bg-amber-50" : ""}`}>
                                            <td className="p-3">
                                                {item.status !== "pago" && (
                                                    <input type="checkbox" className="rounded" checked={isSelected} onChange={() => toggleSelect(item.id)} />
                                                )}
                                            </td>
                                            <td className="p-3 font-medium">{item.supplier}</td>
                                            <td className="p-3 text-gray-600 max-w-[200px] truncate">{item.description || "—"}</td>
                                            <td className="p-3">{item.installmentNumber}/{item.totalInstallments}</td>
                                            <td className="p-3">{new Date(item.dueDate).toLocaleDateString("pt-BR")}</td>
                                            <td className="p-3">{statusBadge(isOverdue && item.status !== "pago" ? "vencido" : item.status)}</td>
                                            <td className="text-right p-3 font-mono font-semibold">{formatCurrency(item.totalAmount, item.currency || "USD")}</td>
                                            <td className="text-right p-3 font-mono text-green-600">{formatCurrency(item.paidAmount || 0, item.currency || "USD")}</td>
                                            <td className="p-3 flex gap-1">
                                                {item.status !== "pago" && (
                                                    <Button size="sm" className="bg-green-600 hover:bg-green-700 h-7 text-xs"
                                                        onClick={() => setPayingItem(item)}>Pagar</Button>
                                                )}
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

                {/* Pay Dialog */}
                <Dialog open={!!payingItem} onOpenChange={(o) => !o && setPayingItem(null)}>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Pagar Conta</DialogTitle></DialogHeader>
                        {payingItem && <PayForm item={payingItem} accounts={accounts}
                            onPay={(data: any) => pay.mutate({ id: payingItem.id, data: { ...data, supplier: payingItem.supplier } })}
                            saving={pay.isPending} />}
                    </DialogContent>
                </Dialog>

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

function APForm({ onSave, saving, seasons }: any) {
    const [supplier, setSupplier] = useState("");
    const [description, setDescription] = useState("");
    const [totalAmount, setTotalAmount] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [totalInstallments, setTotalInstallments] = useState("1");
    const [seasonId, setSeasonId] = useState("__none__");

    const installments = parseInt(totalInstallments) || 1;
    const perInstallment = totalAmount ? (parseFloat(totalAmount) / installments).toFixed(2) : "0.00";

    return (
        <form onSubmit={(e) => {
            e.preventDefault();
            onSave({ supplier, description, totalAmount, dueDate, installmentNumber: 1, totalInstallments: installments, seasonId: seasonId === "__none__" ? null : seasonId || null });
        }} className="space-y-4">
            <div><Label>Fornecedor *</Label><Input value={supplier} onChange={e => setSupplier(e.target.value)} required /></div>
            <div><Label>Descrição</Label><Input value={description} onChange={e => setDescription(e.target.value)} /></div>
            <div><Label>Valor Total ($) *</Label><Input type="number" step="0.01" value={totalAmount} onChange={e => setTotalAmount(e.target.value)} required /></div>
            <div><Label>Primeiro Vencimento *</Label><Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} required /></div>
            <div>
                <Label>Nº de Parcelas</Label>
                <Input type="number" min="1" max="60" value={totalInstallments} onChange={e => setTotalInstallments(e.target.value)} />
                {installments > 1 && (
                    <p className="text-xs text-emerald-600 mt-1">
                        {installments}x de {formatCurrency(perInstallment)} — vencimentos mensais gerados automaticamente
                    </p>
                )}
            </div>
            {seasons.length > 0 && (
                <div>
                    <Label>Vincular à Safra (opcional)</Label>
                    <Select value={seasonId} onValueChange={setSeasonId}>
                        <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__none__">Nenhuma</SelectItem>
                            {seasons.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            )}
            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={saving || !supplier || !totalAmount || !dueDate}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {installments > 1 ? `Gerar ${installments} Parcelas` : "Registrar"}
            </Button>
        </form>
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

function PayForm({ item, accounts, onPay, saving }: any) {
    const remaining = parseFloat(item.totalAmount) - parseFloat(item.paidAmount || 0);
    const [paymentMethod, setPaymentMethod] = useState("transferencia");
    const [observacao, setObservacao] = useState("");
    const [receiptNumber, setReceiptNumber] = useState("");

    // Cheque fields
    const [chequeBanco, setChequeBanco] = useState("");
    const [chequeNumero, setChequeNumero] = useState("");
    const [chequeTipo, setChequeTipo] = useState("proprio");

    // Multiple account rows
    const [accountRows, setAccountRows] = useState<{ accountId: string; amount: string }[]>([
        { accountId: "", amount: remaining.toFixed(2) },
    ]);

    const addAccountRow = () => {
        setAccountRows(prev => [...prev, { accountId: "", amount: "" }]);
    };

    const removeAccountRow = (idx: number) => {
        if (accountRows.length <= 1) return;
        setAccountRows(prev => prev.filter((_, i) => i !== idx));
    };

    const updateRow = (idx: number, field: "accountId" | "amount", value: string) => {
        setAccountRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
    };

    const totalAllocated = accountRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const allRowsValid = accountRows.every(r => r.accountId && parseFloat(r.amount) > 0);
    const totalMatch = Math.abs(totalAllocated - parseFloat(accountRows.length === 1 ? accountRows[0].amount : String(totalAllocated))) < 0.01;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const payload: any = {
            accountId: accountRows[0].accountId,
            amount: totalAllocated.toFixed(2),
            paymentMethod,
            observacao: observacao || undefined,
            receiptNumber: receiptNumber || undefined,
            accountRows: accountRows.length > 1 ? accountRows.map(r => ({ accountId: r.accountId, amount: parseFloat(r.amount).toFixed(2) })) : undefined,
        };

        if (paymentMethod === "cheque") {
            payload.cheque = {
                banco: chequeBanco,
                numero: chequeNumero,
                tipo: chequeTipo,
            };
        }

        onPay(payload);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="p-3 bg-gray-50 rounded-lg text-sm">
                <p>Fornecedor: <strong>{item.supplier}</strong></p>
                <p>Valor Total: {formatCurrency(item.totalAmount, item.currency || "USD")}</p>
                <p>Ja Pago: {formatCurrency(item.paidAmount || 0, item.currency || "USD")}</p>
                <p className="text-lg font-bold text-red-600">Restante: {formatCurrency(remaining, item.currency || "USD")}</p>
            </div>

            {/* Multiple account rows */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label className="font-semibold">Conta(s) Bancaria(s) *</Label>
                    <Button type="button" variant="outline" size="sm" className="text-xs h-7 border-emerald-200 text-emerald-700" onClick={addAccountRow}>
                        <PlusCircle className="mr-1 h-3 w-3" /> Adicionar conta
                    </Button>
                </div>
                {accountRows.map((row, idx) => (
                    <div key={idx} className="flex gap-2 items-end">
                        <div className="flex-1">
                            {idx === 0 && <Label className="text-xs text-gray-500">Conta</Label>}
                            <Select value={row.accountId} onValueChange={v => updateRow(idx, "accountId", v)}>
                                <SelectTrigger><SelectValue placeholder="Selecione a conta..." /></SelectTrigger>
                                <SelectContent>{(accounts as any[]).map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="w-32">
                            {idx === 0 && <Label className="text-xs text-gray-500">Valor</Label>}
                            <Input type="number" step="0.01" value={row.amount} onChange={e => updateRow(idx, "amount", e.target.value)} placeholder="0.00" />
                        </div>
                        {accountRows.length > 1 && (
                            <Button type="button" variant="ghost" size="sm" className="text-red-500 h-9 px-2" onClick={() => removeAccountRow(idx)}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                ))}
                {accountRows.length > 1 && (
                    <p className={`text-xs font-medium ${Math.abs(totalAllocated - remaining) < 0.01 ? "text-green-600" : "text-red-600"}`}>
                        Total alocado: {formatCurrency(totalAllocated, item.currency || "USD")} / Restante: {formatCurrency(remaining, item.currency || "USD")}
                    </p>
                )}
            </div>

            <div><Label>Metodo de Pagamento</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="transferencia">Transferencia</SelectItem>
                        <SelectItem value="dinheiro">Dinheiro</SelectItem>
                        <SelectItem value="cheque">Cheque</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {paymentMethod === "cheque" && (
                <div className="space-y-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <p className="text-xs font-semibold text-blue-700">Dados do Cheque</p>
                    <div><Label className="text-xs">Banco *</Label><Input value={chequeBanco} onChange={e => setChequeBanco(e.target.value)} placeholder="Nome do banco" required /></div>
                    <div><Label className="text-xs">Numero do Cheque *</Label><Input value={chequeNumero} onChange={e => setChequeNumero(e.target.value)} placeholder="000000" required /></div>
                    <div><Label className="text-xs">Tipo</Label>
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

            <div><Label>Nr. Recibo/Comprovante</Label><Input value={receiptNumber} onChange={e => setReceiptNumber(e.target.value)} placeholder="Ex: REC-00123" /></div>

            <div><Label>Observacao</Label><Textarea value={observacao} onChange={e => setObservacao(e.target.value)} placeholder="Observacoes sobre o pagamento..." rows={2} className="resize-none" /></div>

            <Button type="submit" className="w-full bg-green-600 hover:bg-green-700" disabled={saving || !allRowsValid || (paymentMethod === "cheque" && (!chequeBanco || !chequeNumero))}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Confirmar Pagamento
            </Button>
        </form>
    );
}
