import { useState, useEffect, useRef, useMemo, Fragment } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/format-currency";
import { onEnterNext } from "@/lib/enter-navigation";
import { useAuth } from "@/hooks/use-auth";
import FarmLayout from "@/components/fazenda/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Receipt, Loader2, AlertTriangle, CheckCircle, Clock, Download, CheckSquare, PlusCircle, Trash2, Pencil, History, Search, CreditCard, RefreshCw, BarChart3, CalendarDays, DollarSign, TrendingUp, Wallet, ShieldCheck, Upload, Info, X, Check, Eye } from "lucide-react";

// ─── CSV export utility ──────────────────────────────────────────────────────
function exportToCSV(data: any[], filename: string) {
    if (!data.length) return;
    const headers = ["Fornecedor", "Descricao", "Parcela", "Vencimento", "Status", "Valor Total", "Pago"];
    const rows = data.map((i: any) => [
        i.supplier,
        i.description || "",
        `${i.installmentNumber}/${i.totalInstallments}`,
        i.dueDate ? new Date(i.dueDate).toLocaleDateString("pt-BR") : "",
        i.status,
        formatCurrency(i.totalAmount, i.currency || "USD"),
        formatCurrency(i.paidAmount || 0, i.currency || "USD"),
    ]);
    const csv = [headers, ...rows].map(r => r.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}

export default function AccountsPayable() {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [editingItem, setEditingItem] = useState<any>(null);
    const { user } = useAuth();
    const backfillDone = useRef(false);

    // ─── Filters ───────────────────────────────────────────────────────────
    const [pageSize, setPageSize] = useState(15);
    const [filterStatus, setFilterStatus] = useState("todos");
    const [filterFrom, setFilterFrom] = useState("");
    const [filterTo, setFilterTo] = useState("");
    const [filterSupplier, setFilterSupplier] = useState("todos");
    const [filterSeason, setFilterSeason] = useState("todos");
    const [filterCurrencyMain, setFilterCurrencyMain] = useState("todos");

    const { data: items = [], isLoading } = useQuery({
        queryKey: ["/api/farm/accounts-payable"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/accounts-payable"); return r.json(); },
        enabled: !!user,
    });

    // Auto-backfill
    useEffect(() => {
        if (!user || backfillDone.current) return;
        backfillDone.current = true;
        apiRequest("POST", "/api/farm/accounts-payable/backfill-invoices")
            .then(r => r.json())
            .then(result => { if (result.created > 0) queryClient.invalidateQueries({ queryKey: ["/api/farm/accounts-payable"] }); })
            .catch(() => { });
    }, [user]);

    const { data: accounts = [] } = useQuery({
        queryKey: ["/api/farm/cash-accounts"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/cash-accounts"); return r.json(); },
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

    // Compare date-only (strip time) to avoid timezone false-overdue
    function isItemOverdue(item: any) {
        if (item.status === "pago") return false;
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const due = new Date(item.dueDate); due.setHours(0, 0, 0, 0);
        return (item.status === "aberto" || item.status === "parcial") && due < today;
    }

    // ─── Filtered list ─────────────────────────────────────────────────────
    const filtered = (items as any[]).filter((i: any) => {
        const overdue = isItemOverdue(i);
        const statusCheck =
            filterStatus === "todos" ? true :
            filterStatus === "vencido" ? overdue :
            i.status === filterStatus;
        const dateCheck =
            (!filterFrom || new Date(i.dueDate) >= new Date(filterFrom)) &&
            (!filterTo || new Date(i.dueDate) <= new Date(filterTo));
        const supplierCheck = filterSupplier === "todos" || i.supplier === filterSupplier;
        const seasonCheck = filterSeason === "todos" || String(i.season_id || i.seasonId || "") === filterSeason;
        const currencyCheck = filterCurrencyMain === "todos" || (i.currency || "USD") === filterCurrencyMain;
        return statusCheck && dateCheck && supplierCheck && seasonCheck && currencyCheck;
    });

    const totalAberto = (items as any[]).filter((i: any) => i.status === "aberto" || i.status === "parcial")
        .reduce((s: number, i: any) => s + parseFloat(i.totalAmount) - parseFloat(i.paidAmount || 0), 0);
    const totalVencido = (items as any[]).filter((i: any) => isItemOverdue(i))
        .reduce((s: number, i: any) => s + parseFloat(i.totalAmount) - parseFloat(i.paidAmount || 0), 0);

    const pay = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: any }) => {
            // O servidor já cria o registro de cheque em /pay quando data.cheque é fornecido.
            // Não chamar POST /api/farm/cheques aqui para evitar duplicidade.
            const result = await apiRequest("POST", `/api/farm/accounts-payable/${id}/pay`, data);
            return result;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/accounts-payable"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/cash-accounts"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/cash-transactions"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/cash-summary"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/accounts-payable/payment-history"] });
            toast({ title: "Pagamento registrado no Fluxo de Caixa!" });
        },
    });

    const del = useMutation({
        mutationFn: async (id: string) => apiRequest("DELETE", `/api/farm/accounts-payable/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/accounts-payable"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/accounts-payable/payment-history"] });
            toast({ title: "Removido" });
        },
    });

    const reversePayment = useMutation({
        mutationFn: async (id: string) => apiRequest("POST", `/api/farm/accounts-payable/${id}/reverse`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/accounts-payable"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/cash-accounts"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/cash-transactions"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/cash-summary"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/accounts-payable/payment-history"] });
            toast({ title: "Pagamento revertido com sucesso!" });
        },
        onError: () => toast({ title: "Erro ao reverter pagamento", variant: "destructive" }),
    });

    const editMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: any }) => apiRequest("PUT", `/api/farm/accounts-payable/${id}`, data),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/farm/accounts-payable"] }); toast({ title: "Atualizado" }); setEditingItem(null); },
        onError: () => toast({ title: "Erro ao atualizar", variant: "destructive" }),
    });

    // ─── Search state for main tab ─────────────────────────────────────────
    const [searchTerm, setSearchTerm] = useState("");

    const searchFiltered = filtered.filter((i: any) =>
        !searchTerm ||
        i.supplier?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        i.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // ─── Dual currency helper ─────────────────────────────────────────────
    const groupByCur = (arr: any[], amountFn: (i: any) => number) => {
        const result: Record<string, number> = {};
        for (const i of arr) { const cur = i.currency || "USD"; result[cur] = (result[cur] || 0) + amountFn(i); }
        return result;
    };
    const fmtDual = (byCur: Record<string, number>) => {
        const entries = Object.entries(byCur).filter(([, v]) => v !== 0);
        if (entries.length === 0) return "$ 0";
        return entries.map(([cur, val]) => {
            if (cur === "PYG") return `₲ ${Math.round(val).toLocaleString("es-PY")}`;
            return `$ ${val.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
        }).join(" | ");
    };

    // ─── KPI Calculations (dual currency) ──────────────────────────────────
    const kpiTotalPayable = useMemo(() => {
        const open = (items as any[]).filter((i: any) => i.status === "aberto" || i.status === "parcial");
        return {
            total: open.reduce((s: number, i: any) => s + parseFloat(i.totalAmount) - parseFloat(i.paidAmount || 0), 0),
            byCurrency: groupByCur(open, (i) => parseFloat(i.totalAmount) - parseFloat(i.paidAmount || 0)),
        };
    }, [items]);

    const kpiOverdue = useMemo(() => {
        const overdueItems = (items as any[]).filter((i: any) => isItemOverdue(i));
        return {
            count: overdueItems.length,
            sum: overdueItems.reduce((s: number, i: any) => s + parseFloat(i.totalAmount) - parseFloat(i.paidAmount || 0), 0),
            byCurrency: groupByCur(overdueItems, (i) => parseFloat(i.totalAmount) - parseFloat(i.paidAmount || 0)),
        };
    }, [items]);

    const kpiPaidThisMonth = useMemo(() => {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const paid = (items as any[]).filter((i: any) => i.status === "pago" && i.paidDate && new Date(i.paidDate) >= monthStart);
        return {
            total: paid.reduce((s: number, i: any) => s + parseFloat(i.paidAmount || i.totalAmount || 0), 0),
            byCurrency: groupByCur(paid, (i) => parseFloat(i.paidAmount || i.totalAmount || 0)),
        };
    }, [items]);

    const kpiNext7Days = useMemo(() => {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const in7 = new Date(today); in7.setDate(in7.getDate() + 7);
        return (items as any[])
            .filter((i: any) => {
                if (i.status === "pago") return false;
                const d = new Date(i.dueDate); d.setHours(0, 0, 0, 0);
                return d >= today && d <= in7;
            })
            .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    }, [items]);

    const kpiMonthlyFlow = useMemo(() => {
        const months: { label: string; total: number }[] = [];
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const label = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
            const monthItems = (items as any[]).filter((it: any) => {
                const due = new Date(it.dueDate);
                return due.getMonth() === d.getMonth() && due.getFullYear() === d.getFullYear();
            });
            const total = monthItems.reduce((s: number, it: any) => s + parseFloat(it.totalAmount || 0), 0);
            months.push({ label, total });
        }
        return months;
    }, [items]);

    const maxMonthly = useMemo(() => Math.max(...kpiMonthlyFlow.map(m => m.total), 1), [kpiMonthlyFlow]);

    const statusBadge = (s: string) => {
        const map: Record<string, { dot: string; bg: string; label: string }> = {
            aberto: { dot: "bg-red-500", bg: "bg-red-50 text-red-700 ring-1 ring-red-200", label: "ABERTO" },
            parcial: { dot: "bg-yellow-500", bg: "bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200", label: "PARCIAL" },
            pago: { dot: "bg-green-500", bg: "bg-green-50 text-green-700 ring-1 ring-green-200", label: "PAGO" },
            vencido: { dot: "bg-red-500", bg: "bg-red-50 text-red-700 ring-1 ring-red-200", label: "VENCIDO" },
        };
        const cfg = map[s] || map.aberto;
        return (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${cfg.bg}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                {cfg.label}
            </span>
        );
    };

    // Avatar color from supplier name
    const avatarColor = (name: string) => {
        const colors = ["bg-emerald-600", "bg-blue-600", "bg-purple-600", "bg-amber-600", "bg-rose-600", "bg-teal-600", "bg-indigo-600", "bg-orange-600"];
        let hash = 0;
        for (let i = 0; i < (name || "").length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
        return colors[Math.abs(hash) % colors.length];
    };

    return (
        <FarmLayout>
            {/* Manrope font */}
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap'); .font-headline { font-family: 'Manrope', sans-serif; }`}</style>

            <div className="space-y-6">
                {/* ── SECTION 1: PAGE HEADER ─────────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Left: Title */}
                    <div className="lg:col-span-4">
                        <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-600 mb-1">OPERACOES FINANCEIRAS</p>
                        <h1 className="text-4xl font-extrabold font-headline text-gray-900 leading-tight">Contas a Pagar</h1>
                        <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                            Gerencie suas obrigacoes financeiras, acompanhe vencimentos e registre pagamentos.
                        </p>
                        <div className="flex gap-2 mt-4">
                            <Button variant="outline" size="sm" className="text-gray-600 h-8 text-xs" onClick={() => queryClient.invalidateQueries()}>
                                <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Atualizar
                            </Button>
                            <Button variant="outline" size="sm" className="text-gray-600 h-8 text-xs" onClick={() => exportToCSV(filtered, "contas-a-pagar.csv")}>
                                <Download className="mr-1.5 h-3.5 w-3.5" /> CSV
                            </Button>
                        </div>
                    </div>

                    {/* Right: KPI Cards */}
                    <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {/* Total a Pagar */}
                        <div className="bg-white rounded-xl shadow-sm border-l-4 border-emerald-800 p-5">
                            <div className="flex items-center gap-2 mb-2">
                                <DollarSign className="h-4 w-4 text-emerald-700" />
                                <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Total a Pagar</span>
                            </div>
                            <p className="text-2xl font-extrabold font-headline text-gray-900">
                                {fmtDual(kpiTotalPayable.byCurrency)}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">{(items as any[]).filter((i: any) => i.status !== "pago").length} titulos pendentes</p>
                        </div>

                        {/* Vencidos */}
                        <div className="bg-white rounded-xl shadow-sm border-l-4 border-red-500 p-5">
                            <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle className="h-4 w-4 text-red-500" />
                                <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Vencidos</span>
                            </div>
                            <p className="text-2xl font-extrabold font-headline text-red-600">
                                {fmtDual(kpiOverdue.byCurrency)}
                            </p>
                            <p className="text-xs text-red-400 mt-1">{kpiOverdue.count} titulo(s) em atraso</p>
                        </div>

                        {/* Pagos (Mes) */}
                        <div className="bg-white rounded-xl shadow-sm border-l-4 border-green-600 p-5">
                            <div className="flex items-center gap-2 mb-2">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Pagos (Mes)</span>
                            </div>
                            <p className="text-2xl font-extrabold font-headline text-green-600">
                                {fmtDual(kpiPaidThisMonth.byCurrency)}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">no mes atual</p>
                        </div>
                    </div>
                </div>

                {/* Tabs: Contas / Pagamento / Recibo de Provedores */}
                <Tabs defaultValue="contas">
                    <TabsList className="bg-gray-100 p-1 h-10 rounded-lg">
                        <TabsTrigger value="contas" className="text-[13px] font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm px-5 rounded-md">Contas</TabsTrigger>
                        <TabsTrigger value="pagamento" className="text-[13px] font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm px-5 rounded-md">Pagamento</TabsTrigger>
                        <TabsTrigger value="historico" className="text-[13px] font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm px-5 rounded-md">Recibo de Provedores</TabsTrigger>
                    </TabsList>

                    {/* ── CONTAS TAB ─────────────────────────────────────────── */}
                    <TabsContent value="contas" className="space-y-5 mt-5">

                        {/* ── SECTION 2: FILTERS BAR ──────────────────────────── */}
                        <div className="bg-gray-100 rounded-xl p-5">
                            <div className="flex flex-wrap gap-3 items-end">
                                <div className="flex-1 min-w-[200px]">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                        <Input
                                            placeholder="Buscar fornecedor ou descricao..."
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                            className="pl-10 bg-white border-0 shadow-sm h-10"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                                        <SelectTrigger className="w-36 bg-white border-0 shadow-sm h-10"><SelectValue placeholder="Status" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="todos">Todos</SelectItem>
                                            <SelectItem value="aberto">Pendente</SelectItem>
                                            <SelectItem value="parcial">Parcial</SelectItem>
                                            <SelectItem value="pago">Pago</SelectItem>
                                            <SelectItem value="vencido">Vencido</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Select value={filterSupplier} onValueChange={setFilterSupplier}>
                                        <SelectTrigger className="w-44 bg-white border-0 shadow-sm h-10"><SelectValue placeholder="Fornecedor" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="todos">Todos</SelectItem>
                                            {(suppliers as any[]).map((s: any) => (
                                                <SelectItem key={s.id || s.name} value={s.name}>{s.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Select value={filterSeason} onValueChange={setFilterSeason}>
                                        <SelectTrigger className="w-40 bg-white border-0 shadow-sm h-10"><SelectValue placeholder="Safra" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="todos">Todas Safras</SelectItem>
                                            {(seasons as any[]).map((s: any) => (
                                                <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Select value={filterCurrencyMain} onValueChange={setFilterCurrencyMain}>
                                        <SelectTrigger className="w-32 bg-white border-0 shadow-sm h-10"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="todos">Todas Moedas</SelectItem>
                                            <SelectItem value="USD">$ Dolar</SelectItem>
                                            <SelectItem value="PYG">Gs Guarani</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {(filterStatus !== "todos" || filterSupplier !== "todos" || filterSeason !== "todos" || filterCurrencyMain !== "todos" || searchTerm) && (
                                    <Button variant="ghost" size="sm" className="text-gray-500 h-10" onClick={() => { setFilterStatus("todos"); setFilterFrom(""); setFilterTo(""); setFilterSupplier("todos"); setFilterSeason("todos"); setFilterCurrencyMain("todos"); setSearchTerm(""); }}>
                                        Limpar
                                    </Button>
                                )}
                                <span className="text-xs text-gray-400 ml-auto self-center">{searchFiltered.length} de {(items as any[]).length}</span>
                            </div>
                        </div>

                        {/* ── SECTION 3: DATA TABLE ───────────────────────────── */}
                        {isLoading ? (
                            <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
                        ) : searchFiltered.length === 0 ? (
                            <div className="bg-white rounded-xl shadow-sm py-16 text-center">
                                <Receipt className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                                <p className="text-gray-500 font-medium">Nenhuma conta a pagar encontrada</p>
                                <p className="text-xs text-gray-400 mt-1">Tente ajustar os filtros</p>
                            </div>
                        ) : (
                            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-gray-50">
                                                <th className="text-left px-5 py-3.5 text-[11px] uppercase tracking-wider font-bold text-gray-400">Fornecedor</th>
                                                <th className="text-left px-4 py-3.5 text-[11px] uppercase tracking-wider font-bold text-gray-400">Descricao</th>
                                                <th className="text-center px-3 py-3.5 text-[11px] uppercase tracking-wider font-bold text-gray-400">Parcela</th>
                                                <th className="text-left px-4 py-3.5 text-[11px] uppercase tracking-wider font-bold text-gray-400">Vencimento</th>
                                                <th className="text-center px-3 py-3.5 text-[11px] uppercase tracking-wider font-bold text-gray-400">Status</th>
                                                <th className="text-right px-5 py-3.5 text-[11px] uppercase tracking-wider font-bold text-gray-400">Valor</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {searchFiltered.slice(0, pageSize).map((item: any) => {
                                                const due = new Date(item.dueDate); due.setHours(0, 0, 0, 0);
                                                const today = new Date(); today.setHours(0, 0, 0, 0);
                                                const isOverdue = (item.status === "aberto" || item.status === "parcial") && due < today;
                                                return (
                                                    <tr key={item.id} className="hover:bg-emerald-50/20 transition-colors">
                                                        {/* Fornecedor with avatar */}
                                                        <td className="px-5 py-3.5">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`h-8 w-8 rounded-full ${avatarColor(item.supplier)} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                                                                    {(item.supplier || "?")[0].toUpperCase()}
                                                                </div>
                                                                <span className="font-semibold text-gray-900 truncate max-w-[160px]">{item.supplier}</span>
                                                            </div>
                                                        </td>
                                                        {/* Descricao */}
                                                        <td className="px-4 py-3.5 text-gray-500 max-w-[180px] truncate">{item.description || "--"}</td>
                                                        {/* Parcela */}
                                                        <td className="px-3 py-3.5 text-center">
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[11px] font-medium">
                                                                {item.installmentNumber}/{item.totalInstallments}
                                                            </span>
                                                        </td>
                                                        {/* Vencimento */}
                                                        <td className={`px-4 py-3.5 text-sm ${isOverdue ? "text-red-600 font-semibold" : "text-gray-700"}`}>
                                                            {item.dueDate ? new Date(item.dueDate).toLocaleDateString("pt-BR") : "--"}
                                                        </td>
                                                        {/* Status */}
                                                        <td className="px-3 py-3.5 text-center">{statusBadge(isOverdue && item.status !== "pago" ? "vencido" : item.status)}</td>
                                                        {/* Valor */}
                                                        <td className="px-5 py-3.5 text-right font-extrabold text-gray-900 font-headline">
                                                            {formatCurrency(item.totalAmount, item.currency || "USD")}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                {(items as any[]).length > 15 && (
                                    <div className="flex items-center justify-center gap-3 px-5 py-3 border-t border-gray-100">
                                        <span className="text-xs text-gray-400">Mostrando {Math.min(pageSize, searchFiltered.length)} de {searchFiltered.length}</span>
                                        <Select value={String(pageSize)} onValueChange={v => setPageSize(parseInt(v))}>
                                            <SelectTrigger className="w-20 h-7 text-xs border-0 bg-gray-100"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="15">15</SelectItem>
                                                <SelectItem value="30">30</SelectItem>
                                                <SelectItem value="50">50</SelectItem>
                                                <SelectItem value="100">100</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── SECTION 4: BOTTOM INSIGHTS ──────────────────────── */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                            {/* Proximos 7 Dias */}
                            <div className="bg-white rounded-xl shadow-sm p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <CalendarDays className="h-4 w-4 text-emerald-600" />
                                    <h3 className="font-headline font-bold text-gray-900">Proximos 7 Dias</h3>
                                    {kpiNext7Days.length > 0 && (
                                        <span className="ml-auto text-[10px] uppercase tracking-wider font-bold text-gray-400">{kpiNext7Days.length} titulo(s)</span>
                                    )}
                                </div>
                                {kpiNext7Days.length === 0 ? (
                                    <p className="text-sm text-gray-400 text-center py-6">Nenhum vencimento nos proximos 7 dias</p>
                                ) : (
                                    <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                                        {kpiNext7Days.slice(0, 8).map((item: any) => (
                                            <div key={item.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className={`h-6 w-6 rounded-full ${avatarColor(item.supplier)} flex items-center justify-center text-white text-[10px] font-bold`}>
                                                        {(item.supplier || "?")[0].toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-800 truncate max-w-[140px]">{item.supplier}</p>
                                                        <p className="text-[10px] text-gray-400">{new Date(item.dueDate).toLocaleDateString("pt-BR")}</p>
                                                    </div>
                                                </div>
                                                <span className="font-headline font-bold text-gray-900 text-sm">
                                                    {formatCurrency(parseFloat(item.totalAmount) - parseFloat(item.paidAmount || 0), item.currency || "USD")}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Fluxo de Caixa */}
                            <div className="bg-emerald-950 rounded-xl shadow-sm p-5 relative overflow-hidden">
                                {/* Decorative blur circle */}
                                <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-500/20 rounded-full blur-3xl" />
                                <div className="relative z-10">
                                    <div className="flex items-center gap-2 mb-4">
                                        <BarChart3 className="h-4 w-4 text-emerald-400" />
                                        <h3 className="font-headline font-bold text-white">Fluxo de Caixa</h3>
                                        <span className="ml-auto text-[10px] uppercase tracking-wider font-bold text-emerald-400/60">Ultimos 6 meses</span>
                                    </div>
                                    <div className="flex items-end gap-3 h-[140px]">
                                        {kpiMonthlyFlow.map((m, idx) => (
                                            <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full">
                                                <span className="text-[10px] text-emerald-300 font-bold mb-1">
                                                    {m.total > 0 ? (m.total / 1000).toFixed(0) + "k" : "0"}
                                                </span>
                                                <div
                                                    className="w-full rounded-t-md bg-emerald-500/40 hover:bg-emerald-400/60 transition-colors"
                                                    style={{ height: `${Math.max((m.total / maxMonthly) * 100, 4)}%` }}
                                                />
                                                <span className="text-[10px] text-emerald-400/80 mt-2 capitalize">{m.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    {/* ── PAGAMENTO TAB ──────────────────────────────────────── */}
                    <TabsContent value="pagamento" className="space-y-4 mt-4">
                        <PagamentoTab
                            items={items as any[]}
                            accounts={accounts as any[]}
                            seasons={seasons as any[]}
                            onPay={(id, data) => pay.mutate({ id, data })}
                            paying={pay.isPending}
                            queryClient={queryClient}
                        />
                    </TabsContent>

                    {/* ── HISTORICO TAB ──────────────────────────────────────── */}
                    <TabsContent value="historico" className="mt-4">
                        <HistoricoTab
                            items={items as any[]}
                            accounts={accounts as any[]}
                            seasons={seasons as any[]}
                            onPay={(id, data) => pay.mutate({ id, data })}
                            paying={pay.isPending}
                            onReverse={(id) => {
                                if (confirm("Tem certeza que deseja reverter este pagamento? O valor sera devolvido ao saldo da conta.")) {
                                    reversePayment.mutate(id);
                                }
                            }}
                            reversing={reversePayment.isPending}
                        />
                    </TabsContent>
                </Tabs>

                {/* Edit Dialog */}
                <Dialog open={!!editingItem} onOpenChange={(o) => !o && setEditingItem(null)}>
                    <DialogContent className="max-w-md">
                        <DialogHeader><DialogTitle>Editar Conta a Pagar</DialogTitle></DialogHeader>
                        {editingItem && <EditAPForm item={editingItem} seasons={seasons}
                            onSave={(data: any) => editMutation.mutate({ id: editingItem.id, data })}
                            saving={editMutation.isPending} />}
                    </DialogContent>
                </Dialog>
            </div>
        </FarmLayout>
    );
}

// ─── Pagamento Tab ────────────────────────────────────────────────────────────
function PagamentoTab({ items, accounts, seasons, onPay, paying, queryClient }: {
    items: any[]; accounts: any[]; seasons: any[]; onPay: (id: string, data: any) => void; paying: boolean; queryClient: any;
}) {
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState("");
    const [filterDateFrom, setFilterDateFrom] = useState("");
    const [filterDateTo, setFilterDateTo] = useState("");
    const [filterSeason, setFilterSeason] = useState("todos");
    const [filterCurrency, setFilterCurrency] = useState("todos");
    const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
    const [payModalOpen, setPayModalOpen] = useState(false);

    // Payment modal state
    const [paymentRows, setPaymentRows] = useState<{ accountId: string; amount: string; paymentMethod: string }[]>([
        { accountId: "", amount: "", paymentMethod: "transferencia" },
    ]);
    const [chequeBanco, setChequeBanco] = useState("");
    const [chequeNumero, setChequeNumero] = useState("");
    const [chequeTipo, setChequeTipo] = useState("proprio");
    const [selectedChequeId, setSelectedChequeId] = useState("");

    // #20 — available cheques list for auto-fill
    const { data: availableCheques = [] } = useQuery<any[]>({
        queryKey: ["/api/farm/cheques"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/cheques"); return r.json(); },
        enabled: payModalOpen,
    });
    const emitidoCheques = (availableCheques as any[]).filter((ch: any) => ch.status === "emitido");
    const [receiptNumber, setReceiptNumber] = useState("");
    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [receiptFileUrl, setReceiptFileUrl] = useState("");
    const [payObservation, setPayObservation] = useState("");

    // Filter pending items
    const pendingItems = items.filter((i: any) => i.status !== "pago");
    const filteredPending = pendingItems.filter((i: any) => {
        const termMatch = !searchTerm ||
            i.supplier?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            i.description?.toLowerCase().includes(searchTerm.toLowerCase());
        const dateFromMatch = !filterDateFrom || new Date(i.dueDate) >= new Date(filterDateFrom);
        const dateToMatch = !filterDateTo || new Date(i.dueDate) <= new Date(filterDateTo);
        const seasonMatch = filterSeason === "todos" || String(i.season_id || i.seasonId || "") === filterSeason;
        const currencyMatch = filterCurrency === "todos" || (i.currency || "USD") === filterCurrency;
        return termMatch && dateFromMatch && dateToMatch && seasonMatch && currencyMatch;
    });

    const checkedItems = filteredPending.filter((i: any) => checkedIds.has(i.id));
    const totalChecked = checkedItems.reduce((s: number, i: any) =>
        s + parseFloat(i.totalAmount) - parseFloat(i.paidAmount || 0), 0
    );

    const toggleCheck = (id: string) => {
        setCheckedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        if (checkedIds.size === filteredPending.length) {
            setCheckedIds(new Set());
        } else {
            setCheckedIds(new Set(filteredPending.map((i: any) => i.id)));
        }
    };

    const totalAllocated = paymentRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const allRowsValid = paymentRows.every(r => r.accountId && parseFloat(r.amount) > 0);
    const hasChequeMethod = paymentRows.some(r => r.paymentMethod === "cheque");

    const addRow = () => setPaymentRows(prev => [...prev, { accountId: "", amount: "", paymentMethod: "transferencia" }]);
    const removeRow = (idx: number) => { if (paymentRows.length > 1) setPaymentRows(prev => prev.filter((_, i) => i !== idx)); };
    const updateRow = (idx: number, field: string, value: string) => {
        setPaymentRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
    };

    // Currency of selected items (for filtering bank accounts)
    const selectedCurrency = checkedItems.length > 0 ? (checkedItems[0].currency || "USD") : "USD";
    const filteredAccounts = accounts.filter((a: any) => a.currency === selectedCurrency);

    function openPayModal() {
        // Validate: all selected items must be from the same supplier
        const suppliers = new Set(checkedItems.map((i: any) => i.supplier));
        if (suppliers.size > 1) {
            alert("Nao e possivel pagar faturas de fornecedores diferentes na mesma operacao. Selecione apenas faturas do mesmo fornecedor.");
            return;
        }
        // Validate: all selected items must be the same currency
        const currencies = new Set(checkedItems.map((i: any) => (i.currency || "USD").toUpperCase()));
        if (currencies.size > 1) {
            alert("Nao e possivel pagar faturas em moedas diferentes na mesma operacao. Selecione apenas faturas na mesma moeda ($ ou Gs).");
            return;
        }
        setPaymentRows([{ accountId: "", amount: totalChecked.toFixed(2), paymentMethod: "transferencia" }]);
        setChequeBanco(""); setChequeNumero(""); setChequeTipo("proprio"); setSelectedChequeId("");
        setReceiptNumber(""); setReceiptFile(null); setReceiptFileUrl(""); setPayObservation("");
        setPayModalOpen(true);
    }

    const [batchPaying, setBatchPaying] = useState(false);

    async function handleConfirmPayment() {
        if (checkedIds.size === 0 || !allRowsValid) return;

        // Single invoice: use the original onPay (backward compat)
        if (checkedItems.length === 1) {
            const item = checkedItems[0];
            const payload: any = {
                accountId: paymentRows[0].accountId,
                amount: totalAllocated.toFixed(2),
                paymentMethod: paymentRows[0].paymentMethod,
                supplier: item.supplier,
                accountRows: paymentRows.length > 1 ? paymentRows.map(r => ({
                    accountId: r.accountId,
                    amount: r.amount,
                })) : undefined,
            };
            if (hasChequeMethod && chequeBanco && chequeNumero) {
                payload.cheque = { banco: chequeBanco, numero: chequeNumero, tipo: chequeTipo };
            }
            if (receiptNumber) payload.receiptNumber = receiptNumber;
            if (receiptFileUrl) payload.receiptFileUrl = receiptFileUrl;
            if (payObservation) payload.observation = payObservation;
            onPay(item.id, payload);
            setCheckedIds(new Set());
            setPayModalOpen(false);
            return;
        }

        // Multiple invoices: use batch-pay (sequential allocation, single receipt)
        setBatchPaying(true);
        try {
            const payload: any = {
                payableIds: checkedItems.map((i: any) => i.id),
                accountId: paymentRows[0].accountId,
                amount: totalAllocated.toFixed(2),
                paymentMethod: paymentRows[0].paymentMethod,
                accountRows: paymentRows.length > 1 ? paymentRows.map(r => ({
                    accountId: r.accountId,
                    amount: r.amount,
                    paymentMethod: r.paymentMethod,
                })) : undefined,
            };
            if (hasChequeMethod && chequeBanco && chequeNumero) {
                payload.cheque = { banco: chequeBanco, numero: chequeNumero, tipo: chequeTipo };
            }
            if (receiptNumber) payload.receiptNumber = receiptNumber;
            if (receiptFileUrl) payload.receiptFileUrl = receiptFileUrl;
            if (payObservation) payload.observation = payObservation;

            const res = await fetch("/api/farm/accounts-payable/batch-pay", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error("Batch pay failed");

            queryClient.invalidateQueries({ queryKey: ["/api/farm/accounts-payable"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/cash-accounts"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/cash-transactions"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/cash-summary"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/accounts-payable/payment-history"] });
            toast({ title: `Pagamento registrado para ${checkedItems.length} titulos!` });
        } catch (err) {
            toast({ title: "Erro ao processar pagamento", variant: "destructive" });
        } finally {
            setBatchPaying(false);
            setCheckedIds(new Set());
            setPayModalOpen(false);
        }
    }

    const isOverdue = (item: any) => {
        if (item.status === "pago") return false;
        const due = new Date(item.dueDate); due.setHours(0, 0, 0, 0);
        const today = new Date(); today.setHours(0, 0, 0, 0);
        return (item.status === "aberto" || item.status === "parcial") && due < today;
    };

    // Avatar color from supplier name
    const avatarColor = (name: string) => {
        const colors = ["bg-emerald-600", "bg-blue-600", "bg-purple-600", "bg-amber-600", "bg-rose-600", "bg-teal-600", "bg-indigo-600", "bg-orange-600"];
        let hash = 0;
        for (let i = 0; i < (name || "").length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
        return colors[Math.abs(hash) % colors.length];
    };

    const statusBadgePay = (item: any) => {
        const overdue = isOverdue(item);
        if (overdue) return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide bg-red-50 text-red-700 ring-1 ring-red-200">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />VENCIDO
            </span>
        );
        if (item.status === "parcial") return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200">
                <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />PARCIAL
            </span>
        );
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide bg-blue-50 text-blue-700 ring-1 ring-blue-200">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />ABERTO
            </span>
        );
    };

    return (
        <>
            {/* Filters + Pay button */}
            <div className="bg-gray-100 rounded-xl p-5">
                <div className="flex flex-wrap gap-3 items-end">
                    <div className="flex-1 min-w-[200px]">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Fornecedor ou descricao..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-10 bg-white border-0 shadow-sm h-10"
                            />
                        </div>
                    </div>
                    <div>
                        <Input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="w-36 bg-white border-0 shadow-sm h-10" />
                    </div>
                    <div>
                        <Input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="w-36 bg-white border-0 shadow-sm h-10" />
                    </div>
                    <div>
                        <Select value={filterSeason} onValueChange={setFilterSeason}>
                            <SelectTrigger className="w-40 bg-white border-0 shadow-sm h-10"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="todos">Todas Safras</SelectItem>
                                {seasons.map((s: any) => (
                                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Select value={filterCurrency} onValueChange={setFilterCurrency}>
                            <SelectTrigger className="w-32 bg-white border-0 shadow-sm h-10"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="todos">Todas Moedas</SelectItem>
                                <SelectItem value="USD">$ Dolar</SelectItem>
                                <SelectItem value="PYG">Gs Guarani</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Button
                        className="bg-emerald-700 hover:bg-emerald-800 h-10 shadow-sm"
                        disabled={checkedIds.size === 0}
                        onClick={openPayModal}
                    >
                        <CreditCard className="mr-2 h-4 w-4" />
                        Realizar Pagamento {checkedIds.size > 0 && `(${checkedIds.size})`}
                    </Button>
                    <span className="text-xs text-gray-400 ml-auto self-center">{filteredPending.length} pendente(s)</span>
                </div>
            </div>

            {/* Pending items list with checkboxes */}
            {filteredPending.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm py-16 text-center">
                    <Receipt className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 font-medium">Nenhuma conta pendente encontrada</p>
                    <p className="text-xs text-gray-400 mt-1">Tente ajustar os filtros</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50">
                                    <th className="px-4 py-3.5 w-10">
                                        <input
                                            type="checkbox"
                                            className="rounded"
                                            checked={checkedIds.size === filteredPending.length && filteredPending.length > 0}
                                            onChange={toggleAll}
                                        />
                                    </th>
                                    <th className="text-left px-5 py-3.5 text-[11px] uppercase tracking-wider font-bold text-gray-400">Fornecedor</th>
                                    <th className="text-left px-4 py-3.5 text-[11px] uppercase tracking-wider font-bold text-gray-400">Descricao</th>
                                    <th className="text-center px-3 py-3.5 text-[11px] uppercase tracking-wider font-bold text-gray-400">Parcela</th>
                                    <th className="text-left px-4 py-3.5 text-[11px] uppercase tracking-wider font-bold text-gray-400">Vencimento</th>
                                    <th className="text-left px-4 py-3.5 text-[11px] uppercase tracking-wider font-bold text-gray-400">Cadastrado</th>
                                    <th className="text-center px-3 py-3.5 text-[11px] uppercase tracking-wider font-bold text-gray-400">Status</th>
                                    <th className="text-right px-5 py-3.5 text-[11px] uppercase tracking-wider font-bold text-gray-400">Pago</th>
                                    <th className="text-right px-5 py-3.5 text-[11px] uppercase tracking-wider font-bold text-gray-400">Saldo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredPending.map((item: any) => {
                                    const paid = parseFloat(item.paidAmount || 0);
                                    const remaining = parseFloat(item.totalAmount) - paid;
                                    const overdue = isOverdue(item);
                                    return (
                                        <tr
                                            key={item.id}
                                            className={`cursor-pointer transition-colors ${checkedIds.has(item.id) ? "bg-amber-50/60" : "hover:bg-emerald-50/20"}`}
                                            onClick={() => toggleCheck(item.id)}
                                        >
                                            <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                                                <input type="checkbox" className="rounded" checked={checkedIds.has(item.id)} onChange={() => toggleCheck(item.id)} />
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-3">
                                                    <div className={`h-8 w-8 rounded-full ${avatarColor(item.supplier)} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                                                        {(item.supplier || "?")[0].toUpperCase()}
                                                    </div>
                                                    <span className="font-semibold text-gray-900 truncate max-w-[160px]">{item.supplier}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3.5 text-gray-500 max-w-[180px] truncate">{item.description || "--"}</td>
                                            <td className="px-3 py-3.5 text-center">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[11px] font-medium">
                                                    {item.installmentNumber}/{item.totalInstallments}
                                                </span>
                                            </td>
                                            <td className={`px-4 py-3.5 text-sm ${overdue ? "text-red-600 font-semibold" : "text-gray-700"}`}>
                                                {item.dueDate ? new Date(item.dueDate).toLocaleDateString("pt-BR") : "--"}
                                            </td>
                                            <td className="px-4 py-3.5 text-xs text-gray-400">{item.createdAt ? new Date(item.createdAt).toLocaleDateString("pt-BR") : "--"}</td>
                                            <td className="px-3 py-3.5 text-center">{statusBadgePay(item)}</td>
                                            <td className="px-5 py-3.5 text-right font-extrabold font-headline text-green-600">{paid > 0 ? formatCurrency(paid, item.currency || "USD") : <span className="text-gray-300">--</span>}</td>
                                            <td className="px-5 py-3.5 text-right font-extrabold font-headline text-gray-900">{formatCurrency(remaining, item.currency || "USD")}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {checkedIds.size > 0 && (
                        <div className="flex items-center justify-between px-5 py-3 bg-amber-50/80 border-t border-gray-100">
                            <span className="text-sm font-semibold text-amber-800">{checkedIds.size} conta(s) selecionada(s)</span>
                            <span className="text-sm font-extrabold font-headline text-amber-900">Total: {formatCurrency(totalChecked)}</span>
                        </div>
                    )}
                </div>
            )}

            {/* Payment Modal — Stitch Premium Design */}
            <Dialog open={payModalOpen} onOpenChange={setPayModalOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
                    {/* Header */}
                    <DialogHeader className="px-8 pt-6 pb-4 border-b border-gray-100 bg-white">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-lg shadow-red-200">
                                <CreditCard className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-black font-headline tracking-tight text-gray-900">Realizar Pagamento</DialogTitle>
                                <p className="text-xs text-gray-400 mt-0.5">{checkedItems.length} conta(s) selecionada(s) para processamento</p>
                            </div>
                        </div>
                    </DialogHeader>

                    {/* Body — 2 column layout */}
                    <div className="flex-1 overflow-y-auto">
                        <div className="grid grid-cols-12 gap-0 min-h-[420px]">

                            {/* LEFT COLUMN — 7/12 */}
                            <div className="col-span-12 lg:col-span-7 p-8 space-y-6">

                                {/* Total Amount Card */}
                                <div className="bg-white rounded-xl border border-gray-200 border-l-4 border-l-red-500 p-5 flex items-center gap-4 shadow-sm">
                                    <div className="h-12 w-12 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                                        <Wallet className="h-6 w-6 text-red-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Total a Pagar</p>
                                        <p className="text-3xl font-black font-headline text-gray-900 tracking-tight leading-none mt-1">{formatCurrency(totalChecked)}</p>
                                    </div>
                                    {checkedItems.length > 1 && (
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-red-700 bg-red-50 px-2.5 py-1 rounded-full shrink-0">
                                            {checkedItems.length} itens
                                        </span>
                                    )}
                                </div>

                                {/* Form Section */}
                                <div className="bg-gray-50 rounded-xl p-6 space-y-5">

                                    {/* Add method button row */}
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Dados do Pagamento</p>
                                        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50" onClick={addRow}>
                                            <PlusCircle className="mr-1 h-3 w-3" /> Adicionar conta
                                        </Button>
                                    </div>

                                    {paymentRows.map((row, idx) => (
                                        <div key={idx} className="space-y-3">
                                            {paymentRows.length > 1 && (
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Metodo {idx + 1}</span>
                                                    <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-gray-300 hover:text-red-500" onClick={() => removeRow(idx)}>
                                                        <X className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            )}
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 block">Conta *</label>
                                                    <Select value={row.accountId} onValueChange={v => updateRow(idx, "accountId", v)}>
                                                        <SelectTrigger className="bg-gray-100 border-none rounded-lg h-11 focus:ring-2 focus:ring-emerald-200 text-sm">
                                                            <SelectValue placeholder="Selecione a conta..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {filteredAccounts.map((a: any) => (
                                                                <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 block">Valor *</label>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        min="0.01"
                                                        placeholder="0.00"
                                                        value={row.amount}
                                                        onChange={e => updateRow(idx, "amount", e.target.value)}
                                                        className="bg-gray-100 border-none rounded-lg h-11 font-bold text-lg font-headline focus:ring-2 focus:ring-emerald-200 px-4"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 block">Metodo</label>
                                                    <Select value={row.paymentMethod} onValueChange={v => updateRow(idx, "paymentMethod", v)}>
                                                        <SelectTrigger className="bg-gray-100 border-none rounded-lg h-11 focus:ring-2 focus:ring-emerald-200 text-sm">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="transferencia">Transferencia</SelectItem>
                                                            <SelectItem value="dinheiro">Dinheiro</SelectItem>
                                                            <SelectItem value="cheque">Cheque</SelectItem>
                                                            <SelectItem value="pix">PIX</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 block">N. Recibo</label>
                                                    <Input
                                                        placeholder="001-001-0000123"
                                                        value={receiptNumber}
                                                        onChange={e => setReceiptNumber(e.target.value)}
                                                        className="bg-gray-100 border-none rounded-lg h-11 focus:ring-2 focus:ring-emerald-200 px-4 text-sm"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Cheque fields */}
                                    {hasChequeMethod && (
                                        <div className="p-4 bg-blue-50/80 rounded-lg border border-blue-100 space-y-3">
                                            {emitidoCheques.length > 0 && (
                                                <div>
                                                    <label className="text-[10px] font-bold uppercase tracking-widest text-blue-500 mb-1.5 block">Selecionar Cheque Existente</label>
                                                    <Select value={selectedChequeId} onValueChange={(id) => {
                                                        setSelectedChequeId(id);
                                                        const ch = emitidoCheques.find((c: any) => String(c.id) === id);
                                                        if (ch) {
                                                            setChequeBanco(ch.bank || "");
                                                            setChequeNumero(ch.cheque_number || ch.chequeNumber || "");
                                                            setChequeTipo(ch.type || "proprio");
                                                        }
                                                    }}>
                                                        <SelectTrigger className="bg-white/80 border-blue-200 rounded-lg h-11">
                                                            <SelectValue placeholder="Selecionar cheque emitido..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {emitidoCheques.map((ch: any) => (
                                                                <SelectItem key={ch.id} value={String(ch.id)}>
                                                                    #{ch.cheque_number || ch.chequeNumber} — {ch.bank} — {ch.holder} — {formatCurrency(parseFloat(ch.amount), ch.currency)}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            )}
                                            <div className="grid grid-cols-3 gap-3">
                                                <div>
                                                    <label className="text-[10px] font-bold uppercase tracking-widest text-blue-500 mb-1.5 block">Banco *</label>
                                                    <Input value={chequeBanco} onChange={e => setChequeBanco(e.target.value)} placeholder="Nome do banco" className="bg-white/80 border-blue-200 rounded-lg h-11" />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold uppercase tracking-widest text-blue-500 mb-1.5 block">Numero *</label>
                                                    <Input value={chequeNumero} onChange={e => setChequeNumero(e.target.value)} placeholder="000000" className="bg-white/80 border-blue-200 rounded-lg h-11" />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold uppercase tracking-widest text-blue-500 mb-1.5 block">Tipo</label>
                                                    <Select value={chequeTipo} onValueChange={setChequeTipo}>
                                                        <SelectTrigger className="bg-white/80 border-blue-200 rounded-lg h-11"><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="proprio">Proprio</SelectItem>
                                                            <SelectItem value="terceiro">Terceiro</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {paymentRows.length > 1 && (
                                        <div className={`text-xs font-semibold px-3 py-2 rounded-lg ${Math.abs(totalAllocated - totalChecked) < 0.01 ? "text-emerald-700 bg-emerald-50" : "text-amber-700 bg-amber-50"}`}>
                                            Alocado: {formatCurrency(totalAllocated, selectedCurrency)} / Selecionado: {formatCurrency(totalChecked, selectedCurrency)}
                                        </div>
                                    )}

                                    {totalAllocated > totalChecked && (
                                        <div className="text-xs font-semibold px-3 py-2 rounded-lg text-red-700 bg-red-50 border border-red-200">
                                            Valor informado ({formatCurrency(totalAllocated, selectedCurrency)}) excede o saldo devedor ({formatCurrency(totalChecked, selectedCurrency)}). Corrija o valor.
                                        </div>
                                    )}
                                </div>

                                {/* Observações */}
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 block">Observacoes</label>
                                    <textarea
                                        value={payObservation}
                                        onChange={e => setPayObservation(e.target.value)}
                                        placeholder="Observacoes sobre este pagamento..."
                                        rows={2}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-200 focus:border-emerald-300 resize-none"
                                    />
                                </div>

                                {/* Attach Receipt Area */}
                                <div className="relative">
                                    <label
                                        className="flex flex-col items-center justify-center gap-2 p-5 rounded-xl border-2 border-dashed border-gray-200 hover:border-emerald-300 bg-white hover:bg-emerald-50/30 transition-colors cursor-pointer group"
                                    >
                                        <input
                                            type="file"
                                            accept=".pdf,.jpg,.jpeg,.png"
                                            className="sr-only"
                                            onChange={e => {
                                                const file = e.target.files?.[0];
                                                if (!file) return;
                                                setReceiptFile(file);
                                                const reader = new FileReader();
                                                reader.onload = ev => setReceiptFileUrl(ev.target?.result as string);
                                                reader.readAsDataURL(file);
                                            }}
                                        />
                                        <Upload className="h-5 w-5 text-gray-300 group-hover:text-emerald-400 transition-colors" />
                                        {receiptFile ? (
                                            <p className="text-xs font-semibold text-emerald-600">{receiptFile.name}</p>
                                        ) : (
                                            <>
                                                <p className="text-xs font-semibold text-gray-500">Clique para enviar ou arraste</p>
                                                <p className="text-[10px] text-gray-400">PDF, JPG ou PNG</p>
                                            </>
                                        )}
                                    </label>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex items-center justify-between pt-2">
                                    <button
                                        type="button"
                                        className="text-sm font-semibold text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                                        onClick={() => setPayModalOpen(false)}
                                    >
                                        Cancelar
                                    </button>
                                    <Button
                                        className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold rounded-xl h-12 px-8 shadow-lg shadow-red-200 transition-all hover:shadow-xl hover:shadow-red-200 text-sm"
                                        disabled={paying || batchPaying || !allRowsValid || checkedIds.size === 0 || totalAllocated > totalChecked || (hasChequeMethod && (!chequeBanco || !chequeNumero))}
                                        onClick={handleConfirmPayment}
                                    >
                                        {(paying || batchPaying) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                                        Confirmar Pagamento
                                    </Button>
                                </div>
                            </div>

                            {/* RIGHT COLUMN — 5/12 */}
                            <div className="col-span-12 lg:col-span-5 bg-gray-50/50 border-l border-gray-100 p-8 space-y-5">

                                {/* Security Card */}
                                <div className="relative bg-red-950 text-white p-6 rounded-xl overflow-hidden">
                                    {/* Decorative blur circle */}
                                    <div className="absolute -top-8 -right-8 h-28 w-28 rounded-full bg-red-400/20 blur-2xl" />
                                    <div className="relative z-10">
                                        <div className="flex items-center gap-2 mb-3">
                                            <ShieldCheck className="h-5 w-5 text-red-400" />
                                            <h3 className="text-sm font-bold font-headline tracking-tight">Seguranca do Pagamento</h3>
                                        </div>
                                        <p className="text-red-300/70 text-xs leading-relaxed mb-5">
                                            Todas as transacoes sao registradas com rastreabilidade completa e vinculadas ao seu historico financeiro.
                                        </p>
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-lg bg-red-800/60 flex items-center justify-center shrink-0">
                                                    <ShieldCheck className="h-4 w-4 text-red-400" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-semibold text-white">Transacao Protegida</p>
                                                    <p className="text-[10px] text-red-400/60">Registro auditavel completo</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-lg bg-red-800/60 flex items-center justify-center shrink-0">
                                                    <CheckCircle className="h-4 w-4 text-red-400" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-semibold text-white">Fornecedor Verificado</p>
                                                    <p className="text-[10px] text-red-400/60">Cadastro validado no sistema</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Transaction Details */}
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Detalhes da Transacao</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="bg-white rounded-lg p-3 border border-gray-100">
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Categoria</p>
                                            <p className="text-xs font-semibold text-gray-800 mt-1 truncate">{checkedItems[0]?.description || "Conta a Pagar"}</p>
                                        </div>
                                        <div className="bg-white rounded-lg p-3 border border-gray-100">
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Fornecedor</p>
                                            <p className="text-xs font-semibold text-gray-800 mt-1 truncate">{checkedItems[0]?.supplier || "--"}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Selected Items Summary */}
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Contas Incluidas</p>
                                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                                        {checkedItems.map((item: any) => {
                                            const remaining = parseFloat(item.totalAmount) - parseFloat(item.paidAmount || 0);
                                            return (
                                                <div key={item.id} className="flex items-center justify-between bg-white rounded-lg p-2.5 border border-gray-100">
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-xs font-semibold text-gray-800 truncate">{item.supplier}</p>
                                                        <p className="text-[10px] text-gray-400 truncate">{item.description || "Sem descricao"} - {item.installmentNumber}/{item.totalInstallments}</p>
                                                    </div>
                                                    <span className="text-xs font-bold font-headline text-gray-900 shrink-0 ml-2">{formatCurrency(remaining, item.currency || "USD")}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Info Banner */}
                                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex gap-3">
                                    <Info className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-xs font-semibold text-emerald-800">Pagamento parcial disponivel</p>
                                        <p className="text-[10px] text-emerald-600/70 leading-relaxed mt-0.5">
                                            Voce pode informar um valor menor que o total para registrar um pagamento parcial. O saldo restante permanecera em aberto.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

// ─── Historico Tab ────────────────────────────────────────────────────────────
function HistoricoTab({ items, accounts, seasons, onPay, paying, onReverse, reversing }: {
    items: any[]; accounts: any[]; seasons: any[];
    onPay: (id: string, data: any) => void; paying: boolean;
    onReverse: (id: string) => void; reversing: boolean;
}) {
    const [searchTerm, setSearchTerm] = useState("");
    const [filterReceiptNum, setFilterReceiptNum] = useState("");
    const [filterDateFrom, setFilterDateFrom] = useState("");
    const [filterDateTo, setFilterDateTo] = useState("");
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [editingHistItem, setEditingHistItem] = useState<any>(null);

    // Payment-style edit modal state
    const [editPaymentRows, setEditPaymentRows] = useState<{ accountId: string; amount: string; paymentMethod: string }[]>([
        { accountId: "", amount: "", paymentMethod: "transferencia" },
    ]);
    const [editChequeBanco, setEditChequeBanco] = useState("");
    const [editChequeNumero, setEditChequeNumero] = useState("");
    const [editChequeTipo, setEditChequeTipo] = useState("proprio");
    const [editSelectedChequeId, setEditSelectedChequeId] = useState("");
    const [editReceiptNumber, setEditReceiptNumber] = useState("");
    const [editReceiptFile, setEditReceiptFile] = useState<File | null>(null);
    const [editReceiptFileUrl, setEditReceiptFileUrl] = useState("");
    const [editObservation, setEditObservation] = useState("");

    const { data: availableCheques = [] } = useQuery<any[]>({
        queryKey: ["/api/farm/cheques"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/cheques"); return r.json(); },
        enabled: !!editingHistItem,
    });
    const emitidoCheques = (availableCheques as any[]).filter((ch: any) => ch.status === "emitido");

    function openEditModal(item: any) {
        // Multi-method: populate one edit row per transaction
        if (item._allTxs && item._allTxs.length > 1) {
            setEditPaymentRows(item._allTxs.map((tx: any) => ({
                accountId: tx.accountId || tx.account_id || "",
                amount: String(parseFloat(tx.amount || 0)),
                paymentMethod: tx.paymentMethod || tx.payment_method || "transferencia",
            })));
        } else {
            const paidAmt = parseFloat(item.amount || item.paidAmount || item.totalAmount || 0);
            setEditPaymentRows([{
                accountId: item.accountId || item.account_id || "",
                amount: String(paidAmt),
                paymentMethod: item.paymentMethod || item.payment_method || "transferencia",
            }]);
        }
        setEditReceiptNumber(item.receiptNumber || item.receipt_number || "");
        setEditReceiptFileUrl(item.receiptFileUrl || item.receipt_file_url || "");
        setEditReceiptFile(null);
        setEditChequeBanco(""); setEditChequeNumero(""); setEditChequeTipo("proprio"); setEditSelectedChequeId("");
        setEditObservation(item.observation || "");
        setEditingHistItem(item);
    }

    const editTotalAllocated = editPaymentRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const editAllRowsValid = editPaymentRows.every(r => r.accountId && parseFloat(r.amount) > 0);
    const editHasChequeMethod = editPaymentRows.some(r => r.paymentMethod === "cheque");

    const addEditRow = () => setEditPaymentRows(prev => [...prev, { accountId: "", amount: "", paymentMethod: "transferencia" }]);
    const removeEditRow = (idx: number) => { if (editPaymentRows.length > 1) setEditPaymentRows(prev => prev.filter((_, i) => i !== idx)); };
    const updateEditRow = (idx: number, field: string, value: string) => {
        setEditPaymentRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
    };

    function handleConfirmEdit() {
        if (!editingHistItem || !editAllRowsValid) return;
        const payload: any = {
            accountId: editPaymentRows[0].accountId,
            amount: editTotalAllocated.toFixed(2),
            paymentMethod: editPaymentRows[0].paymentMethod,
            supplier: editingHistItem.supplier,
            _editOnly: true,
            accountRows: editPaymentRows.length > 1 ? editPaymentRows.map(r => ({
                accountId: r.accountId,
                amount: r.amount,
            })) : undefined,
        };
        if (editHasChequeMethod && editChequeBanco && editChequeNumero) {
            payload.cheque = { banco: editChequeBanco, numero: editChequeNumero, tipo: editChequeTipo };
        }
        if (editReceiptNumber) payload.receiptNumber = editReceiptNumber;
        if (editReceiptFileUrl) payload.receiptFileUrl = editReceiptFileUrl;
        payload.observation = editObservation || null;
        onPay(editingHistItem.payableId || editingHistItem.id, payload);
        setEditingHistItem(null);
    }

    // Fetch individual payment transactions (each payment = separate entry)
    const { data: paymentHistoryData } = useQuery<any>({
        queryKey: ["/api/farm/accounts-payable/payment-history"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/accounts-payable/payment-history"); return r.json(); },
    });
    // Support both old format (array) and new format ({ payments, allPayableIds })
    const paymentHistory: any[] = Array.isArray(paymentHistoryData) ? paymentHistoryData : (paymentHistoryData?.payments || []);
    const allPaidPayableIds: string[] = Array.isArray(paymentHistoryData) ? [] : (paymentHistoryData?.allPayableIds || []);

    // Fallback: show AP records that are pago/parcial but NOT tracked by any payment transaction or batch
    const txPayableIds = new Set([
        ...paymentHistory.map((p: any) => p.payableId).filter(Boolean),
        ...allPaidPayableIds,
    ]);
    const legacyPaid = items
        .filter((i: any) => (i.status === "pago" || i.status === "parcial") && !txPayableIds.has(i.id))
        .map((i: any) => ({
            id: i.id,
            amount: i.paidAmount || i.totalAmount,
            currency: i.currency || "USD",
            paymentMethod: i.paymentMethod || i.payment_method,
            accountId: i.accountId || i.account_id,
            receiptNumber: i.receiptNumber || i.receipt_number,
            payableId: i.id,
            paidDate: i.paidDate || i.updatedAt || i.dueDate,
            supplier: i.supplier,
            apDescription: i.description,
            totalAmount: i.totalAmount,
            installmentNumber: i.installmentNumber,
            totalInstallments: i.totalInstallments,
            receiptFileUrl: i.receiptFileUrl || i.receipt_file_url,
            observation: i.observation || null,
        }));

    const allPayments = [...paymentHistory, ...legacyPaid]
        .sort((a: any, b: any) => new Date(b.paidDate).getTime() - new Date(a.paidDate).getTime());

    const filteredPaid = allPayments.filter((i: any) => {
        const termMatch = !searchTerm || i.supplier?.toLowerCase().includes(searchTerm.toLowerCase()) || i.apDescription?.toLowerCase().includes(searchTerm.toLowerCase());
        const receiptMatch = !filterReceiptNum || (i.receiptNumber || "").toLowerCase().includes(filterReceiptNum.toLowerCase());
        const dateFromMatch = !filterDateFrom || (i.paidDate && new Date(i.paidDate) >= new Date(filterDateFrom));
        const dateToMatch = !filterDateTo || (i.paidDate && new Date(i.paidDate) <= new Date(filterDateTo + "T23:59:59"));
        return termMatch && receiptMatch && dateFromMatch && dateToMatch;
    });

    // Group payments: batch payments by paymentBatchId, multi-method single payments by payableId
    const groups: { key: string; date: string; supplier: string; items: any[]; total: number; currency: string; receiptNumber: string; observation: string; batchItems?: any[]; isBatch: boolean; isMultiMethod: boolean }[] = [];
    const seenBatchIds = new Set<string>();
    const seenPayableIds = new Set<string>();
    for (const item of filteredPaid) {
        const dateStr = item.paidDate ? new Date(item.paidDate).toLocaleDateString("pt-BR") : "—";

        // Batch payment: group by batchId
        if (item.paymentBatchId) {
            if (seenBatchIds.has(item.paymentBatchId)) continue;
            seenBatchIds.add(item.paymentBatchId);
            const batchTxs = filteredPaid.filter((p: any) => p.paymentBatchId === item.paymentBatchId);
            const batchItemsArr = item.batchItems || [];
            const batchTotal = batchItemsArr.length > 0
                ? batchItemsArr.reduce((s: number, bi: any) => s + parseFloat(bi.amount || 0), 0)
                : parseFloat(item.amount || 0);
            groups.push({
                key: item.paymentBatchId,
                date: dateStr,
                supplier: item.supplier || "—",
                observation: item.observation || "",
                items: batchTxs,
                total: batchTotal,
                currency: item.currency || "USD",
                receiptNumber: item.receiptNumber || "",
                batchItems: item.batchItems || [],
                isBatch: true,
                isMultiMethod: false,
            });
        } else if (item.payableId) {
            // Single AP payment — group all transactions of the same payableId (multi-method case)
            if (seenPayableIds.has(item.payableId)) continue;
            seenPayableIds.add(item.payableId);
            const samePayableTxs = filteredPaid.filter((p: any) => !p.paymentBatchId && p.payableId === item.payableId);
            const total = samePayableTxs.reduce((s: number, p: any) => s + parseFloat(p.amount || 0), 0);
            groups.push({
                key: item.payableId,
                date: dateStr,
                supplier: item.supplier || "—",
                observation: item.observation || "",
                items: samePayableTxs,
                total,
                currency: item.currency || "USD",
                receiptNumber: item.receiptNumber || "",
                isBatch: false,
                isMultiMethod: samePayableTxs.length > 1,
            });
        } else {
            // Legacy: no payableId
            groups.push({
                key: item.id,
                date: dateStr,
                supplier: item.supplier || "—",
                observation: item.observation || "",
                items: [item],
                total: parseFloat(item.amount || 0),
                currency: item.currency || "USD",
                receiptNumber: item.receiptNumber || "",
                isBatch: false,
                isMultiMethod: false,
            });
        }
    }

    const toggleGroup = (key: string) => setExpandedGroups(prev => {
        const next = new Set(prev);
        next.has(key) ? next.delete(key) : next.add(key);
        return next;
    });

    // Avatar color from supplier name
    const avatarColor = (name: string) => {
        const colors = ["bg-emerald-600", "bg-blue-600", "bg-purple-600", "bg-amber-600", "bg-rose-600", "bg-teal-600", "bg-indigo-600", "bg-orange-600"];
        let hash = 0;
        for (let i = 0; i < (name || "").length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
        return colors[Math.abs(hash) % colors.length];
    };

    const methodLabel = (m: string) => {
        const map: Record<string, { label: string; bg: string }> = {
            transferencia: { label: "TRANSFERENCIA", bg: "bg-blue-50 text-blue-700 ring-1 ring-blue-200" },
            dinheiro: { label: "DINHEIRO", bg: "bg-green-50 text-green-700 ring-1 ring-green-200" },
            cheque: { label: "CHEQUE", bg: "bg-purple-50 text-purple-700 ring-1 ring-purple-200" },
        };
        const cfg = map[m] || { label: m?.toUpperCase() || "--", bg: "bg-gray-50 text-gray-600 ring-1 ring-gray-200" };
        return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${cfg.bg}`}>{cfg.label}</span>;
    };

    return (
        <div className="space-y-5">
            <div className="bg-gray-100 rounded-xl p-5">
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="relative flex-1 min-w-[200px] max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            placeholder="Buscar fornecedor..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-10 bg-white border-0 shadow-sm h-10"
                        />
                    </div>
                    <Input
                        placeholder="N. Recibo"
                        value={filterReceiptNum}
                        onChange={e => setFilterReceiptNum(e.target.value)}
                        className="w-36 bg-white border-0 shadow-sm h-10"
                    />
                    <Input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="w-36 bg-white border-0 shadow-sm h-10" />
                    <Input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="w-36 bg-white border-0 shadow-sm h-10" />
                    {(searchTerm || filterReceiptNum || filterDateFrom || filterDateTo) && (
                        <Button variant="ghost" size="sm" className="text-gray-500 h-10" onClick={() => { setSearchTerm(""); setFilterReceiptNum(""); setFilterDateFrom(""); setFilterDateTo(""); }}>
                            <X className="h-3.5 w-3.5 mr-1" /> Limpar
                        </Button>
                    )}
                    <span className="text-xs text-gray-400 ml-auto">{groups.length} pagamento(s)</span>
                </div>
            </div>

            {groups.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm py-16 text-center">
                    <History className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 font-medium">Nenhum pagamento registrado</p>
                    <p className="text-xs text-gray-400 mt-1">Os pagamentos realizados aparecerao aqui</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50">
                                    <th className="text-left px-5 py-3.5 text-[11px] uppercase tracking-wider font-bold text-gray-400">Fornecedor</th>
                                    <th className="text-left px-4 py-3.5 text-[11px] uppercase tracking-wider font-bold text-gray-400">Descricao</th>
                                    <th className="text-left px-4 py-3.5 text-[11px] uppercase tracking-wider font-bold text-gray-400">Observacoes</th>
                                    <th className="text-left px-4 py-3.5 text-[11px] uppercase tracking-wider font-bold text-gray-400">Data Pgto</th>
                                    <th className="text-center px-3 py-3.5 text-[11px] uppercase tracking-wider font-bold text-gray-400">Parcela</th>
                                    <th className="text-center px-3 py-3.5 text-[11px] uppercase tracking-wider font-bold text-gray-400">Metodo</th>
                                    <th className="text-center px-3 py-3.5 text-[11px] uppercase tracking-wider font-bold text-gray-400">Recibo</th>
                                    <th className="text-right px-5 py-3.5 text-[11px] uppercase tracking-wider font-bold text-gray-400">Valor Pago</th>
                                    <th className="text-right px-5 py-3.5 text-[11px] uppercase tracking-wider font-bold text-gray-400">Acoes</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {groups.map(group => {
                                    const item = group.items[0];
                                    const isExpanded = expandedGroups.has(group.key);
                                    const hasBatchDetails = group.isBatch && group.batchItems && group.batchItems.length > 0;
                                    const hasMultiMethod = group.isMultiMethod && group.items.length > 1;
                                    return (
                                        <Fragment key={group.key}>
                                        <tr className={`hover:bg-emerald-50/20 transition-colors ${hasBatchDetails ? 'cursor-pointer' : ''}`}
                                            onClick={() => hasBatchDetails && toggleGroup(group.key)}>
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-3">
                                                    <div className={`h-8 w-8 rounded-full ${avatarColor(group.supplier)} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                                                        {(group.supplier || "?")[0].toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <span className="font-semibold text-gray-900 truncate max-w-[160px] block">{group.supplier}</span>
                                                        {hasBatchDetails && (
                                                            <span className="text-[10px] text-blue-600 font-medium">
                                                                {isExpanded ? "▼" : "▶"} {group.batchItems!.length} titulo{group.batchItems!.length > 1 ? "s" : ""}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3.5 text-gray-500 max-w-[180px] truncate">
                                                {hasBatchDetails
                                                    ? `Pgto agrupado (${group.batchItems!.length} titulos)`
                                                    : item?.apDescription || "--"}
                                            </td>
                                            <td className="px-4 py-3.5 text-gray-400 max-w-[150px] truncate text-xs italic">
                                                {group.observation || item?.observation || "--"}
                                            </td>
                                            <td className="px-4 py-3.5 text-sm text-gray-700">{group.date}</td>
                                            <td className="px-3 py-3.5 text-center">
                                                {hasBatchDetails ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[11px] font-medium">
                                                        {group.batchItems!.length}x
                                                    </span>
                                                ) : item?.installmentNumber ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[11px] font-medium">
                                                        {item.installmentNumber}/{item.totalInstallments}
                                                    </span>
                                                ) : <span className="text-gray-300">--</span>}
                                            </td>
                                            <td className="px-3 py-3.5 text-center">
                                                {hasMultiMethod
                                                    ? <div className="flex flex-wrap gap-1 justify-center">{group.items.map((tx: any, i: number) => <span key={i}>{methodLabel(tx.paymentMethod)}</span>)}</div>
                                                    : methodLabel(item?.paymentMethod)}
                                            </td>
                                            <td className="px-3 py-3.5 text-center">
                                                {group.receiptNumber ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />#{group.receiptNumber}
                                                    </span>
                                                ) : <span className="text-gray-300">--</span>}
                                            </td>
                                            <td className="px-5 py-3.5 text-right font-extrabold text-green-600 font-headline">
                                                {formatCurrency(group.total, group.currency)}
                                            </td>
                                            <td className="px-5 py-3.5 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    {item?.receiptFileUrl && (
                                                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-blue-400 hover:text-blue-600 hover:bg-blue-50"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const url = item.receiptFileUrl as string;
                                                                if (url.startsWith("data:")) {
                                                                    const [meta, b64] = url.split(",");
                                                                    const mime = meta.match(/:(.*?);/)?.[1] ?? "application/octet-stream";
                                                                    const bytes = atob(b64);
                                                                    const arr = new Uint8Array(bytes.length);
                                                                    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
                                                                    const blob = new Blob([arr], { type: mime });
                                                                    const objUrl = URL.createObjectURL(blob);
                                                                    window.open(objUrl, "_blank");
                                                                    setTimeout(() => URL.revokeObjectURL(objUrl), 10000);
                                                                } else {
                                                                    window.open(url, "_blank");
                                                                }
                                                            }} aria-label="Ver recibo">
                                                            <Eye className="h-3.5 w-3.5" />
                                                        </Button>
                                                    )}
                                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-blue-600" onClick={() => openEditModal(hasMultiMethod ? { ...item, _allTxs: group.items } : item)} aria-label="Editar">
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-red-600" disabled={reversing}
                                                        onClick={(e) => { e.stopPropagation(); onReverse(item.payableId || item.id); }} aria-label="Excluir">
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                        {/* Expanded batch detail rows */}
                                        {isExpanded && hasBatchDetails && group.batchItems!.map((bi: any, idx: number) => (
                                            <tr key={`${group.key}-${idx}`} className="bg-blue-50/40">
                                                <td className="pl-16 pr-5 py-2">
                                                    <span className="text-xs text-gray-600">{bi.supplier || group.supplier}</span>
                                                </td>
                                                <td className="px-4 py-2 text-xs text-gray-500">{bi.description || "--"}</td>
                                                <td className="px-4 py-2"></td>
                                                <td className="px-4 py-2 text-xs text-gray-400">--</td>
                                                <td className="px-3 py-2 text-center">
                                                    {bi.installmentNumber ? (
                                                        <span className="text-[10px] text-gray-500">{bi.installmentNumber}/{bi.totalInstallments}</span>
                                                    ) : <span className="text-gray-300 text-[10px]">--</span>}
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                                        bi.status === "pago" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                                                    }`}>
                                                        {bi.status === "pago" ? "Pago" : "Parcial"}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2"></td>
                                                <td className="px-5 py-2 text-right text-xs font-semibold text-green-600">
                                                    {formatCurrency(parseFloat(bi.amount || 0), group.currency)}
                                                </td>
                                                <td className="px-5 py-2"></td>
                                            </tr>
                                        ))}
                                        </Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Dialog de edição — layout 2 colunas igual ao modal de pagamento */}
            <Dialog open={!!editingHistItem} onOpenChange={o => !o && setEditingHistItem(null)}>
                <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
                    {/* Header */}
                    <DialogHeader className="px-8 pt-6 pb-4 border-b border-gray-100 bg-white">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-200">
                                <Pencil className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-black font-headline tracking-tight text-gray-900">Editar Pagamento</DialogTitle>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    {editingHistItem?.supplier}
                                    {editingHistItem?.batchItems?.length > 1 && ` — ${editingHistItem.batchItems.length} titulo(s)`}
                                </p>
                            </div>
                        </div>
                    </DialogHeader>
                    {editingHistItem && (
                        <div className="flex-1 overflow-y-auto">
                            <div className="grid grid-cols-12 gap-0 min-h-[420px]">
                                {/* LEFT COLUMN — 7/12 */}
                                <div className="col-span-12 lg:col-span-7 p-8 space-y-6">
                                    {/* Total Card */}
                                    <div className="bg-white rounded-xl border border-gray-200 border-l-4 border-l-blue-500 p-5 flex items-center gap-4 shadow-sm">
                                        <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                                            <Wallet className="h-6 w-6 text-blue-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Valor Pago</p>
                                            <p className="text-3xl font-black font-headline text-gray-900 tracking-tight leading-none mt-1">{formatCurrency(parseFloat(editingHistItem.amount || editingHistItem.totalAmount), editingHistItem.currency || "USD")}</p>
                                        </div>
                                        {editingHistItem.batchItems?.length > 1 && (
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full shrink-0">
                                                {editingHistItem.batchItems.length} itens
                                            </span>
                                        )}
                                    </div>

                                    {/* Form */}
                                    <div className="bg-gray-50 rounded-xl p-6 space-y-5">
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Dados do Pagamento</p>
                                            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50" onClick={addEditRow}>
                                                <PlusCircle className="mr-1 h-3 w-3" /> Adicionar conta
                                            </Button>
                                        </div>
                                        {editPaymentRows.map((row, idx) => (
                                            <div key={idx} className="space-y-3">
                                                {editPaymentRows.length > 1 && (
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Metodo {idx + 1}</span>
                                                        <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-gray-300 hover:text-red-500" onClick={() => removeEditRow(idx)}>
                                                            <X className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                )}
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 block">Conta *</label>
                                                        <Select value={row.accountId} onValueChange={v => updateEditRow(idx, "accountId", v)}>
                                                            <SelectTrigger className="bg-gray-100 border-none rounded-lg h-11 focus:ring-2 focus:ring-emerald-200 text-sm"><SelectValue placeholder="Selecione a conta..." /></SelectTrigger>
                                                            <SelectContent>{accounts.map((a: any) => (<SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>))}</SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 block">Valor *</label>
                                                        <Input type="number" step="0.01" min="0.01" placeholder="0.00" value={row.amount}
                                                            onChange={e => updateEditRow(idx, "amount", e.target.value)}
                                                            className="bg-gray-100 border-none rounded-lg h-11 font-bold text-lg font-headline focus:ring-2 focus:ring-emerald-200 px-4" />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 block">Metodo</label>
                                                        <Select value={row.paymentMethod} onValueChange={v => updateEditRow(idx, "paymentMethod", v)}>
                                                            <SelectTrigger className="bg-gray-100 border-none rounded-lg h-11 focus:ring-2 focus:ring-emerald-200 text-sm"><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="transferencia">Transferencia</SelectItem>
                                                                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                                                                <SelectItem value="cheque">Cheque</SelectItem>
                                                                <SelectItem value="pix">PIX</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 block">N. Recibo</label>
                                                        <Input placeholder="001-001-0000123" value={editReceiptNumber}
                                                            onChange={e => setEditReceiptNumber(e.target.value)}
                                                            className="bg-gray-100 border-none rounded-lg h-11 focus:ring-2 focus:ring-emerald-200 px-4 text-sm" />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}

                                        {editHasChequeMethod && (
                                            <div className="p-4 bg-blue-50/80 rounded-lg border border-blue-100 space-y-3">
                                                {emitidoCheques.length > 0 && (
                                                    <div>
                                                        <label className="text-[10px] font-bold uppercase tracking-widest text-blue-500 mb-1.5 block">Selecionar Cheque Existente</label>
                                                        <Select value={editSelectedChequeId} onValueChange={(id) => {
                                                            setEditSelectedChequeId(id);
                                                            const ch = emitidoCheques.find((c: any) => String(c.id) === id);
                                                            if (ch) { setEditChequeBanco(ch.bank || ""); setEditChequeNumero(ch.cheque_number || ch.chequeNumber || ""); setEditChequeTipo(ch.type || "proprio"); }
                                                        }}>
                                                            <SelectTrigger className="bg-white/80 border-blue-200 rounded-lg h-11"><SelectValue placeholder="Selecionar cheque emitido..." /></SelectTrigger>
                                                            <SelectContent>{emitidoCheques.map((ch: any) => (<SelectItem key={ch.id} value={String(ch.id)}>#{ch.cheque_number || ch.chequeNumber} — {ch.bank} — {formatCurrency(parseFloat(ch.amount), ch.currency)}</SelectItem>))}</SelectContent>
                                                        </Select>
                                                    </div>
                                                )}
                                                <div className="grid grid-cols-3 gap-3">
                                                    <div><label className="text-[10px] font-bold uppercase tracking-widest text-blue-500 mb-1.5 block">Banco *</label><Input value={editChequeBanco} onChange={e => setEditChequeBanco(e.target.value)} placeholder="Nome do banco" className="bg-white/80 border-blue-200 rounded-lg h-11" /></div>
                                                    <div><label className="text-[10px] font-bold uppercase tracking-widest text-blue-500 mb-1.5 block">Numero *</label><Input value={editChequeNumero} onChange={e => setEditChequeNumero(e.target.value)} placeholder="000000" className="bg-white/80 border-blue-200 rounded-lg h-11" /></div>
                                                    <div><label className="text-[10px] font-bold uppercase tracking-widest text-blue-500 mb-1.5 block">Tipo</label>
                                                        <Select value={editChequeTipo} onValueChange={setEditChequeTipo}>
                                                            <SelectTrigger className="bg-white/80 border-blue-200 rounded-lg h-11"><SelectValue /></SelectTrigger>
                                                            <SelectContent><SelectItem value="proprio">Proprio</SelectItem><SelectItem value="terceiro">Terceiro</SelectItem></SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {editPaymentRows.length > 1 && (
                                            <div className={`text-xs font-semibold px-3 py-2 rounded-lg ${Math.abs(editTotalAllocated - parseFloat(editingHistItem.amount || editingHistItem.totalAmount)) < 0.01 ? "text-emerald-700 bg-emerald-50" : "text-amber-700 bg-amber-50"}`}>
                                                Alocado: {formatCurrency(editTotalAllocated)} / Pago: {formatCurrency(parseFloat(editingHistItem.amount || editingHistItem.totalAmount))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Observações */}
                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 block">Observacoes</label>
                                        <textarea value={editObservation} onChange={e => setEditObservation(e.target.value)}
                                            placeholder="Observacoes sobre este pagamento..." rows={2}
                                            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-200 focus:border-emerald-300 resize-none" />
                                    </div>

                                    {/* Attach Receipt */}
                                    <div className="relative">
                                        <label className="flex flex-col items-center justify-center gap-2 p-5 rounded-xl border-2 border-dashed border-gray-200 hover:border-emerald-300 bg-white hover:bg-emerald-50/30 transition-colors cursor-pointer group">
                                            <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="sr-only" onChange={e => {
                                                const file = e.target.files?.[0]; if (!file) return;
                                                setEditReceiptFile(file);
                                                const reader = new FileReader(); reader.onload = ev => setEditReceiptFileUrl(ev.target?.result as string); reader.readAsDataURL(file);
                                            }} />
                                            <Upload className="h-5 w-5 text-gray-300 group-hover:text-emerald-400 transition-colors" />
                                            {editReceiptFile ? (
                                                <p className="text-xs font-semibold text-emerald-600">{editReceiptFile.name}</p>
                                            ) : editReceiptFileUrl ? (
                                                <p className="text-xs font-semibold text-emerald-600">Recibo existente — clique para substituir</p>
                                            ) : (
                                                <><p className="text-xs font-semibold text-gray-500">Clique para enviar ou arraste</p><p className="text-[10px] text-gray-400">PDF, JPG ou PNG</p></>
                                            )}
                                        </label>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center justify-between pt-2">
                                        <button type="button" className="text-sm font-semibold text-gray-400 hover:text-gray-600 transition-colors cursor-pointer" onClick={() => setEditingHistItem(null)}>Cancelar</button>
                                        <Button
                                            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold rounded-xl h-12 px-8 shadow-lg shadow-blue-200 transition-all hover:shadow-xl hover:shadow-blue-200 text-sm"
                                            disabled={paying || !editAllRowsValid || (editHasChequeMethod && (!editChequeBanco || !editChequeNumero))}
                                            onClick={handleConfirmEdit}
                                        >
                                            {paying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                                            Salvar Alteracoes
                                        </Button>
                                    </div>
                                </div>

                                {/* RIGHT COLUMN — 5/12 — Detalhes + Contas Incluidas */}
                                <div className="col-span-12 lg:col-span-5 bg-gray-50/50 border-l border-gray-100 p-8 space-y-5">
                                    {/* Info Card */}
                                    <div className="relative bg-blue-950 text-white p-6 rounded-xl overflow-hidden">
                                        <div className="absolute -top-8 -right-8 h-28 w-28 rounded-full bg-blue-400/20 blur-2xl" />
                                        <div className="relative z-10">
                                            <div className="flex items-center gap-2 mb-3">
                                                <ShieldCheck className="h-5 w-5 text-blue-400" />
                                                <h3 className="text-sm font-bold font-headline tracking-tight">Detalhes do Pagamento</h3>
                                            </div>
                                            <div className="space-y-2 text-blue-200 text-xs">
                                                <div className="flex justify-between"><span>Fornecedor</span><span className="font-bold text-white">{editingHistItem.supplier}</span></div>
                                                <div className="flex justify-between"><span>Data</span><span className="font-bold text-white">{editingHistItem.paidDate ? new Date(editingHistItem.paidDate).toLocaleDateString("pt-BR") : "--"}</span></div>
                                                <div className="flex justify-between"><span>Metodo</span><span className="font-bold text-white">{editingHistItem.paymentMethod || "--"}</span></div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Contas Incluidas */}
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">
                                            Contas Incluidas ({editingHistItem.batchItems?.length || 1})
                                        </p>
                                        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                            {editingHistItem.batchItems && editingHistItem.batchItems.length > 0 ? (
                                                editingHistItem.batchItems.map((bi: any, idx: number) => (
                                                    <div key={idx} className="flex items-center justify-between bg-white rounded-lg p-2.5 border border-gray-100">
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-xs font-semibold text-gray-800 truncate">{bi.supplier || editingHistItem.supplier}</p>
                                                            <p className="text-[10px] text-gray-400 truncate">{bi.description || "Sem descricao"} {bi.installmentNumber ? `- ${bi.installmentNumber}/${bi.totalInstallments}` : ""}</p>
                                                        </div>
                                                        <div className="text-right shrink-0 ml-2">
                                                            <span className="text-xs font-bold font-headline text-gray-900">{formatCurrency(parseFloat(bi.amount || 0), editingHistItem.currency || "USD")}</span>
                                                            <p className={`text-[9px] font-bold ${bi.status === "pago" ? "text-emerald-600" : "text-amber-600"}`}>{bi.status === "pago" ? "Pago" : "Parcial"}</p>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="flex items-center justify-between bg-white rounded-lg p-2.5 border border-gray-100">
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-xs font-semibold text-gray-800 truncate">{editingHistItem.supplier}</p>
                                                        <p className="text-[10px] text-gray-400 truncate">{editingHistItem.apDescription || "Sem descricao"} {editingHistItem.installmentNumber ? `- ${editingHistItem.installmentNumber}/${editingHistItem.totalInstallments}` : ""}</p>
                                                    </div>
                                                    <span className="text-xs font-bold font-headline text-gray-900 shrink-0 ml-2">{formatCurrency(parseFloat(editingHistItem.totalAmount || 0), editingHistItem.currency || "USD")}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

function EditAPForm({ item, seasons, onSave, saving }: any) {
    const [supplier, setSupplier] = useState(item.supplier || "");
    const [description, setDescription] = useState(item.description || "");
    const [totalAmount, setTotalAmount] = useState(String(item.totalAmount || ""));
    const [dueDate, setDueDate] = useState(item.dueDate ? new Date(item.dueDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]);
    const [seasonId, setSeasonId] = useState(String(item.seasonId || item.season_id || "__none__"));

    const handleSave = () => {
        if (!supplier || !totalAmount || !dueDate || saving) return;
        onSave({ supplier, description, totalAmount, dueDate, seasonId: seasonId === "__none__" ? null : seasonId || null });
    };

    return (
        <div className="space-y-4" onKeyDown={onEnterNext as any}>
            <div><Label>Fornecedor *</Label><Input value={supplier} onChange={e => setSupplier(e.target.value)} /></div>
            <div><Label>Descricao</Label><Input value={description} onChange={e => setDescription(e.target.value)} /></div>
            <div><Label>Valor Total ($) *</Label><CurrencyInput value={totalAmount} onValueChange={setTotalAmount} /></div>
            <div><Label>Vencimento *</Label><Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></div>
            {(seasons || []).length > 0 && (
                <div>
                    <Label>Safra (opcional)</Label>
                    <Select value={String(seasonId)} onValueChange={setSeasonId}>
                        <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__none__">Nenhuma</SelectItem>
                            {seasons.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            )}
            <Button type="button" className="w-full bg-blue-600 hover:bg-blue-700" disabled={saving || !supplier || !totalAmount || !dueDate}
                onClick={handleSave}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Salvar Alteracoes"}
            </Button>
        </div>
    );
}
