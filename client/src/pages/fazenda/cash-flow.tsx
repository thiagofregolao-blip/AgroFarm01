import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import FarmLayout from "@/components/fazenda/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
    Wallet, Plus, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
    Loader2, Trash2, Building2, Banknote, CreditCard, Landmark, DollarSign,
    Calendar, Tag, CreditCard as CardIcon
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const ACCOUNT_TYPES = [
    { value: "caixa_fisico", label: "Caixa Físico", icon: Banknote },
    { value: "conta_corrente", label: "Conta Corrente", icon: Landmark },
    { value: "poupanca", label: "Poupança", icon: Building2 },
    { value: "carteira_digital", label: "Carteira Digital / PIX", icon: CreditCard },
];

const SAIDA_CATEGORIES = [
    { value: "insumos", label: "Insumos Agrícolas" },
    { value: "pecas", label: "Peças e Manutenção" },
    { value: "diesel", label: "Combustível / Diesel" },
    { value: "mao_de_obra", label: "Mão de Obra" },
    { value: "frete", label: "Frete / Transporte" },
    { value: "energia", label: "Energia / Água" },
    { value: "arrendamento", label: "Arrendamento" },
    { value: "financiamento", label: "Parcela Financiamento" },
    { value: "impostos", label: "Impostos e Taxas" },
    { value: "pro_labore", label: "Retirada (Pró-labore)" },
    { value: "outro_saida", label: "Outras Saídas" },
];

const ENTRADA_CATEGORIES = [
    { value: "venda_producao", label: "Venda de Produção" },
    { value: "recebimento", label: "Recebimento de Clientes" },
    { value: "emprestimo", label: "Empréstimo / Financiamento" },
    { value: "reembolso", label: "Reembolso / Devolução" },
    { value: "aporte", label: "Aporte do Proprietário" },
    { value: "outro_entrada", label: "Outras Entradas" },
];

const PAYMENT_METHODS = [
    { value: "efetivo", label: "Dinheiro / Efetivo" },
    { value: "transferencia", label: "Transferência Bancária" },
    { value: "cheque", label: "Cheque" },
    { value: "cartao", label: "Cartão" },
    { value: "pix", label: "PIX" },
];

const ALL_CATEGORIES = [...SAIDA_CATEGORIES, ...ENTRADA_CATEGORIES];

function currencySymbol(c: string) { return c === "PYG" ? "Gs." : "$"; }
function formatMoney(amount: number, currency: string) {
    const sym = currencySymbol(currency);
    if (currency === "PYG") return `${sym} ${Math.round(amount).toLocaleString("es-PY")}`;
    return `${sym} ${amount.toFixed(2)}`;
}

