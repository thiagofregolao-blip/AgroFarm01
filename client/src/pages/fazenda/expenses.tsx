import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
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
import { Plus, DollarSign, Loader2 } from "lucide-react";

const EXPENSE_CATEGORIES = [
    { value: "diesel", label: "Diesel" },
    { value: "frete", label: "Frete" },
    { value: "mao_de_obra", label: "Mão de Obra" },
    { value: "manutencao", label: "Manutenção" },
    { value: "outro", label: "Outro" },
];

export default function FarmExpenses() {
    const [, setLocation] = useLocation();
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [openDialog, setOpenDialog] = useState(false);

    const { user } = useAuth();

    const { data: expenses = [], isLoading } = useQuery({
        queryKey: ["/api/farm/expenses"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/expenses"); return r.json(); },
        enabled: !!user,
    });

    const { data: properties = [] } = useQuery({
        queryKey: ["/api/farm/properties"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/properties"); return r.json(); },
        enabled: !!user,
    });

    const { data: plots = [] } = useQuery({
        queryKey: ["/api/farm/plots"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/plots"); return r.json(); },
        enabled: !!user,
    });

    const totalExpenses = expenses.reduce((s: number, e: any) => s + parseFloat(e.amount), 0);

    const save = useMutation({
        mutationFn: async (data: any) => apiRequest("POST", "/api/farm/expenses", data),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/farm/expenses"] }); toast({ title: "Despesa registrada" }); setOpenDialog(false); },
    });

    return (
        <FarmLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-emerald-800">Despesas Extras</h1>
                        <p className="text-emerald-600 text-sm">Total: <strong>${totalExpenses.toLocaleString("en", { minimumFractionDigits: 2 })}</strong></p>
                    </div>
                    <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                        <DialogTrigger asChild>
                            <Button className="bg-emerald-600 hover:bg-emerald-700"><Plus className="mr-2 h-4 w-4" /> Nova Despesa</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader><DialogTitle>Nova Despesa</DialogTitle></DialogHeader>
                            <ExpenseForm properties={properties} plots={plots} onSave={(data: any) => save.mutate(data)} saving={save.isPending} />
                        </DialogContent>
                    </Dialog>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
                ) : expenses.length === 0 ? (
                    <Card className="border-emerald-100"><CardContent className="py-12 text-center">
                        <DollarSign className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">Nenhuma despesa registrada</p>
                    </CardContent></Card>
                ) : (
                    <div className="bg-white rounded-xl border border-emerald-100 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-emerald-50">
                                <tr>
                                    <th className="text-left p-3 font-semibold text-emerald-800">Data</th>
                                    <th className="text-left p-3 font-semibold text-emerald-800">Categoria</th>
                                    <th className="text-left p-3 font-semibold text-emerald-800">Descrição</th>
                                    <th className="text-right p-3 font-semibold text-emerald-800">Valor</th>
                                </tr>
                            </thead>
                            <tbody>
                                {expenses.map((e: any) => (
                                    <tr key={e.id} className="border-t border-gray-100">
                                        <td className="p-3">{new Date(e.expenseDate).toLocaleDateString("pt-BR")}</td>
                                        <td className="p-3">
                                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                                                {EXPENSE_CATEGORIES.find(c => c.value === e.category)?.label || e.category}
                                            </span>
                                        </td>
                                        <td className="p-3">{e.description || "—"}</td>
                                        <td className="text-right p-3 font-mono font-semibold">${parseFloat(e.amount).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </FarmLayout>
    );
}

function ExpenseForm({ properties, plots, onSave, saving }: any) {
    const [category, setCategory] = useState("");
    const [description, setDescription] = useState("");
    const [amount, setAmount] = useState("");
    const [propertyId, setPropertyId] = useState("");
    const [plotId, setPlotId] = useState("");
    const [expenseDate, setExpenseDate] = useState(new Date().toISOString().substring(0, 10));

    return (
        <form onSubmit={(e) => { e.preventDefault(); onSave({ category, description, amount, propertyId: propertyId || null, plotId: plotId || null, expenseDate }); }} className="space-y-4">
            <div>
                <Label>Categoria *</Label>
                <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>{EXPENSE_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
            </div>
            <div><Label>Descrição</Label><Input value={description} onChange={e => setDescription(e.target.value)} /></div>
            <div><Label>Valor ($) *</Label><Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required /></div>
            <div><Label>Data</Label><Input type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} /></div>
            <div>
                <Label>Propriedade (opcional)</Label>
                <Select value={propertyId} onValueChange={setPropertyId}>
                    <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                    <SelectContent>{properties.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
            </div>
            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={saving || !category || !amount}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Salvar
            </Button>
        </form>
    );
}
