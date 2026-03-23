import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import FarmLayout from "@/components/fazenda/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, DollarSign, Loader2, Repeat, Download, Pencil, Trash2, FileText } from "lucide-react";
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

    const { data: suppliers = [] } = useQuery({
        queryKey: ["/api/farm/suppliers"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/suppliers"); return r.json(); },
        enabled: !!user,
    });

    const { data: invoices = [] } = useQuery({
        queryKey: ["/api/farm/invoices"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/invoices"); return r.json(); },
        enabled: !!user,
    });

    const { data: cashAccounts = [] } = useQuery({
        queryKey: ["/api/farm/cash-accounts"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/cash-accounts"); return r.json(); },
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
                                <ExpenseForm properties={properties} seasons={seasons} suppliers={suppliers} invoices={invoices} cashAccounts={cashAccounts} onSave={(data: any) => save.mutate(data)} saving={save.isPending} />
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
                                suppliers={suppliers}
                                invoices={invoices}
                                cashAccounts={cashAccounts}
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

function ExpenseForm({ properties, seasons, suppliers, invoices, cashAccounts, onSave, saving, initialData }: any) {
    const [category, setCategory] = useState(initialData?.category || "");
    const [description, setDescription] = useState(initialData?.description || "");
    const [amount, setAmount] = useState(initialData?.amount ? String(initialData.amount) : "");
    const [supplier, setSupplier] = useState(initialData?.supplier || "");
    const [propertyId, setPropertyId] = useState(initialData?.propertyId ? String(initialData.propertyId) : "__none__");
    const [seasonId, setSeasonId] = useState(initialData?.seasonId ? String(initialData.seasonId) : "__none__");
    const [expenseDate, setExpenseDate] = useState(initialData?.expenseDate ? new Date(initialData.expenseDate).toISOString().substring(0, 10) : new Date().toISOString().substring(0, 10));
    const [paymentType, setPaymentType] = useState(initialData?.paymentType || "a_vista");
    const [dueDate, setDueDate] = useState(initialData?.dueDate ? new Date(initialData.dueDate).toISOString().substring(0, 10) : "");
    const [installments, setInstallments] = useState(initialData?.installments ? String(initialData.installments) : "1");
    const [accountId, setAccountId] = useState(initialData?.accountId ? String(initialData.accountId) : "");

    // Item #17 — expense with or without invoice
    const [expenseType, setExpenseType] = useState<"sem_fatura" | "com_fatura">(initialData?.invoiceId ? "com_fatura" : "sem_fatura");
    const [invoiceId, setInvoiceId] = useState(initialData?.invoiceId ? String(initialData.invoiceId) : "");

    // Recurring expense controls
    const [isRecurring, setIsRecurring] = useState(false);
    const [frequency, setFrequency] = useState("mensal");
    const [repeatTimes, setRepeatTimes] = useState("3");

    // Supplier validation state
    const [triedSubmit, setTriedSubmit] = useState(false);

    const [currency, setCurrency] = useState<"USD" | "PYG">(initialData?.currency || "USD");
    const currencySymbol = currency === "PYG" ? "Gs" : "$";

    // Item #17 — pending invoices for selected supplier
    const pendingInvoicesForSupplier = invoices.filter((inv: any) =>
        (inv.supplier === supplier || inv.supplierName === supplier) &&
        (inv.status === "pending" || inv.status === "pendente")
    );

    // When invoice selected, auto-fill amount and supplier
    function handleInvoiceSelect(invId: string) {
        setInvoiceId(invId);
        if (invId) {
            const inv = invoices.find((i: any) => String(i.id) === invId);
            if (inv) {
                setAmount(String(inv.totalAmount || inv.amount || ""));
                if (inv.supplier || inv.supplierName) {
                    setSupplier(inv.supplier || inv.supplierName);
                }
            }
        }
    }

    const submittable = category && amount && supplier;

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setTriedSubmit(true);
        if (!submittable) return;
        onSave({
            category,
            description,
            amount,
            currency,
            supplier: supplier || null,
            propertyId: propertyId === "__none__" ? null : propertyId || null,
            seasonId: seasonId === "__none__" ? null : seasonId || null,
            expenseDate,
            paymentType,
            dueDate: dueDate || null,
            installments: paymentType === "a_prazo" ? parseInt(installments) : 1,
            accountId: paymentType === "a_vista" && accountId ? accountId : null,
            invoiceId: expenseType === "com_fatura" && invoiceId ? invoiceId : null,
            // Recurring fields -- backend will interpret repeatTimes > 1
            frequency: isRecurring ? frequency : null,
            repeatTimes: isRecurring ? parseInt(repeatTimes) : 1,
        });
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            {/* Item #17 — Toggle com/sem fatura */}
            <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
                <button
                    type="button"
                    onClick={() => { setExpenseType("sem_fatura"); setInvoiceId(""); }}
                    className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${expenseType === "sem_fatura" ? "bg-white shadow text-emerald-700" : "text-gray-500 hover:text-gray-700"}`}
                >
                    Sem Fatura
                </button>
                <button
                    type="button"
                    onClick={() => setExpenseType("com_fatura")}
                    className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${expenseType === "com_fatura" ? "bg-white shadow text-emerald-700" : "text-gray-500 hover:text-gray-700"}`}
                >
                    <FileText className="h-3.5 w-3.5" /> Com Fatura
                </button>
            </div>

            <div>
                <Label>Categoria *</Label>
                <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>{EXPENSE_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
            </div>

            {/* Item #16 — Supplier is required (must be registered) */}
            <div>
                <Label>Fornecedor *</Label>
                <Select value={supplier} onValueChange={(v) => { setSupplier(v); setInvoiceId(""); }}>
                    <SelectTrigger className={triedSubmit && !supplier ? "border-red-400" : ""}>
                        <SelectValue placeholder="Selecione um fornecedor..." />
                    </SelectTrigger>
                    <SelectContent>
                        {suppliers.map((s: any) => (
                            <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                        ))}
                        <div className="border-t border-gray-100 mt-1 pt-1">
                            <Link href="/fazenda/fornecedores" className="block px-2 py-1.5 text-xs text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer font-medium">
                                + Cadastrar novo fornecedor
                            </Link>
                        </div>
                    </SelectContent>
                </Select>
                {triedSubmit && !supplier && (
                    <p className="text-xs text-red-500 mt-1">Selecione um fornecedor cadastrado</p>
                )}
            </div>

            {/* Item #17 — Invoice selection when "Com Fatura" */}
            {expenseType === "com_fatura" && supplier && (
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 space-y-2">
                    <Label className="text-blue-700">Fatura pendente</Label>
                    {pendingInvoicesForSupplier.length > 0 ? (
                        <Select value={invoiceId} onValueChange={handleInvoiceSelect}>
                            <SelectTrigger><SelectValue placeholder="Selecione uma fatura..." /></SelectTrigger>
                            <SelectContent>
                                {pendingInvoicesForSupplier.map((inv: any) => (
                                    <SelectItem key={inv.id} value={String(inv.id)}>
                                        #{inv.invoiceNumber || inv.id} - {formatCurrency(inv.totalAmount || inv.amount)} ({new Date(inv.invoiceDate || inv.createdAt).toLocaleDateString("pt-BR")})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    ) : (
                        <p className="text-xs text-blue-600">Nenhuma fatura pendente para este fornecedor</p>
                    )}
                </div>
            )}

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <Label>Moeda</Label>
                    <Select value={currency} onValueChange={(v) => setCurrency(v as "USD" | "PYG")}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="USD">Dólar (USD — $)</SelectItem>
                            <SelectItem value="PYG">Guarani (PYG — Gs)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div><Label>Data</Label><Input type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} /></div>
            </div>
            <div>
                <Label>Valor ({currencySymbol}) *</Label>
                <CurrencyInput value={amount} onValueChange={setAmount} />
            </div>
            <div><Label>Descricao</Label><Input value={description} onChange={e => setDescription(e.target.value)} /></div>

            <div>
                <Label>Pagamento</Label>
                <Select value={paymentType} onValueChange={setPaymentType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="a_vista">A Vista</SelectItem>
                        <SelectItem value="a_prazo">A Prazo</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Item #1 — When "a vista", choose account to debit */}
            {paymentType === "a_vista" && cashAccounts.length > 0 && (
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                    <Label className="text-emerald-700">Conta para debito</Label>
                    <Select value={accountId} onValueChange={setAccountId}>
                        <SelectTrigger><SelectValue placeholder="Selecione a conta..." /></SelectTrigger>
                        <SelectContent>
                            {cashAccounts.map((acc: any) => (
                                <SelectItem key={acc.id} value={String(acc.id)}>
                                    {acc.name} {acc.bankName ? `(${acc.bankName})` : ""} - {acc.currency || "USD"}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-emerald-600 mt-1">O valor sera debitado automaticamente desta conta</p>
                </div>
            )}

            {paymentType === "a_prazo" && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <div>
                        <Label className="text-amber-700">N Parcelas</Label>
                        <Input type="number" min="1" max="60" value={installments} onChange={e => setInstallments(e.target.value)} />
                    </div>
                    <div>
                        <Label className="text-amber-700">1 Vencimento</Label>
                        <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                    </div>
                    <p className="col-span-2 text-xs text-amber-600">
                        Gerara {installments} parcelas de {formatCurrency(amount ? parseFloat(amount) / parseInt(installments || "1") : 0)} em Contas a Pagar
                    </p>
                </div>
            )}

            {/* Recurring toggle */}
            <div className="border rounded-lg p-3 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} className="rounded" />
                    <Repeat className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-medium">Esta despesa se repete?</span>
                </label>
                {isRecurring && (
                    <div className="grid grid-cols-2 gap-3 pt-1">
                        <div>
                            <Label className="text-xs text-gray-500">Frequencia</Label>
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
                            <Label className="text-xs text-gray-500">Qtd. de repeticoes</Label>
                            <Input type="number" min="2" max="60" value={repeatTimes} onChange={e => setRepeatTimes(e.target.value)} />
                        </div>
                        <p className="col-span-2 text-xs text-emerald-600">
                            Criara {repeatTimes} lancamentos com frequencia {frequency}
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
                            <SelectItem value="__none__">Todas</SelectItem>
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
                            <SelectItem value="__none__">Nenhuma</SelectItem>
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
