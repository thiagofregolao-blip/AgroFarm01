import { useState } from "react";
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
import { Plus, HandCoins, Loader2, Clock, CheckCircle, AlertTriangle } from "lucide-react";

export default function AccountsReceivable() {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [openCreate, setOpenCreate] = useState(false);
    const [receivingItem, setReceivingItem] = useState<any>(null);
    const { user } = useAuth();

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

    const totalPendente = items.filter((i: any) => i.status !== "recebido").reduce((s: number, i: any) => s + parseFloat(i.totalAmount) - parseFloat(i.receivedAmount || 0), 0);
    const totalRecebido = items.filter((i: any) => i.status === "recebido").reduce((s: number, i: any) => s + parseFloat(i.totalAmount), 0);

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

    const badge = (s: string) => {
        const m: Record<string, string> = { pendente: "bg-blue-100 text-blue-700", parcial: "bg-amber-100 text-amber-700", recebido: "bg-green-100 text-green-700" };
        return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m[s] || m.pendente}`}>{s}</span>;
    };

    return (
        <FarmLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-emerald-800">💰 Contas a Receber</h1>
                        <p className="text-sm text-emerald-600">A receber: <strong className="text-blue-600">$ {totalPendente.toFixed(2)}</strong> • Recebido: <strong className="text-green-600">$ {totalRecebido.toFixed(2)}</strong></p>
                    </div>
                    <Dialog open={openCreate} onOpenChange={setOpenCreate}>
                        <DialogTrigger asChild><Button className="bg-emerald-600 hover:bg-emerald-700"><Plus className="mr-2 h-4 w-4" /> Nova Conta</Button></DialogTrigger>
                        <DialogContent>
                            <DialogHeader><DialogTitle>Nova Conta a Receber</DialogTitle></DialogHeader>
                            <form onSubmit={(e: any) => { e.preventDefault(); const fd = new FormData(e.target); save.mutate({ buyer: fd.get("buyer"), description: fd.get("description"), totalAmount: fd.get("totalAmount"), dueDate: fd.get("dueDate") }); }} className="space-y-4">
                                <div><Label>Comprador *</Label><Input name="buyer" required /></div>
                                <div><Label>Descrição</Label><Input name="description" /></div>
                                <div><Label>Valor ($) *</Label><Input name="totalAmount" type="number" step="0.01" required /></div>
                                <div><Label>Vencimento *</Label><Input name="dueDate" type="date" required /></div>
                                <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={save.isPending}>{save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Registrar</Button>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>

                {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div> : items.length === 0 ? (
                    <Card className="border-emerald-100"><CardContent className="py-12 text-center"><HandCoins className="h-12 w-12 text-gray-300 mx-auto mb-4" /><p className="text-gray-500">Nenhuma conta a receber</p></CardContent></Card>
                ) : (
                    <div className="bg-white rounded-xl border border-emerald-100 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-emerald-50"><tr>
                                <th className="text-left p-3 font-semibold text-emerald-800">Comprador</th>
                                <th className="text-left p-3 font-semibold text-emerald-800">Descrição</th>
                                <th className="text-left p-3 font-semibold text-emerald-800">Vencimento</th>
                                <th className="text-left p-3 font-semibold text-emerald-800">Status</th>
                                <th className="text-right p-3 font-semibold text-emerald-800">Valor</th>
                                <th className="text-right p-3 font-semibold text-emerald-800">Recebido</th>
                                <th className="p-3"></th>
                            </tr></thead>
                            <tbody>
                                {items.map((item: any) => (
                                    <tr key={item.id} className="border-t border-gray-100">
                                        <td className="p-3 font-medium">{item.buyer}</td>
                                        <td className="p-3 text-gray-600 max-w-[200px] truncate">{item.description || "—"}</td>
                                        <td className="p-3">{new Date(item.dueDate).toLocaleDateString("pt-BR")}</td>
                                        <td className="p-3">{badge(item.status)}</td>
                                        <td className="text-right p-3 font-mono font-semibold">$ {parseFloat(item.totalAmount).toFixed(2)}</td>
                                        <td className="text-right p-3 font-mono text-green-600">$ {parseFloat(item.receivedAmount || 0).toFixed(2)}</td>
                                        <td className="p-3 flex gap-1">
                                            {item.status !== "recebido" && <Button size="sm" className="bg-blue-600 hover:bg-blue-700 h-7 text-xs" onClick={() => setReceivingItem(item)}>Receber</Button>}
                                            <Button variant="ghost" size="sm" className="text-red-500 h-7 text-xs" onClick={() => { if (confirm("Remover?")) del.mutate(item.id); }}>×</Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
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
                <Select value={accountId} onValueChange={setAccountId}><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>{accounts.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>)}</SelectContent>
                </Select>
            </div>
            <div><Label>Valor ($)</Label><Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} /></div>
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={saving || !accountId}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Confirmar</Button>
        </form>
    );
}
