import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency } from "@/lib/format-currency";
import FarmLayout from "@/components/fazenda/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
    Wallet, Plus, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
    Loader2, Trash2, Building2, Banknote, CreditCard, Landmark, DollarSign,
    Tag, Download, AlertTriangle, Target, Activity, ArrowLeftRight, FileText,
    CheckCircle, XCircle, Clock, Pencil,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Area, AreaChart } from "recharts";

// ─── Constants ───────────────────────────────────────────────────────────────
const ACCOUNT_TYPES = [
    { value: "caixa_fisico", label: "Caixa Físico", icon: Banknote },
    { value: "conta_corrente", label: "Conta Corrente", icon: Landmark },
    { value: "poupanca", label: "Poupança", icon: Building2 },
    { value: "carteira_digital", label: "Carteira Digital / PIX", icon: CreditCard },
];

const SAIDA_CATEGORIES = [
    { value: "insumos", label: "Insumos Agrícolas" }, { value: "pecas", label: "Peças e Manutenção" },
    { value: "diesel", label: "Combustível / Diesel" }, { value: "mao_de_obra", label: "Mão de Obra" },
    { value: "frete", label: "Frete / Transporte" }, { value: "energia", label: "Energia / Água" },
    { value: "arrendamento", label: "Arrendamento" }, { value: "financiamento", label: "Parcela Financiamento" },
    { value: "impostos", label: "Impostos e Taxas" }, { value: "pro_labore", label: "Retirada (Pró-labore)" },
    { value: "outro_saida", label: "Outras Saídas" },
];

const ENTRADA_CATEGORIES = [
    { value: "venda_producao", label: "Venda de Produção" }, { value: "recebimento", label: "Recebimento de Clientes" },
    { value: "emprestimo", label: "Empréstimo / Financiamento" }, { value: "reembolso", label: "Reembolso / Devolução" },
    { value: "aporte", label: "Aporte do Proprietário" }, { value: "outro_entrada", label: "Outras Entradas" },
];

const PAYMENT_METHODS = [
    { value: "efetivo", label: "Dinheiro / Efetivo" }, { value: "transferencia", label: "Transferência Bancária" },
    { value: "cheque", label: "Cheque" }, { value: "cartao", label: "Cartão" }, { value: "pix", label: "PIX" },
];

const ALL_CATEGORIES = [...SAIDA_CATEGORIES, ...ENTRADA_CATEGORIES];
const PIE_COLORS = ["#059669", "#0891b2", "#d97706", "#dc2626", "#7c3aed", "#db2777", "#65a30d", "#ea580c", "#4f46e5", "#0d9488"];

// formatCurrency imported from @/lib/format-currency

