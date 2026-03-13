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
import { useToast } from "@/hooks/use-toast";
import { Plus, HandCoins, Loader2, Download, CheckSquare, Square, CheckCheck, PlusCircle, Trash2 } from "lucide-react";

// ─── CSV export ────────────────────────────────────────────────────────────
function exportToCSV(data: any[], filename: string) {
    if (!data.length) return;
    const headers = ["Comprador", "Descrição", "Vencimento", "Status", "Valor Total", "Recebido", "Saldo"];
    const rows = data.map((i: any) => [
        i.buyer,
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

    // Enrich status: vencido if dueDate past and not received
    const enriched = useMemo(() => (items as any[]).map((i: any) => {
        const isPast = new Date(i.dueDate) < new Date() && i.status !== "recebido";
        return { ...i, status: isPast && i.status === "pendente" ? "vencido" : i.status };
    }), [items]);

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
    const receive = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: any }) => {
            const { paymentRows, cheques, buyerName } = data;
            const totalAmount = paymentRows.reduce((s: number, r: any) => s + parseFloat(r.amount || 0), 0);

            // Create cheque records first
            const createdCheques: any[] = [];
            for (const ch of (cheques || [])) {
                const r = await apiRequest("POST", "/api/farm/cheques", {
                    type: "recebido",
                    chequeNumber: String(ch.numero || ""),
                    bank: String(ch.banco || ""),
                    holder: String(ch.titular || ""),
                    amount: String(ch.valor || "0"),
                    currency: String(ch.currency || "USD"),
                    issueDate: new Date().toISOString(),
                    relatedReceivableId: String(id),
                });
                const created = await r.json();
                createdCheques.push(created);
            }

            // Submit each payment row
            for (const row of paymentRows) {
                await apiRequest("POST", `/api/farm/accounts-receivable/${id}/receive`, {
                    accountId: row.accountId,
                    amount: row.amount,
                    paymentMethod: row.paymentMethod,
                });
            }

            // Build payment methods for receipt
            const paymentMethods = paymentRows.map((row: any, idx: number) => ({
                method: row.paymentMethod,
                accountId: row.accountId,
                amount: row.amount,
                chequeId: row.paymentMethod === "cheque" && createdCheques[idx] ? createdCheques[idx].id : undefined,
            }));

            // Determine if partial or total
            const item = (items as any[]).find((i: any) => i.id === id);
            const remaining = item ? parseFloat(item.totalAmount) - parseFloat(item.receivedAmount || 0) : totalAmount;
            const paymentType = totalAmount >= remaining ? "total" : "parcial";

            // Create receipt
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

    // Bulk: mark selected as received (receive full amount to default account)
    function handleBulkReceive() {
        if (!accounts.length) { toast({ title: "Cadastre uma conta bancária primeiro", variant: "destructive" }); return; }
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
            toast({ title: `✅ ${todo.length} contas marcadas como recebidas!` });
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
                        <h1 className="text-2xl font-bold text-emerald-800">💰 Contas a Receber</h1>
                        <p className="text-sm text-emerald-600">
                            A receber: <strong className="text-blue-600">{formatCurrency(totalPendente)}</strong>
                            {totalVencido > 0 && <> · Vencido: <strong className="text-red-600">{formatCurrency(totalVencido)}</strong></>}
                            {" "} · Recebido: <strong className="text-green-600">{formatCurrency(totalRecebido)}</strong>
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
                            <DialogContent>
                                <DialogHeader><DialogTitle>Nova Conta a Receber</DialogTitle></DialogHeader>
                                <form onSubmit={(e: any) => {
                                    e.preventDefault();
                                    const fd = new FormData(e.target);
                                    save.mutate({ buyer: fd.get("buyer"), description: fd.get("description"), totalAmount: fd.get("totalAmount"), dueDate: fd.get("dueDate") });
                                }} className="space-y-4">
                                    <div><Label>Comprador *</Label><Input name="buyer" required /></div>
                                    <div><Label>Descrição</Label><Input name="description" /></div>
                                    <div><Label>Valor ($) *</Label><Input name="totalAmount" type="number" step="0.01" required /></div>
                                    <div><Label>Vencimento *</Label><Input name="dueDate" type="date" required /></div>
                                    <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={save.isPending}>
                                        {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Registrar
                                    </Button>
                                </form>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

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
                                <p className="text-xs text-gray-500 mb-1">até</p>
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
                                    <th className="text-left p-3 font-semibold text-emerald-800">Descrição</th>
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
                                        <td className="p-3 text-gray-600 max-w-[200px] truncate">{item.description || "—"}</td>
                                        <td className="p-3">{new Date(item.dueDate).toLocaleDateString("pt-BR")}</td>
                                        <td className="p-3">{badge(item.status)}</td>
                                        <td className="text-right p-3 font-mono font-semibold">{formatCurrency(item.totalAmount)}</td>
                                        <td className="text-right p-3 font-mono text-green-600">{formatCurrency(item.receivedAmount || 0)}</td>
                                        <td className={`text-right p-3 font-mono font-semibold ${(parseFloat(item.totalAmount) - parseFloat(item.receivedAmount || 0)) > 0 ? "text-red-600" : "text-green-600"}`}>
                                            {formatCurrency(parseFloat(item.totalAmount) - parseFloat(item.receivedAmount || 0))}
                                        </td>
                                        <td className="p-3 flex gap-1 justify-end">
                                            {item.status !== "recebido" &&
                                                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 h-7 text-xs" onClick={() => setReceivingItem(item)}>Cobrar</Button>}
                                            <Button variant="ghost" size="sm" className="text-red-500 h-7 text-xs" onClick={() => { if (confirm("Remover?")) del.mutate(item.id); }}>×</Button>
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

                <Dialog open={!!receivingItem} onOpenChange={(o) => !o && setReceivingItem(null)}>
                    <DialogContent>
                        <DialogHeader><DialogTitle>💰 Receber Pagamento</DialogTitle></DialogHeader>
                        {receivingItem && <ReceiveForm item={receivingItem} accounts={accounts} onReceive={(data: any) => receive.mutate({ id: receivingItem.id, data })} saving={receive.isPending} />}
                    </DialogContent>
                </Dialog>
            </div>
        </FarmLayout>
    );
}

function ReceiveForm({ item, accounts, onReceive, saving }: any) {
    const remaining = parseFloat(item.totalAmount) - parseFloat(item.receivedAmount || 0);

    // Payment rows (multi-account split)
    const [paymentRows, setPaymentRows] = useState<{ accountId: string; amount: string; paymentMethod: string }[]>([
        { accountId: "", amount: remaining.toFixed(2), paymentMethod: "transferencia" },
    ]);

    // Cheque fields (visible when any row uses cheque)
    const [chequeBanco, setChequeBanco] = useState("");
    const [chequeTitular, setChequeTitular] = useState("");
    const [chequeNumero, setChequeNumero] = useState("");
    const [chequeValor, setChequeValor] = useState("");
    const [chequeCurrency, setChequeCurrency] = useState("USD");
    const [cheques, setCheques] = useState<{ banco: string; titular: string; numero: string; valor: string; currency: string }[]>([]);

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
        setCheques([...cheques, { banco: chequeBanco, titular: chequeTitular, numero: chequeNumero, valor: chequeValor, currency: chequeCurrency }]);
        setChequeBanco(""); setChequeTitular(""); setChequeNumero(""); setChequeValor(""); setChequeCurrency("USD");
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

            {/* Payment rows - multi account */}
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

            {/* Cheque section */}
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
