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
import { Plus, Target, Loader2 } from "lucide-react";

const CATEGORIES = [
    { value: "insumos", label: "Insumos" },
    { value: "diesel", label: "Diesel" },
    { value: "mao_de_obra", label: "Mão de Obra" },
    { value: "frete", label: "Frete" },
    { value: "secagem", label: "Secagem" },
    { value: "admin", label: "Administrativo" },
    { value: "manutencao", label: "Manutenção" },
    { value: "outro", label: "Outro" },
];

export default function BudgetPage() {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [openCreate, setOpenCreate] = useState(false);
    const { user } = useAuth();

    const { data: budgets = [], isLoading } = useQuery({
        queryKey: ["/api/farm/budgets"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/budgets"); return r.json(); },
        enabled: !!user,
    });
    const { data: seasons = [] } = useQuery({
        queryKey: ["/api/farm/seasons"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/seasons"); return r.json(); },
        enabled: !!user,
    });

    const totalPlanned = budgets.reduce((s: number, b: any) => s + parseFloat(b.plannedAmount || 0), 0);
    const totalActual = budgets.reduce((s: number, b: any) => s + (b.actualAmount || 0), 0);

    const save = useMutation({
        mutationFn: async (data: any) => apiRequest("POST", "/api/farm/budgets", data),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/farm/budgets"] }); toast({ title: "Orçamento registrado" }); setOpenCreate(false); },
    });
    const del = useMutation({
        mutationFn: async (id: string) => apiRequest("DELETE", `/api/farm/budgets/${id}`),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/farm/budgets"] }); toast({ title: "Removido" }); },
    });

    return (
        <FarmLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-emerald-800">📋 Orçamento por Safra</h1>
                        <p className="text-sm text-emerald-600">Planejado: <strong>$ {totalPlanned.toFixed(2)}</strong> • Realizado: <strong>$ {totalActual.toFixed(2)}</strong></p>
                    </div>
                    <Dialog open={openCreate} onOpenChange={setOpenCreate}>
                        <DialogTrigger asChild><Button className="bg-emerald-600 hover:bg-emerald-700"><Plus className="mr-2 h-4 w-4" /> Novo Item</Button></DialogTrigger>
                        <DialogContent>
                            <DialogHeader><DialogTitle>Novo Item de Orçamento</DialogTitle></DialogHeader>
                            <form onSubmit={(e: any) => { e.preventDefault(); const fd = new FormData(e.target); save.mutate({ category: fd.get("category"), plannedAmount: fd.get("plannedAmount"), seasonId: fd.get("seasonId") || null, notes: fd.get("notes") || null }); }} className="space-y-4">
                                <div><Label>Categoria *</Label>
                                    <Select name="category"><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                        <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div><Label>Valor Planejado ($) *</Label><Input name="plannedAmount" type="number" step="0.01" required /></div>
                                <div><Label>Safra</Label>
                                    <Select name="seasonId"><SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                                        <SelectContent>{seasons.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div><Label>Notas</Label><Input name="notes" /></div>
                                <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={save.isPending}>{save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Salvar</Button>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>

                {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div> : budgets.length === 0 ? (
                    <Card className="border-emerald-100"><CardContent className="py-12 text-center"><Target className="h-12 w-12 text-gray-300 mx-auto mb-4" /><p className="text-gray-500">Nenhum orçamento cadastrado</p></CardContent></Card>
                ) : (
                    <div className="space-y-3">
                        {budgets.map((b: any) => {
                            const pct = parseFloat(b.percentUsed || 0);
                            const barColor = pct > 100 ? "bg-red-500" : pct > 80 ? "bg-amber-500" : "bg-emerald-500";
                            return (
                                <Card key={b.id} className="border-emerald-100">
                                    <CardContent className="p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <div>
                                                <span className="font-semibold text-emerald-800">{CATEGORIES.find(c => c.value === b.category)?.label || b.category}</span>
                                                {b.notes && <span className="ml-2 text-xs text-gray-400">{b.notes}</span>}
                                            </div>
                                            <div className="text-right">
                                                <span className="text-sm font-mono">$ {(b.actualAmount || 0).toFixed(2)}</span>
                                                <span className="text-xs text-gray-500"> / $ {parseFloat(b.plannedAmount).toFixed(2)}</span>
                                                <span className={`ml-2 text-xs font-bold ${pct > 100 ? "text-red-600" : "text-emerald-600"}`}>{pct}%</span>
                                            </div>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                                            <div className={`${barColor} h-2.5 rounded-full transition-all`} style={{ width: `${Math.min(pct, 100)}%` }}></div>
                                        </div>
                                        <div className="mt-2 flex justify-end">
                                            <Button variant="ghost" size="sm" className="text-red-500 h-6 text-xs" onClick={() => { if (confirm("Remover?")) del.mutate(b.id); }}>Excluir</Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>
        </FarmLayout>
    );
}
