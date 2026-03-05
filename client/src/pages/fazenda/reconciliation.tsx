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
import { Plus, Building2, Loader2, Link2, CheckCircle } from "lucide-react";

export default function BankReconciliation() {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [openCreate, setOpenCreate] = useState(false);
    const [matchingItem, setMatchingItem] = useState<any>(null);
    const { user } = useAuth();

    const { data: statements = [], isLoading } = useQuery({
        queryKey: ["/api/farm/bank-statements"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/bank-statements"); return r.json(); },
        enabled: !!user,
    });
    const { data: accounts = [] } = useQuery({
        queryKey: ["/api/farm/cash-accounts"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/cash-accounts"); return r.json(); },
        enabled: !!user,
    });
    const { data: transactions = [] } = useQuery({
        queryKey: ["/api/farm/cash-transactions"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/cash-transactions"); return r.json(); },
        enabled: !!user,
    });

    const pending = statements.filter((s: any) => s.status === "pending").length;
    const matched = statements.filter((s: any) => s.status === "matched").length;

    const save = useMutation({
        mutationFn: async (data: any) => apiRequest("POST", "/api/farm/bank-statements", data),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/farm/bank-statements"] }); toast({ title: "Extrato importado" }); setOpenCreate(false); },
    });

    const match = useMutation({
        mutationFn: async ({ id, transactionId }: { id: string; transactionId: string }) => apiRequest("POST", `/api/farm/bank-statements/${id}/match`, { transactionId }),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/farm/bank-statements"] }); toast({ title: "✅ Conciliado!" }); setMatchingItem(null); },
    });

    const badge = (s: string) => {
        const m: Record<string, string> = { pending: "bg-amber-100 text-amber-700", matched: "bg-green-100 text-green-700", unmatched: "bg-red-100 text-red-700" };
        const labels: Record<string, string> = { pending: "Pendente", matched: "Conciliado", unmatched: "Não encontrado" };
        return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m[s] || m.pending}`}>{labels[s] || s}</span>;
    };

    return (
        <FarmLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-emerald-800">🏦 Conciliação Bancária</h1>
                        <p className="text-sm text-emerald-600">Pendentes: <strong className="text-amber-600">{pending}</strong> • Conciliados: <strong className="text-green-600">{matched}</strong></p>
                    </div>
                    <Dialog open={openCreate} onOpenChange={setOpenCreate}>
                        <DialogTrigger asChild><Button className="bg-emerald-600 hover:bg-emerald-700"><Plus className="mr-2 h-4 w-4" /> Lançar Extrato</Button></DialogTrigger>
                        <DialogContent>
                            <DialogHeader><DialogTitle>Lançar Linha do Extrato</DialogTitle></DialogHeader>
                            <form onSubmit={(e: any) => { e.preventDefault(); const fd = new FormData(e.target); save.mutate({ accountId: fd.get("accountId"), transactionDate: fd.get("transactionDate"), description: fd.get("description"), amount: fd.get("amount"), type: fd.get("type") }); }} className="space-y-4">
                                <div><Label>Conta *</Label>
                                    <Select name="accountId"><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                        <SelectContent>{accounts.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div><Label>Data *</Label><Input name="transactionDate" type="date" required /></div>
                                <div><Label>Descrição *</Label><Input name="description" required /></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><Label>Valor ($) *</Label><Input name="amount" type="number" step="0.01" required /></div>
                                    <div><Label>Tipo *</Label>
                                        <Select name="type"><SelectTrigger><SelectValue placeholder="Tipo..." /></SelectTrigger>
                                            <SelectContent><SelectItem value="credit">Crédito</SelectItem><SelectItem value="debit">Débito</SelectItem></SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={save.isPending}>{save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Registrar</Button>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>

                {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div> : statements.length === 0 ? (
                    <Card className="border-emerald-100"><CardContent className="py-12 text-center"><Building2 className="h-12 w-12 text-gray-300 mx-auto mb-4" /><p className="text-gray-500">Nenhum lançamento de extrato</p></CardContent></Card>
                ) : (
                    <div className="bg-white rounded-xl border border-emerald-100 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-emerald-50"><tr>
                                <th className="text-left p-3 font-semibold text-emerald-800">Data</th>
                                <th className="text-left p-3 font-semibold text-emerald-800">Descrição</th>
                                <th className="text-left p-3 font-semibold text-emerald-800">Tipo</th>
                                <th className="text-right p-3 font-semibold text-emerald-800">Valor</th>
                                <th className="text-left p-3 font-semibold text-emerald-800">Status</th>
                                <th className="p-3"></th>
                            </tr></thead>
                            <tbody>
                                {statements.map((s: any) => (
                                    <tr key={s.id} className="border-t border-gray-100">
                                        <td className="p-3">{new Date(s.transactionDate).toLocaleDateString("pt-BR")}</td>
                                        <td className="p-3">{s.description}</td>
                                        <td className="p-3">{s.type === "credit" ? <span className="text-green-600">Crédito</span> : <span className="text-red-600">Débito</span>}</td>
                                        <td className={`text-right p-3 font-mono font-semibold ${s.type === "credit" ? "text-green-700" : "text-red-600"}`}>
                                            {s.type === "credit" ? "+" : "-"} $ {Math.abs(parseFloat(s.amount)).toFixed(2)}
                                        </td>
                                        <td className="p-3">{badge(s.status)}</td>
                                        <td className="p-3">
                                            {s.status === "pending" && (
                                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setMatchingItem(s)}>
                                                    <Link2 className="h-3 w-3 mr-1" /> Conciliar
                                                </Button>
                                            )}
                                            {s.status === "matched" && <CheckCircle className="h-4 w-4 text-green-500" />}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <Dialog open={!!matchingItem} onOpenChange={(o) => !o && setMatchingItem(null)}>
                    <DialogContent className="max-w-lg">
                        <DialogHeader><DialogTitle>🔗 Conciliar com Transação</DialogTitle></DialogHeader>
                        {matchingItem && (
                            <div className="space-y-3">
                                <div className="p-3 bg-gray-50 rounded-lg text-sm">
                                    <p>Extrato: <strong>{matchingItem.description}</strong></p>
                                    <p>Valor: $ {parseFloat(matchingItem.amount).toFixed(2)} ({matchingItem.type})</p>
                                </div>
                                <p className="text-sm text-gray-500">Selecione a transação do Fluxo de Caixa correspondente:</p>
                                <div className="max-h-[300px] overflow-y-auto space-y-2">
                                    {transactions.filter((t: any) => !matchingItem || (matchingItem.type === "credit" ? t.type === "entrada" : t.type === "saida")).map((t: any) => (
                                        <button key={t.id} className="w-full text-left p-3 border rounded-lg hover:bg-emerald-50 transition text-sm"
                                            onClick={() => match.mutate({ id: matchingItem.id, transactionId: t.id })}>
                                            <div className="flex justify-between">
                                                <span className="font-medium">{t.description}</span>
                                                <span className="font-mono font-bold">$ {parseFloat(t.amount).toFixed(2)}</span>
                                            </div>
                                            <p className="text-xs text-gray-400">{new Date(t.transactionDate).toLocaleDateString("pt-BR")} • {t.category}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
            </div>
        </FarmLayout>
    );
}
