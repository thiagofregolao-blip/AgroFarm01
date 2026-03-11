import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import FarmLayout from "@/components/fazenda/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, HandCoins, Loader2, Download, CheckSquare, Square, CheckCheck } from "lucide-react";

// ─── CSV export ────────────────────────────────────────────────────────────
function exportToCSV(data: any[], filename: string) {
    if (!data.length) return;
    const headers = ["Comprador", "Descrição", "Vencimento", "Status", "Valor Total", "Recebido", "Saldo"];
    const rows = data.map((i: any) => [
        i.buyer,
        i.description || "",
        new Date(i.dueDate).toLocaleDateString("pt-BR"),
        i.status,
        parseFloat(i.totalAmount).toFixed(2),
        parseFloat(i.receivedAmount || 0).toFixed(2),
        (parseFloat(i.totalAmount) - parseFloat(i.receivedAmount || 0)).toFixed(2),
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
        mutationFn: async ({ id, data }: { id: string; data: any }) => apiRequest("POST", `/api/farm/accounts-receivable/${id}/receive`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/accounts-receivable"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/cash-accounts"] });
            toast({ title: "✅ Recebimento registrado no Fluxo de Caixa!" }); setReceivingItem(null);
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
                            A receber: <strong className="text-blue-600">$ {totalPendente.toFixed(2)}</strong>
                            {totalVencido > 0 && <> · Vencido: <strong className="text-red-600">$ {totalVencido.toFixed(2)}</strong></>}
                            {" "} · Recebido: <strong className="text-green-600">$ {totalRecebido.toFixed(2)}</strong>
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
                                        <td className="text-right p-3 font-mono font-semibold">$ {parseFloat(item.totalAmount).toFixed(2)}</td>
                                        <td className="text-right p-3 font-mono text-green-600">$ {parseFloat(item.receivedAmount || 0).toFixed(2)}</td>
                                        <td className="p-3 flex gap-1 justify-end">
                                            {item.status !== "recebido" &&
                                                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 h-7 text-xs" onClick={() => setReceivingItem(item)}>Receber</Button>}
                                            <Button variant="ghost" size="sm" className="text-red-500 h-7 text-xs" onClick={() => { if (confirm("Remover?")) del.mutate(item.id); }}>×</Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="p-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-sm text-gray-600">
                            <span>{filtered.length} registros</span>
                            <span>Total filtrado: <strong>$ {filtered.reduce((s: number, i: any) => s + parseFloat(i.totalAmount), 0).toFixed(2)}</strong></span>
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
    const [accountId, setAccountId] = useState("");
    const [amount, setAmount] = useState(remaining.toFixed(2));
    const [paymentMethod, setPaymentMethod] = useState("transferencia");
    return (
        <form onSubmit={(e) => { e.preventDefault(); onReceive({ accountId, amount, paymentMethod }); }} className="space-y-4">
            <div className="p-3 bg-gray-50 rounded-lg text-sm">
                <p>Comprador: <strong>{item.buyer}</strong></p>
                <p className="text-lg font-bold text-blue-600">Restante: $ {remaining.toFixed(2)}</p>
            </div>
            <div><Label>Conta Bancária *</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>{(accounts as any[]).map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>)}</SelectContent>
                </Select>
            </div>
            <div><Label>Valor ($)</Label><Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} /></div>
            <div><Label>Forma de Recebimento</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="transferencia">Transferência Bancária</SelectItem>
                        <SelectItem value="pix">PIX</SelectItem>
                        <SelectItem value="efetivo">Dinheiro / Efetivo</SelectItem>
                        <SelectItem value="cheque">Cheque</SelectItem>
                        <SelectItem value="cartao">Cartão</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={saving || !accountId}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Confirmar Recebimento
            </Button>
        </form>
    );
}
