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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Receipt, Loader2, AlertTriangle, CheckCircle, Clock } from "lucide-react";

export default function AccountsPayable() {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [openCreate, setOpenCreate] = useState(false);
    const [payingItem, setPayingItem] = useState<any>(null);
    const { user } = useAuth();

    const { data: items = [], isLoading } = useQuery({
        queryKey: ["/api/farm/accounts-payable"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/accounts-payable"); return r.json(); },
        enabled: !!user,
    });

    const { data: accounts = [] } = useQuery({
        queryKey: ["/api/farm/cash-accounts"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/cash-accounts"); return r.json(); },
        enabled: !!user,
    });

    const totalAberto = items.filter((i: any) => i.status === "aberto" || i.status === "parcial")
        .reduce((s: number, i: any) => s + parseFloat(i.totalAmount) - parseFloat(i.paidAmount || 0), 0);
    const totalVencido = items.filter((i: any) => (i.status === "aberto" || i.status === "parcial") && new Date(i.dueDate) < new Date())
        .reduce((s: number, i: any) => s + parseFloat(i.totalAmount) - parseFloat(i.paidAmount || 0), 0);

    const save = useMutation({
        mutationFn: async (data: any) => apiRequest("POST", "/api/farm/accounts-payable", data),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/farm/accounts-payable"] }); toast({ title: "Conta registrada" }); setOpenCreate(false); },
    });

    const pay = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: any }) => apiRequest("POST", `/api/farm/accounts-payable/${id}/pay`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/accounts-payable"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/cash-accounts"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/cash-transactions"] });
            toast({ title: "✅ Pagamento registrado no Fluxo de Caixa!" });
            setPayingItem(null);
        },
    });

    const del = useMutation({
        mutationFn: async (id: string) => apiRequest("DELETE", `/api/farm/accounts-payable/${id}`),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/farm/accounts-payable"] }); toast({ title: "Removido" }); },
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
                        <h1 className="text-2xl font-bold text-emerald-800">📋 Contas a Pagar</h1>
                        <p className="text-sm text-emerald-600">
                            A pagar: <strong className="text-red-600">$ {totalAberto.toFixed(2)}</strong>
                            {totalVencido > 0 && <span className="ml-2 text-red-600">⚠️ Vencido: $ {totalVencido.toFixed(2)}</span>}
                        </p>
                    </div>
                    <Dialog open={openCreate} onOpenChange={setOpenCreate}>
                        <DialogTrigger asChild>
                            <Button className="bg-emerald-600 hover:bg-emerald-700"><Plus className="mr-2 h-4 w-4" /> Nova Conta</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader><DialogTitle>Nova Conta a Pagar</DialogTitle></DialogHeader>
                            <APForm onSave={(data: any) => save.mutate(data)} saving={save.isPending} />
                        </DialogContent>
                    </Dialog>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        { label: "Total em Aberto", value: totalAberto, color: "text-blue-700" },
                        { label: "Vencidos", value: totalVencido, color: "text-red-600" },
                        { label: "Total de Títulos", value: items.length, color: "text-gray-700", isCurrency: false },
                        { label: "Pagos", value: items.filter((i: any) => i.status === "pago").length, color: "text-green-700", isCurrency: false },
                    ].map((c, idx) => (
                        <Card key={idx} className="border-emerald-100"><CardContent className="p-4">
                            <p className="text-xs text-gray-500">{c.label}</p>
                            <p className={`text-xl font-bold ${c.color}`}>
                                {c.isCurrency !== false ? `$ ${(c.value as number).toFixed(2)}` : c.value}
                            </p>
                        </CardContent></Card>
                    ))}
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
                ) : items.length === 0 ? (
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
                                {items.map((item: any) => {
                                    const isOverdue = (item.status === "aberto" || item.status === "parcial") && new Date(item.dueDate) < new Date();
                                    return (
                                        <tr key={item.id} className={`border-t border-gray-100 ${isOverdue ? "bg-red-50" : ""}`}>
                                            <td className="p-3 font-medium">{item.supplier}</td>
                                            <td className="p-3 text-gray-600 max-w-[200px] truncate">{item.description || "—"}</td>
                                            <td className="p-3">{item.installmentNumber}/{item.totalInstallments}</td>
                                            <td className="p-3">{new Date(item.dueDate).toLocaleDateString("pt-BR")}</td>
                                            <td className="p-3">{statusBadge(isOverdue && item.status !== "pago" ? "vencido" : item.status)}</td>
                                            <td className="text-right p-3 font-mono font-semibold">$ {parseFloat(item.totalAmount).toFixed(2)}</td>
                                            <td className="text-right p-3 font-mono text-green-600">$ {parseFloat(item.paidAmount || 0).toFixed(2)}</td>
                                            <td className="p-3 flex gap-1">
                                                {item.status !== "pago" && (
                                                    <Button size="sm" className="bg-green-600 hover:bg-green-700 h-7 text-xs"
                                                        onClick={() => setPayingItem(item)}>Pagar</Button>
                                                )}
                                                <Button variant="ghost" size="sm" className="text-red-500 h-7 text-xs"
                                                    onClick={() => { if (confirm("Remover?")) del.mutate(item.id); }}>×</Button>
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
                        <DialogHeader><DialogTitle>💰 Pagar Conta</DialogTitle></DialogHeader>
                        {payingItem && <PayForm item={payingItem} accounts={accounts}
                            onPay={(data: any) => pay.mutate({ id: payingItem.id, data })}
                            saving={pay.isPending} />}
                    </DialogContent>
                </Dialog>
            </div>
        </FarmLayout>
    );
}

function APForm({ onSave, saving }: any) {
    const [supplier, setSupplier] = useState("");
    const [description, setDescription] = useState("");
    const [totalAmount, setTotalAmount] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [installmentNumber, setInstallmentNumber] = useState("1");
    const [totalInstallments, setTotalInstallments] = useState("1");

    return (
        <form onSubmit={(e) => { e.preventDefault(); onSave({ supplier, description, totalAmount, dueDate, installmentNumber: parseInt(installmentNumber), totalInstallments: parseInt(totalInstallments) }); }} className="space-y-4">
            <div><Label>Fornecedor *</Label><Input value={supplier} onChange={e => setSupplier(e.target.value)} required /></div>
            <div><Label>Descrição</Label><Input value={description} onChange={e => setDescription(e.target.value)} /></div>
            <div><Label>Valor ($) *</Label><Input type="number" step="0.01" value={totalAmount} onChange={e => setTotalAmount(e.target.value)} required /></div>
            <div><Label>Vencimento *</Label><Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} required /></div>
            <div className="grid grid-cols-2 gap-4">
                <div><Label>Parcela Nº</Label><Input type="number" value={installmentNumber} onChange={e => setInstallmentNumber(e.target.value)} /></div>
                <div><Label>de</Label><Input type="number" value={totalInstallments} onChange={e => setTotalInstallments(e.target.value)} /></div>
            </div>
            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={saving || !supplier || !totalAmount || !dueDate}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Registrar
            </Button>
        </form>
    );
}

function PayForm({ item, accounts, onPay, saving }: any) {
    const remaining = parseFloat(item.totalAmount) - parseFloat(item.paidAmount || 0);
    const [accountId, setAccountId] = useState("");
    const [amount, setAmount] = useState(remaining.toFixed(2));
    const [paymentMethod, setPaymentMethod] = useState("transferencia");

    return (
        <form onSubmit={(e) => { e.preventDefault(); onPay({ accountId, amount, paymentMethod }); }} className="space-y-4">
            <div className="p-3 bg-gray-50 rounded-lg text-sm">
                <p>Fornecedor: <strong>{item.supplier}</strong></p>
                <p>Valor Total: $ {parseFloat(item.totalAmount).toFixed(2)}</p>
                <p>Já Pago: $ {parseFloat(item.paidAmount || 0).toFixed(2)}</p>
                <p className="text-lg font-bold text-red-600">Restante: $ {remaining.toFixed(2)}</p>
            </div>
            <div><Label>Conta Bancária *</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                    <SelectTrigger><SelectValue placeholder="Selecione a conta..." /></SelectTrigger>
                    <SelectContent>{accounts.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>)}</SelectContent>
                </Select>
            </div>
            <div><Label>Valor a Pagar ($)</Label><Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} /></div>
            <div><Label>Método</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="transferencia">Transferência</SelectItem>
                        <SelectItem value="cheque">Cheque</SelectItem>
                        <SelectItem value="dinheiro">Dinheiro</SelectItem>
                        <SelectItem value="cartao">Cartão</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <Button type="submit" className="w-full bg-green-600 hover:bg-green-700" disabled={saving || !accountId}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Confirmar Pagamento
            </Button>
        </form>
    );
}