export default function FarmCashFlow() {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { user } = useAuth();

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

    const accounts: any[] = summary?.accounts || [];
    const month = summary?.monthSummary || { totalEntradas: 0, totalSaidas: 0, saldoLiquido: 0 };
    const chartData: any[] = summary?.chartData || [];
    const byCategory: any[] = summary?.byCategory || [];
    const PIE_COLORS = ["#059669", "#0891b2", "#d97706", "#dc2626", "#7c3aed", "#db2777", "#65a30d", "#ea580c", "#4f46e5", "#0d9488"];

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
                    <div className="flex gap-2">
                        <CreateAccountDialog onSuccess={() => queryClient.invalidateQueries({ queryKey: ["/api/farm/cash-summary"] })} />
                        <CreateTransactionDialog
                            accounts={accounts}
                            onSuccess={() => {
                                queryClient.invalidateQueries({ queryKey: ["/api/farm/cash-summary"] });
                                queryClient.invalidateQueries({ queryKey: ["/api/farm/cash-transactions"] });
                            }}
                        />
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
                ) : (
                    <Tabs defaultValue="dashboard">
                        <TabsList className="bg-emerald-50 text-emerald-800">
                            <TabsTrigger value="dashboard">Painel</TabsTrigger>
                            <TabsTrigger value="extrato">Extrato</TabsTrigger>
                            <TabsTrigger value="contas">Contas / Bancos</TabsTrigger>
                            <TabsTrigger value="categorias">Categorias</TabsTrigger>
                        </TabsList>

                        <TabsContent value="dashboard" className="space-y-6 mt-4">
                            {/* Resumo do mês */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <Card className="border-emerald-200 bg-emerald-50">
                                    <CardContent className="p-5">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-full bg-emerald-200 flex items-center justify-center">
                                                <ArrowUpRight className="h-5 w-5 text-emerald-700" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-emerald-600 font-medium">Entradas (Mês)</p>
                                                <p className="text-xl font-bold text-emerald-800">$ {month.totalEntradas.toFixed(2)}</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card className="border-red-200 bg-red-50">
                                    <CardContent className="p-5">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-full bg-red-200 flex items-center justify-center">
                                                <ArrowDownRight className="h-5 w-5 text-red-700" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-red-600 font-medium">Saídas (Mês)</p>
                                                <p className="text-xl font-bold text-red-800">$ {month.totalSaidas.toFixed(2)}</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card className={`border-${month.saldoLiquido >= 0 ? 'blue' : 'amber'}-200 bg-${month.saldoLiquido >= 0 ? 'blue' : 'amber'}-50`}>
                                    <CardContent className="p-5">
                                        <div className="flex items-center gap-3">
                                            <div className={`h-10 w-10 rounded-full ${month.saldoLiquido >= 0 ? 'bg-blue-200' : 'bg-amber-200'} flex items-center justify-center`}>
                                                <DollarSign className={`h-5 w-5 ${month.saldoLiquido >= 0 ? 'text-blue-700' : 'text-amber-700'}`} />
                                            </div>
                                            <div>
                                                <p className={`text-xs ${month.saldoLiquido >= 0 ? 'text-blue-600' : 'text-amber-600'} font-medium`}>Saldo Líquido (Mês)</p>
                                                <p className={`text-xl font-bold ${month.saldoLiquido >= 0 ? 'text-blue-800' : 'text-amber-800'}`}>$ {month.saldoLiquido.toFixed(2)}</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Saldo das contas */}
                            <Card className="border-emerald-100">
                                <CardHeader><CardTitle className="text-emerald-800">Saldos por Conta</CardTitle></CardHeader>
                                <CardContent>
                                    {accounts.length === 0 ? (
                                        <div className="py-6 text-center">
                                            <Wallet className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                                            <p className="text-gray-500 text-sm">Nenhuma conta cadastrada. Clique em "Nova Conta" para começar.</p>
                                        </div>
                                    ) : (
                                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {accounts.map((acc: any) => {
                                                const balance = parseFloat(acc.currentBalance) || 0;
                                                const accType = ACCOUNT_TYPES.find(t => t.value === acc.accountType);
                                                const AccIcon = accType?.icon || Wallet;
                                                return (
                                                    <div key={acc.id} className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 bg-white">
                                                        <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                                                            <AccIcon className="h-5 w-5" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-semibold text-gray-800 truncate">{acc.name}</p>
                                                            <p className="text-xs text-gray-500">{accType?.label} · {acc.currency}</p>
                                                        </div>
                                                        <p className={`font-bold text-lg ${balance >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                                                            {formatMoney(balance, acc.currency)}
                                                        </p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Gráficos */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <Card className="border-emerald-100">
                                    <CardHeader><CardTitle className="text-emerald-800 text-base">Entradas vs Saídas (6 meses)</CardTitle></CardHeader>
                                    <CardContent>
                                        {chartData.length > 0 ? (
                                            <ResponsiveContainer width="100%" height={250}>
                                                <BarChart data={chartData}>
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis dataKey="month" />
                                                    <YAxis />
                                                    <Tooltip formatter={(v: number) => `$ ${v.toFixed(2)}`} />
                                                    <Legend />
                                                    <Bar dataKey="entradas" name="Entradas" fill="#059669" radius={[4, 4, 0, 0]} />
                                                    <Bar dataKey="saidas" name="Saídas" fill="#dc2626" radius={[4, 4, 0, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <p className="text-center text-gray-400 py-8 text-sm">Sem dados para exibir</p>
                                        )}
                                    </CardContent>
                                </Card>
                                <Card className="border-emerald-100">
                                    <CardHeader><CardTitle className="text-emerald-800 text-base">Saídas por Categoria (Mês)</CardTitle></CardHeader>
                                    <CardContent>
                                        {byCategory.length > 0 ? (
                                            <ResponsiveContainer width="100%" height={250}>
                                                <PieChart>
                                                    <Pie data={byCategory} dataKey="value" nameKey="category" cx="50%" cy="50%" outerRadius={90} label={({ category, value }) => `${category}: $${value}`}>
                                                        {byCategory.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                                                    </Pie>
                                                    <Tooltip formatter={(v: number) => `$ ${v.toFixed(2)}`} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <p className="text-center text-gray-400 py-8 text-sm">Sem saídas neste mês</p>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Últimas movimentações */}
                            <Card className="border-emerald-100">
                                <CardHeader><CardTitle className="text-emerald-800">Últimas Movimentações</CardTitle></CardHeader>
                                <CardContent>
                                    <TransactionTable
                                        transactions={transactions.slice(0, 10)}
                                        accounts={accounts}
                                        onDelete={(id) => deleteTransaction.mutate(id)}
                                        deleting={deleteTransaction.isPending}
                                    />
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="extrato" className="mt-4">
                            <Card className="border-emerald-100">
                                <CardHeader><CardTitle className="text-emerald-800">Extrato Completo</CardTitle></CardHeader>
                                <CardContent>
                                    <TransactionTable
                                        transactions={transactions}
                                        accounts={accounts}
                                        onDelete={(id) => deleteTransaction.mutate(id)}
                                        deleting={deleteTransaction.isPending}
                                    />
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="contas" className="mt-4">
                            <AccountsManager accounts={accounts} onRefresh={() => queryClient.invalidateQueries({ queryKey: ["/api/farm/cash-summary"] })} />
                        </TabsContent>

                        <TabsContent value="categorias" className="mt-4">
                            <CategoriesManager
                                categories={customCategories}
                                onRefresh={() => queryClient.invalidateQueries({ queryKey: ["/api/farm/expense-categories"] })}
                            />
                        </TabsContent>
                    </Tabs>
                )}
            </div>
        </FarmLayout>
    );
}

function TransactionTable({ transactions, accounts, onDelete, deleting }: { transactions: any[]; accounts: any[]; onDelete: (id: string) => void; deleting: boolean }) {
    if (transactions.length === 0) {
        return (
            <div className="py-6 text-center">
                <Wallet className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">Nenhuma movimentação encontrada</p>
            </div>
        );
    }
    return (
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
                        <th className="text-center p-3 font-semibold text-gray-600">Origem</th>
                        <th className="text-center p-3 font-semibold text-gray-600">Ações</th>
                    </tr>
                </thead>
                <tbody>
                    {transactions.map((t: any) => {
                        const acc = accounts.find((a: any) => a.id === t.accountId);
                        const cat = ALL_CATEGORIES.find(c => c.value === t.category);
                        const isEntrada = t.type === "entrada";
                        return (
                            <tr key={t.id} className="border-t border-gray-100">
                                <td className="p-3">{new Date(t.transactionDate).toLocaleDateString("pt-BR")}</td>
                                <td className="p-3">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${isEntrada ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                        {isEntrada ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                        {isEntrada ? "Entrada" : "Saída"}
                                    </span>
                                </td>
                                <td className="p-3">{cat?.label || t.category}</td>
                                <td className="p-3 max-w-[200px] truncate">{t.description || "—"}</td>
                                <td className="p-3 text-gray-600">{acc?.name || "—"}</td>
                                <td className={`text-right p-3 font-mono font-semibold ${isEntrada ? 'text-emerald-700' : 'text-red-600'}`}>
                                    {isEntrada ? "+" : "-"}{formatMoney(parseFloat(t.amount), t.currency)}
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
        </div>
    );
}

function AccountsManager({ accounts, onRefresh }: { accounts: any[]; onRefresh: () => void }) {
    const { toast } = useToast();
    const deleteMutation = useMutation({
        mutationFn: (id: string) => apiRequest("DELETE", `/api/farm/cash-accounts/${id}`),
        onSuccess: () => { onRefresh(); toast({ title: "Conta removida" }); },
        onError: () => toast({ title: "Erro ao remover conta", variant: "destructive" }),
    });

    return (
        <Card className="border-emerald-100">
            <CardHeader><CardTitle className="text-emerald-800">Contas e Bancos Cadastrados</CardTitle></CardHeader>
            <CardContent>
                {accounts.length === 0 ? (
                    <div className="py-8 text-center">
                        <Landmark className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">Nenhuma conta cadastrada</p>
                        <p className="text-gray-400 text-sm">Cadastre suas contas bancárias e caixas para controlar o fluxo.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {accounts.map((acc: any) => {
                            const accType = ACCOUNT_TYPES.find(t => t.value === acc.accountType);
                            const AccIcon = accType?.icon || Wallet;
                            const balance = parseFloat(acc.currentBalance) || 0;
                            return (
                                <div key={acc.id} className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 bg-white group">
                                    <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                                        <AccIcon className="h-6 w-6" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold text-gray-800">{acc.name}</h3>
                                        <p className="text-sm text-gray-500">
                                            {accType?.label} · {acc.bankName || "Sem banco"} · Moeda: {acc.currency}
                                        </p>
                                        <p className="text-xs text-gray-400">Saldo inicial: {formatMoney(parseFloat(acc.initialBalance) || 0, acc.currency)}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-gray-500">Saldo atual</p>
                                        <p className={`text-xl font-bold ${balance >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                                            {formatMoney(balance, acc.currency)}
                                        </p>
                                    </div>
                                    <Button
                                        size="icon" variant="ghost"
                                        className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 h-8 w-8"
                                        onClick={() => { if (confirm(`Remover conta "${acc.name}"?`)) deleteMutation.mutate(acc.id); }}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function CreateAccountDialog({ onSuccess }: { onSuccess: () => void }) {
    const [open, setOpen] = useState(false);
    const { toast } = useToast();
    const [name, setName] = useState("");
    const [bankName, setBankName] = useState("");
    const [accountType, setAccountType] = useState("");
    const [currency, setCurrency] = useState("USD");
    const [initialBalance, setInitialBalance] = useState("");

    const save = useMutation({
        mutationFn: () => apiRequest("POST", "/api/farm/cash-accounts", { name, bankName, accountType, currency, initialBalance: parseFloat(initialBalance) || 0 }),
        onSuccess: () => {
            toast({ title: "Conta cadastrada!" });
            setOpen(false);
            onSuccess();
            setName(""); setBankName(""); setAccountType(""); setCurrency("USD"); setInitialBalance("");
        },
        onError: () => toast({ title: "Erro ao salvar", variant: "destructive" }),
    });

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="border-emerald-200 text-emerald-700">
                    <Landmark className="mr-2 h-4 w-4" /> Nova Conta
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Cadastrar Conta / Banco</DialogTitle></DialogHeader>
                <div className="space-y-4 py-2">
                    <div>
                        <Label>Nome da Conta *</Label>
                        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Caixa Físico, Banco Continental" />
                    </div>
                    <div>
                        <Label>Nome do Banco (opcional)</Label>
                        <Input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="Ex: Banco Continental, Itaú, Visión" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Tipo de Conta *</Label>
                            <Select value={accountType} onValueChange={setAccountType}>
                                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                <SelectContent>
                                    {ACCOUNT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Moeda *</Label>
                            <Select value={currency} onValueChange={setCurrency}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="USD">Dólar (USD $)</SelectItem>
                                    <SelectItem value="PYG">Guaraní (PYG Gs.)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div>
                        <Label>Saldo Inicial</Label>
                        <Input type="number" step="0.01" value={initialBalance} onChange={e => setInitialBalance(e.target.value)} placeholder="0.00" />
                    </div>
                    <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={() => save.mutate()} disabled={save.isPending || !name || !accountType}>
                        {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Salvar Conta"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}


function CategoriesManager({ categories, onRefresh }: { categories: any[]; onRefresh: () => void }) {
    const { toast } = useToast();
    const [name, setName] = useState("");
    const [type, setType] = useState("saida");

    const create = useMutation({
        mutationFn: () => apiRequest("POST", "/api/farm/expense-categories", { name, type }),
        onSuccess: () => {
            toast({ title: "Categoria criada!" });
            setName("");
            onRefresh();
        },
        onError: () => toast({ title: "Erro ao criar", variant: "destructive" }),
    });

    const remove = useMutation({
        mutationFn: (id: string) => apiRequest("DELETE", `/api/farm/expense-categories/${id}`),
        onSuccess: () => { onRefresh(); toast({ title: "Categoria removida" }); },
    });

    const defaultSaida = SAIDA_CATEGORIES;
    const defaultEntrada = ENTRADA_CATEGORIES;
    const customSaida = categories.filter(c => c.type === "saida");
    const customEntrada = categories.filter(c => c.type === "entrada");

    return (
        <div className="space-y-6">
            <Card className="border-emerald-100">
                <CardHeader><CardTitle className="text-emerald-800 flex items-center gap-2"><Tag className="h-5 w-5" /> Gerenciar Categorias</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex gap-3 items-end">
                        <div className="flex-1">
                            <Label>Nome da Categoria</Label>
                            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Aluguel de máquinas, Soja, Milho..." />
                        </div>
                        <div className="w-36">
                            <Label>Tipo</Label>
                            <Select value={type} onValueChange={setType}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="saida">Saída</SelectItem>
                                    <SelectItem value="entrada">Entrada</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => create.mutate()} disabled={create.isPending || !name}>
                            <Plus className="mr-1 h-4 w-4" /> Adicionar
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h3 className="font-semibold text-red-700 mb-3 flex items-center gap-2">
                                <TrendingDown className="h-4 w-4" /> Categorias de Saída
                            </h3>
                            <div className="space-y-2">
                                {defaultSaida.map(c => (
                                    <div key={c.value} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 text-sm">
                                        <span className="px-2 py-0.5 rounded-full bg-gray-200 text-gray-500 text-xs">padrão</span>
                                        <span>{c.label}</span>
                                    </div>
                                ))}
                                {customSaida.map((c: any) => (
                                    <div key={c.id} className="flex items-center justify-between p-2 rounded-lg bg-red-50 border border-red-100 text-sm group">
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-xs">custom</span>
                                            <span className="font-medium">{c.name}</span>
                                        </div>
                                        <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 text-red-500 h-6 w-6 p-0"
                                            onClick={() => remove.mutate(c.id)}>
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <h3 className="font-semibold text-emerald-700 mb-3 flex items-center gap-2">
                                <TrendingUp className="h-4 w-4" /> Categorias de Entrada
                            </h3>
                            <div className="space-y-2">
                                {defaultEntrada.map(c => (
                                    <div key={c.value} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 text-sm">
                                        <span className="px-2 py-0.5 rounded-full bg-gray-200 text-gray-500 text-xs">padrão</span>
                                        <span>{c.label}</span>
                                    </div>
                                ))}
                                {customEntrada.map((c: any) => (
                                    <div key={c.id} className="flex items-center justify-between p-2 rounded-lg bg-emerald-50 border border-emerald-100 text-sm group">
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-600 text-xs">custom</span>
                                            <span className="font-medium">{c.name}</span>
                                        </div>
                                        <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 text-red-500 h-6 w-6 p-0"
                                            onClick={() => remove.mutate(c.id)}>
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function CreateTransactionDialog({ accounts, onSuccess }: { accounts: any[]; onSuccess: () => void }) {
    const [open, setOpen] = useState(false);
    const { toast } = useToast();
    const [type, setType] = useState("saida");
    const [accountId, setAccountId] = useState("");
    const [amount, setAmount] = useState("");
    const [category, setCategory] = useState("");
    const [description, setDescription] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("efetivo");
    const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split("T")[0]);

    const categories = type === "entrada" ? ENTRADA_CATEGORIES : SAIDA_CATEGORIES;

    const save = useMutation({
        mutationFn: () => apiRequest("POST", "/api/farm/cash-transactions", {
            accountId, type, amount: parseFloat(amount), category, description, paymentMethod, transactionDate: new Date(transactionDate),
        }),
        onSuccess: () => {
            toast({ title: type === "entrada" ? "Entrada registrada!" : "Saída registrada!" });
            setOpen(false);
            onSuccess();
            setAmount(""); setCategory(""); setDescription("");
        },
        onError: () => toast({ title: "Erro ao registrar", variant: "destructive" }),
    });

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="mr-2 h-4 w-4" /> Novo Lançamento
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Novo Lançamento</DialogTitle></DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="grid grid-cols-2 gap-2">
                        <Button
                            variant={type === "saida" ? "default" : "outline"}
                            className={type === "saida" ? "bg-red-600 hover:bg-red-700" : ""}
                            onClick={() => { setType("saida"); setCategory(""); }}
                        >
                            <TrendingDown className="mr-2 h-4 w-4" /> Saída
                        </Button>
                        <Button
                            variant={type === "entrada" ? "default" : "outline"}
                            className={type === "entrada" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                            onClick={() => { setType("entrada"); setCategory(""); }}
                        >
                            <TrendingUp className="mr-2 h-4 w-4" /> Entrada
                        </Button>
                    </div>

                    <div>
                        <Label>Conta *</Label>
                        <Select value={accountId} onValueChange={setAccountId}>
                            <SelectTrigger><SelectValue placeholder="Selecione a conta..." /></SelectTrigger>
                            <SelectContent>
                                {accounts.map((a: any) => (
                                    <SelectItem key={a.id} value={a.id}>
                                        {a.name} ({formatMoney(parseFloat(a.currentBalance), a.currency)})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Valor *</Label>
                            <Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
                        </div>
                        <div>
                            <Label>Data</Label>
                            <Input type="date" value={transactionDate} onChange={e => setTransactionDate(e.target.value)} />
                        </div>
                    </div>

                    <div>
                        <Label>Categoria *</Label>
                        <Select value={category} onValueChange={setCategory}>
                            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                            <SelectContent>
                                {categories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label>Forma de Pagamento</Label>
                        <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {PAYMENT_METHODS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label>Descrição</Label>
                        <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex: Pagamento fornecedor Kurosso" />
                    </div>

                    <Button
                        className={`w-full ${type === "entrada" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`}
                        onClick={() => save.mutate()}
                        disabled={save.isPending || !accountId || !amount || !category}
                    >
                        {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : type === "entrada" ? "Registrar Entrada" : "Registrar Saída"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