// ─── CSV helper ───────────────────────────────────────────────────────────────
function exportTransactionsCSV(transactions: any[], accounts: any[]) {
    const headers = ["Data", "Tipo", "Categoria", "Descrição", "Conta", "Valor", "Moeda", "Recibo", "Origem"];
    const rows = transactions.map((t: any) => {
        const acc = accounts.find((a: any) => a.id === t.accountId);
        const cat = ALL_CATEGORIES.find(c => c.value === t.category);
        return [
            new Date(t.transactionDate).toLocaleDateString("pt-BR"),
            t.type === "entrada" ? "Entrada" : "Saída",
            cat?.label || t.category,
            t.description || "",
            acc?.name || "",
            (t.type === "entrada" ? "+" : "-") + formatCurrency(parseFloat(t.amount), t.currency || "USD"),
            t.currency || "USD",
            t.receipt_id || "",
            t.referenceType === "manual" ? "Manual" : t.referenceType === "whatsapp" ? "WhatsApp" : "Auto",
        ];
    });
    const csv = [headers, ...rows].map(r => r.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "extrato_fluxo_caixa.csv"; a.click();
    URL.revokeObjectURL(url);
}

// ═══════════════════════════════════════════════════════════════════
export default function FarmCashFlow() {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { user } = useAuth();

    // Expandable summary cards
    const [expandEntradas, setExpandEntradas] = useState(false);
    const [expandSaidas, setExpandSaidas] = useState(false);
    const [expandSaldo, setExpandSaldo] = useState(false);

    // Extrato date filter
    const [extratoFrom, setExtratoFrom] = useState("");
    const [extratoTo, setExtratoTo] = useState("");

    const { data: summary, isLoading } = useQuery<any>({
        queryKey: ["/api/farm/cash-summary"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/cash-summary"); return r.json(); },
        enabled: !!user,
    });

    const { data: transactions = [] } = useQuery<any[]>({
        queryKey: ["/api/farm/cash-transactions"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/cash-transactions"); return r.json(); },
        enabled: !!user,
    });

    const { data: customCategories = [] } = useQuery<any[]>({
        queryKey: ["/api/farm/expense-categories"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/expense-categories"); return r.json(); },
        enabled: !!user,
    });

    const { data: accountsPayable = [] } = useQuery<any[]>({
        queryKey: ["/api/farm/accounts-payable"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/accounts-payable"); return r.json(); },
        enabled: !!user,
    });

    const { data: accountsReceivable = [] } = useQuery<any[]>({
        queryKey: ["/api/farm/accounts-receivable"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/accounts-receivable"); return r.json(); },
        enabled: !!user,
    });

    const [currencyFilter, setCurrencyFilter] = useState<"todos" | "USD" | "PYG">("todos");

    const allAccounts: any[] = summary?.accounts || [];
    const accounts = currencyFilter === "todos" ? allAccounts : allAccounts.filter((a: any) => a.currency === currencyFilter);
    const month = summary?.monthSummary || { totalEntradas: 0, totalSaidas: 0, saldoLiquido: 0 };
    const chartData: any[] = summary?.chartData || [];
    const byCategory: any[] = summary?.byCategory || [];

    // Filtered transactions by currency
    const filteredTransactions = currencyFilter === "todos" ? transactions : transactions.filter((t: any) => (t.currency || "USD") === currencyFilter);

    // Per-currency month totals
    const monthTotals = useMemo(() => {
        const currencies = currencyFilter === "todos" ? ["USD", "PYG"] : [currencyFilter];
        return currencies.map(cur => {
            const curTx = transactions.filter((t: any) => (t.currency || "USD") === cur);
            const entradas = curTx.filter((t: any) => t.type === "entrada").reduce((s: number, t: any) => s + parseFloat(t.amount || 0), 0);
            const saidas = curTx.filter((t: any) => t.type !== "entrada").reduce((s: number, t: any) => s + parseFloat(t.amount || 0), 0);
            return { currency: cur, entradas, saidas, saldo: entradas - saidas };
        }).filter(m => m.entradas > 0 || m.saidas > 0 || currencyFilter !== "todos");
    }, [transactions, currencyFilter]);

    // ── Predictive indicators ────────────────────────────────────────
    const totalSaldo = allAccounts.reduce((s, a) => s + (parseFloat(a.currentBalance) || 0), 0);

    const upcomingAP = useMemo(() => {
        const next30 = new Date(); next30.setDate(next30.getDate() + 30);
        return (accountsPayable as any[])
            .filter((ap: any) => ap.status !== "pago" && new Date(ap.dueDate) <= next30)
            .reduce((s: number, ap: any) => s + parseFloat(ap.totalAmount || ap.amount || 0), 0);
    }, [accountsPayable]);

    const upcomingAR = useMemo(() => {
        const next30 = new Date(); next30.setDate(next30.getDate() + 30);
        return (accountsReceivable as any[])
            .filter((ar: any) => ar.status !== "recebido" && new Date(ar.dueDate) <= next30)
            .reduce((s: number, ar: any) => s + parseFloat(ar.totalAmount) - parseFloat(ar.receivedAmount || 0), 0);
    }, [accountsReceivable]);

    const predictedBalance = totalSaldo + upcomingAR - upcomingAP;
    const burnRate = month.totalSaidas / (new Date().getDate() || 1); // daily average spending
    const daysUntilZero = burnRate > 0 ? Math.floor(totalSaldo / burnRate) : null;

    // Build 30-day cash flow projection
    const projectionData = useMemo(() => {
        const today = new Date();
        const points: { day: string; saldo: number; entradas: number; saidas: number }[] = [];
        let running = totalSaldo;
        for (let d = 0; d <= 30; d++) {
            const dt = new Date(today); dt.setDate(dt.getDate() + d);
            const dateStr = dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
            const dayAP = (accountsPayable as any[]).filter((ap: any) => {
                const due = new Date(ap.dueDate);
                return ap.status !== "pago" && due.toDateString() === dt.toDateString();
            }).reduce((s: number, ap: any) => s + parseFloat(ap.totalAmount || 0), 0);
            const dayAR = (accountsReceivable as any[]).filter((ar: any) => {
                const due = new Date(ar.dueDate);
                return ar.status !== "recebido" && due.toDateString() === dt.toDateString();
            }).reduce((s: number, ar: any) => s + parseFloat(ar.totalAmount) - parseFloat(ar.receivedAmount || 0), 0);
            running = running + dayAR - dayAP;
            if (d === 0 || d % 5 === 0 || dayAP > 0 || dayAR > 0) {
                points.push({ day: dateStr, saldo: Math.max(0, parseFloat(running.toFixed(2))), entradas: dayAR, saidas: dayAP });
            }
        }
        return points;
    }, [totalSaldo, accountsPayable, accountsReceivable]);

    const deleteTransaction = useMutation({
        mutationFn: (id: string) => apiRequest("DELETE", `/api/farm/cash-transactions/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/cash-summary"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/cash-transactions"] });
            toast({ title: "Movimentação excluída" });
        },
    });

    return (
        <FarmLayout>
            <div className="space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-emerald-800">Fluxo de Caixa</h1>
                        <p className="text-emerald-600 text-sm">Controle financeiro da sua fazenda</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <TransferDialog accounts={allAccounts} onSuccess={() => {
                            queryClient.invalidateQueries({ queryKey: ["/api/farm/cash-summary"] });
                            queryClient.invalidateQueries({ queryKey: ["/api/farm/cash-transactions"] });
                        }} />
                        <CreateAccountDialog onSuccess={() => queryClient.invalidateQueries({ queryKey: ["/api/farm/cash-summary"] })} />
                    </div>
                </div>

                {/* Currency filter */}
                <div className="flex gap-1">
                    {(["todos", "USD", "PYG"] as const).map(cur => (
                        <button key={cur} onClick={() => setCurrencyFilter(cur)}
                            className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-colors ${currencyFilter === cur
                                ? "bg-emerald-600 text-white border-emerald-600"
                                : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                            {cur === "todos" ? "Todas Moedas" : cur === "USD" ? "USD ($)" : "PYG (Gs.)"}
                        </button>
                    ))}
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
                ) : (
                    <Tabs defaultValue="dashboard">
                        <TabsList className="bg-emerald-50 text-emerald-800">
                            <TabsTrigger value="dashboard">Painel</TabsTrigger>
                            <TabsTrigger value="previsao">Previsao</TabsTrigger>
                            <TabsTrigger value="extrato">Extrato</TabsTrigger>
                            <TabsTrigger value="transferencias">Transferencias</TabsTrigger>
                            <TabsTrigger value="contas">Contas / Bancos</TabsTrigger>
                            <TabsTrigger value="cheques">Cheques</TabsTrigger>
                            <TabsTrigger value="categorias">Categorias</TabsTrigger>
                        </TabsList>

                        {/* ── DASHBOARD ─────────────────── */}
                        <TabsContent value="dashboard" className="space-y-6 mt-4">
                            {/* Month KPIs - Expandable */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <Card className="border-emerald-200 bg-emerald-50 cursor-pointer transition-shadow hover:shadow-md" onClick={() => setExpandEntradas(!expandEntradas)}>
                                    <CardContent className="p-5">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-full bg-emerald-200 flex items-center justify-center"><ArrowUpRight className="h-5 w-5 text-emerald-700" /></div>
                                            <div><p className="text-xs text-emerald-600 font-medium">Entradas (Mes) {expandEntradas ? "[-]" : "[+]"}</p>
                                                {monthTotals.length > 0 ? monthTotals.map(m => (
                                                    <p key={m.currency} className="text-xl font-bold text-emerald-800">{formatCurrency(m.entradas, m.currency)}</p>
                                                )) : <p className="text-xl font-bold text-emerald-800">{formatCurrency(month.totalEntradas, currencyFilter === "todos" ? "USD" : currencyFilter)}</p>}
                                            </div>
                                        </div>
                                        {expandEntradas && (
                                            <div className="mt-3 pt-3 border-t border-emerald-200 space-y-1">
                                                <p className="text-xs font-medium text-emerald-700 mb-1">Ultimas 5 entradas:</p>
                                                {filteredTransactions.filter(t => t.type === "entrada").slice(0, 5).map((t: any) => (
                                                    <div key={t.id} className="flex justify-between text-xs">
                                                        <span className="text-gray-600 truncate max-w-[60%]">{t.description || t.category || "Entrada"}</span>
                                                        <span className="font-mono text-emerald-700">+{formatCurrency(parseFloat(t.amount), t.currency || "USD")}</span>
                                                    </div>
                                                ))}
                                                {filteredTransactions.filter(t => t.type === "entrada").length === 0 && <p className="text-xs text-gray-400">Nenhuma entrada</p>}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                                <Card className="border-red-200 bg-red-50 cursor-pointer transition-shadow hover:shadow-md" onClick={() => setExpandSaidas(!expandSaidas)}>
                                    <CardContent className="p-5">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-full bg-red-200 flex items-center justify-center"><ArrowDownRight className="h-5 w-5 text-red-700" /></div>
                                            <div><p className="text-xs text-red-600 font-medium">Saidas (Mes) {expandSaidas ? "[-]" : "[+]"}</p>
                                                {monthTotals.length > 0 ? monthTotals.map(m => (
                                                    <p key={m.currency} className="text-xl font-bold text-red-800">{formatCurrency(m.saidas, m.currency)}</p>
                                                )) : <p className="text-xl font-bold text-red-800">{formatCurrency(month.totalSaidas, currencyFilter === "todos" ? "USD" : currencyFilter)}</p>}
                                            </div>
                                        </div>
                                        {expandSaidas && (
                                            <div className="mt-3 pt-3 border-t border-red-200 space-y-1">
                                                <p className="text-xs font-medium text-red-700 mb-1">Ultimas 5 saidas:</p>
                                                {filteredTransactions.filter(t => t.type !== "entrada").slice(0, 5).map((t: any) => (
                                                    <div key={t.id} className="flex justify-between text-xs">
                                                        <span className="text-gray-600 truncate max-w-[60%]">{t.description || t.category || "Saida"}</span>
                                                        <span className="font-mono text-red-700">-{formatCurrency(parseFloat(t.amount), t.currency || "USD")}</span>
                                                    </div>
                                                ))}
                                                {filteredTransactions.filter(t => t.type !== "entrada").length === 0 && <p className="text-xs text-gray-400">Nenhuma saida</p>}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                                <Card className={`border-${month.saldoLiquido >= 0 ? "blue" : "amber"}-200 bg-${month.saldoLiquido >= 0 ? "blue" : "amber"}-50 cursor-pointer transition-shadow hover:shadow-md`} onClick={() => setExpandSaldo(!expandSaldo)}>
                                    <CardContent className="p-5">
                                        <div className="flex items-center gap-3">
                                            <div className={`h-10 w-10 rounded-full ${month.saldoLiquido >= 0 ? "bg-blue-200" : "bg-amber-200"} flex items-center justify-center`}><DollarSign className={`h-5 w-5 ${month.saldoLiquido >= 0 ? "text-blue-700" : "text-amber-700"}`} /></div>
                                            <div><p className={`text-xs ${month.saldoLiquido >= 0 ? "text-blue-600" : "text-amber-600"} font-medium`}>Saldo Liquido (Mes) {expandSaldo ? "[-]" : "[+]"}</p>
                                                {monthTotals.length > 0 ? monthTotals.map(m => (
                                                    <p key={m.currency} className={`text-xl font-bold ${m.saldo >= 0 ? "text-blue-800" : "text-amber-800"}`}>{formatCurrency(m.saldo, m.currency)}</p>
                                                )) : <p className={`text-xl font-bold ${month.saldoLiquido >= 0 ? "text-blue-800" : "text-amber-800"}`}>{formatCurrency(month.saldoLiquido, currencyFilter === "todos" ? "USD" : currencyFilter)}</p>}
                                            </div>
                                        </div>
                                        {expandSaldo && (
                                            <div className="mt-3 pt-3 border-t border-blue-200 space-y-1">
                                                <p className="text-xs font-medium text-blue-700 mb-1">Resumo do saldo:</p>
                                                {monthTotals.map(m => (
                                                    <div key={m.currency} className="text-xs space-y-0.5">
                                                        <div className="flex justify-between"><span className="text-emerald-600">Entradas ({m.currency})</span><span className="font-mono">+{formatCurrency(m.entradas, m.currency)}</span></div>
                                                        <div className="flex justify-between"><span className="text-red-600">Saidas ({m.currency})</span><span className="font-mono">-{formatCurrency(m.saidas, m.currency)}</span></div>
                                                        <div className="flex justify-between font-semibold"><span>Liquido</span><span className="font-mono">{formatCurrency(m.saldo, m.currency)}</span></div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Account balances */}
                            <Card className="border-emerald-100">
                                <CardHeader><CardTitle className="text-emerald-800">Saldos por Conta</CardTitle></CardHeader>
                                <CardContent>
                                    {accounts.length === 0 ? (
                                        <div className="py-6 text-center"><Wallet className="h-10 w-10 text-gray-300 mx-auto mb-2" /><p className="text-gray-500 text-sm">Nenhuma conta cadastrada.</p></div>
                                    ) : (
                                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {accounts.map((acc: any) => {
                                                const balance = parseFloat(acc.currentBalance) || 0;
                                                const accType = ACCOUNT_TYPES.find(t => t.value === acc.accountType);
                                                const AccIcon = accType?.icon || Wallet;
                                                return (
                                                    <div key={acc.id} className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 bg-white">
                                                        <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0"><AccIcon className="h-5 w-5" /></div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-semibold text-gray-800 truncate">{acc.name}</p>
                                                            <p className="text-xs text-gray-500">{accType?.label} · {acc.currency}</p>
                                                        </div>
                                                        <p className={`font-bold text-lg ${balance >= 0 ? "text-emerald-700" : "text-red-600"}`}>{formatCurrency(balance, acc.currency)}</p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Charts */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <Card className="border-emerald-100">
                                    <CardHeader><CardTitle className="text-emerald-800 text-base">Entradas vs Saídas (6 meses)</CardTitle></CardHeader>
                                    <CardContent>
                                        {chartData.length > 0 ? (
                                            <ResponsiveContainer width="100%" height={250}>
                                                <BarChart data={chartData}>
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis dataKey="month" /><YAxis />
                                                    <Tooltip formatter={(v: number) => formatCurrency(v, "USD")} /><Legend />
                                                    <Bar dataKey="entradas" name="Entradas" fill="#059669" radius={[4, 4, 0, 0]} />
                                                    <Bar dataKey="saidas" name="Saídas" fill="#dc2626" radius={[4, 4, 0, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        ) : <p className="text-center text-gray-400 py-8 text-sm">Sem dados para exibir</p>}
                                    </CardContent>
                                </Card>
                                <Card className="border-emerald-100">
                                    <CardHeader><CardTitle className="text-emerald-800 text-base">Saídas por Categoria (Mês)</CardTitle></CardHeader>
                                    <CardContent>
                                        {byCategory.length > 0 ? (
                                            <ResponsiveContainer width="100%" height={250}>
                                                <PieChart>
                                                    <Pie data={byCategory} dataKey="value" nameKey="category" cx="50%" cy="50%" outerRadius={90} label={({ category, value }) => `${category}: ${formatCurrency(value, "USD")}`}>
                                                        {byCategory.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                                                    </Pie>
                                                    <Tooltip formatter={(v: number) => formatCurrency(v, "USD")} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        ) : <p className="text-center text-gray-400 py-8 text-sm">Sem saídas neste mês</p>}
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Last transactions */}
                            <Card className="border-emerald-100">
                                <CardHeader><CardTitle className="text-emerald-800">Últimas Movimentações</CardTitle></CardHeader>
                                <CardContent>
                                    <TransactionTable transactions={filteredTransactions.slice(0, 10)} accounts={accounts} onDelete={(id) => deleteTransaction.mutate(id)} deleting={deleteTransaction.isPending} />
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* ── PREDICTIVE TAB ─────────────────── */}
                        <TabsContent value="previsao" className="space-y-6 mt-4">
                            {/* Indicator cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <Card className="border-emerald-200 bg-emerald-50"><CardContent className="p-5">
                                    <div className="flex items-center gap-2 mb-1"><Activity className="h-4 w-4 text-emerald-600" /><p className="text-xs text-emerald-600 font-medium">Saldo Total Atual</p></div>
                                    <p className="text-xl font-bold text-emerald-800">{formatCurrency(totalSaldo, "USD")}</p>
                                </CardContent></Card>

                                <Card className={`border-${upcomingAP > 0 ? "red" : "gray"}-200 bg-${upcomingAP > 0 ? "red" : "gray"}-50`}><CardContent className="p-5">
                                    <div className="flex items-center gap-2 mb-1">{upcomingAP > 0 ? <AlertTriangle className="h-4 w-4 text-red-600" /> : <DollarSign className="h-4 w-4 text-gray-400" />}<p className={`text-xs font-medium ${upcomingAP > 0 ? "text-red-600" : "text-gray-500"}`}>A Pagar (30 dias)</p></div>
                                    <p className={`text-xl font-bold ${upcomingAP > 0 ? "text-red-700" : "text-gray-500"}`}>{formatCurrency(upcomingAP, "USD")}</p>
                                </CardContent></Card>

                                <Card className={`border-${upcomingAR > 0 ? "blue" : "gray"}-200 bg-${upcomingAR > 0 ? "blue" : "gray"}-50`}><CardContent className="p-5">
                                    <div className="flex items-center gap-2 mb-1"><TrendingUp className={`h-4 w-4 ${upcomingAR > 0 ? "text-blue-600" : "text-gray-400"}`} /><p className={`text-xs font-medium ${upcomingAR > 0 ? "text-blue-600" : "text-gray-500"}`}>A Receber (30 dias)</p></div>
                                    <p className={`text-xl font-bold ${upcomingAR > 0 ? "text-blue-700" : "text-gray-500"}`}>{formatCurrency(upcomingAR, "USD")}</p>
                                </CardContent></Card>

                                <Card className={`border-${predictedBalance >= 0 ? "emerald" : "red"}-200 bg-${predictedBalance >= 0 ? "emerald" : "red"}-50`}><CardContent className="p-5">
                                    <div className="flex items-center gap-2 mb-1"><Target className={`h-4 w-4 ${predictedBalance >= 0 ? "text-emerald-600" : "text-red-600"}`} /><p className={`text-xs font-medium ${predictedBalance >= 0 ? "text-emerald-600" : "text-red-600"}`}>Saldo Projetado (30d)</p></div>
                                    <p className={`text-xl font-bold ${predictedBalance >= 0 ? "text-emerald-800" : "text-red-700"}`}>{formatCurrency(predictedBalance, "USD")}</p>
                                    {predictedBalance < 0 && <p className="text-xs text-red-500 mt-1">⚠ Possível saldo negativo!</p>}
                                </CardContent></Card>
                            </div>

                            {daysUntilZero !== null && daysUntilZero < 60 && (
                                <Card className={`border-${daysUntilZero < 15 ? "red" : "amber"}-200 bg-${daysUntilZero < 15 ? "red" : "amber"}-50`}>
                                    <CardContent className="p-4 flex items-center gap-3">
                                        <AlertTriangle className={`h-6 w-6 ${daysUntilZero < 15 ? "text-red-600" : "text-amber-600"} shrink-0`} />
                                        <div>
                                            <p className={`font-semibold ${daysUntilZero < 15 ? "text-red-700" : "text-amber-700"}`}>
                                                ⚠ Alerta de Fluxo de Caixa
                                            </p>
                                            <p className={`text-sm ${daysUntilZero < 15 ? "text-red-600" : "text-amber-600"}`}>
                                                Com o ritmo de gastos atual ({formatCurrency(burnRate, "USD")}/dia), o caixa pode zerar em aproximadamente <strong>{daysUntilZero} dias</strong>. Considere reduzir despesas ou antecipar recebimentos.
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Projection chart */}
                            <Card className="border-emerald-100">
                                <CardHeader><CardTitle className="text-emerald-800 text-base">Projeção de Saldo – Próximos 30 dias</CardTitle></CardHeader>
                                <CardContent>
                                    {projectionData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height={300}>
                                            <AreaChart data={projectionData}>
                                                <defs>
                                                    <linearGradient id="gradSaldo" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#059669" stopOpacity={0.3} />
                                                        <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                                                <YAxis tick={{ fontSize: 11 }} />
                                                <Tooltip formatter={(v: number) => formatCurrency(v, "USD")} />
                                                <Legend />
                                                <Area type="monotone" dataKey="saldo" name="Saldo" stroke="#059669" fill="url(#gradSaldo)" strokeWidth={2} />
                                                {projectionData.some(p => p.entradas > 0) && <Bar dataKey="entradas" name="Entradas previstas" fill="#3b82f6" radius={[4, 4, 0, 0]} />}
                                                {projectionData.some(p => p.saidas > 0) && <Bar dataKey="saidas" name="Saídas previstas" fill="#ef4444" radius={[4, 4, 0, 0]} />}
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="py-10 text-center text-gray-400 text-sm">
                                            <Target className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                                            <p>Cadastre contas a pagar e a receber para gerar a projeção</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Upcoming obligations */}
                            {((accountsPayable as any[]).filter((ap: any) => ap.status !== "pago").length > 0 || (accountsReceivable as any[]).filter((ar: any) => ar.status !== "recebido").length > 0) && (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    {(accountsPayable as any[]).filter((ap: any) => ap.status !== "pago").length > 0 && (
                                        <Card className="border-red-100">
                                            <CardHeader><CardTitle className="text-red-700 text-sm flex items-center gap-2"><TrendingDown className="h-4 w-4" /> Próximas Saídas (A Pagar)</CardTitle></CardHeader>
                                            <CardContent>
                                                <div className="space-y-2">
                                                    {(accountsPayable as any[]).filter((ap: any) => ap.status !== "pago").slice(0, 5).map((ap: any) => (
                                                        <div key={ap.id} className="flex justify-between items-center text-sm py-1.5 border-b border-gray-100">
                                                            <div>
                                                                <p className="font-medium text-gray-800">{ap.supplier || ap.description}</p>
                                                                <p className="text-xs text-gray-500">{new Date(ap.dueDate).toLocaleDateString("pt-BR")}</p>
                                                            </div>
                                                            <span className="font-mono font-semibold text-red-600">- {formatCurrency(parseFloat(ap.totalAmount || ap.amount || 0), ap.currency || "USD")}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )}
                                    {(accountsReceivable as any[]).filter((ar: any) => ar.status !== "recebido").length > 0 && (
                                        <Card className="border-blue-100">
                                            <CardHeader><CardTitle className="text-blue-700 text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Próximas Entradas (A Receber)</CardTitle></CardHeader>
                                            <CardContent>
                                                <div className="space-y-2">
                                                    {(accountsReceivable as any[]).filter((ar: any) => ar.status !== "recebido").slice(0, 5).map((ar: any) => (
                                                        <div key={ar.id} className="flex justify-between items-center text-sm py-1.5 border-b border-gray-100">
                                                            <div>
                                                                <p className="font-medium text-gray-800">{ar.buyer}</p>
                                                                <p className="text-xs text-gray-500">{new Date(ar.dueDate).toLocaleDateString("pt-BR")} · {ar.description || ""}</p>
                                                            </div>
                                                            <span className="font-mono font-semibold text-blue-600">+ {formatCurrency(parseFloat(ar.totalAmount) - parseFloat(ar.receivedAmount || 0), ar.currency || "USD")}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )}
                                </div>
                            )}
                        </TabsContent>

                        {/* ── EXTRATO (full) ───────────────── */}
                        <TabsContent value="extrato" className="mt-4 space-y-4">
                            <div className="flex flex-wrap gap-3 items-end justify-between">
                                <div className="flex flex-wrap gap-3 items-end">
                                    <div>
                                        <Label className="text-xs text-gray-500">Data de</Label>
                                        <Input type="date" value={extratoFrom} onChange={e => setExtratoFrom(e.target.value)} className="w-40 h-8 text-sm" />
                                    </div>
                                    <div>
                                        <Label className="text-xs text-gray-500">ate</Label>
                                        <Input type="date" value={extratoTo} onChange={e => setExtratoTo(e.target.value)} className="w-40 h-8 text-sm" />
                                    </div>
                                    {(extratoFrom || extratoTo) && (
                                        <Button variant="ghost" size="sm" className="text-gray-500 h-8 text-xs" onClick={() => { setExtratoFrom(""); setExtratoTo(""); }}>
                                            Limpar datas
                                        </Button>
                                    )}
                                </div>
                                <Button variant="outline" className="border-emerald-200 text-emerald-700" onClick={() => exportTransactionsCSV(
                                    filteredTransactions.filter((t: any) => {
                                        if (extratoFrom && new Date(t.transactionDate) < new Date(extratoFrom)) return false;
                                        if (extratoTo && new Date(t.transactionDate) > new Date(extratoTo)) return false;
                                        return true;
                                    }), accounts)}>
                                    <Download className="mr-2 h-4 w-4" /> Exportar CSV
                                </Button>
                            </div>
                            <Card className="border-emerald-100">
                                <CardHeader><CardTitle className="text-emerald-800">Extrato Completo</CardTitle></CardHeader>
                                <CardContent>
                                    <TransactionTable transactions={filteredTransactions.filter((t: any) => {
                                        if (extratoFrom && new Date(t.transactionDate) < new Date(extratoFrom)) return false;
                                        if (extratoTo && new Date(t.transactionDate) > new Date(extratoTo)) return false;
                                        return true;
                                    })} accounts={accounts} onDelete={(id) => deleteTransaction.mutate(id)} deleting={deleteTransaction.isPending} />
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* ── TRANSFERENCIAS ───────────────── */}
                        <TabsContent value="transferencias" className="mt-4">
                            <TransferenciasTab transactions={filteredTransactions} accounts={allAccounts} onRefresh={() => {
                                queryClient.invalidateQueries({ queryKey: ["/api/farm/cash-summary"] });
                                queryClient.invalidateQueries({ queryKey: ["/api/farm/cash-transactions"] });
                            }} />
                        </TabsContent>

                        {/* ── CHEQUES ───────────────── */}
                        <TabsContent value="cheques" className="mt-4">
                            <ChequesTab accounts={allAccounts} />
                        </TabsContent>

                        <TabsContent value="contas" className="mt-4">
                            <AccountsManager accounts={accounts} onRefresh={() => queryClient.invalidateQueries({ queryKey: ["/api/farm/cash-summary"] })} />
                        </TabsContent>
                        <TabsContent value="categorias" className="mt-4">
                            <CategoriesManager categories={customCategories} onRefresh={() => queryClient.invalidateQueries({ queryKey: ["/api/farm/expense-categories"] })} />
                        </TabsContent>
                    </Tabs>
                )}
            </div>
        </FarmLayout>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
function TransactionTable({ transactions, accounts, onDelete, deleting }: { transactions: any[]; accounts: any[]; onDelete: (id: string) => void; deleting: boolean }) {
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState("todos");

    const filtered = transactions.filter((t: any) => {
        if (typeFilter !== "todos" && t.type !== typeFilter) return false;
        if (search) {
            const cat = ALL_CATEGORIES.find(c => c.value === t.category)?.label || t.category;
            const desc = t.description || "";
            const acc = accounts.find((a: any) => a.id === t.accountId)?.name || "";
            if (![cat, desc, acc].some(s => s.toLowerCase().includes(search.toLowerCase()))) return false;
        }
        return true;
    });

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
                <Input placeholder="Buscar por descrição, categoria, conta..." value={search} onChange={e => setSearch(e.target.value)} className="flex-1 min-w-48 max-w-sm h-8 text-sm" />
                <div className="flex gap-1">
                    {["todos", "entrada", "saida"].map(t => (
                        <button key={t} onClick={() => setTypeFilter(t)}
                            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${typeFilter === t
                                ? t === "todos" ? "bg-gray-600 text-white border-gray-600"
                                    : t === "entrada" ? "bg-emerald-600 text-white border-emerald-600"
                                        : "bg-red-600 text-white border-red-600"
                                : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                            {t === "todos" ? "Todos" : t === "entrada" ? "Entradas" : "Saídas"}
                        </button>
                    ))}
                </div>
            </div>
            {filtered.length === 0 ? (
                <div className="py-6 text-center"><Wallet className="h-10 w-10 text-gray-300 mx-auto mb-2" /><p className="text-gray-500 text-sm">Nenhuma movimentação encontrada</p></div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="text-left p-3 font-semibold text-gray-600">Data</th>
                                <th className="text-left p-3 font-semibold text-gray-600">Tipo</th>
                                <th className="text-left p-3 font-semibold text-gray-600">Categoria</th>
                                <th className="text-left p-3 font-semibold text-gray-600">Descrição</th>
                                <th className="text-left p-3 font-semibold text-gray-600">Conta</th>
                                <th className="text-right p-3 font-semibold text-gray-600">Valor</th>
                                <th className="text-center p-3 font-semibold text-gray-600">Recibo</th>
                                <th className="text-center p-3 font-semibold text-gray-600">Origem</th>
                                <th className="text-center p-3 font-semibold text-gray-600">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((t: any) => {
                                const acc = accounts.find((a: any) => a.id === t.accountId);
                                const cat = ALL_CATEGORIES.find(c => c.value === t.category);
                                const isEntrada = t.type === "entrada";
                                return (
                                    <tr key={t.id} className="border-t border-gray-100 hover:bg-gray-50">
                                        <td className="p-3">{new Date(t.transactionDate).toLocaleDateString("pt-BR")}</td>
                                        <td className="p-3">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${isEntrada ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                                                {isEntrada ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}{isEntrada ? "Entrada" : "Saída"}
                                            </span>
                                        </td>
                                        <td className="p-3">{cat?.label || t.category}</td>
                                        <td className="p-3 max-w-[200px] truncate">{t.description || "—"}</td>
                                        <td className="p-3 text-gray-600">{acc?.name || "—"}</td>
                                        <td className={`text-right p-3 font-mono font-semibold ${isEntrada ? "text-emerald-700" : "text-red-600"}`}>
                                            {isEntrada ? "+" : "-"}{formatCurrency(parseFloat(t.amount), t.currency || "USD")}
                                        </td>
                                        <td className="text-center p-3">
                                            {t.receipt_id ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700 font-mono">
                                                    <FileText className="h-3 w-3" />{t.receipt_id}
                                                </span>
                                            ) : <span className="text-gray-300">--</span>}
                                        </td>
                                        <td className="text-center p-3">
                                            <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
                                                {t.referenceType === "manual" ? "Manual" : t.referenceType === "whatsapp" ? "WhatsApp" : t.referenceType === "aprovacao_despesa" ? "Despesa" : "Fatura"}
                                            </span>
                                        </td>
                                        <td className="text-center p-3">
                                            {t.referenceType === "manual" && (
                                                <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700 h-7 w-7 p-0" onClick={() => onDelete(t.id)} disabled={deleting}>
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    <div className="p-3 bg-gray-50 border-t border-gray-100 text-sm text-gray-600 flex justify-between">
                        <span>{filtered.length} movimentações</span>
                        <span>
                            Entradas: <strong className="text-emerald-600">{formatCurrency(filtered.filter(t => t.type === "entrada").reduce((s: number, t: any) => s + parseFloat(t.amount), 0), "USD")}</strong>
                            {" "}· Saidas: <strong className="text-red-600">{formatCurrency(filtered.filter(t => t.type !== "entrada").reduce((s: number, t: any) => s + parseFloat(t.amount), 0), "USD")}</strong>
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
function AccountsManager({ accounts, onRefresh }: { accounts: any[]; onRefresh: () => void }) {
    const { toast } = useToast();
    const [editingAccount, setEditingAccount] = useState<any>(null);
    const [editName, setEditName] = useState("");
    const [editBankName, setEditBankName] = useState("");
    const [editAccountType, setEditAccountType] = useState("");

    const deleteMutation = useMutation({
        mutationFn: (id: string) => apiRequest("DELETE", `/api/farm/cash-accounts/${id}`),
        onSuccess: () => { onRefresh(); toast({ title: "Conta removida" }); },
        onError: () => toast({ title: "Erro ao remover conta", variant: "destructive" }),
    });

    const editMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PUT", `/api/farm/cash-accounts/${id}`, data),
        onSuccess: () => { onRefresh(); toast({ title: "Conta atualizada" }); setEditingAccount(null); },
        onError: () => toast({ title: "Erro ao atualizar", variant: "destructive" }),
    });

    function openEdit(acc: any) {
        setEditName(acc.name);
        setEditBankName(acc.bankName || "");
        setEditAccountType(acc.accountType);
        setEditingAccount(acc);
    }

    return (
        <>
        <Card className="border-emerald-100">
            <CardHeader><CardTitle className="text-emerald-800">Contas e Bancos Cadastrados</CardTitle></CardHeader>
            <CardContent>
                {accounts.length === 0 ? (
                    <div className="py-8 text-center"><Landmark className="h-12 w-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">Nenhuma conta cadastrada</p></div>
                ) : (
                    <div className="space-y-3">
                        {accounts.map((acc: any) => {
                            const accType = ACCOUNT_TYPES.find(t => t.value === acc.accountType);
                            const AccIcon = accType?.icon || Wallet;
                            const balance = parseFloat(acc.currentBalance) || 0;
                            return (
                                <div key={acc.id} className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 bg-white group">
                                    <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0"><AccIcon className="h-6 w-6" /></div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold text-gray-800">{acc.name}</h3>
                                        <p className="text-sm text-gray-500">{accType?.label} · {acc.bankName || "Sem banco"} · Moeda: {acc.currency}</p>
                                        <p className="text-xs text-gray-400">Saldo inicial: {formatCurrency(parseFloat(acc.initialBalance) || 0, acc.currency)}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-gray-500">Saldo atual</p>
                                        <p className={`text-xl font-bold ${balance >= 0 ? "text-emerald-700" : "text-red-600"}`}>{formatCurrency(balance, acc.currency)}</p>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                                        <Button size="icon" variant="ghost" className="text-blue-500 hover:text-blue-700 h-8 w-8"
                                            onClick={() => openEdit(acc)} aria-label="Editar conta">
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button size="icon" variant="ghost" className="text-red-500 hover:text-red-700 h-8 w-8"
                                            onClick={() => { if (confirm(`Remover conta "${acc.name}"? Todas as transacoes vinculadas serao perdidas.`)) deleteMutation.mutate(acc.id); }}
                                            aria-label="Remover conta">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>

        <Dialog open={!!editingAccount} onOpenChange={(o) => !o && setEditingAccount(null)}>
            <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Editar Conta</DialogTitle></DialogHeader>
                <div className="space-y-4 py-2">
                    <div><Label>Nome da Conta *</Label><Input value={editName} onChange={e => setEditName(e.target.value)} /></div>
                    <div><Label>Nome do Banco</Label><Input value={editBankName} onChange={e => setEditBankName(e.target.value)} /></div>
                    <div><Label>Tipo *</Label>
                        <Select value={editAccountType} onValueChange={setEditAccountType}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>{ACCOUNT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <Button className="w-full bg-blue-600 hover:bg-blue-700"
                        onClick={() => editMutation.mutate({ id: editingAccount.id, data: { name: editName, bankName: editBankName || null, accountType: editAccountType } })}
                        disabled={editMutation.isPending || !editName || !editAccountType}>
                        {editMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Salvar Alteracoes"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
        </>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
function CreateAccountDialog({ onSuccess }: { onSuccess: () => void }) {
    const [open, setOpen] = useState(false);
    const { toast } = useToast();
    const [name, setName] = useState(""); const [bankName, setBankName] = useState("");
    const [accountType, setAccountType] = useState(""); const [currency, setCurrency] = useState("USD");
    const [initialBalance, setInitialBalance] = useState("");

    const save = useMutation({
        mutationFn: () => apiRequest("POST", "/api/farm/cash-accounts", { name, bankName, accountType, currency, initialBalance: parseFloat(initialBalance) || 0 }),
        onSuccess: () => { toast({ title: "Conta cadastrada!" }); setOpen(false); onSuccess(); setName(""); setBankName(""); setAccountType(""); setCurrency("USD"); setInitialBalance(""); },
        onError: () => toast({ title: "Erro ao salvar", variant: "destructive" }),
    });

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button variant="outline" className="border-emerald-200 text-emerald-700"><Landmark className="mr-2 h-4 w-4" /> Nova Conta</Button></DialogTrigger>
            <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Cadastrar Conta / Banco</DialogTitle></DialogHeader>
                <div className="space-y-4 py-2">
                    <div><Label>Nome da Conta *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Caixa Físico" /></div>
                    <div><Label>Nome do Banco (opcional)</Label><Input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="Ex: Banco Continental" /></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><Label>Tipo *</Label><Select value={accountType} onValueChange={setAccountType}><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{ACCOUNT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select></div>
                        <div><Label>Moeda *</Label><Select value={currency} onValueChange={setCurrency}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="USD">Dólar (USD $)</SelectItem><SelectItem value="PYG">Guaraní (PYG Gs.)</SelectItem></SelectContent></Select></div>
                    </div>
                    <div><Label>Saldo Inicial</Label><CurrencyInput value={initialBalance} onValueChange={setInitialBalance} /></div>
                    <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={() => save.mutate()} disabled={save.isPending || !name || !accountType}>
                        {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Salvar Conta"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
function CategoriesManager({ categories, onRefresh }: { categories: any[]; onRefresh: () => void }) {
    const { toast } = useToast();
    const [name, setName] = useState(""); const [type, setType] = useState("saida");
    const create = useMutation({
        mutationFn: () => apiRequest("POST", "/api/farm/expense-categories", { name, type }),
        onSuccess: () => { toast({ title: "Categoria criada!" }); setName(""); onRefresh(); },
        onError: () => toast({ title: "Erro ao criar", variant: "destructive" }),
    });
    const remove = useMutation({
        mutationFn: (id: string) => apiRequest("DELETE", `/api/farm/expense-categories/${id}`),
        onSuccess: () => { onRefresh(); toast({ title: "Categoria removida" }); },
    });
    const customSaida = categories.filter(c => c.type === "saida");
    const customEntrada = categories.filter(c => c.type === "entrada");

    return (
        <div className="space-y-6">
            <Card className="border-emerald-100">
                <CardHeader><CardTitle className="text-emerald-800 flex items-center gap-2"><Tag className="h-5 w-5" /> Gerenciar Categorias</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex gap-3 items-end">
                        <div className="flex-1"><Label>Nome da Categoria</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Aluguel de máquinas..." /></div>
                        <div className="w-36"><Label>Tipo</Label><Select value={type} onValueChange={setType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="saida">Saída</SelectItem><SelectItem value="entrada">Entrada</SelectItem></SelectContent></Select></div>
                        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => create.mutate()} disabled={create.isPending || !name}><Plus className="mr-1 h-4 w-4" /> Adicionar</Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h3 className="font-semibold text-red-700 mb-3 flex items-center gap-2"><TrendingDown className="h-4 w-4" /> Categorias de Saída</h3>
                            <div className="space-y-2">
                                {SAIDA_CATEGORIES.map(c => (<div key={c.value} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 text-sm"><span className="px-2 py-0.5 rounded-full bg-gray-200 text-gray-500 text-xs">padrão</span><span>{c.label}</span></div>))}
                                {customSaida.map((c: any) => (<div key={c.id} className="flex items-center justify-between p-2 rounded-lg bg-red-50 border border-red-100 text-sm group"><div className="flex items-center gap-2"><span className="px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-xs">custom</span><span className="font-medium">{c.name}</span></div><Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 text-red-500 h-6 w-6 p-0" onClick={() => remove.mutate(c.id)}><Trash2 className="h-3 w-3" /></Button></div>))}
                            </div>
                        </div>
                        <div>
                            <h3 className="font-semibold text-emerald-700 mb-3 flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Categorias de Entrada</h3>
                            <div className="space-y-2">
                                {ENTRADA_CATEGORIES.map(c => (<div key={c.value} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 text-sm"><span className="px-2 py-0.5 rounded-full bg-gray-200 text-gray-500 text-xs">padrão</span><span>{c.label}</span></div>))}
                                {customEntrada.map((c: any) => (<div key={c.id} className="flex items-center justify-between p-2 rounded-lg bg-emerald-50 border border-emerald-100 text-sm group"><div className="flex items-center gap-2"><span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-600 text-xs">custom</span><span className="font-medium">{c.name}</span></div><Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 text-red-500 h-6 w-6 p-0" onClick={() => remove.mutate(c.id)}><Trash2 className="h-3 w-3" /></Button></div>))}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
function TransferenciasTab({ transactions, accounts, onRefresh }: { transactions: any[]; accounts: any[]; onRefresh: () => void }) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [editingTransfer, setEditingTransfer] = useState<any>(null);
    const [editDescription, setEditDescription] = useState("");
    const [editAmount, setEditAmount] = useState("");
    const [editDate, setEditDate] = useState("");

    const transfers = transactions.filter((t: any) => t.category === "transferencia" || t.referenceType === "transfer");

    const editMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PUT", `/api/farm/cash-transactions/${id}`, data),
        onSuccess: () => {
            onRefresh();
            toast({ title: "Transferencia atualizada" });
            setEditingTransfer(null);
        },
        onError: () => toast({ title: "Erro ao atualizar", variant: "destructive" }),
    });

    function openEdit(t: any) {
        setEditDescription(t.description || "");
        setEditAmount(String(t.amount || ""));
        setEditDate(t.transactionDate ? new Date(t.transactionDate).toISOString().split("T")[0] : "");
        setEditingTransfer(t);
    }

    return (
        <div className="space-y-4">
            <Card className="border-emerald-100">
                <CardHeader><CardTitle className="text-emerald-800 flex items-center gap-2"><ArrowLeftRight className="h-5 w-5" /> Transferencias Recentes</CardTitle></CardHeader>
                <CardContent>
                    {transfers.length === 0 ? (
                        <div className="py-8 text-center">
                            <ArrowLeftRight className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                            <p className="text-gray-500 text-sm">Nenhuma transferencia encontrada</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {transfers.slice(0, 20).map((t: any) => {
                                const acc = accounts.find((a: any) => a.id === t.accountId);
                                return (
                                    <div key={t.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium">{t.description || "Transferencia"}</p>
                                            <p className="text-xs text-gray-500">
                                                {new Date(t.transactionDate).toLocaleDateString("pt-BR")} - Conta: {acc?.name || "--"}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`font-mono font-semibold text-sm ${t.type === "entrada" ? "text-emerald-700" : "text-red-600"}`}>
                                                {t.type === "entrada" ? "+" : "-"}{formatCurrency(parseFloat(t.amount), t.currency || "USD")}
                                            </span>
                                            <Button variant="outline" size="sm" className="h-7 text-xs border-blue-200 text-blue-600 hover:bg-blue-50"
                                                onClick={() => openEdit(t)}>
                                                <Pencil className="h-3 w-3 mr-1" /> Editar
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Edit transfer dialog */}
            <Dialog open={!!editingTransfer} onOpenChange={(o) => !o && setEditingTransfer(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Editar Transferencia</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-2">
                        <div><Label>Descricao</Label><Input value={editDescription} onChange={e => setEditDescription(e.target.value)} /></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><Label>Valor</Label><CurrencyInput value={editAmount} onValueChange={setEditAmount} /></div>
                            <div><Label>Data</Label><Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} /></div>
                        </div>
                        <Button className="w-full bg-blue-600 hover:bg-blue-700"
                            onClick={() => editMutation.mutate({
                                id: editingTransfer.id,
                                data: { description: editDescription, amount: editAmount, transactionDate: editDate }
                            })}
                            disabled={editMutation.isPending}>
                            {editMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Salvar Alteracoes"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
function CreateTransactionDialog({ accounts, onSuccess }: { accounts: any[]; onSuccess: () => void }) {
    const [open, setOpen] = useState(false);
    const { toast } = useToast();
    const [type, setType] = useState("saida"); const [accountId, setAccountId] = useState("");
    const [amount, setAmount] = useState(""); const [category, setCategory] = useState("");
    const [description, setDescription] = useState(""); const [paymentMethod, setPaymentMethod] = useState("efetivo");
    const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split("T")[0]);
    const categories = type === "entrada" ? ENTRADA_CATEGORIES : SAIDA_CATEGORIES;

    const save = useMutation({
        mutationFn: () => apiRequest("POST", "/api/farm/cash-transactions", { accountId, type, amount: parseFloat(amount), category, description, paymentMethod, transactionDate }),
        onSuccess: () => { toast({ title: type === "entrada" ? "Entrada registrada!" : "Saída registrada!" }); setOpen(false); onSuccess(); setAmount(""); setCategory(""); setDescription(""); },
        onError: () => toast({ title: "Erro ao registrar", variant: "destructive" }),
    });

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="bg-emerald-600 hover:bg-emerald-700"><Plus className="mr-2 h-4 w-4" /> Novo Lançamento</Button></DialogTrigger>
            <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Novo Lançamento</DialogTitle></DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="grid grid-cols-2 gap-2">
                        <Button variant={type === "saida" ? "default" : "outline"} className={type === "saida" ? "bg-red-600 hover:bg-red-700" : ""} onClick={() => { setType("saida"); setCategory(""); }}><TrendingDown className="mr-2 h-4 w-4" /> Saída</Button>
                        <Button variant={type === "entrada" ? "default" : "outline"} className={type === "entrada" ? "bg-emerald-600 hover:bg-emerald-700" : ""} onClick={() => { setType("entrada"); setCategory(""); }}><TrendingUp className="mr-2 h-4 w-4" /> Entrada</Button>
                    </div>
                    <div><Label>Conta *</Label><Select value={accountId} onValueChange={setAccountId}><SelectTrigger><SelectValue placeholder="Selecione a conta..." /></SelectTrigger><SelectContent>{accounts.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name} ({formatCurrency(parseFloat(a.currentBalance), a.currency)})</SelectItem>)}</SelectContent></Select></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><Label>Valor *</Label><CurrencyInput value={amount} onValueChange={setAmount} /></div>
                        <div><Label>Data</Label><Input type="date" value={transactionDate} onChange={e => setTransactionDate(e.target.value)} /></div>
                    </div>
                    <div><Label>Categoria *</Label><Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{categories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label>Forma de Pagamento</Label><Select value={paymentMethod} onValueChange={setPaymentMethod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PAYMENT_METHODS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label>Descrição</Label><Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex: Pagamento fornecedor" /></div>
                    <Button className={`w-full ${type === "entrada" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`} onClick={() => save.mutate()} disabled={save.isPending || !accountId || !amount || !category}>
                        {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : type === "entrada" ? "Registrar Entrada" : "Registrar Saída"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
function TransferDialog({ accounts, onSuccess }: { accounts: any[]; onSuccess: () => void }) {
    const [open, setOpen] = useState(false);
    const { toast } = useToast();
    const [sourceAccountId, setSourceAccountId] = useState("");
    const [destAccountId, setDestAccountId] = useState("");
    const [amount, setAmount] = useState("");
    const [exchangeRate, setExchangeRate] = useState("");
    const [description, setDescription] = useState("");
    const [transferDate, setTransferDate] = useState(new Date().toISOString().split("T")[0]);

    const sourceAccount = accounts.find((a: any) => a.id === sourceAccountId);
    const destAccount = accounts.find((a: any) => a.id === destAccountId);
    const showExchangeRate = sourceAccount && destAccount && sourceAccount.currency !== destAccount.currency;

    const transfer = useMutation({
        mutationFn: () => apiRequest("POST", "/api/farm/cash-flow/transfer", {
            sourceAccountId,
            destAccountId,
            amount: parseFloat(amount),
            exchangeRate: showExchangeRate ? parseFloat(exchangeRate) || 1 : undefined,
            description,
            transactionDate: transferDate || undefined,
        }),
        onSuccess: () => {
            toast({ title: "Transferencia realizada!" });
            setOpen(false);
            onSuccess();
            setSourceAccountId(""); setDestAccountId(""); setAmount(""); setExchangeRate(""); setDescription(""); setTransferDate(new Date().toISOString().split("T")[0]);
        },
        onError: () => toast({ title: "Erro ao transferir", variant: "destructive" }),
    });

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="border-emerald-200 text-emerald-700">
                    <ArrowLeftRight className="mr-2 h-4 w-4" /> Transferencia
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Transferencia entre Contas</DialogTitle></DialogHeader>
                <div className="space-y-4 py-2">
                    <div>
                        <Label>Conta Origem *</Label>
                        <Select value={sourceAccountId} onValueChange={setSourceAccountId}>
                            <SelectTrigger><SelectValue placeholder="Selecione a conta de origem..." /></SelectTrigger>
                            <SelectContent>
                                {accounts.filter((a: any) => a.id !== destAccountId).map((a: any) => (
                                    <SelectItem key={a.id} value={a.id}>{a.name} ({formatCurrency(parseFloat(a.currentBalance), a.currency)})</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label>Conta Destino *</Label>
                        <Select value={destAccountId} onValueChange={setDestAccountId}>
                            <SelectTrigger><SelectValue placeholder="Selecione a conta de destino..." /></SelectTrigger>
                            <SelectContent>
                                {accounts.filter((a: any) => a.id !== sourceAccountId).map((a: any) => (
                                    <SelectItem key={a.id} value={a.id}>{a.name} ({formatCurrency(parseFloat(a.currentBalance), a.currency)})</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label>Valor *{sourceAccount ? ` (${sourceAccount.currency})` : ""}</Label>
                        <CurrencyInput value={amount} onValueChange={setAmount} />
                    </div>
                    {showExchangeRate && (
                        <div>
                            <Label>Taxa de Cambio (1 {sourceAccount.currency} = ? {destAccount.currency}) *</Label>
                            <Input type="number" step="0.0001" value={exchangeRate} onChange={e => setExchangeRate(e.target.value)}
                                placeholder={sourceAccount.currency === "USD" && destAccount.currency === "PYG" ? "Ex: 7300" :
                                    sourceAccount.currency === "PYG" && destAccount.currency === "USD" ? "Ex: 0.000137" :
                                    "Ex: taxa de conversao"} />
                            {exchangeRate && amount && (
                                <p className="text-xs text-gray-500 mt-1">
                                    {formatCurrency(parseFloat(amount), sourceAccount.currency)} = {formatCurrency(parseFloat(amount) * parseFloat(exchangeRate), destAccount.currency)}
                                </p>
                            )}
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Descricao</Label>
                            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex: Troco de moeda" />
                        </div>
                        <div>
                            <Label>Data</Label>
                            <Input type="date" value={transferDate} onChange={e => setTransferDate(e.target.value)} />
                        </div>
                    </div>
                    <Button className="w-full bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => transfer.mutate()}
                        disabled={transfer.isPending || !sourceAccountId || !destAccountId || !amount || (showExchangeRate && !exchangeRate)}>
                        {transfer.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Realizar Transferencia"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
const CHEQUE_STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
    emitido: { bg: "bg-yellow-100", text: "text-yellow-700", label: "Emitido" },
    compensado: { bg: "bg-green-100", text: "text-green-700", label: "Compensado" },
    cancelado: { bg: "bg-red-100", text: "text-red-700", label: "Cancelado" },
};

function ChequesTab({ accounts }: { accounts: any[] }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { user } = useAuth();

    const { data: cheques = [], isLoading } = useQuery<any[]>({
        queryKey: ["/api/farm/cheques"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/cheques"); return r.json(); },
        enabled: !!user,
    });

    const compensate = useMutation({
        mutationFn: ({ id, accountId }: { id: string; accountId: string }) =>
            apiRequest("POST", `/api/farm/cheques/${id}/compensate`, { accountId }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/cheques"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/cash-summary"] });
            toast({ title: "Cheque compensado!" });
        },
        onError: () => toast({ title: "Erro ao compensar cheque", variant: "destructive" }),
    });

    const cancel = useMutation({
        mutationFn: (id: string) => apiRequest("PUT", `/api/farm/cheques/${id}/cancel`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/cheques"] });
            toast({ title: "Cheque cancelado" });
        },
        onError: () => toast({ title: "Erro ao cancelar cheque", variant: "destructive" }),
    });

    const [compensateDialogId, setCompensateDialogId] = useState<string | null>(null);
    const [compensateAccountId, setCompensateAccountId] = useState("");

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-emerald-800">Cheques</h2>
                <CreateChequeDialog accounts={accounts} onSuccess={() => queryClient.invalidateQueries({ queryKey: ["/api/farm/cheques"] })} />
            </div>

            {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
            ) : cheques.length === 0 ? (
                <Card className="border-emerald-100">
                    <CardContent className="py-8 text-center">
                        <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">Nenhum cheque cadastrado</p>
                    </CardContent>
                </Card>
            ) : (
                <Card className="border-emerald-100">
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="text-left p-3 font-semibold text-gray-600">Numero</th>
                                        <th className="text-left p-3 font-semibold text-gray-600">Banco</th>
                                        <th className="text-left p-3 font-semibold text-gray-600">Titular</th>
                                        <th className="text-right p-3 font-semibold text-gray-600">Valor</th>
                                        <th className="text-center p-3 font-semibold text-gray-600">Moeda</th>
                                        <th className="text-center p-3 font-semibold text-gray-600">Status</th>
                                        <th className="text-center p-3 font-semibold text-gray-600">Emissao</th>
                                        <th className="text-center p-3 font-semibold text-gray-600">Vencimento</th>
                                        <th className="text-center p-3 font-semibold text-gray-600">Acoes</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {cheques.map((ch: any) => {
                                        const status = CHEQUE_STATUS_COLORS[ch.status] || CHEQUE_STATUS_COLORS.emitido;
                                        return (
                                            <tr key={ch.id} className="border-t border-gray-100 hover:bg-gray-50">
                                                <td className="p-3 font-mono">{ch.cheque_number || ch.chequeNumber || "--"}</td>
                                                <td className="p-3">{ch.bank || "--"}</td>
                                                <td className="p-3">{ch.holder || "--"}</td>
                                                <td className="p-3 text-right font-mono font-semibold">{formatCurrency(parseFloat(ch.amount), ch.currency || "USD")}</td>
                                                <td className="p-3 text-center">{ch.currency || "USD"}</td>
                                                <td className="p-3 text-center">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.text}`}>
                                                        {ch.status === "compensado" ? <CheckCircle className="h-3 w-3" /> : ch.status === "cancelado" ? <XCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                                        {status.label}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-center">{(ch.issue_date || ch.issueDate) ? new Date(ch.issue_date || ch.issueDate).toLocaleDateString("pt-BR") : "--"}</td>
                                                <td className="p-3 text-center">{(ch.due_date || ch.dueDate) ? new Date(ch.due_date || ch.dueDate).toLocaleDateString("pt-BR") : "--"}</td>
                                                <td className="p-3 text-center">
                                                    {ch.status === "emitido" && (
                                                        <div className="flex gap-1 justify-center">
                                                            <Button size="sm" variant="outline" className="h-7 text-xs border-green-200 text-green-700 hover:bg-green-50"
                                                                onClick={() => { setCompensateDialogId(ch.id); setCompensateAccountId(""); }}>
                                                                Compensar
                                                            </Button>
                                                            <Button size="sm" variant="outline" className="h-7 text-xs border-red-200 text-red-600 hover:bg-red-50"
                                                                onClick={() => { if (confirm("Cancelar este cheque?")) cancel.mutate(ch.id); }}
                                                                disabled={cancel.isPending}>
                                                                Cancelar
                                                            </Button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Compensate dialog */}
            <Dialog open={!!compensateDialogId} onOpenChange={(v) => { if (!v) setCompensateDialogId(null); }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader><DialogTitle>Compensar Cheque</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-2">
                        <div>
                            <Label>Conta para debito/credito *</Label>
                            <Select value={compensateAccountId} onValueChange={setCompensateAccountId}>
                                <SelectTrigger><SelectValue placeholder="Selecione a conta..." /></SelectTrigger>
                                <SelectContent>
                                    {accounts.map((a: any) => (
                                        <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button className="w-full bg-green-600 hover:bg-green-700"
                            onClick={() => { if (compensateDialogId) compensate.mutate({ id: compensateDialogId, accountId: compensateAccountId }); setCompensateDialogId(null); }}
                            disabled={!compensateAccountId || compensate.isPending}>
                            {compensate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Confirmar Compensacao"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
function CreateChequeDialog({ accounts, onSuccess }: { accounts: any[]; onSuccess: () => void }) {
    const [open, setOpen] = useState(false);
    const { toast } = useToast();
    const [type, setType] = useState("emitido");
    const [chequeNumber, setChequeNumber] = useState("");
    const [bank, setBank] = useState("");
    const [holder, setHolder] = useState("");
    const [amount, setAmount] = useState("");
    const [currency, setCurrency] = useState("USD");
    const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
    const [dueDate, setDueDate] = useState("");
    const [ownerType, setOwnerType] = useState("proprio");
    const [accountId, setAccountId] = useState("");
    const [notes, setNotes] = useState("");

    const save = useMutation({
        mutationFn: () => apiRequest("POST", "/api/farm/cheques", {
            type, chequeNumber, bank, holder, amount: String(amount), currency,
            issueDate: new Date(issueDate).toISOString(), dueDate: dueDate ? new Date(dueDate).toISOString() : null,
            ownerType, accountId: accountId || null, notes,
        }),
        onSuccess: () => {
            toast({ title: "Cheque cadastrado!" });
            setOpen(false); onSuccess();
            setChequeNumber(""); setBank(""); setHolder(""); setAmount(""); setDueDate(""); setNotes(""); setAccountId("");
        },
        onError: () => toast({ title: "Erro ao cadastrar cheque", variant: "destructive" }),
    });

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-emerald-600 hover:bg-emerald-700"><Plus className="mr-2 h-4 w-4" /> Novo Cheque</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Cadastrar Cheque</DialogTitle></DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="grid grid-cols-2 gap-2">
                        <Button variant={type === "emitido" ? "default" : "outline"} className={type === "emitido" ? "bg-emerald-600 hover:bg-emerald-700" : ""} onClick={() => setType("emitido")}>Emitido</Button>
                        <Button variant={type === "recebido" ? "default" : "outline"} className={type === "recebido" ? "bg-blue-600 hover:bg-blue-700" : ""} onClick={() => setType("recebido")}>Recebido</Button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><Label>Numero do Cheque *</Label><Input value={chequeNumber} onChange={e => setChequeNumber(e.target.value)} placeholder="000000" /></div>
                        <div><Label>Banco *</Label><Input value={bank} onChange={e => setBank(e.target.value)} placeholder="Ex: Itau" /></div>
                    </div>
                    <div><Label>Titular *</Label><Input value={holder} onChange={e => setHolder(e.target.value)} placeholder="Nome do titular" /></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><Label>Valor *</Label><CurrencyInput value={amount} onValueChange={setAmount} /></div>
                        <div><Label>Moeda</Label>
                            <Select value={currency} onValueChange={setCurrency}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="USD">USD ($)</SelectItem>
                                    <SelectItem value="PYG">PYG (Gs.)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><Label>Data Emissao</Label><Input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} /></div>
                        <div><Label>Data Vencimento</Label><Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><Label>Tipo de Proprietario</Label>
                            <Select value={ownerType} onValueChange={setOwnerType}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="proprio">Proprio</SelectItem>
                                    <SelectItem value="terceiro">Terceiro</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div><Label>Conta Vinculada</Label>
                            <Select value={accountId} onValueChange={setAccountId}>
                                <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                                <SelectContent>
                                    {accounts.map((a: any) => (
                                        <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div><Label>Observacoes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notas adicionais..." rows={2} /></div>
                    <Button className="w-full bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => save.mutate()}
                        disabled={save.isPending || !chequeNumber || !bank || !holder || !amount}>
                        {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Cadastrar Cheque"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
