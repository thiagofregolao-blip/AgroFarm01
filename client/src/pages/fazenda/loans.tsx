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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
    Loader2, PlusCircle, Trash2, CheckCircle, Clock, AlertTriangle,
    DollarSign, CalendarDays, Wallet, Percent, Eye, CreditCard, Search,
    Pencil, History
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────
interface Installment {
    id?: string;
    installmentNumber?: number;
    amount: string;
    dueDate: string;
    status?: string;
    paidAmount?: string;
    paidDate?: string;
}

interface Loan {
    id: string;
    type: string;
    counterpart_id?: string;
    counterpart_name: string;
    description?: string;
    currency: string;
    account_id?: string;
    total_amount: string;
    interest_rate?: string;
    paid_amount: string;
    status: string;
    created_at: string;
    installments: any[];
}

// ─── Status badge ───────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
    if (status === "pago") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"><CheckCircle className="w-3 h-3" /> Pago</span>;
    if (status === "parcial") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700"><Clock className="w-3 h-3" /> Parcial</span>;
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700"><Clock className="w-3 h-3" /> Aberto</span>;
}

function isOverdue(dueDate: string, status: string) {
    if (status === "pago") return false;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate); due.setHours(0, 0, 0, 0);
    return due < today;
}

export default function LoansPage() {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState("payable");
    const [showNewModal, setShowNewModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
    const [showPayModal, setShowPayModal] = useState(false);
    const [payingInstallment, setPayingInstallment] = useState<any>(null);
    const [payAccountId, setPayAccountId] = useState("");
    const [payAmount, setPayAmount] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [filterCurrency, setFilterCurrency] = useState("todos");
    const [filterStatus, setFilterStatus] = useState("todos");

    // ─── Form state for new loan ────────────────────────────────────────
    const [formCounterpartId, setFormCounterpartId] = useState("");
    const [formCounterpartName, setFormCounterpartName] = useState("");
    const [formDescription, setFormDescription] = useState("");
    const [formCurrency, setFormCurrency] = useState("USD");
    const [formAccountId, setFormAccountId] = useState("");
    const [formTotalAmount, setFormTotalAmount] = useState("");
    const [formInterestRate, setFormInterestRate] = useState("");
    const [formInstallments, setFormInstallments] = useState<Installment[]>([
        { amount: "", dueDate: "" },
    ]);

    // ─── Queries ────────────────────────────────────────────────────────
    const { data: loans = [], isLoading } = useQuery({
        queryKey: ["/api/farm/loans"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/loans"); return r.json(); },
        enabled: !!user,
    });

    const { data: accounts = [] } = useQuery({
        queryKey: ["/api/farm/cash-accounts"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/cash-accounts"); return r.json(); },
        enabled: !!user,
    });

    const { data: suppliers = [] } = useQuery({
        queryKey: ["/api/farm/suppliers"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/suppliers"); return r.json(); },
        enabled: !!user,
    });

    // ─── Filtered loans ─────────────────────────────────────────────────
    const filtered = useMemo(() => {
        return (loans as Loan[]).filter((l) => {
            if (l.type !== activeTab) return false;
            if (filterCurrency !== "todos" && l.currency !== filterCurrency) return false;
            if (filterStatus !== "todos" && l.status !== filterStatus) return false;
            if (searchTerm) {
                const s = searchTerm.toLowerCase();
                if (!l.counterpart_name.toLowerCase().includes(s) && !(l.description || "").toLowerCase().includes(s)) return false;
            }
            return true;
        });
    }, [loans, activeTab, filterCurrency, filterStatus, searchTerm]);

    // ─── KPIs ───────────────────────────────────────────────────────────
    const kpis = useMemo(() => {
        const tabLoans = (loans as Loan[]).filter(l => l.type === activeTab);
        const totalUSD = tabLoans.filter(l => l.currency === "USD").reduce((s, l) => s + parseFloat(l.total_amount), 0);
        const totalPYG = tabLoans.filter(l => l.currency === "PYG").reduce((s, l) => s + parseFloat(l.total_amount), 0);
        const paidUSD = tabLoans.filter(l => l.currency === "USD").reduce((s, l) => s + parseFloat(l.paid_amount || "0"), 0);
        const paidPYG = tabLoans.filter(l => l.currency === "PYG").reduce((s, l) => s + parseFloat(l.paid_amount || "0"), 0);
        const openCount = tabLoans.filter(l => l.status !== "pago").length;
        return { totalUSD, totalPYG, paidUSD, paidPYG, openCount, total: tabLoans.length };
    }, [loans, activeTab]);

    // ─── Mutations ──────────────────────────────────────────────────────
    const createMutation = useMutation({
        mutationFn: async (data: any) => {
            const r = await apiRequest("POST", "/api/farm/loans", data);
            return r.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/loans"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/cash-accounts"] });
            toast({ title: "Prestamo registrado com sucesso" });
            setShowNewModal(false);
            resetForm();
        },
        onError: (err: any) => {
            toast({ title: "Erro ao criar prestamo", description: err.message, variant: "destructive" });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const r = await apiRequest("DELETE", `/api/farm/loans/${id}`);
            return r.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/loans"] });
            toast({ title: "Prestamo excluido" });
        },
    });

    const payMutation = useMutation({
        mutationFn: async (data: { installmentId: string; accountId: string; amount: number }) => {
            const r = await apiRequest("POST", `/api/farm/loans/installments/${data.installmentId}/pay`, {
                accountId: data.accountId,
                amount: data.amount,
            });
            return r.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/loans"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/cash-accounts"] });
            toast({ title: "Parcela paga com sucesso" });
            setShowPayModal(false);
            setPayingInstallment(null);
            // Refresh detail
            if (selectedLoan) {
                apiRequest("GET", `/api/farm/loans/${selectedLoan.id}`).then(r => r.json()).then(setSelectedLoan);
            }
        },
        onError: (err: any) => {
            toast({ title: "Erro ao pagar parcela", description: err.message, variant: "destructive" });
        },
    });

    // ─── Form helpers ───────────────────────────────────────────────────
    function resetForm() {
        setFormCounterpartId("");
        setFormCounterpartName("");
        setFormDescription("");
        setFormCurrency("USD");
        setFormAccountId("");
        setFormTotalAmount("");
        setFormInterestRate("");
        setFormInstallments([{ amount: "", dueDate: "" }]);
    }

    function addInstallment() {
        setFormInstallments(prev => [...prev, { amount: "", dueDate: "" }]);
    }

    function removeInstallment(idx: number) {
        setFormInstallments(prev => prev.filter((_, i) => i !== idx));
    }

    function updateInstallment(idx: number, field: keyof Installment, value: string) {
        setFormInstallments(prev => prev.map((inst, i) => i === idx ? { ...inst, [field]: value } : inst));
    }

    function distributeEvenly() {
        const total = parseFloat(formTotalAmount) || 0;
        const count = formInstallments.length;
        if (count === 0 || total === 0) return;
        const each = Math.floor(total / count * 100) / 100;
        const last = +(total - each * (count - 1)).toFixed(2);
        setFormInstallments(prev => prev.map((inst, i) => ({
            ...inst,
            amount: i === count - 1 ? String(last) : String(each),
        })));
    }

    const installmentsSum = formInstallments.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
    const totalAmount = parseFloat(formTotalAmount) || 0;
    const sumDiff = Math.abs(installmentsSum - totalAmount);
    const sumValid = sumDiff < 0.01;

    function handleSubmit() {
        if (!formCounterpartName || !formTotalAmount || formInstallments.length === 0) {
            toast({ title: "Preencha todos os campos obrigatorios", variant: "destructive" });
            return;
        }
        if (!sumValid) {
            toast({ title: "Soma das parcelas diverge do valor total", variant: "destructive" });
            return;
        }
        for (const inst of formInstallments) {
            if (!inst.amount || !inst.dueDate) {
                toast({ title: "Preencha valor e vencimento de todas as parcelas", variant: "destructive" });
                return;
            }
        }
        createMutation.mutate({
            type: activeTab,
            counterpartId: formCounterpartId || null,
            counterpartName: formCounterpartName,
            description: formDescription || null,
            currency: formCurrency,
            accountId: formAccountId || null,
            totalAmount: formTotalAmount,
            interestRate: formInterestRate || null,
            installments: formInstallments.map(i => ({
                amount: i.amount,
                dueDate: i.dueDate,
            })),
        });
    }

    function handleSelectSupplier(supplierId: string) {
        const sup = (suppliers as any[]).find(s => s.id === supplierId);
        if (sup) {
            setFormCounterpartId(sup.id);
            setFormCounterpartName(sup.name);
        }
    }

    function openDetail(loan: Loan) {
        setSelectedLoan(loan);
        setShowDetailModal(true);
    }

    function openPayInstallment(inst: any, loan: Loan) {
        setPayingInstallment({ ...inst, loan });
        setPayAmount(String(parseFloat(inst.amount) - (parseFloat(inst.paid_amount) || 0)));
        setPayAccountId("");
        setShowPayModal(true);
    }

    const currencySymbol = (c: string) => c === "PYG" ? "Gs" : "$";

    return (
        <FarmLayout>
            <div className="max-w-6xl mx-auto p-4 space-y-4">
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Prestamos</h1>
                        <p className="text-sm text-gray-500">Controle de emprestimos a pagar e a receber</p>
                    </div>
                </div>

                {/* Tabs — vermelho para "a Pagar" (saida), verde para "a Receber" (entrada) */}
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="w-full flex flex-wrap gap-1 h-auto p-1">
                        <TabsTrigger value="payable" className="flex-1 min-w-[140px] gap-1 data-[state=active]:bg-red-100 data-[state=active]:text-red-700">
                            <CreditCard className="w-4 h-4" /> Prestamos a Pagar
                        </TabsTrigger>
                        <TabsTrigger value="history_payable" className="flex-1 min-w-[140px] gap-1 data-[state=active]:bg-red-100 data-[state=active]:text-red-700">
                            <History className="w-4 h-4" /> Historico de Prestamos Pagos
                        </TabsTrigger>
                        <TabsTrigger value="receivable" className="flex-1 min-w-[140px] gap-1 data-[state=active]:bg-green-100 data-[state=active]:text-green-700">
                            <Wallet className="w-4 h-4" /> Prestamos a Receber
                        </TabsTrigger>
                        <TabsTrigger value="history_receivable" className="flex-1 min-w-[140px] gap-1 data-[state=active]:bg-green-100 data-[state=active]:text-green-700">
                            <History className="w-4 h-4" /> Historico de Prestamos Recebidos
                        </TabsTrigger>
                    </TabsList>

                    {/* KPI Cards — apenas nas tabs de emprestimos (nao no historico) */}
                    {(activeTab === "payable" || activeTab === "receivable") && (
                    <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                        <Card>
                            <CardContent className="p-3">
                                <p className="text-xs text-gray-500">Total USD</p>
                                <p className="text-lg font-bold">{formatCurrency(kpis.totalUSD, "USD")}</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-3">
                                <p className="text-xs text-gray-500">Total Gs</p>
                                <p className="text-lg font-bold">{formatCurrency(kpis.totalPYG, "PYG")}</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-3">
                                <p className="text-xs text-gray-500">{activeTab === "payable" ? "Pago USD" : "Recebido USD"}</p>
                                <p className="text-lg font-bold text-green-600">{formatCurrency(kpis.paidUSD, "USD")}</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-3">
                                <p className="text-xs text-gray-500">Abertos</p>
                                <p className="text-lg font-bold text-orange-600">{kpis.openCount} de {kpis.total}</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Filters + New button */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                                placeholder="Buscar por nome ou descricao..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <Select value={filterCurrency} onValueChange={setFilterCurrency}>
                            <SelectTrigger className="w-full sm:w-32"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="todos">Moeda</SelectItem>
                                <SelectItem value="USD">$ Dolar</SelectItem>
                                <SelectItem value="PYG">Gs Guarani</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={filterStatus} onValueChange={setFilterStatus}>
                            <SelectTrigger className="w-full sm:w-32"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="todos">Status</SelectItem>
                                <SelectItem value="aberto">Aberto</SelectItem>
                                <SelectItem value="parcial">Parcial</SelectItem>
                                <SelectItem value="pago">Pago</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button onClick={() => { resetForm(); setShowNewModal(true); }} className="gap-1">
                            <PlusCircle className="w-4 h-4" /> Novo Prestamo
                        </Button>
                    </div>
                    </>
                    )}

                    {/* Content for loan tabs */}
                    <TabsContent value="payable" className="mt-4">
                        <LoansList loans={filtered} isLoading={isLoading} onDetail={openDetail} onDelete={(id) => deleteMutation.mutate(id)} currencySymbol={currencySymbol} />
                    </TabsContent>
                    <TabsContent value="receivable" className="mt-4">
                        <LoansList loans={filtered} isLoading={isLoading} onDetail={openDetail} onDelete={(id) => deleteMutation.mutate(id)} currencySymbol={currencySymbol} />
                    </TabsContent>

                    {/* Content for history tabs */}
                    <TabsContent value="history_payable" className="mt-4">
                        <LoanPaymentHistory type="payable" accounts={accounts as any[]} />
                    </TabsContent>
                    <TabsContent value="history_receivable" className="mt-4">
                        <LoanPaymentHistory type="receivable" accounts={accounts as any[]} />
                    </TabsContent>
                </Tabs>

                {/* ── NEW LOAN MODAL ───────────────────────────────────────────── */}
                {showNewModal && (
                    <Dialog open={showNewModal} onOpenChange={setShowNewModal}>
                        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>
                                    {activeTab === "payable" ? "Novo Prestamo a Pagar" : "Novo Prestamo a Receber"}
                                </DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                                {/* Counterpart */}
                                <div>
                                    <Label>{activeTab === "payable" ? "Provedor do Prestamo" : "Quem recebe o Prestamo"}</Label>
                                    <Select value={formCounterpartId} onValueChange={handleSelectSupplier}>
                                        <SelectTrigger><SelectValue placeholder="Selecione empresa/pessoa" /></SelectTrigger>
                                        <SelectContent>
                                            {(suppliers as any[]).map((s: any) => (
                                                <SelectItem key={s.id} value={s.id}>{s.name}{s.ruc ? ` (${s.ruc})` : ""}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Input
                                        className="mt-1"
                                        placeholder="Ou digite o nome manualmente"
                                        value={formCounterpartName}
                                        onChange={e => setFormCounterpartName(e.target.value)}
                                    />
                                </div>

                                {/* Currency + Account + Interest */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <Label>Moeda</Label>
                                        <Select value={formCurrency} onValueChange={setFormCurrency}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="USD">$ Dolar</SelectItem>
                                                <SelectItem value="PYG">Gs Guarani</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label>Conta {activeTab === "payable" ? "Creditada" : "Debitada"}</Label>
                                        <Select value={formAccountId} onValueChange={setFormAccountId}>
                                            <SelectTrigger><SelectValue placeholder="Selecione conta" /></SelectTrigger>
                                            <SelectContent>
                                                {(accounts as any[]).filter((a: any) => a.currency === formCurrency).map((a: any) => (
                                                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label>Taxa de Juros (%) <span className="text-gray-400 text-xs">opcional</span></Label>
                                        <div className="relative">
                                            <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <Input
                                                type="number"
                                                step="0.01"
                                                className="pl-9"
                                                placeholder="0.00"
                                                value={formInterestRate}
                                                onChange={e => setFormInterestRate(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Total Amount + Description */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <Label>Valor Total do Prestamo</Label>
                                        <div className="relative">
                                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <Input
                                                type="number"
                                                step="0.01"
                                                className="pl-9"
                                                placeholder="0.00"
                                                value={formTotalAmount}
                                                onChange={e => setFormTotalAmount(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <Label>Descricao <span className="text-gray-400 text-xs">opcional</span></Label>
                                        <Input
                                            placeholder="Ex: Financiamento colheitadeira"
                                            value={formDescription}
                                            onChange={e => setFormDescription(e.target.value)}
                                        />
                                    </div>
                                </div>

                                {/* Installments */}
                                <div className="border rounded-lg p-3 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-base font-semibold">Parcelas</Label>
                                        <div className="flex gap-2">
                                            <Button variant="outline" size="sm" onClick={distributeEvenly} disabled={!formTotalAmount}>
                                                Distribuir igualmente
                                            </Button>
                                            <Button variant="outline" size="sm" onClick={addInstallment}>
                                                <PlusCircle className="w-4 h-4 mr-1" /> Parcela
                                            </Button>
                                        </div>
                                    </div>

                                    {formInstallments.map((inst, idx) => (
                                        <div key={idx} className="flex items-end gap-2">
                                            <div className="w-10 text-center text-sm font-medium text-gray-500 pb-2">
                                                {idx + 1}
                                            </div>
                                            <div className="flex-1">
                                                <Label className="text-xs">Valor</Label>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    placeholder="0.00"
                                                    value={inst.amount}
                                                    onChange={e => updateInstallment(idx, "amount", e.target.value)}
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <Label className="text-xs">Vencimento</Label>
                                                <Input
                                                    type="date"
                                                    value={inst.dueDate}
                                                    onChange={e => updateInstallment(idx, "dueDate", e.target.value)}
                                                />
                                            </div>
                                            {formInstallments.length > 1 && (
                                                <Button variant="ghost" size="icon" onClick={() => removeInstallment(idx)} className="text-red-500 hover:text-red-700">
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            )}
                                        </div>
                                    ))}

                                    {/* Validation bar */}
                                    <div className={`flex items-center justify-between p-2 rounded text-sm font-medium ${sumValid ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                                        <span>Soma das parcelas: {currencySymbol(formCurrency)} {installmentsSum.toFixed(2)}</span>
                                        <span>Total: {currencySymbol(formCurrency)} {totalAmount.toFixed(2)}</span>
                                        {sumValid
                                            ? <CheckCircle className="w-4 h-4 text-green-600" />
                                            : <AlertTriangle className="w-4 h-4 text-red-600" />
                                        }
                                    </div>
                                </div>

                                {/* Submit */}
                                <Button
                                    onClick={handleSubmit}
                                    disabled={createMutation.isPending || !sumValid}
                                    className="w-full"
                                >
                                    {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                    Registrar Prestamo
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                )}

                {/* ── DETAIL MODAL ─────────────────────────────────────────────── */}
                {showDetailModal && selectedLoan && (
                    <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
                        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    {selectedLoan.type === "payable" ? "Prestamo a Pagar" : "Prestamo a Receber"}
                                    <StatusBadge status={selectedLoan.status} />
                                </DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                                {/* Loan info */}
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <p className="text-gray-500">{selectedLoan.type === "payable" ? "Provedor" : "Recebedor"}</p>
                                        <p className="font-medium">{selectedLoan.counterpart_name}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-500">Valor Total</p>
                                        <p className="font-medium">{formatCurrency(parseFloat(selectedLoan.total_amount), selectedLoan.currency)}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-500">{selectedLoan.type === "payable" ? "Pago" : "Recebido"}</p>
                                        <p className="font-medium text-green-600">{formatCurrency(parseFloat(selectedLoan.paid_amount || "0"), selectedLoan.currency)}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-500">Saldo Pendente</p>
                                        <p className="font-medium text-orange-600">
                                            {formatCurrency(parseFloat(selectedLoan.total_amount) - parseFloat(selectedLoan.paid_amount || "0"), selectedLoan.currency)}
                                        </p>
                                    </div>
                                    {selectedLoan.interest_rate && (
                                        <div>
                                            <p className="text-gray-500">Taxa de Juros</p>
                                            <p className="font-medium">{selectedLoan.interest_rate}%</p>
                                        </div>
                                    )}
                                    {selectedLoan.description && (
                                        <div className="col-span-2">
                                            <p className="text-gray-500">Descricao</p>
                                            <p className="font-medium">{selectedLoan.description}</p>
                                        </div>
                                    )}
                                    <div>
                                        <p className="text-gray-500">Data de Criacao</p>
                                        <p className="font-medium">{new Date(selectedLoan.created_at).toLocaleDateString("pt-BR")}</p>
                                    </div>
                                </div>

                                {/* Installments table */}
                                <div className="border rounded-lg overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-3 py-2 text-left">#</th>
                                                <th className="px-3 py-2 text-left">Vencimento</th>
                                                <th className="px-3 py-2 text-right">Valor</th>
                                                <th className="px-3 py-2 text-right">Pago</th>
                                                <th className="px-3 py-2 text-center">Status</th>
                                                <th className="px-3 py-2 text-center">Acao</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedLoan.installments.map((inst: any) => {
                                                const overdue = isOverdue(inst.due_date, inst.status);
                                                return (
                                                    <tr key={inst.id} className={`border-t ${overdue ? "bg-red-50" : ""}`}>
                                                        <td className="px-3 py-2">{inst.installment_number}</td>
                                                        <td className="px-3 py-2">
                                                            <span className={`flex items-center gap-1 ${overdue ? "text-red-600 font-medium" : ""}`}>
                                                                <CalendarDays className="w-3 h-3" />
                                                                {new Date(inst.due_date).toLocaleDateString("pt-BR")}
                                                                {overdue && <AlertTriangle className="w-3 h-3 text-red-500" />}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2 text-right font-medium">
                                                            {formatCurrency(parseFloat(inst.amount), selectedLoan.currency)}
                                                        </td>
                                                        <td className="px-3 py-2 text-right text-green-600">
                                                            {formatCurrency(parseFloat(inst.paid_amount || "0"), selectedLoan.currency)}
                                                        </td>
                                                        <td className="px-3 py-2 text-center">
                                                            <StatusBadge status={inst.status} />
                                                        </td>
                                                        <td className="px-3 py-2 text-center">
                                                            {inst.status !== "pago" && (
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => openPayInstallment(inst, selectedLoan)}
                                                                >
                                                                    {selectedLoan.type === "payable" ? "Pagar" : "Receber"}
                                                                </Button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                )}

                {/* ── PAY INSTALLMENT MODAL ────────────────────────────────────── */}
                {showPayModal && payingInstallment && (
                    <Dialog open={showPayModal} onOpenChange={setShowPayModal}>
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle>
                                    {payingInstallment.loan.type === "payable" ? "Pagar Parcela" : "Receber Parcela"} #{payingInstallment.installment_number}
                                </DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                                <div className="bg-gray-50 rounded p-3 text-sm space-y-1">
                                    <p><strong>{payingInstallment.loan.counterpart_name}</strong></p>
                                    <p>Valor da parcela: {formatCurrency(parseFloat(payingInstallment.amount), payingInstallment.loan.currency)}</p>
                                    <p>Ja pago: {formatCurrency(parseFloat(payingInstallment.paid_amount || "0"), payingInstallment.loan.currency)}</p>
                                </div>
                                <div>
                                    <Label>Conta</Label>
                                    <Select value={payAccountId} onValueChange={setPayAccountId}>
                                        <SelectTrigger><SelectValue placeholder="Selecione conta" /></SelectTrigger>
                                        <SelectContent>
                                            {(accounts as any[]).filter((a: any) => a.currency === payingInstallment.loan.currency).map((a: any) => (
                                                <SelectItem key={a.id} value={a.id}>{a.name} ({formatCurrency(parseFloat(a.balance), a.currency)})</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Valor a {payingInstallment.loan.type === "payable" ? "Pagar" : "Receber"}</Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={payAmount}
                                        onChange={e => setPayAmount(e.target.value)}
                                    />
                                </div>
                                <Button
                                    className="w-full"
                                    disabled={payMutation.isPending || !payAccountId || !payAmount}
                                    onClick={() => {
                                        payMutation.mutate({
                                            installmentId: payingInstallment.id,
                                            accountId: payAccountId,
                                            amount: parseFloat(payAmount),
                                        });
                                    }}
                                >
                                    {payMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                    Confirmar {payingInstallment.loan.type === "payable" ? "Pagamento" : "Recebimento"}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                )}
            </div>
        </FarmLayout>
    );
}

// ─── Loans List Component ───────────────────────────────────────────────────
function LoansList({
    loans, isLoading, onDetail, onDelete, currencySymbol,
}: {
    loans: Loan[];
    isLoading: boolean;
    onDetail: (loan: Loan) => void;
    onDelete: (id: string) => void;
    currencySymbol: (c: string) => string;
}) {
    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
        );
    }

    if (loans.length === 0) {
        return (
            <div className="text-center py-12 text-gray-400">
                <CreditCard className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Nenhum prestamo encontrado</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {loans.map(loan => {
                const total = parseFloat(loan.total_amount);
                const paid = parseFloat(loan.paid_amount || "0");
                const pct = total > 0 ? Math.min((paid / total) * 100, 100) : 0;
                const nextInst = loan.installments.find((i: any) => i.status !== "pago");
                const nextOverdue = nextInst ? isOverdue(nextInst.due_date, nextInst.status) : false;

                return (
                    <Card key={loan.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-semibold truncate">{loan.counterpart_name}</span>
                                        <StatusBadge status={loan.status} />
                                        {loan.interest_rate && (
                                            <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{loan.interest_rate}%</span>
                                        )}
                                    </div>
                                    {loan.description && <p className="text-sm text-gray-500 truncate">{loan.description}</p>}
                                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                        <span>{loan.installments.length} parcela(s)</span>
                                        <span>{new Date(loan.created_at).toLocaleDateString("pt-BR")}</span>
                                        {nextInst && (
                                            <span className={`flex items-center gap-1 ${nextOverdue ? "text-red-600 font-medium" : ""}`}>
                                                <CalendarDays className="w-3 h-3" />
                                                Prox: {new Date(nextInst.due_date).toLocaleDateString("pt-BR")}
                                                {nextOverdue && <AlertTriangle className="w-3 h-3" />}
                                            </span>
                                        )}
                                    </div>
                                    {/* Progress bar */}
                                    <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-green-500 rounded-full transition-all"
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="text-right">
                                        <p className="font-bold text-lg">{formatCurrency(total, loan.currency)}</p>
                                        <p className="text-xs text-green-600">
                                            {loan.type === "payable" ? "Pago" : "Recebido"}: {formatCurrency(paid, loan.currency)}
                                        </p>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button variant="outline" size="icon" onClick={() => onDetail(loan)} title="Ver detalhes">
                                            <Eye className="w-4 h-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => onDelete(loan.id)} className="text-red-500 hover:text-red-700" title="Excluir">
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}

// ─── PAYMENT HISTORY ────────────────────────────────────────────────────────
interface PaymentRow {
    id: string;
    transactionDate: string;
    amount: string;
    currency: string;
    description: string | null;
    accountId: string | null;
    accountName: string | null;
    installmentId: string | null;
    installmentNumber: number | null;
    installmentAmount: string | null;
    loanId: string | null;
    counterpartName: string | null;
    loanType: string | null;
}

function LoanPaymentHistory({ type, accounts }: { type: "payable" | "receivable"; accounts: any[] }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [editing, setEditing] = useState<PaymentRow | null>(null);
    const [editAmount, setEditAmount] = useState("");
    const [editAccountId, setEditAccountId] = useState("");
    const [editDate, setEditDate] = useState("");
    const [editDescription, setEditDescription] = useState("");

    const { data: payments = [], isLoading } = useQuery<PaymentRow[]>({
        queryKey: ["/api/farm/loan-payments", type],
        queryFn: async () => {
            const r = await apiRequest("GET", `/api/farm/loan-payments?type=${type}`);
            return r.json();
        },
    });

    const editMutation = useMutation({
        mutationFn: async (payload: { txId: string; amount: number; accountId: string; transactionDate: string; description: string }) => {
            const r = await apiRequest("PATCH", `/api/farm/loan-payments/${payload.txId}`, {
                amount: payload.amount,
                accountId: payload.accountId,
                transactionDate: payload.transactionDate,
                description: payload.description,
            });
            return r.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/loan-payments"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/loans"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/cash-accounts"] });
            toast({ title: "Pagamento atualizado" });
            setEditing(null);
        },
        onError: (err: any) => {
            toast({ title: "Erro ao editar pagamento", description: err.message, variant: "destructive" });
        },
    });

    function openEdit(row: PaymentRow) {
        setEditing(row);
        setEditAmount(String(parseFloat(row.amount)));
        setEditAccountId(row.accountId || "");
        setEditDate(row.transactionDate ? new Date(row.transactionDate).toISOString().slice(0, 10) : "");
        setEditDescription(row.description || "");
    }

    function submitEdit() {
        if (!editing) return;
        const amt = parseFloat(editAmount);
        if (isNaN(amt) || amt <= 0) {
            toast({ title: "Valor invalido", variant: "destructive" });
            return;
        }
        if (!editAccountId) {
            toast({ title: "Selecione uma caixa", variant: "destructive" });
            return;
        }
        editMutation.mutate({
            txId: editing.id,
            amount: amt,
            accountId: editAccountId,
            transactionDate: editDate || new Date().toISOString(),
            description: editDescription,
        });
    }

    const themeHeader = type === "payable" ? "text-red-700 border-red-200" : "text-green-700 border-green-200";
    const themeAmount = type === "payable" ? "text-red-600" : "text-green-600";

    if (isLoading) {
        return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
    }
    if (payments.length === 0) {
        return (
            <div className="text-center py-12 text-gray-400">
                <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Nenhum {type === "payable" ? "pagamento" : "recebimento"} registrado</p>
            </div>
        );
    }

    return (
        <>
            <Card>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className={`border-b ${themeHeader}`}>
                                    <th className="text-left px-4 py-3 font-semibold">Data</th>
                                    <th className="text-left px-4 py-3 font-semibold">Caixa</th>
                                    <th className="text-left px-4 py-3 font-semibold">Descricao</th>
                                    <th className="text-left px-4 py-3 font-semibold">{type === "payable" ? "Fornecedor" : "Pessoa/Empresa"}</th>
                                    <th className="text-right px-4 py-3 font-semibold">Valor</th>
                                    <th className="text-right px-4 py-3 font-semibold">Acoes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payments.map(p => {
                                    const canEdit = !!p.installmentId;
                                    return (
                                        <tr key={p.id} className="border-b hover:bg-gray-50">
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                {p.transactionDate ? new Date(p.transactionDate).toLocaleDateString("pt-BR") : "—"}
                                            </td>
                                            <td className="px-4 py-3">{p.accountName || "—"}</td>
                                            <td className="px-4 py-3 text-gray-600 max-w-[280px] truncate" title={p.description || ""}>
                                                {p.description || "—"}
                                            </td>
                                            <td className="px-4 py-3 font-medium">{p.counterpartName || "—"}</td>
                                            <td className={`px-4 py-3 text-right font-bold ${themeAmount}`}>
                                                {formatCurrency(parseFloat(p.amount), p.currency)}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={() => openEdit(p)}
                                                    disabled={!canEdit}
                                                    title={canEdit ? "Editar pagamento" : "Pagamento antigo sem vinculo (nao editavel)"}
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Edit Modal */}
            {editing && (
                <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>Editar Pagamento</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3">
                            <div className="text-xs text-gray-500 bg-gray-50 rounded p-2">
                                <p><span className="font-semibold">Contraparte:</span> {editing.counterpartName || "—"}</p>
                                {editing.installmentNumber != null && (
                                    <p><span className="font-semibold">Parcela:</span> #{editing.installmentNumber}{editing.installmentAmount ? ` (${formatCurrency(parseFloat(editing.installmentAmount), editing.currency)})` : ""}</p>
                                )}
                            </div>
                            <div>
                                <Label>Valor</Label>
                                <Input type="number" step="0.01" value={editAmount} onChange={e => setEditAmount(e.target.value)} />
                            </div>
                            <div>
                                <Label>Caixa</Label>
                                <Select value={editAccountId} onValueChange={setEditAccountId}>
                                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                                    <SelectContent>
                                        {accounts.filter((a: any) => a.currency === editing.currency).map((a: any) => (
                                            <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Data</Label>
                                <Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} />
                            </div>
                            <div>
                                <Label>Descricao</Label>
                                <Input value={editDescription} onChange={e => setEditDescription(e.target.value)} />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
                                <Button onClick={submitEdit} disabled={editMutation.isPending}>
                                    {editMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                                    Salvar
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
}
