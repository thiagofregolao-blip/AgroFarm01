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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, DollarSign, Loader2, Repeat, Download, Pencil, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/format-currency";

// ─── CSV export utility ──────────────────────────────────────────────────────
function exportToCSV(data: any[], filename: string) {
    if (!data.length) return;
    const headers = ["Data", "Categoria", "Descrição", "Fornecedor", "Propriedade", "Valor", "Tipo Pag."];
    const rows = data.map((e: any) => [
        new Date(e.expenseDate).toLocaleDateString("pt-BR"),
        e.category,
        e.description || "",
        e.supplier || "",
        e.propertyId || "",
        parseFloat(e.amount).toFixed(2),
        e.paymentType || "a_vista",
    ]);
    const csv = [headers, ...rows].map(r => r.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}

const EXPENSE_CATEGORIES = [
    { value: "diesel", label: "Diesel / Combustível" },
    { value: "frete", label: "Frete / Transporte" },
    { value: "mao_de_obra", label: "Mão de Obra" },
    { value: "manutencao", label: "Manutenção de Equipamentos" },
    { value: "arrendamento", label: "Arrendamento" },
    { value: "energia", label: "Energia / Água" },
    { value: "financiamento", label: "Parcela de Financiamento" },
    { value: "insumos", label: "Insumos Agrícolas" },
    { value: "impostos", label: "Impostos e Taxas" },
    { value: "salario", label: "Salário / Pro-Labore" },
    { value: "outro", label: "Outro" },
];

export default function FarmExpenses() {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [openDialog, setOpenDialog] = useState(false);
    const [filterCategory, setFilterCategory] = useState("todos");
    const { user } = useAuth();
    const [editingExpense, setEditingExpense] = useState<any>(null);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<any>(null);

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

    const { data: seasons = [] } = useQuery({
        queryKey: ["/api/farm/seasons"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/seasons"); return r.json(); },
        enabled: !!user,
    });

    const filtered = filterCategory === "todos" ? expenses : expenses.filter((e: any) => e.category === filterCategory);
    const totalExpenses = expenses.reduce((s: number, e: any) => s + parseFloat(e.amount), 0);
    const totalFiltered = filtered.reduce((s: number, e: any) => s + parseFloat(e.amount), 0);

    const save = useMutation({
        mutationFn: async (data: any) => apiRequest("POST", "/api/farm/expenses", data),
        onSuccess: (_, vars) => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/expenses"] });
            const rep = parseInt(vars.repeatTimes) || 1;
            toast({ title: rep > 1 ? `${rep} lancamentos recorrentes criados!` : "Despesa registrada" });
            setOpenDialog(false);
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => apiRequest("DELETE", `/api/farm/expenses/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/expenses"] });
            toast({ title: "Despesa excluida com sucesso" });
            setDeleteTarget(null);
        },
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: number; data: any }) => apiRequest("PUT", `/api/farm/expenses/${id}`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/expenses"] });
            toast({ title: "Despesa atualizada com sucesso" });
            setEditDialogOpen(false);
            setEditingExpense(null);
        },
    });

    return (
        <FarmLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-emerald-800">Despesas Extras</h1>
                        <p className="text-emerald-600 text-sm">
                            Total geral: <strong>{formatCurrency(totalExpenses)}</strong>
                            {filterCategory !== "todos" && <> · Filtrado: <strong className="text-amber-600">{formatCurrency(totalFiltered)}</strong></>}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" className="border-emerald-200 text-emerald-700" onClick={() => exportToCSV(filtered, "despesas.csv")}>
                            <Download className="mr-2 h-4 w-4" /> Exportar CSV
                        </Button>
                        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                            <DialogTrigger asChild>
                                <Button className="bg-emerald-600 hover:bg-emerald-700"><Plus className="mr-2 h-4 w-4" /> Nova Despesa</Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-lg">
                                <DialogHeader><DialogTitle>Nova Despesa</DialogTitle></DialogHeader>
                                <ExpenseForm properties={properties} seasons={seasons} onSave={(data: any) => save.mutate(data)} saving={save.isPending} />
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

                {/* Filter bar */}
                <Card className="border-emerald-100"><CardContent className="p-3">
                    <div className="flex flex-wrap gap-2 items-center">
                        <span className="text-xs text-gray-500 font-medium">Categoria:</span>
                        <button onClick={() => setFilterCategory("todos")}
                            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${filterCategory === "todos" ? "bg-emerald-600 text-white border-emerald-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                            Todas
                        </button>
                        {EXPENSE_CATEGORIES.map(c => (
                            <button key={c.value} onClick={() => setFilterCategory(c.value)}
                                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${filterCategory === c.value ? "bg-amber-500 text-white border-amber-500" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                                {c.label}
                            </button>
                        ))}
                    </div>
                </CardContent></Card>

                {isLoading ? (
                    <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
                ) : filtered.length === 0 ? (
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
                                    <th className="text-left p-3 font-semibold text-emerald-800">Fornecedor</th>
                                    <th className="text-right p-3 font-semibold text-emerald-800">Valor</th>
                                    <th className="text-center p-3 font-semibold text-emerald-800 w-24">Acoes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((e: any) => (
                                    <tr key={e.id} className="border-t border-gray-100 hover:bg-gray-50">
                                        <td className="p-3">{new Date(e.expenseDate).toLocaleDateString("pt-BR")}</td>
                                        <td className="p-3">
                                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                                                {EXPENSE_CATEGORIES.find(c => c.value === e.category)?.label || e.category}
                                            </span>
                                        </td>
                                        <td className="p-3 text-gray-600 max-w-[200px] truncate">{e.description || "—"}</td>
                                        <td className="p-3 text-gray-500">{e.supplier || "—"}</td>
                                        <td className="text-right p-3 font-mono font-semibold">{formatCurrency(e.amount)}</td>
                                        <td className="p-3 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50"
                                                    aria-label="Editar despesa"
                                                    onClick={() => { setEditingExpense(e); setEditDialogOpen(true); }}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                    aria-label="Excluir despesa"
                                                    onClick={() => setDeleteTarget(e)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {/* Delete confirmation dialog */}
                <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Excluir despesa</AlertDialogTitle>
                            <AlertDialogDescription>
                                Tem certeza que deseja excluir esta despesa
                                {deleteTarget?.description ? ` "${deleteTarget.description}"` : ""}
                                {deleteTarget ? ` de ${formatCurrency(deleteTarget.amount)}` : ""}?
                                Esta acao nao pode ser desfeita.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                                className="bg-red-600 hover:bg-red-700"
                                onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
                                disabled={deleteMutation.isPending}
                            >
                                {deleteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Excluir
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {/* Edit dialog */}
                <Dialog open={editDialogOpen} onOpenChange={(open) => { if (!open) { setEditDialogOpen(false); setEditingExpense(null); } }}>
                    <DialogContent className="max-w-lg">
                        <DialogHeader><DialogTitle>Editar Despesa</DialogTitle></DialogHeader>
                        {editingExpense && (
                            <ExpenseForm
                                properties={properties}
                                seasons={seasons}
                                onSave={(data: any) => updateMutation.mutate({ id: editingExpense.id, data })}
                                saving={updateMutation.isPending}
                                initialData={editingExpense}
                            />
                        )}
                    </DialogContent>
                </Dialog>
            </div>
        </FarmLayout>
    );
}

function ExpenseForm({ properties, seasons, onSave, saving, initialData }: any) {
    const [category, setCategory] = useState(initialData?.category || "");
    const [description, setDescription] = useState(initialData?.description || "");
    const [amount, setAmount] = useState(initialData?.amount ? String(initialData.amount) : "");
    const [supplier, setSupplier] = useState(initialData?.supplier || "");
    const [propertyId, setPropertyId] = useState(initialData?.propertyId ? String(initialData.propertyId) : "");
    const [seasonId, setSeasonId] = useState(initialData?.seasonId ? String(initialData.seasonId) : "");
    const [expenseDate, setExpenseDate] = useState(initialData?.expenseDate ? new Date(initialData.expenseDate).toISOString().substring(0, 10) : new Date().toISOString().substring(0, 10));
    const [paymentType, setPaymentType] = useState(initialData?.paymentType || "a_vista");
    const [dueDate, setDueDate] = useState(initialData?.dueDate ? new Date(initialData.dueDate).toISOString().substring(0, 10) : "");
    const [installments, setInstallments] = useState(initialData?.installments ? String(initialData.installments) : "1");

    // Recurring expense controls
    const [isRecurring, setIsRecurring] = useState(false);
    const [frequency, setFrequency] = useState("mensal");
    const [repeatTimes, setRepeatTimes] = useState("3");

    const submittable = category && amount;

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!submittable) return;
        onSave({
            category,
            description,
            amount,
            supplier: supplier || null,
            propertyId: propertyId || null,
            seasonId: seasonId || null,
            expenseDate,
            paymentType,
            dueDate: dueDate || null,
            installments: paymentType === "a_prazo" ? parseInt(installments) : 1,
            // Recurring fields — backend will interpret repeatTimes > 1
            frequency: isRecurring ? frequency : null,
            repeatTimes: isRecurring ? parseInt(repeatTimes) : 1,
        });
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            <div>
                <Label>Categoria *</Label>
                <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>{EXPENSE_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div><Label>Valor ($) *</Label><Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required /></div>
                <div><Label>Data</Label><Input type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} /></div>
            </div>
            <div><Label>Descrição</Label><Input value={description} onChange={e => setDescription(e.target.value)} /></div>
            <div><Label>Fornecedor</Label><Input value={supplier} onChange={e => setSupplier(e.target.value)} /></div>

            <div>
                <Label>Pagamento</Label>
                <Select value={paymentType} onValueChange={setPaymentType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="a_vista">À Vista</SelectItem>
                        <SelectItem value="a_prazo">A Prazo</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {paymentType === "a_prazo" && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <div>
                        <Label className="text-amber-700">Nº Parcelas</Label>
                        <Input type="number" min="1" max="60" value={installments} onChange={e => setInstallments(e.target.value)} />
                    </div>
                    <div>
                        <Label className="text-amber-700">1º Vencimento</Label>
                        <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                    </div>
                    <p className="col-span-2 text-xs text-amber-600">
                        Gerara {installments} parcelas de {formatCurrency(amount ? parseFloat(amount) / parseInt(installments || "1") : 0)} em Contas a Pagar
                    </p>
                </div>
            )}

            {/* ── Recurring toggle ── */}
            <div className="border rounded-lg p-3 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} className="rounded" />
                    <Repeat className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-medium">Esta despesa se repete?</span>
                </label>
                {isRecurring && (
                    <div className="grid grid-cols-2 gap-3 pt-1">
                        <div>
                            <Label className="text-xs text-gray-500">Frequência</Label>
                            <Select value={frequency} onValueChange={setFrequency}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="semanal">Semanal</SelectItem>
                                    <SelectItem value="mensal">Mensal</SelectItem>
                                    <SelectItem value="anual">Anual</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className="text-xs text-gray-500">Qtd. de repetições</Label>
                            <Input type="number" min="2" max="60" value={repeatTimes} onChange={e => setRepeatTimes(e.target.value)} />
                        </div>
                        <p className="col-span-2 text-xs text-emerald-600">
                            ✅ Criará {repeatTimes} lançamentos com frequência {frequency}
                        </p>
                    </div>
                )}
            </div>

            {/* Cost center */}
            {properties.length > 0 && (
                <div>
                    <Label>Propriedade (Centro de Custo)</Label>
                    <Select value={propertyId} onValueChange={setPropertyId}>
                        <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="">Todas</SelectItem>
                            {properties.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            )}
            {seasons.length > 0 && (
                <div>
                    <Label>Safra (opcional)</Label>
                    <Select value={seasonId} onValueChange={setSeasonId}>
                        <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="">Nenhuma</SelectItem>
                            {seasons.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            )}

            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={saving || !submittable}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {initialData ? "Atualizar Despesa" : isRecurring ? `Criar ${repeatTimes} lancamentos` : "Salvar Despesa"}
            </Button>
        </form>
    );
}
