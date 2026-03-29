import { useState, useEffect, useRef, useMemo } from "react";
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
import { Receipt, Loader2, AlertTriangle, CheckCircle, Clock, Download, CheckSquare, PlusCircle, Trash2, Pencil, History, Search, CreditCard, RefreshCw, BarChart3, CalendarDays, DollarSign, TrendingUp } from "lucide-react";

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
        return statusCheck && dateCheck && supplierCheck && seasonCheck;
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

    // ─── KPI Calculations ───────────────────────────────────────────────────
    const kpiTotalPayable = useMemo(() => {
        return (items as any[])
            .filter((i: any) => i.status === "aberto" || i.status === "parcial")
            .reduce((s: number, i: any) => s + parseFloat(i.totalAmount) - parseFloat(i.paidAmount || 0), 0);
    }, [items]);

    const kpiOverdue = useMemo(() => {
        const overdueItems = (items as any[]).filter((i: any) => isItemOverdue(i));
        return {
            count: overdueItems.length,
            sum: overdueItems.reduce((s: number, i: any) => s + parseFloat(i.totalAmount) - parseFloat(i.paidAmount || 0), 0),
        };
    }, [items]);

    const kpiPaidThisMonth = useMemo(() => {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        return (items as any[])
            .filter((i: any) => i.status === "pago" && i.paidDate && new Date(i.paidDate) >= monthStart)
            .reduce((s: number, i: any) => s + parseFloat(i.paidAmount || i.totalAmount || 0), 0);
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
                                {kpiTotalPayable.toLocaleString("pt-BR", { style: "currency", currency: "USD" })}
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
                                {kpiOverdue.sum.toLocaleString("pt-BR", { style: "currency", currency: "USD" })}
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
                                {kpiPaidThisMonth.toLocaleString("pt-BR", { style: "currency", currency: "USD" })}
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
                                {(filterStatus !== "todos" || filterSupplier !== "todos" || filterSeason !== "todos" || searchTerm) && (
                                    <Button variant="ghost" size="sm" className="text-gray-500 h-10" onClick={() => { setFilterStatus("todos"); setFilterFrom(""); setFilterTo(""); setFilterSupplier("todos"); setFilterSeason("todos"); setSearchTerm(""); }}>
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
                                                <th className="text-right px-5 py-3.5 text-[11px] uppercase tracking-wider font-bold text-gray-400">Acoes</th>
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
                                                        {/* Acoes */}
                                                        <td className="px-5 py-3.5 text-right">
                                                            <div className="flex items-center justify-end gap-1">
                                                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-blue-600" onClick={() => setEditingItem(item)} aria-label="Editar">
                                                                    <Pencil className="h-3.5 w-3.5" />
                                                                </Button>
                                                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-red-600" onClick={() => { if (confirm("Excluir esta conta?")) del.mutate(item.id); }} aria-label="Excluir">
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </div>
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
function PagamentoTab({ items, accounts, seasons, onPay, paying }: {
    items: any[]; accounts: any[]; seasons: any[]; onPay: (id: string, data: any) => void; paying: boolean;
}) {
    const [searchTerm, setSearchTerm] = useState("");
    const [filterDateFrom, setFilterDateFrom] = useState("");
    const [filterDateTo, setFilterDateTo] = useState("");
    const [filterSeason, setFilterSeason] = useState("todos");
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

    // Filter pending items
    const pendingItems = items.filter((i: any) => i.status !== "pago");
    const filteredPending = pendingItems.filter((i: any) => {
        const termMatch = !searchTerm ||
            i.supplier?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            i.description?.toLowerCase().includes(searchTerm.toLowerCase());
        const dateFromMatch = !filterDateFrom || new Date(i.dueDate) >= new Date(filterDateFrom);
        const dateToMatch = !filterDateTo || new Date(i.dueDate) <= new Date(filterDateTo);
        const seasonMatch = filterSeason === "todos" || String(i.season_id || i.seasonId || "") === filterSeason;
        return termMatch && dateFromMatch && dateToMatch && seasonMatch;
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

    function openPayModal() {
        // Validate: all selected items must be from the same supplier
        const suppliers = new Set(checkedItems.map((i: any) => i.supplier));
        if (suppliers.size > 1) {
            alert("Nao e possivel pagar faturas de fornecedores diferentes na mesma operacao. Selecione apenas faturas do mesmo fornecedor.");
            return;
        }
        setPaymentRows([{ accountId: "", amount: totalChecked.toFixed(2), paymentMethod: "transferencia" }]);
        setChequeBanco(""); setChequeNumero(""); setChequeTipo("proprio"); setSelectedChequeId("");
        setReceiptNumber(""); setReceiptFile(null); setReceiptFileUrl("");
        setPayModalOpen(true);
    }

    async function handleConfirmPayment() {
        if (checkedIds.size === 0 || !allRowsValid) return;

        // Total the user actually wants to pay across all selected items
        const totalToPay = totalAllocated;
        // Sum of remaining balances of all selected items
        const totalRemaining = checkedItems.reduce((s: number, i: any) =>
            s + parseFloat(i.totalAmount) - parseFloat(i.paidAmount || 0), 0);

        for (const item of checkedItems) {
            const itemRemaining = parseFloat(item.totalAmount) - parseFloat(item.paidAmount || 0);
            // Proportional share of totalToPay for this item, capped at item's remaining balance
            const proportion = totalRemaining > 0 ? itemRemaining / totalRemaining : 0;
            const itemPayAmount = Math.min(itemRemaining, totalToPay * proportion);

            const payload: any = {
                accountId: paymentRows[0].accountId,
                amount: itemPayAmount.toFixed(2),
                paymentMethod: paymentRows[0].paymentMethod,
                supplier: item.supplier,
                // For multi-account split, distribute each item's share proportionally across accounts
                accountRows: paymentRows.length > 1 ? paymentRows.map(r => ({
                    accountId: r.accountId,
                    amount: (itemPayAmount * (parseFloat(r.amount) / totalToPay)).toFixed(2),
                })) : undefined,
            };
            if (hasChequeMethod && chequeBanco && chequeNumero) {
                payload.cheque = { banco: chequeBanco, numero: chequeNumero, tipo: chequeTipo };
            }
            if (receiptNumber) payload.receiptNumber = receiptNumber;
            if (receiptFileUrl) payload.receiptFileUrl = receiptFileUrl;
            onPay(item.id, payload);
        }
        setCheckedIds(new Set());
        setPayModalOpen(false);
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

            {/* Payment Modal */}
            <Dialog open={payModalOpen} onOpenChange={setPayModalOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
                    <DialogHeader className="px-6 pt-5 pb-3 border-b">
                        <DialogTitle>Realizar Pagamento</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                        {/* Resumo das contas selecionadas */}
                        <div className="bg-gray-50 rounded-lg border p-3">
                            <p className="text-xs font-semibold text-gray-500 mb-2">Contas selecionadas ({checkedItems.length})</p>
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                                {checkedItems.map((item: any) => {
                                    const remaining = parseFloat(item.totalAmount) - parseFloat(item.paidAmount || 0);
                                    return (
                                        <div key={item.id} className="flex items-center justify-between text-sm">
                                            <span className="text-gray-700">{item.supplier} - {item.description || "Sem descricao"} ({item.installmentNumber}/{item.totalInstallments})</span>
                                            <span className="font-mono font-semibold text-red-600">{formatCurrency(remaining, item.currency || "USD")}</span>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
                                <span className="text-sm font-bold text-gray-800">Total a pagar</span>
                                <span className="text-lg font-bold text-red-600">{formatCurrency(totalChecked)}</span>
                            </div>
                        </div>

                        {/* Forma de pagamento */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label className="font-semibold text-emerald-800">Forma de Pagamento</Label>
                                <Button type="button" variant="outline" size="sm" className="h-7 text-xs border-emerald-200 text-emerald-700" onClick={addRow}>
                                    <PlusCircle className="mr-1 h-3 w-3" /> Adicionar metodo
                                </Button>
                            </div>
                            {paymentRows.map((row, idx) => (
                                <div key={idx} className="grid grid-cols-3 gap-3 items-end">
                                    <div>
                                        <Label className="text-xs text-gray-500">Conta Bancaria *</Label>
                                        <Select value={row.accountId} onValueChange={v => updateRow(idx, "accountId", v)}>
                                            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                            <SelectContent>
                                                {accounts.map((a: any) => (
                                                    <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label className="text-xs text-gray-500">Valor * (parcial ou total)</Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            min="0.01"
                                            placeholder="0.00"
                                            value={row.amount}
                                            onChange={e => updateRow(idx, "amount", e.target.value)}
                                            className="font-mono"
                                        />
                                    </div>
                                    <div className="flex gap-2 items-end">
                                        <div className="flex-1">
                                            <Label className="text-xs text-gray-500">Metodo</Label>
                                            <Select value={row.paymentMethod} onValueChange={v => updateRow(idx, "paymentMethod", v)}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="transferencia">Transferencia</SelectItem>
                                                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                                                    <SelectItem value="cheque">Cheque</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        {paymentRows.length > 1 && (
                                            <Button type="button" variant="ghost" size="sm" className="text-red-400 hover:text-red-600 h-10" onClick={() => removeRow(idx)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Cheque fields — #20: select from existing emitido cheques */}
                        {hasChequeMethod && (
                            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 space-y-3">
                                {emitidoCheques.length > 0 && (
                                    <div>
                                        <Label className="text-xs text-blue-700">Selecionar Cheque Existente</Label>
                                        <Select value={selectedChequeId} onValueChange={(id) => {
                                            setSelectedChequeId(id);
                                            const ch = emitidoCheques.find((c: any) => String(c.id) === id);
                                            if (ch) {
                                                setChequeBanco(ch.bank || "");
                                                setChequeNumero(ch.cheque_number || ch.chequeNumber || "");
                                                setChequeTipo(ch.type || "proprio");
                                            }
                                        }}>
                                            <SelectTrigger><SelectValue placeholder="Selecionar cheque emitido..." /></SelectTrigger>
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
                                    <div><Label className="text-xs text-blue-700">Banco *</Label><Input value={chequeBanco} onChange={e => setChequeBanco(e.target.value)} placeholder="Nome do banco" /></div>
                                    <div><Label className="text-xs text-blue-700">Numero *</Label><Input value={chequeNumero} onChange={e => setChequeNumero(e.target.value)} placeholder="000000" /></div>
                                    <div><Label className="text-xs text-blue-700">Tipo</Label>
                                        <Select value={chequeTipo} onValueChange={setChequeTipo}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
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
                            <p className={`text-xs font-medium ${Math.abs(totalAllocated - totalChecked) < 0.01 ? "text-green-600" : "text-amber-600"}`}>
                                Total alocado: {formatCurrency(totalAllocated)} / Total selecionado: {formatCurrency(totalChecked)}
                            </p>
                        )}

                        {/* Recibo do fornecedor */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                            <div>
                                <Label className="text-xs text-gray-500">Nº Recibo do Fornecedor</Label>
                                <Input
                                    placeholder="Ex: 001-001-0000123"
                                    value={receiptNumber}
                                    onChange={e => setReceiptNumber(e.target.value)}
                                />
                            </div>
                            <div>
                                <Label className="text-xs text-gray-500">Importar Recibo (PDF/imagem)</Label>
                                <input
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 border border-gray-200 rounded-md px-2 py-1.5 cursor-pointer"
                                    onChange={e => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        setReceiptFile(file);
                                        const reader = new FileReader();
                                        reader.onload = ev => setReceiptFileUrl(ev.target?.result as string);
                                        reader.readAsDataURL(file);
                                    }}
                                />
                                {receiptFile && <p className="text-xs text-emerald-600 mt-1">✓ {receiptFile.name}</p>}
                            </div>
                        </div>
                    </div>

                    {/* Footer fixo */}
                    <div className="px-6 py-3 border-t bg-gray-50 flex items-center justify-end gap-3">
                        <Button variant="outline" onClick={() => setPayModalOpen(false)}>Cancelar</Button>
                        <Button
                            className="bg-green-600 hover:bg-green-700"
                            disabled={paying || !allRowsValid || checkedIds.size === 0 || (hasChequeMethod && (!chequeBanco || !chequeNumero))}
                            onClick={handleConfirmPayment}
                        >
                            {paying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckSquare className="mr-2 h-4 w-4" />}
                            Confirmar Pagamento ({checkedIds.size} conta(s))
                        </Button>
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

    const { data: availableCheques = [] } = useQuery<any[]>({
        queryKey: ["/api/farm/cheques"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/cheques"); return r.json(); },
        enabled: !!editingHistItem,
    });
    const emitidoCheques = (availableCheques as any[]).filter((ch: any) => ch.status === "emitido");

    function openEditModal(item: any) {
        const paidAmt = parseFloat(item.amount || item.paidAmount || item.totalAmount || 0);
        setEditPaymentRows([{
            accountId: item.accountId || item.account_id || "",
            amount: String(paidAmt),
            paymentMethod: item.paymentMethod || item.payment_method || "transferencia",
        }]);
        setEditReceiptNumber(item.receiptNumber || item.receipt_number || "");
        setEditReceiptFileUrl(item.receiptFileUrl || item.receipt_file_url || "");
        setEditReceiptFile(null);
        setEditChequeBanco(""); setEditChequeNumero(""); setEditChequeTipo("proprio"); setEditSelectedChequeId("");
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
        onPay(editingHistItem.payableId || editingHistItem.id, payload);
        setEditingHistItem(null);
    }

    // Fetch individual payment transactions (each payment = separate entry)
    const { data: paymentHistory = [] } = useQuery<any[]>({
        queryKey: ["/api/farm/accounts-payable/payment-history"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/accounts-payable/payment-history"); return r.json(); },
    });

    // Fallback: also show AP records that are pago/parcial but have no payable_id in transactions (legacy)
    const txPayableIds = new Set(paymentHistory.map((p: any) => p.payableId).filter(Boolean));
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
        }));

    const allPayments = [...paymentHistory, ...legacyPaid]
        .sort((a: any, b: any) => new Date(b.paidDate).getTime() - new Date(a.paidDate).getTime());

    const filteredPaid = allPayments.filter((i: any) =>
        !searchTerm || i.supplier?.toLowerCase().includes(searchTerm.toLowerCase()) || i.apDescription?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Each payment is its own entry (no grouping that merges partial + final)
    const groups: { key: string; date: string; supplier: string; items: any[]; total: number; currency: string; receiptNumber: string }[] = [];
    for (const item of filteredPaid) {
        const dateStr = item.paidDate ? new Date(item.paidDate).toLocaleDateString("pt-BR") : "—";
        const key = item.id; // unique per payment transaction
        groups.push({
            key,
            date: dateStr,
            supplier: item.supplier || "—",
            items: [item],
            total: parseFloat(item.amount || 0),
            currency: item.currency || "USD",
            receiptNumber: item.receiptNumber || "",
        });
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
                <div className="flex items-center gap-3">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            placeholder="Buscar no historico..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-10 bg-white border-0 shadow-sm h-10"
                        />
                    </div>
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
                                    return (
                                        <tr key={group.key} className="hover:bg-emerald-50/20 transition-colors">
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-3">
                                                    <div className={`h-8 w-8 rounded-full ${avatarColor(group.supplier)} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                                                        {(group.supplier || "?")[0].toUpperCase()}
                                                    </div>
                                                    <span className="font-semibold text-gray-900 truncate max-w-[160px]">{group.supplier}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3.5 text-gray-500 max-w-[180px] truncate">{item?.apDescription || "--"}</td>
                                            <td className="px-4 py-3.5 text-sm text-gray-700">{group.date}</td>
                                            <td className="px-3 py-3.5 text-center">
                                                {item?.installmentNumber ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[11px] font-medium">
                                                        {item.installmentNumber}/{item.totalInstallments}
                                                    </span>
                                                ) : <span className="text-gray-300">--</span>}
                                            </td>
                                            <td className="px-3 py-3.5 text-center">{methodLabel(item?.paymentMethod)}</td>
                                            <td className="px-3 py-3.5 text-center">
                                                {group.receiptNumber ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />#{group.receiptNumber}
                                                    </span>
                                                ) : item?.receiptFileUrl ? (
                                                    <a href={item.receiptFileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-600 hover:underline inline-flex items-center gap-1">
                                                        <Receipt className="h-3 w-3" /> Ver
                                                    </a>
                                                ) : <span className="text-gray-300">--</span>}
                                            </td>
                                            <td className="px-5 py-3.5 text-right font-extrabold text-green-600 font-headline">
                                                {formatCurrency(group.total, group.currency)}
                                            </td>
                                            <td className="px-5 py-3.5 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-blue-600" onClick={() => openEditModal(item)} aria-label="Editar">
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-red-600" disabled={reversing} onClick={() => onReverse(item.payableId || item.id)} aria-label="Excluir">
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Dialog de edição do histórico — mesmo modal de pagamento */}
            <Dialog open={!!editingHistItem} onOpenChange={o => !o && setEditingHistItem(null)}>
                <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
                    <DialogHeader className="px-6 pt-5 pb-3 border-b">
                        <DialogTitle>Editar Pagamento</DialogTitle>
                    </DialogHeader>
                    {editingHistItem && (
                        <>
                            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                                {/* Resumo da conta */}
                                <div className="bg-gray-50 rounded-lg border p-3">
                                    <p className="text-xs font-semibold text-gray-500 mb-2">Conta selecionada</p>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-700">{editingHistItem.supplier} - {editingHistItem.description || "Sem descricao"} ({editingHistItem.installmentNumber}/{editingHistItem.totalInstallments})</span>
                                        <span className="font-mono font-semibold text-red-600">{formatCurrency(parseFloat(editingHistItem.totalAmount), editingHistItem.currency || "USD")}</span>
                                    </div>
                                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
                                        <span className="text-sm font-bold text-gray-800">Total da conta</span>
                                        <span className="text-lg font-bold text-red-600">{formatCurrency(parseFloat(editingHistItem.totalAmount), editingHistItem.currency || "USD")}</span>
                                    </div>
                                </div>

                                {/* Forma de pagamento */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <Label className="font-semibold text-emerald-800">Forma de Pagamento</Label>
                                        <Button type="button" variant="outline" size="sm" className="h-7 text-xs border-emerald-200 text-emerald-700" onClick={addEditRow}>
                                            <PlusCircle className="mr-1 h-3 w-3" /> Adicionar metodo
                                        </Button>
                                    </div>
                                    {editPaymentRows.map((row, idx) => (
                                        <div key={idx} className="grid grid-cols-3 gap-3 items-end">
                                            <div>
                                                <Label className="text-xs text-gray-500">Conta Bancaria *</Label>
                                                <Select value={row.accountId} onValueChange={v => updateEditRow(idx, "accountId", v)}>
                                                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                                    <SelectContent>
                                                        {accounts.map((a: any) => (
                                                            <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div>
                                                <Label className="text-xs text-gray-500">Valor * (parcial ou total)</Label>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    min="0.01"
                                                    placeholder="0.00"
                                                    value={row.amount}
                                                    onChange={e => updateEditRow(idx, "amount", e.target.value)}
                                                    className="font-mono"
                                                />
                                            </div>
                                            <div className="flex gap-2 items-end">
                                                <div className="flex-1">
                                                    <Label className="text-xs text-gray-500">Metodo</Label>
                                                    <Select value={row.paymentMethod} onValueChange={v => updateEditRow(idx, "paymentMethod", v)}>
                                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="transferencia">Transferencia</SelectItem>
                                                            <SelectItem value="dinheiro">Dinheiro</SelectItem>
                                                            <SelectItem value="cheque">Cheque</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                {editPaymentRows.length > 1 && (
                                                    <Button type="button" variant="ghost" size="sm" className="text-red-400 hover:text-red-600 h-10" onClick={() => removeEditRow(idx)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Cheque fields */}
                                {editHasChequeMethod && (
                                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 space-y-3">
                                        {emitidoCheques.length > 0 && (
                                            <div>
                                                <Label className="text-xs text-blue-700">Selecionar Cheque Existente</Label>
                                                <Select value={editSelectedChequeId} onValueChange={(id) => {
                                                    setEditSelectedChequeId(id);
                                                    const ch = emitidoCheques.find((c: any) => String(c.id) === id);
                                                    if (ch) {
                                                        setEditChequeBanco(ch.bank || "");
                                                        setEditChequeNumero(ch.cheque_number || ch.chequeNumber || "");
                                                        setEditChequeTipo(ch.type || "proprio");
                                                    }
                                                }}>
                                                    <SelectTrigger><SelectValue placeholder="Selecionar cheque emitido..." /></SelectTrigger>
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
                                            <div><Label className="text-xs text-blue-700">Banco *</Label><Input value={editChequeBanco} onChange={e => setEditChequeBanco(e.target.value)} placeholder="Nome do banco" /></div>
                                            <div><Label className="text-xs text-blue-700">Numero *</Label><Input value={editChequeNumero} onChange={e => setEditChequeNumero(e.target.value)} placeholder="000000" /></div>
                                            <div><Label className="text-xs text-blue-700">Tipo</Label>
                                                <Select value={editChequeTipo} onValueChange={setEditChequeTipo}>
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="proprio">Proprio</SelectItem>
                                                        <SelectItem value="terceiro">Terceiro</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {editPaymentRows.length > 1 && (
                                    <p className={`text-xs font-medium ${Math.abs(editTotalAllocated - parseFloat(editingHistItem.totalAmount)) < 0.01 ? "text-green-600" : "text-amber-600"}`}>
                                        Total alocado: {formatCurrency(editTotalAllocated)} / Total da conta: {formatCurrency(parseFloat(editingHistItem.totalAmount))}
                                    </p>
                                )}

                                {/* Recibo do fornecedor */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                                    <div>
                                        <Label className="text-xs text-gray-500">Nº Recibo do Fornecedor</Label>
                                        <Input
                                            placeholder="Ex: 001-001-0000123"
                                            value={editReceiptNumber}
                                            disabled
                                            className="bg-gray-100 cursor-not-allowed"
                                        />
                                        <p className="text-xs text-gray-400 mt-1">Numero do recibo nao pode ser alterado</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs text-gray-500">Importar Recibo (PDF/imagem)</Label>
                                        <input
                                            type="file"
                                            accept=".pdf,.jpg,.jpeg,.png"
                                            className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 border border-gray-200 rounded-md px-2 py-1.5 cursor-pointer"
                                            onChange={e => {
                                                const file = e.target.files?.[0];
                                                if (!file) return;
                                                setEditReceiptFile(file);
                                                const reader = new FileReader();
                                                reader.onload = ev => setEditReceiptFileUrl(ev.target?.result as string);
                                                reader.readAsDataURL(file);
                                            }}
                                        />
                                        {editReceiptFile && <p className="text-xs text-emerald-600 mt-1">✓ {editReceiptFile.name}</p>}
                                        {!editReceiptFile && editReceiptFileUrl && <p className="text-xs text-emerald-600 mt-1">✓ Recibo existente</p>}
                                    </div>
                                </div>
                            </div>

                            {/* Footer fixo */}
                            <div className="px-6 py-3 border-t bg-gray-50 flex items-center justify-end gap-3">
                                <Button variant="outline" onClick={() => setEditingHistItem(null)}>Cancelar</Button>
                                <Button
                                    className="bg-green-600 hover:bg-green-700"
                                    disabled={paying || !editAllRowsValid || (editHasChequeMethod && (!editChequeBanco || !editChequeNumero))}
                                    onClick={handleConfirmEdit}
                                >
                                    {paying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckSquare className="mr-2 h-4 w-4" />}
                                    Salvar Alteracoes
                                </Button>
                            </div>
                        </>
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
