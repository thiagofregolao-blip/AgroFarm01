import { useState, useMemo, useEffect, useRef } from "react";
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
import {
    Receipt, Loader2, AlertTriangle, CheckCircle, Clock, Download, CheckSquare,
    PlusCircle, Trash2, Pencil, History, Search, CreditCard, Plus, Printer, Settings, RefreshCw,
    BarChart3, CalendarDays, DollarSign
} from "lucide-react";

// ─── CSV export utility ──────────────────────────────────────────────────────
function exportToCSV(data: any[], filename: string) {
    if (!data.length) return;
    const headers = ["Comprador", "Descricao", "Parcela", "Nro Fatura", "Vencimento", "Status", "Valor Total", "Recebido"];
    const rows = data.map((i: any) => [
        i.buyer,
        i.description || "",
        `${i.installmentNumber || 1}/${i.totalInstallments || 1}`,
        i.invoiceNumber || "",
        i.dueDate ? new Date(i.dueDate).toLocaleDateString("pt-BR") : "",
        i.status,
        formatCurrency(i.totalAmount),
        formatCurrency(i.receivedAmount || 0),
    ]);
    const csv = [headers, ...rows].map(r => r.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}

export default function AccountsReceivable() {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { user } = useAuth();
    const [openCreate, setOpenCreate] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [printingId, setPrintingId] = useState<string | null>(null);
    const [timbradoConfigOpen, setTimbradoConfigOpen] = useState(false);
    const [viewingNotasId, setViewingNotasId] = useState<string | null>(null);

    // Fetch detail with items when editing
    const { data: editingDetail } = useQuery({
        queryKey: ["/api/farm/accounts-receivable", editingItemId],
        queryFn: async () => {
            const r = await apiRequest("GET", `/api/farm/accounts-receivable/${editingItemId}`);
            return r.json();
        },
        enabled: !!editingItemId,
    });

    // Open edit with detail loaded
    function openEdit(item: any) {
        setEditingItemId(item.id);
        setEditingItem(item);
    }

    // Filters
    const [pageSize, setPageSize] = useState(15);
    const [filterStatus, setFilterStatus] = useState("todos");
    const [filterFrom, setFilterFrom] = useState("");
    const [filterTo, setFilterTo] = useState("");
    const [filterSupplier, setFilterSupplier] = useState("todos");
    const [filterSeason, setFilterSeason] = useState("todos");

    const { data: items = [], isLoading } = useQuery({
        queryKey: ["/api/farm/accounts-receivable"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/accounts-receivable"); return r.json(); },
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
    const { data: seasons = [] } = useQuery({
        queryKey: ["/api/farm/seasons"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/seasons"); return r.json(); },
        enabled: !!user,
    });
    const { data: products = [] } = useQuery({
        queryKey: ["/api/farm/products"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/products"); return r.json(); },
        enabled: !!user,
    });
    const { data: stockByDeposit = [] } = useQuery({
        queryKey: ["/api/farm/stock/by-deposit"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/stock/by-deposit"); return r.json(); },
        enabled: !!user,
    });
    const { data: grainStock = [] } = useQuery({
        queryKey: ["/api/farm/grain-stock"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/grain-stock"); return r.json(); },
        enabled: !!user,
    });
    const { data: invoiceConfig } = useQuery({
        queryKey: ["/api/farm/invoice-config"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/invoice-config"); return r.json(); },
        enabled: !!user,
    });

    // Filtered list (mirror AP logic)
    function isItemOverdue(item: any) {
        if (item.status === "recebido") return false;
        if (!item.dueDate) return false;
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const due = new Date(item.dueDate); due.setHours(0, 0, 0, 0);
        return (item.status === "pendente" || item.status === "parcial") && due < today;
    }

    const activeItems = (items as any[]).filter((i: any) => i.status !== "anulado");

    const filtered = activeItems.filter((i: any) => {
        const overdue = isItemOverdue(i);
        const statusCheck =
            filterStatus === "todos" ? true :
            filterStatus === "vencido" ? overdue :
            i.status === filterStatus;
        const dateCheck =
            (!filterFrom || new Date(i.dueDate) >= new Date(filterFrom)) &&
            (!filterTo || new Date(i.dueDate) <= new Date(filterTo));
        const supplierCheck = filterSupplier === "todos" || i.buyer === filterSupplier ||
            String(i.supplier_id || i.supplierId || "") === filterSupplier;
        const seasonCheck = filterSeason === "todos" || String(i.season_id || i.seasonId || "") === filterSeason;
        return statusCheck && dateCheck && supplierCheck && seasonCheck;
    });

    const totalPendente = activeItems.filter((i: any) => i.status === "pendente" || i.status === "parcial")
        .reduce((s: number, i: any) => s + parseFloat(i.totalAmount) - parseFloat(i.receivedAmount || 0), 0);
    const totalVencido = activeItems.filter((i: any) => isItemOverdue(i))
        .reduce((s: number, i: any) => s + parseFloat(i.totalAmount) - parseFloat(i.receivedAmount || 0), 0);

    const receive = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: any }) => {
            const { paymentRows, cheques, buyerName } = data;
            const totalAmount = paymentRows.reduce((s: number, r: any) => s + parseFloat(r.amount || 0), 0);
            const createdCheques: any[] = [];
            for (const ch of (cheques || [])) {
                const r = await apiRequest("POST", "/api/farm/cheques", {
                    type: "recebido", chequeNumber: String(ch.numero || ""), bank: String(ch.banco || ""),
                    holder: String(ch.titular || ""), amount: String(ch.valor || "0"), currency: String(ch.currency || "USD"),
                    issueDate: ch.emissao ? new Date(ch.emissao).toISOString() : new Date().toISOString(),
                    dueDate: ch.vencimento ? new Date(ch.vencimento).toISOString() : null, relatedReceivableId: String(id),
                });
                createdCheques.push(await r.json());
            }
            for (const row of paymentRows) {
                await apiRequest("POST", `/api/farm/accounts-receivable/${id}/receive`, {
                    accountId: row.accountId, amount: row.amount, paymentMethod: row.paymentMethod,
                });
            }
            const paymentMethods = paymentRows.map((row: any, idx: number) => ({
                method: row.paymentMethod, accountId: row.accountId, amount: row.amount,
                chequeId: row.paymentMethod === "cheque" && createdCheques[idx] ? createdCheques[idx].id : undefined,
            }));
            const item = (items as any[]).find((i: any) => i.id === id);
            const remaining = item ? parseFloat(item.totalAmount) - parseFloat(item.receivedAmount || 0) : totalAmount;
            const paymentType = totalAmount >= remaining ? "total" : "parcial";
            const receiptRes = await apiRequest("POST", "/api/farm/receipts", {
                type: "recebimento", entity: buyerName, totalAmount: totalAmount.toFixed(2), paymentType,
                paymentMethods, invoiceRefs: [{ receivableId: id, amount: totalAmount.toFixed(2) }],
            });
            return receiptRes.json();
        },
        onSuccess: (receipt: any) => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/accounts-receivable"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/cash-accounts"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/cash-transactions"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/cash-summary"] });
            toast({ title: `Recebimento registrado! Recibo #${receipt?.receipt_number || receipt?.receiptNumber || ""}` });
        },
    });

    const anular = useMutation({
        mutationFn: async ({ id, reason }: { id: string; reason: string }) =>
            apiRequest("POST", `/api/farm/accounts-receivable/${id}/anular`, { reason }),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/farm/accounts-receivable"] }); toast({ title: "Conta a receber anulada" }); },
    });

    const editMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: any }) => apiRequest("PUT", `/api/farm/accounts-receivable/${id}`, data),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/farm/accounts-receivable"] }); toast({ title: "Atualizado" }); setEditingItem(null); setEditingItemId(null); },
        onError: () => toast({ title: "Erro ao atualizar", variant: "destructive" }),
    });

    const save = useMutation({
        mutationFn: async (data: any) => {
            const r = await apiRequest("POST", "/api/farm/accounts-receivable", data);
            return r.json();
        },
        onError: (err: Error) => {
            const match = err.message.match(/^\d+: (.+)$/);
            let msg = err.message;
            if (match) { try { msg = JSON.parse(match[1]).error || match[1]; } catch { msg = match[1]; } }
            toast({ title: msg || "Erro ao registrar conta a receber", variant: "destructive" });
        },
        onSuccess: (result: any) => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/accounts-receivable"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/invoice-config"] });
            toast({ title: "Conta(s) a receber registrada(s)" });
            setOpenCreate(false);
            // Auto-print: open print for first created AR
            const createdId = Array.isArray(result) ? result[0]?.id : result?.id;
            if (createdId) {
                setTimeout(() => setPrintingId(createdId), 300);
            }
        },
    });

    // ─── Search state for main tab ─────────────────────────────────────────
    const [searchTerm, setSearchTerm] = useState("");

    const searchFiltered = filtered.filter((i: any) =>
        !searchTerm ||
        i.buyer?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        i.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // ─── KPI Calculations ───────────────────────────────────────────────────
    const kpiTotalReceivable = useMemo(() => {
        return activeItems
            .filter((i: any) => i.status === "pendente" || i.status === "parcial")
            .reduce((s: number, i: any) => s + parseFloat(i.totalAmount) - parseFloat(i.receivedAmount || 0), 0);
    }, [items]);

    const kpiOverdue = useMemo(() => {
        const overdueItems = activeItems.filter((i: any) => isItemOverdue(i));
        return {
            count: overdueItems.length,
            sum: overdueItems.reduce((s: number, i: any) => s + parseFloat(i.totalAmount) - parseFloat(i.receivedAmount || 0), 0),
        };
    }, [items]);

    const kpiReceivedThisMonth = useMemo(() => {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        return activeItems
            .filter((i: any) => i.status === "recebido" && i.updatedAt && new Date(i.updatedAt) >= monthStart)
            .reduce((s: number, i: any) => s + parseFloat(i.receivedAmount || i.totalAmount || 0), 0);
    }, [items]);

    const kpiNext7Days = useMemo(() => {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const in7 = new Date(today); in7.setDate(in7.getDate() + 7);
        return activeItems
            .filter((i: any) => {
                if (i.status === "recebido") return false;
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
            const monthItems = activeItems.filter((it: any) => {
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
            pendente: { dot: "bg-red-500", bg: "bg-red-50 text-red-700 ring-1 ring-red-200", label: "ABERTO" },
            parcial: { dot: "bg-yellow-500", bg: "bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200", label: "PARCIAL" },
            recebido: { dot: "bg-green-500", bg: "bg-green-50 text-green-700 ring-1 ring-green-200", label: "PAGO" },
            vencido: { dot: "bg-red-500", bg: "bg-red-50 text-red-700 ring-1 ring-red-200", label: "VENCIDO" },
        };
        const cfg = map[s] || map.pendente;
        return (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${cfg.bg}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                {cfg.label}
            </span>
        );
    };

    // Avatar color from buyer name
    const avatarColor = (name: string) => {
        const colors = ["bg-emerald-600", "bg-blue-600", "bg-purple-600", "bg-amber-600", "bg-rose-600", "bg-teal-600", "bg-indigo-600", "bg-orange-600"];
        let hash = 0;
        for (let i = 0; i < (name || "").length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
        return colors[Math.abs(hash) % colors.length];
    };

    // Unique buyer names for filter
    const buyerNames = Array.from(new Set((items as any[]).map((i: any) => i.buyer).filter(Boolean))) as string[];

    return (
        <FarmLayout>
            {/* Manrope font */}
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap'); .font-headline { font-family: 'Manrope', sans-serif; }`}</style>

            <div className="space-y-6">
                {/* ── SECTION 1: PAGE HEADER ─────────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Left: Title */}
                    <div className="lg:col-span-4">
                        <p className="text-[10px] uppercase tracking-widest font-bold text-emerald-700 mb-1">FINANCEIRO {'>'} CONTAS A RECEBER</p>
                        <h1 className="text-4xl font-extrabold font-headline text-gray-900 leading-tight">Contas a Receber</h1>
                        <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                            Gerencie seus recebimentos, acompanhe vencimentos e registre pagamentos recebidos.
                        </p>
                        <div className="flex gap-2 mt-4 flex-wrap">
                            <Button variant="outline" size="sm" className="text-gray-600 h-8 text-xs" onClick={() => queryClient.invalidateQueries()}>
                                <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Atualizar
                            </Button>
                            <Button variant="outline" size="sm" className="text-gray-600 h-8 text-xs" onClick={() => exportToCSV(filtered, "contas-a-receber.csv")}>
                                <Download className="mr-1.5 h-3.5 w-3.5" /> CSV
                            </Button>
                            <Button variant="outline" size="sm" className="text-gray-600 h-8 text-xs" onClick={() => setTimbradoConfigOpen(true)}>
                                <Settings className="mr-1.5 h-3.5 w-3.5" /> Timbrado
                            </Button>
                            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-8 text-xs" onClick={() => setOpenCreate(true)}>
                                <Plus className="mr-1.5 h-3.5 w-3.5" /> Nova Conta
                            </Button>
                        </div>
                    </div>

                    {/* Right: KPI Cards */}
                    <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {/* Total a Receber */}
                        <div className="bg-white rounded-xl shadow-sm border-l-4 border-emerald-600 p-5">
                            <div className="flex items-center gap-2 mb-2">
                                <DollarSign className="h-4 w-4 text-emerald-700" />
                                <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Total a Receber</span>
                            </div>
                            <p className="text-2xl font-extrabold font-headline text-gray-900">
                                {kpiTotalReceivable.toLocaleString("pt-BR", { style: "currency", currency: "USD" })}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">{activeItems.filter((i: any) => i.status !== "recebido").length} titulos pendentes</p>
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

                        {/* Recebidos (Mes) */}
                        <div className="bg-white rounded-xl shadow-sm border-l-4 border-green-600 p-5">
                            <div className="flex items-center gap-2 mb-2">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Recebidos (Mes)</span>
                            </div>
                            <p className="text-2xl font-extrabold font-headline text-green-600">
                                {kpiReceivedThisMonth.toLocaleString("pt-BR", { style: "currency", currency: "USD" })}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">no mes atual</p>
                        </div>
                    </div>
                </div>

                {/* Tabs: Contas / Recebimento / Historico */}
                <Tabs defaultValue="contas">
                    <TabsList className="bg-gray-100 p-1 h-10 rounded-lg">
                        <TabsTrigger value="contas" className="text-[13px] font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm px-5 rounded-md">Contas</TabsTrigger>
                        <TabsTrigger value="recebimento" className="text-[13px] font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm px-5 rounded-md">Recebimento</TabsTrigger>
                        <TabsTrigger value="historico" className="text-[13px] font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm px-5 rounded-md">Historico e Recibos</TabsTrigger>
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
                                            placeholder="Buscar comprador ou descricao..."
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
                                            <SelectItem value="pendente">Pendente</SelectItem>
                                            <SelectItem value="parcial">Parcial</SelectItem>
                                            <SelectItem value="recebido">Recebido</SelectItem>
                                            <SelectItem value="vencido">Vencido</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Select value={filterSupplier} onValueChange={setFilterSupplier}>
                                        <SelectTrigger className="w-44 bg-white border-0 shadow-sm h-10"><SelectValue placeholder="Cliente" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="todos">Todos</SelectItem>
                                            {buyerNames.map((name) => (
                                                <SelectItem key={name} value={name}>{name}</SelectItem>
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
                                <span className="text-xs text-gray-400 ml-auto self-center">{searchFiltered.length} de {activeItems.length}</span>
                            </div>
                        </div>

                        {/* ── SECTION 3: DATA TABLE ───────────────────────────── */}
                        {isLoading ? (
                            <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
                        ) : searchFiltered.length === 0 ? (
                            <div className="bg-white rounded-xl shadow-sm py-16 text-center">
                                <Receipt className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                                <p className="text-gray-500 font-medium">Nenhuma conta a receber encontrada</p>
                                <p className="text-xs text-gray-400 mt-1">Tente ajustar os filtros</p>
                            </div>
                        ) : (
                            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-gray-50">
                                                <th className="text-left px-5 py-3.5 text-[11px] uppercase tracking-wider font-bold text-gray-400">Comprador</th>
                                                <th className="text-left px-4 py-3.5 text-[11px] uppercase tracking-wider font-bold text-gray-400">Descricao</th>
                                                <th className="text-center px-3 py-3.5 text-[11px] uppercase tracking-wider font-bold text-gray-400">Parcela</th>
                                                <th className="text-left px-4 py-3.5 text-[11px] uppercase tracking-wider font-bold text-gray-400">Vencimento</th>
                                                <th className="text-center px-3 py-3.5 text-[11px] uppercase tracking-wider font-bold text-gray-400">Status</th>
                                                <th className="text-right px-5 py-3.5 text-[11px] uppercase tracking-wider font-bold text-gray-400">Valor</th>
                                                <th className="text-right px-4 py-3.5 text-[11px] uppercase tracking-wider font-bold text-gray-400">Recebido</th>
                                                <th className="text-right px-5 py-3.5 text-[11px] uppercase tracking-wider font-bold text-gray-400">Acoes</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {searchFiltered.slice(0, pageSize).map((item: any) => {
                                                const today = new Date(); today.setHours(0, 0, 0, 0);
                                                const due = item.dueDate ? new Date(item.dueDate) : null;
                                                if (due) due.setHours(0, 0, 0, 0);
                                                const isOverdue = !!due && (item.status === "pendente" || item.status === "parcial") && due < today;
                                                return (
                                                    <tr key={item.id} className="hover:bg-emerald-50/20 transition-colors">
                                                        {/* Comprador with avatar */}
                                                        <td className="px-5 py-3.5">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`h-8 w-8 rounded-full ${avatarColor(item.buyer || "")} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                                                                    {(item.buyer || "?")[0].toUpperCase()}
                                                                </div>
                                                                <span className="font-semibold text-gray-900 truncate max-w-[160px]">{item.buyer}</span>
                                                            </div>
                                                        </td>
                                                        {/* Descricao */}
                                                        <td className="px-4 py-3.5 text-gray-500 max-w-[180px] truncate">{item.description || "--"}</td>
                                                        {/* Parcela */}
                                                        <td className="px-3 py-3.5 text-center">
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[11px] font-medium">
                                                                {item.installmentNumber || 1}/{item.totalInstallments || 1}
                                                            </span>
                                                        </td>
                                                        {/* Vencimento */}
                                                        <td className={`px-4 py-3.5 text-sm ${isOverdue ? "text-red-600 font-semibold" : "text-gray-700"}`}>
                                                            {item.dueDate ? new Date(item.dueDate).toLocaleDateString("pt-BR") : "--"}
                                                        </td>
                                                        {/* Status */}
                                                        <td className="px-3 py-3.5 text-center">{statusBadge(isOverdue && item.status !== "recebido" ? "vencido" : item.status)}</td>
                                                        {/* Valor */}
                                                        <td className="px-5 py-3.5 text-right font-extrabold text-gray-900 font-headline">
                                                            {formatCurrency(item.totalAmount)}
                                                        </td>
                                                        {/* Recebido */}
                                                        <td className="px-4 py-3.5 text-right font-semibold text-green-600">
                                                            {parseFloat(item.receivedAmount || 0) > 0 ? formatCurrency(item.receivedAmount) : <span className="text-gray-300">--</span>}
                                                        </td>
                                                        {/* Acoes */}
                                                        <td className="px-5 py-3.5 text-right">
                                                            <div className="flex items-center justify-end gap-1">
                                                                {item.invoiceNumber && (
                                                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-emerald-600" onClick={() => setPrintingId(item.id)} aria-label="Imprimir fatura">
                                                                        <Printer className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                )}
                                                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-blue-600" onClick={() => setViewingNotasId(item.id)} aria-label="Ver notas">
                                                                    <Receipt className="h-3.5 w-3.5" />
                                                                </Button>
                                                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-blue-600" onClick={() => openEdit(item)} aria-label="Editar">
                                                                    <Pencil className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                {activeItems.length > 15 && (
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
                            {/* Proximos Vencimentos */}
                            <div className="bg-white rounded-xl shadow-sm p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <CalendarDays className="h-4 w-4 text-emerald-600" />
                                    <h3 className="font-headline font-bold text-gray-900">Proximos Vencimentos</h3>
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
                                                    <div className={`h-6 w-6 rounded-full ${avatarColor(item.buyer || "")} flex items-center justify-center text-white text-[10px] font-bold`}>
                                                        {(item.buyer || "?")[0].toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-800 truncate max-w-[140px]">{item.buyer}</p>
                                                        <p className="text-[10px] text-gray-400">{new Date(item.dueDate).toLocaleDateString("pt-BR")}</p>
                                                    </div>
                                                </div>
                                                <span className="font-headline font-bold text-gray-900 text-sm">
                                                    {formatCurrency(parseFloat(item.totalAmount) - parseFloat(item.receivedAmount || 0))}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Fluxo de Receitas */}
                            <div className="bg-emerald-950 rounded-xl shadow-sm p-5 relative overflow-hidden">
                                {/* Decorative blur circle */}
                                <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-500/20 rounded-full blur-3xl" />
                                <div className="relative z-10">
                                    <div className="flex items-center gap-2 mb-4">
                                        <BarChart3 className="h-4 w-4 text-emerald-400" />
                                        <h3 className="font-headline font-bold text-white">Fluxo de Receitas</h3>
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

                    {/* ── RECEBIMENTO TAB ──────────────────────────────────── */}
                    <TabsContent value="recebimento" className="space-y-4 mt-4">
                        <RecebimentoTab
                            items={activeItems}
                            accounts={accounts as any[]}
                            seasons={seasons as any[]}
                            onReceive={(id, data) => receive.mutate({ id, data })}
                            receiving={receive.isPending}
                        />
                    </TabsContent>

                    {/* ── HISTORICO TAB ──────────────────────────────────────── */}
                    <TabsContent value="historico" className="mt-4">
                        <HistoricoTab items={items as any[]} />
                    </TabsContent>
                </Tabs>

                {/* Create Dialog */}
                <Dialog open={openCreate} onOpenChange={(o) => { if (!o) save.reset(); setOpenCreate(o); }}>
                    <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
                        <DialogHeader className="px-6 pt-5 pb-3 border-b">
                            <DialogTitle>Nova Conta a Receber</DialogTitle>
                        </DialogHeader>
                        {save.isError && (
                            <div className="px-6 py-2 bg-red-50 border-b border-red-200">
                                <p className="text-sm text-red-700 font-medium">
                                    {(() => { const m = (save.error as Error)?.message || ""; const match = m.match(/^\d+: (.+)$/); if (match) { try { return JSON.parse(match[1]).error || match[1]; } catch { return match[1]; } } return m || "Erro ao registrar"; })()}
                                </p>
                            </div>
                        )}
                        <div className="flex-1 overflow-y-auto px-6 py-4">
                            <CreateARForm
                                suppliers={suppliers as any[]}
                                seasons={seasons as any[]}
                                products={products as any[]}
                                stockByDeposit={stockByDeposit as any[]}
                                grainStock={grainStock as any[]}
                                invoiceConfig={invoiceConfig}
                                onSave={(data: any) => save.mutate(data)}
                                saving={save.isPending}
                            />
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Edit Dialog -- reuses CreateARForm pre-populated */}
                <Dialog open={!!editingItem} onOpenChange={(o) => { if (!o) { setEditingItem(null); setEditingItemId(null); } }}>
                    <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
                        <DialogHeader className="px-6 pt-5 pb-3 border-b">
                            <DialogTitle>Editar Conta a Receber</DialogTitle>
                        </DialogHeader>
                        <div className="flex-1 overflow-y-auto px-6 py-4">
                            {editingItem && (
                                <CreateARForm
                                    suppliers={suppliers as any[]}
                                    seasons={seasons as any[]}
                                    products={products as any[]}
                                    stockByDeposit={stockByDeposit as any[]}
                                    grainStock={grainStock as any[]}
                                    invoiceConfig={invoiceConfig}
                                    initialData={editingDetail || editingItem}
                                    onSave={(data: any) => editMutation.mutate({ id: editingItem.id, data })}
                                    saving={editMutation.isPending}
                                />
                            )}
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Print Overlay */}
                {printingId && (
                    <InvoicePrintOverlay receivableId={printingId} onClose={() => setPrintingId(null)} />
                )}

                {/* Ver Notas Emitidas Dialog */}
                <Dialog open={!!viewingNotasId} onOpenChange={o => !o && setViewingNotasId(null)}>
                    <DialogContent className="max-w-lg">
                        <DialogHeader><DialogTitle>Notas Emitidas</DialogTitle></DialogHeader>
                        {viewingNotasId && <ViewNotasContent receivableId={viewingNotasId} items={items as any[]} />}
                    </DialogContent>
                </Dialog>

                {/* Timbrado Config Dialog */}
                <Dialog open={timbradoConfigOpen} onOpenChange={setTimbradoConfigOpen}>
                    <DialogContent className="max-w-lg">
                        <DialogHeader><DialogTitle>Configuracao do Timbrado</DialogTitle></DialogHeader>
                        <TimbradoConfigForm config={invoiceConfig} onSaved={() => {
                            queryClient.invalidateQueries({ queryKey: ["/api/farm/invoice-config"] });
                            setTimbradoConfigOpen(false);
                            toast({ title: "Timbrado configurado" });
                        }} />
                    </DialogContent>
                </Dialog>
            </div>
        </FarmLayout>
    );
}

// ─── Create AR Form (complete with items, IVA, parcelas) ──────────────────────
function CreateARForm({ suppliers, seasons, products, stockByDeposit, grainStock, invoiceConfig, onSave, saving, initialData }: {
    suppliers: any[]; seasons: any[]; products: any[]; stockByDeposit?: any[]; grainStock?: any[]; invoiceConfig: any; onSave: (data: any) => void; saving: boolean;
    initialData?: any;
}) {
    const { toast } = useToast();
    const ed = initialData;
    const [buyer, setBuyer] = useState(ed?.buyer || "");
    const [buyerSearch, setBuyerSearch] = useState("");
    const [supplierId, setSupplierId] = useState(ed?.supplier_id || ed?.supplierId ? String(ed.supplier_id || ed.supplierId) : "__none__");
    const [customerRuc, setCustomerRuc] = useState(ed?.customerRuc || ed?.customer_ruc || "");
    const [customerAddress, setCustomerAddress] = useState(ed?.customerAddress || ed?.customer_address || "");
    const [invoiceNumber, setInvoiceNumber] = useState(ed?.invoiceNumber || ed?.invoice_number || "");
    const [emissionDate, setEmissionDate] = useState(
        ed?.createdAt ? new Date(ed.createdAt).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]
    );
    const [paymentCondition, setPaymentCondition] = useState(ed?.paymentCondition || ed?.payment_condition || "contado");
    const [seasonId, setSeasonId] = useState(String(ed?.seasonId || ed?.season_id || "__none__"));
    const [totalInstallments, setTotalInstallments] = useState(ed?.totalInstallments || ed?.total_installments || 1);
    const [customDueDate, setCustomDueDate] = useState(false);
    const [dueDate, setDueDate] = useState(
        ed?.dueDate ? new Date(ed.dueDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]
    );
    const [observation, setObservation] = useState(ed?.observation || "");
    const [items, setItems] = useState<{
        productId: string; productName: string; unit: string;
        quantity: string; unitPrice: string; ivaRate: string;
    }[]>(
        ed?.items?.length > 0
            ? ed.items.map((it: any) => ({
                productId: it.productId || it.product_id || "",
                productName: it.productName || it.product_name || "",
                unit: it.unit || "UN",
                quantity: String(it.quantity || "1"),
                unitPrice: String(it.unitPrice || it.unit_price || ""),
                ivaRate: it.ivaRate || it.iva_rate || "10",
            }))
            : [{ productId: "", productName: "", unit: "UN", quantity: "1", unitPrice: ed ? String(ed.totalAmount || "") : "", ivaRate: "10" }]
    );

    // Re-populate items when editingDetail loads asynchronously (edit mode)
    useEffect(() => {
        if (ed?.items?.length > 0) {
            setItems(ed.items.map((it: any) => ({
                productId: it.productId || it.product_id || "",
                productName: it.productName || it.product_name || "",
                unit: it.unit || "UN",
                quantity: String(it.quantity || "1"),
                unitPrice: String(it.unitPrice || it.unit_price || ""),
                ivaRate: it.ivaRate || it.iva_rate || "10",
            })));
        }
    }, [ed?.id, ed?.items?.length]);

    const isEditMode = !!initialData;

    const [autoNumberLoading, setAutoNumberLoading] = useState(false);
    const [productPickerOpen, setProductPickerOpen] = useState(false);
    const [productPickerTab, setProductPickerTab] = useState("insumos");
    const [pickerSearch, setPickerSearch] = useState("");

    // Filter suppliers by search
    const filteredSuppliers = suppliers.filter(s =>
        !buyerSearch || s.name?.toLowerCase().includes(buyerSearch.toLowerCase())
    );

    // When supplier selected, fill buyer + RUC + address
    function selectSupplier(id: string) {
        setSupplierId(id);
        if (id === "__none__") { setBuyer(""); setCustomerRuc(""); setCustomerAddress(""); return; }
        const s = suppliers.find((s: any) => String(s.id) === id);
        if (s) {
            setBuyer(s.name || "");
            setCustomerRuc(s.ruc || s.document || "");
            setCustomerAddress(s.address || "");
        }
    }

    // Stock items separated by type for product selection
    const stockInsumos = (stockByDeposit || []).filter((s: any) =>
        s.deposit_type === "comercial" || s.depositType === "comercial"
    );
    const stockGraos = (stockByDeposit || []).filter((s: any) =>
        s.category === "Semente" || s.category === "Grao" || s.category === "Graos"
    );
    // Use stock products when available, fallback to global catalog
    const hasStockProducts = (stockByDeposit || []).length > 0;

    // When product selected, fill name + unit
    function selectProduct(idx: number, productId: string) {
        // Try stock first, then global catalog
        const stockItem = (stockByDeposit || []).find((s: any) => String(s.product_id || s.productId) === productId);
        const p = stockItem
            ? { id: stockItem.product_id || stockItem.productId, name: stockItem.product_name || stockItem.productName, unit: stockItem.unit }
            : products.find((p: any) => String(p.id) === productId);
        const next = [...items];
        next[idx] = {
            ...next[idx],
            productId,
            productName: p?.name || "",
            unit: p?.unit || "UN",
        };
        setItems(next);
    }

    function updateItem(idx: number, field: string, value: string) {
        const next = [...items];
        (next[idx] as any)[field] = value;
        setItems(next);
    }

    function addItem() {
        setItems([...items, { productId: "", productName: "", unit: "UN", quantity: "1", unitPrice: "", ivaRate: "10" }]);
    }

    function removeItem(idx: number) {
        if (items.length <= 1) return;
        setItems(items.filter((_, i) => i !== idx));
    }

    // Calculations
    const itemTotals = items.map(it => {
        const qty = parseFloat(it.quantity) || 0;
        const price = parseFloat(it.unitPrice) || 0;
        return { total: qty * price, ivaRate: it.ivaRate };
    });

    const subtotalExenta = itemTotals.filter(t => t.ivaRate === "exenta").reduce((s, t) => s + t.total, 0);
    const subtotalGravada5 = itemTotals.filter(t => t.ivaRate === "5").reduce((s, t) => s + t.total, 0);
    const subtotalGravada10 = itemTotals.filter(t => t.ivaRate === "10").reduce((s, t) => s + t.total, 0);
    const iva5 = subtotalGravada5 / 21;
    const iva10 = subtotalGravada10 / 11;
    const totalGeral = subtotalExenta + subtotalGravada5 + subtotalGravada10;

    // Due date from season
    useEffect(() => {
        if (paymentCondition === "contado") {
            setDueDate(emissionDate);
        } else if (seasonId && seasonId !== "__none__" && !customDueDate) {
            const season = seasons.find((s: any) => String(s.id) === seasonId);
            if (season?.paymentEndDate) {
                setDueDate(new Date(season.paymentEndDate).toISOString().split("T")[0]);
            }
        }
    }, [paymentCondition, seasonId, emissionDate, customDueDate, seasons]);

    async function handleAutoNumber() {
        setAutoNumberLoading(true);
        try {
            const r = await apiRequest("POST", "/api/farm/invoice-config/next");
            const data = await r.json();
            if (data.invoiceNumber) setInvoiceNumber(data.invoiceNumber);
        } catch {
            // If no config, leave manual
        }
        setAutoNumberLoading(false);
    }

    // Timbrado info
    const hasTimbrado = invoiceConfig?.timbrado;

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!buyer) { toast({ title: "Informe o comprador", variant: "destructive" }); return; }
        if (!dueDate) { toast({ title: "Informe a data de vencimento", variant: "destructive" }); return; }
        if (totalGeral <= 0) { toast({ title: "Adicione pelo menos um item com preco", variant: "destructive" }); return; }

        onSave({
            buyer,
            supplier_id: (supplierId && supplierId !== "__none__") ? supplierId : null,
            description: items.map(it => it.productName).filter(Boolean).join(", ") || "Venda",
            totalAmount: totalGeral.toFixed(2),
            dueDate,
            totalInstallments: paymentCondition === "credito" ? totalInstallments : 1,
            seasonId: seasonId === "__none__" ? null : seasonId,
            invoiceNumber: invoiceNumber || null,
            paymentCondition,
            customerRuc: customerRuc || null,
            customerAddress: customerAddress || null,
            subtotalExenta: subtotalExenta.toFixed(2),
            subtotalGravada5: subtotalGravada5.toFixed(2),
            subtotalGravada10: subtotalGravada10.toFixed(2),
            iva5: iva5.toFixed(2),
            iva10: iva10.toFixed(2),
            observation: observation || null,
            items: items.filter(it => it.productName && parseFloat(it.unitPrice) > 0).map(it => ({
                productId: it.productId || null,
                productName: it.productName,
                unit: it.unit,
                quantity: it.quantity,
                unitPrice: it.unitPrice,
                ivaRate: it.ivaRate,
                totalPrice: ((parseFloat(it.quantity) || 0) * (parseFloat(it.unitPrice) || 0)).toFixed(2),
                grainCrop: (it as any).grainCrop || null,
                grainSeasonId: (it as any).grainSeasonId || null,
                grainGranero: (it as any).grainGranero || null,
            })),
        });
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5" onKeyDown={onEnterNext as any}>
            {/* Secao 1: Dados da Fatura */}
            <div className="space-y-2">
                <h3 className="text-sm font-semibold text-emerald-800 border-b pb-1">Dados da Fatura</h3>
                <div className="grid grid-cols-3 gap-3">
                    <div>
                        <Label className="text-xs">Nro. Fatura</Label>
                        <div className="flex gap-1">
                            <Input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)}
                                placeholder={hasTimbrado ? "Auto ou manual" : "Digitar numero"}
                                className="text-sm" />
                            {hasTimbrado && (
                                <Button type="button" variant="outline" size="sm" className="h-9 px-2 text-xs shrink-0"
                                    onClick={handleAutoNumber} disabled={autoNumberLoading}>
                                    {autoNumberLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Auto"}
                                </Button>
                            )}
                        </div>
                    </div>
                    <div>
                        <Label className="text-xs">Data Emissao *</Label>
                        <Input type="date" value={emissionDate} onChange={e => setEmissionDate(e.target.value)} className="text-sm" />
                    </div>
                    <div>
                        <Label className="text-xs">Timbrado</Label>
                        <Input value={invoiceConfig?.timbrado || "Nao configurado"} disabled className="text-sm bg-gray-50" />
                        {invoiceConfig?.timbradoEndDate && (
                            <p className="text-[10px] text-gray-400 mt-0.5">
                                Vigencia ate {new Date(invoiceConfig.timbradoEndDate).toLocaleDateString("pt-BR")}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Secao 2: Cliente */}
            <div className="space-y-2">
                <h3 className="text-sm font-semibold text-emerald-800 border-b pb-1">Cliente / Comprador</h3>
                <div className="grid grid-cols-3 gap-3">
                    <div>
                        <Label className="text-xs">Cliente *</Label>
                        <Select value={supplierId} onValueChange={selectSupplier}>
                            <SelectTrigger className="text-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__none__">Selecione...</SelectItem>
                                <div className="px-2 pb-1">
                                    <Input placeholder="Buscar..." value={buyerSearch} onChange={e => setBuyerSearch(e.target.value)}
                                        className="h-7 text-xs" onClick={e => e.stopPropagation()} />
                                </div>
                                {filteredSuppliers.map((s: any) => (
                                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {supplierId === "__none__" && (
                            <Input value={buyer} onChange={e => setBuyer(e.target.value)} placeholder="Ou digite o nome..."
                                className="text-sm mt-1" />
                        )}
                    </div>
                    <div>
                        <Label className="text-xs">RUC</Label>
                        <Input value={customerRuc} onChange={e => setCustomerRuc(e.target.value)} placeholder="RUC do cliente" className="text-sm" />
                    </div>
                    <div>
                        <Label className="text-xs">Endereco</Label>
                        <Input value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} placeholder="Endereco" className="text-sm" />
                    </div>
                </div>
            </div>

            {/* Secao 3: Itens */}
            <div className="space-y-2">
                <div className="flex items-center justify-between border-b pb-1">
                    <h3 className="text-sm font-semibold text-emerald-800">Itens ({items.filter(it => it.productName).length})</h3>
                    <Button type="button" variant="outline" size="sm" className="h-7 text-xs border-emerald-200 text-emerald-700"
                        onClick={() => { setPickerSearch(""); setProductPickerOpen(true); }}>
                        <PlusCircle className="mr-1 h-3 w-3" /> Adicionar Item
                    </Button>
                </div>

                {/* Items already added */}
                {items.filter(it => it.productName).length > 0 && (
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <table className="w-full text-xs">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="text-left p-2 font-medium text-gray-600">Produto</th>
                                    <th className="text-center p-2 font-medium text-gray-600 w-28">Qtd</th>
                                    <th className="text-center p-2 font-medium text-gray-600 w-14">Un</th>
                                    <th className="text-center p-2 font-medium text-gray-600 w-32">Preco Un.</th>
                                    <th className="text-center p-2 font-medium text-gray-600 w-20">IVA</th>
                                    <th className="text-right p-2 font-medium text-gray-600 w-28">Total</th>
                                    <th className="p-2 w-8"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((it, idx) => {
                                    if (!it.productName) return null;
                                    const total = (parseFloat(it.quantity) || 0) * (parseFloat(it.unitPrice) || 0);
                                    return (
                                        <tr key={idx} className="border-t border-gray-100">
                                            <td className="p-1.5 font-medium text-gray-800">{it.productName}</td>
                                            <td className="p-1.5">
                                                <Input type="number" step="0.01" min="0" className="h-8 text-xs text-center"
                                                    value={it.quantity} onChange={e => updateItem(idx, "quantity", e.target.value)} />
                                            </td>
                                            <td className="p-1.5 text-center text-gray-500">{it.unit}</td>
                                            <td className="p-1.5">
                                                <CurrencyInput value={it.unitPrice} onValueChange={v => updateItem(idx, "unitPrice", v)}
                                                    className="h-8 text-xs text-right" prefix="" />
                                            </td>
                                            <td className="p-1.5">
                                                <Select value={it.ivaRate} onValueChange={v => updateItem(idx, "ivaRate", v)}>
                                                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="exenta">Exenta</SelectItem>
                                                        <SelectItem value="5">5%</SelectItem>
                                                        <SelectItem value="10">10%</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </td>
                                            <td className="p-1.5 text-right font-mono font-semibold">{formatCurrency(total)}</td>
                                            <td className="p-1.5">
                                                <button type="button" onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600">
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {items.filter(it => it.productName).length === 0 && (
                    <div className="border border-dashed border-gray-300 rounded-lg p-6 text-center">
                        <p className="text-gray-400 text-sm">Nenhum item adicionado</p>
                        <Button type="button" variant="outline" size="sm" className="mt-2 text-xs border-emerald-200 text-emerald-700"
                            onClick={() => { setPickerSearch(""); setProductPickerOpen(true); }}>
                            <PlusCircle className="mr-1 h-3 w-3" /> Selecionar Produtos
                        </Button>
                    </div>
                )}

                {/* ── Product Picker Dialog ── */}
                <Dialog open={productPickerOpen} onOpenChange={setProductPickerOpen}>
                    <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0">
                        <DialogHeader className="px-5 pt-4 pb-2 border-b">
                            <DialogTitle>Selecionar Produto do Estoque</DialogTitle>
                        </DialogHeader>
                        <div className="px-5 py-3">
                            <Tabs value={productPickerTab} onValueChange={setProductPickerTab}>
                                <TabsList className="bg-gray-100">
                                    <TabsTrigger value="insumos">Insumos (Comercial)</TabsTrigger>
                                    <TabsTrigger value="graos">Graos (Silos)</TabsTrigger>
                                </TabsList>

                                {/* Search */}
                                <div className="relative mt-3 mb-2">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                                    <Input placeholder="Buscar produto..." value={pickerSearch}
                                        onChange={e => setPickerSearch(e.target.value)} className="pl-9 text-sm" />
                                </div>

                                {/* Insumos Tab */}
                                <TabsContent value="insumos" className="mt-0 max-h-[45vh] overflow-y-auto">
                                    {(() => {
                                        const insumosFiltered = stockInsumos.filter((s: any) =>
                                            !pickerSearch || (s.product_name || s.productName || "").toLowerCase().includes(pickerSearch.toLowerCase())
                                        );
                                        if (insumosFiltered.length === 0) return (
                                            <div className="py-8 text-center text-gray-400 text-sm">
                                                {stockInsumos.length === 0
                                                    ? "Nenhum produto no deposito comercial. Crie um deposito comercial e adicione produtos."
                                                    : "Nenhum produto encontrado"}
                                            </div>
                                        );
                                        return (
                                            <div className="grid grid-cols-1 gap-1">
                                                {insumosFiltered.map((s: any) => {
                                                    const pid = String(s.product_id || s.productId);
                                                    const pName = s.product_name || s.productName;
                                                    const alreadyAdded = items.some(it => it.productId === pid);
                                                    return (
                                                        <button key={s.id} type="button"
                                                            className={`flex items-center justify-between w-full p-3 rounded-lg border text-left transition-colors ${alreadyAdded ? "bg-emerald-50 border-emerald-300" : "border-gray-200 hover:bg-gray-50"}`}
                                                            onClick={() => {
                                                                if (!alreadyAdded) {
                                                                    const newItem = { productId: pid, productName: pName, unit: s.unit || "UN", quantity: "1", unitPrice: "", ivaRate: "10" };
                                                                    // Replace empty first item or add new
                                                                    if (items.length === 1 && !items[0].productName) {
                                                                        setItems([newItem]);
                                                                    } else {
                                                                        setItems([...items, newItem]);
                                                                    }
                                                                } else {
                                                                    setItems(items.filter(it => it.productId !== pid));
                                                                }
                                                            }}>
                                                            <div>
                                                                <p className="font-medium text-sm text-gray-800">{pName}</p>
                                                                <p className="text-xs text-gray-500">{s.category} - {s.deposit_name || s.depositName || "Deposito"}</p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-sm font-mono font-semibold">{parseFloat(s.quantity).toFixed(1)} {s.unit}</p>
                                                                {alreadyAdded && <p className="text-[10px] text-emerald-600 font-medium">Adicionado</p>}
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })()}
                                </TabsContent>

                                {/* Graos Tab — data from farm_grain_stock (romaneios) */}
                                <TabsContent value="graos" className="mt-0 max-h-[45vh] overflow-y-auto">
                                    {(() => {
                                        const allGraos = (grainStock || []).filter((g: any) => {
                                            const qty = parseFloat(g.quantity || 0);
                                            if (qty <= 0) return false;
                                            const cropName = (g.crop || "").toLowerCase();
                                            return !pickerSearch || cropName.includes(pickerSearch.toLowerCase());
                                        });
                                        if (allGraos.length === 0) return (
                                            <div className="py-8 text-center text-gray-400 text-sm">
                                                {(grainStock || []).length === 0
                                                    ? "Nenhum grao no estoque. Os graos entram automaticamente ao confirmar romaneios."
                                                    : "Nenhum grao encontrado"}
                                            </div>
                                        );
                                        return (
                                            <div className="grid grid-cols-1 gap-1">
                                                {allGraos.map((g: any) => {
                                                    const cropName = (g.crop || "").charAt(0).toUpperCase() + (g.crop || "").slice(1);
                                                    const qtyKg = parseFloat(g.quantity || 0);
                                                    const qtyTon = (qtyKg / 1000).toFixed(2);
                                                    const gid = g.id || g.crop;
                                                    const alreadyAdded = items.some(it => (it as any).grainId === gid);
                                                    return (
                                                        <button key={gid} type="button"
                                                            className={`flex items-center justify-between w-full p-3 rounded-lg border text-left transition-colors ${alreadyAdded ? "bg-amber-50 border-amber-300" : "border-gray-200 hover:bg-gray-50"}`}
                                                            onClick={() => {
                                                                if (!alreadyAdded) {
                                                                    const newItem = { productId: "", grainId: gid, productName: cropName, unit: "TON", quantity: qtyTon, unitPrice: "", ivaRate: "5", grainCrop: g.crop, grainSeasonId: g.seasonId || null, grainGranero: g.granero || null };
                                                                    if (items.length === 1 && !items[0].productName) {
                                                                        setItems([newItem]);
                                                                    } else {
                                                                        setItems([...items, newItem]);
                                                                    }
                                                                } else {
                                                                    setItems(items.filter(it => (it as any).grainId !== gid));
                                                                }
                                                            }}>
                                                            <div>
                                                                <p className="font-medium text-sm text-gray-800">{cropName}</p>
                                                                <p className="text-xs text-gray-500">{g.granero ? `Granero: ${g.granero}` : "Estoque de graos (romaneios)"}{g.seasonName ? ` — ${g.seasonName}` : ""}</p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-sm font-mono font-semibold">{qtyTon} ton</p>
                                                                <p className="text-[10px] text-gray-400">{qtyKg.toLocaleString()} kg</p>
                                                                {alreadyAdded && <p className="text-[10px] text-amber-600 font-medium">Adicionado</p>}
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })()}
                                </TabsContent>
                            </Tabs>
                        </div>
                        <div className="px-5 py-3 border-t bg-gray-50 flex items-center justify-between">
                            <span className="text-xs text-gray-500">{items.filter(it => it.productName).length} produto(s) selecionado(s)</span>
                            <Button type="button" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setProductPickerOpen(false)}>
                                Confirmar Selecao
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Secao 4: Totais IVA */}
            <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-gray-600">Subtotal Exenta:</span><span className="font-mono">{formatCurrency(subtotalExenta)}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Subtotal Gravada 5%:</span><span className="font-mono">{formatCurrency(subtotalGravada5)}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Subtotal Gravada 10%:</span><span className="font-mono">{formatCurrency(subtotalGravada10)}</span></div>
                <div className="flex justify-between text-xs text-gray-500"><span>IVA 5% (/{21}):</span><span className="font-mono">{formatCurrency(iva5)}</span></div>
                <div className="flex justify-between text-xs text-gray-500"><span>IVA 10% (/{11}):</span><span className="font-mono">{formatCurrency(iva10)}</span></div>
                <div className="flex justify-between border-t pt-1 font-bold text-emerald-800">
                    <span>Total Geral:</span><span className="font-mono text-lg">{formatCurrency(totalGeral)}</span>
                </div>
            </div>

            {/* Secao 5: Condicao de Pagamento */}
            <div className="space-y-2">
                <h3 className="text-sm font-semibold text-emerald-800 border-b pb-1">Condicao de Pagamento</h3>
                <div className="grid grid-cols-4 gap-3">
                    <div>
                        <Label className="text-xs">Condicao</Label>
                        <Select value={paymentCondition} onValueChange={setPaymentCondition}>
                            <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="contado">Contado</SelectItem>
                                <SelectItem value="credito">Credito</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label className="text-xs">Safra</Label>
                        <Select value={seasonId} onValueChange={setSeasonId}>
                            <SelectTrigger className="text-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__none__">Nenhuma</SelectItem>
                                {seasons.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    {paymentCondition === "credito" && (
                        <div>
                            <Label className="text-xs">Parcelas</Label>
                            <Input type="number" min={1} max={12} value={totalInstallments}
                                onChange={e => setTotalInstallments(parseInt(e.target.value) || 1)} className="text-sm" />
                        </div>
                    )}
                    <div>
                        <div className="flex items-center gap-1.5 mb-1">
                            <input type="checkbox" id="customDue" checked={customDueDate} onChange={e => setCustomDueDate(e.target.checked)}
                                className="rounded" />
                            <Label htmlFor="customDue" className="text-xs cursor-pointer">Vcto diferenciado</Label>
                        </div>
                        <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                            className="text-sm" disabled={paymentCondition === "contado" && !customDueDate} />
                    </div>
                </div>
            </div>

            {/* Secao 6: Observacoes */}
            <div>
                <Label className="text-xs">Observacoes</Label>
                <textarea value={observation} onChange={e => setObservation(e.target.value)}
                    className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background min-h-[60px]"
                    placeholder="Observacoes da fatura..." />
            </div>

            {/* Submit */}
            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-base py-5"
                disabled={saving || !buyer || totalGeral <= 0 || !dueDate}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Receipt className="mr-2 h-4 w-4" />}
                {isEditMode ? "Salvar Alteracoes" : "Registrar e Imprimir"}
            </Button>
        </form>
    );
}


// ─── Recebimento Tab (mirror AP Pagamento Tab) ────────────────────────────────
function RecebimentoTab({ items, accounts, seasons, onReceive, receiving }: {
    items: any[]; accounts: any[]; seasons: any[]; onReceive: (id: string, data: any) => void; receiving: boolean;
}) {
    const [searchTerm, setSearchTerm] = useState("");
    const [filterDateFrom, setFilterDateFrom] = useState("");
    const [filterDateTo, setFilterDateTo] = useState("");
    const [filterSeason, setFilterSeason] = useState("todos");
    const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
    const [payModalOpen, setPayModalOpen] = useState(false);

    const [paymentRows, setPaymentRows] = useState<{ accountId: string; amount: string; paymentMethod: string }[]>([
        { accountId: "", amount: "", paymentMethod: "transferencia" },
    ]);
    const [chequeBanco, setChequeBanco] = useState("");
    const [chequeNumero, setChequeNumero] = useState("");
    const [chequeTitular, setChequeTitular] = useState("");

    const pendingItems = items.filter((i: any) => i.status !== "recebido");
    const filteredPending = pendingItems.filter((i: any) => {
        const termMatch = !searchTerm ||
            i.buyer?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            i.description?.toLowerCase().includes(searchTerm.toLowerCase());
        const dateFromMatch = !filterDateFrom || new Date(i.dueDate) >= new Date(filterDateFrom);
        const dateToMatch = !filterDateTo || new Date(i.dueDate) <= new Date(filterDateTo);
        const seasonMatch = filterSeason === "todos" || String(i.season_id || i.seasonId || "") === filterSeason;
        return termMatch && dateFromMatch && dateToMatch && seasonMatch;
    });

    const checkedItems = filteredPending.filter((i: any) => checkedIds.has(i.id));
    const totalChecked = checkedItems.reduce((s: number, i: any) =>
        s + parseFloat(i.totalAmount) - parseFloat(i.receivedAmount || 0), 0
    );

    const toggleCheck = (id: string) => {
        setCheckedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
    };
    const toggleAll = () => {
        if (checkedIds.size === filteredPending.length) setCheckedIds(new Set());
        else setCheckedIds(new Set(filteredPending.map((i: any) => i.id)));
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
        setPaymentRows([{ accountId: "", amount: totalChecked.toFixed(2), paymentMethod: "transferencia" }]);
        setChequeBanco(""); setChequeNumero(""); setChequeTitular("");
        setPayModalOpen(true);
    }

    async function handleConfirmReceive() {
        if (checkedIds.size === 0 || !allRowsValid) return;
        const cheques = hasChequeMethod && chequeBanco && chequeNumero ? [{
            banco: chequeBanco, numero: chequeNumero, titular: chequeTitular,
            valor: totalChecked.toFixed(2), currency: "USD",
            emissao: new Date().toISOString().split("T")[0], vencimento: "",
        }] : [];

        // Total the user actually wants to receive across all selected items
        const totalToReceive = totalAllocated;
        // Sum of remaining balances of all selected items
        const totalRemaining = checkedItems.reduce((s: number, i: any) =>
            s + parseFloat(i.totalAmount) - parseFloat(i.receivedAmount || 0), 0);

        for (const item of checkedItems) {
            const itemRemaining = parseFloat(item.totalAmount) - parseFloat(item.receivedAmount || 0);
            // Proportional share of totalToReceive for this item, capped at item's remaining balance
            const proportion = totalRemaining > 0 ? itemRemaining / totalRemaining : 0;
            const itemReceiveAmount = Math.min(itemRemaining, totalToReceive * proportion);

            onReceive(item.id, {
                paymentRows: paymentRows.map(r => ({
                    ...r,
                    amount: paymentRows.length === 1
                        ? itemReceiveAmount.toFixed(2)
                        : (itemReceiveAmount * (parseFloat(r.amount) / totalToReceive)).toFixed(2),
                })),
                cheques,
                buyerName: item.buyer,
            });
        }
        setCheckedIds(new Set());
        setPayModalOpen(false);
    }

    const isOverdue = (item: any) => {
        if (item.status === "recebido") return false;
        const due = new Date(item.dueDate); due.setHours(0, 0, 0, 0);
        const today = new Date(); today.setHours(0, 0, 0, 0);
        return (item.status === "pendente" || item.status === "parcial") && due < today;
    };

    // Avatar color from buyer name
    const avatarColor = (name: string) => {
        const colors = ["bg-emerald-600", "bg-blue-600", "bg-purple-600", "bg-amber-600", "bg-rose-600", "bg-teal-600", "bg-indigo-600", "bg-orange-600"];
        let hash = 0;
        for (let i = 0; i < (name || "").length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
        return colors[Math.abs(hash) % colors.length];
    };

    return (
        <>
            {/* Filters + Pay button */}
            <div className="bg-gray-100 rounded-xl p-5">
                <div className="flex flex-wrap gap-3 items-end">
                    <div className="flex-1 min-w-[200px]">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input placeholder="Buscar comprador ou descricao..." value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)} className="pl-10 bg-white border-0 shadow-sm h-10" />
                        </div>
                    </div>
                    <div>
                        <Input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="w-36 bg-white border-0 shadow-sm h-10" placeholder="De" />
                    </div>
                    <div>
                        <Input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="w-36 bg-white border-0 shadow-sm h-10" placeholder="Ate" />
                    </div>
                    <div>
                        <Select value={filterSeason} onValueChange={setFilterSeason}>
                            <SelectTrigger className="w-40 bg-white border-0 shadow-sm h-10"><SelectValue placeholder="Safra" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="todos">Todas</SelectItem>
                                {seasons.map((s: any) => (
                                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button className="bg-blue-600 hover:bg-blue-700 h-10" disabled={checkedIds.size === 0} onClick={openPayModal}>
                        <CreditCard className="mr-2 h-4 w-4" />
                        Receber Pagamento {checkedIds.size > 0 && `(${checkedIds.size})`}
                    </Button>
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
                                        <input type="checkbox" className="rounded"
                                            checked={checkedIds.size === filteredPending.length && filteredPending.length > 0}
                                            onChange={toggleAll} />
                                    </th>
                                    <th className="text-left px-5 py-3.5 text-[11px] uppercase tracking-wider font-bold text-gray-400">Comprador</th>
                                    <th className="text-left px-4 py-3.5 text-[11px] uppercase tracking-wider font-bold text-gray-400">Descricao</th>
                                    <th className="text-center px-3 py-3.5 text-[11px] uppercase tracking-wider font-bold text-gray-400">Parcela</th>
                                    <th className="text-left px-4 py-3.5 text-[11px] uppercase tracking-wider font-bold text-gray-400">Vencimento</th>
                                    <th className="text-center px-3 py-3.5 text-[11px] uppercase tracking-wider font-bold text-gray-400">Status</th>
                                    <th className="text-right px-4 py-3.5 text-[11px] uppercase tracking-wider font-bold text-gray-400">Recebido</th>
                                    <th className="text-right px-5 py-3.5 text-[11px] uppercase tracking-wider font-bold text-gray-400">Saldo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredPending.map((item: any) => {
                                    const received = parseFloat(item.receivedAmount || 0);
                                    const remaining = parseFloat(item.totalAmount) - received;
                                    const overdue = isOverdue(item);
                                    return (
                                        <tr key={item.id}
                                            className={`cursor-pointer transition-colors ${checkedIds.has(item.id) ? "bg-blue-50" : overdue ? "bg-red-50/50 hover:bg-red-50" : "hover:bg-emerald-50/20"}`}
                                            onClick={() => toggleCheck(item.id)}>
                                            <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                                                <input type="checkbox" className="rounded" checked={checkedIds.has(item.id)} onChange={() => toggleCheck(item.id)} />
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-3">
                                                    <div className={`h-8 w-8 rounded-full ${avatarColor(item.buyer || "")} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                                                        {(item.buyer || "?")[0].toUpperCase()}
                                                    </div>
                                                    <span className="font-semibold text-gray-900 truncate max-w-[160px]">{item.buyer}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3.5 text-gray-500 max-w-[180px] truncate">{item.description || "--"}</td>
                                            <td className="px-3 py-3.5 text-center">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[11px] font-medium">
                                                    {item.installmentNumber || 1}/{item.totalInstallments || 1}
                                                </span>
                                            </td>
                                            <td className={`px-4 py-3.5 text-sm ${overdue ? "text-red-600 font-semibold" : "text-gray-700"}`}>
                                                {item.dueDate ? new Date(item.dueDate).toLocaleDateString("pt-BR") : "--"}
                                            </td>
                                            <td className="px-3 py-3.5 text-center">
                                                {overdue
                                                    ? <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide bg-red-50 text-red-700 ring-1 ring-red-200"><span className="h-1.5 w-1.5 rounded-full bg-red-500" />VENCIDO</span>
                                                    : <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${item.status === "parcial" ? "bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200" : "bg-red-50 text-red-700 ring-1 ring-red-200"}`}><span className={`h-1.5 w-1.5 rounded-full ${item.status === "parcial" ? "bg-yellow-500" : "bg-red-500"}`} />{item.status === "parcial" ? "PARCIAL" : "ABERTO"}</span>
                                                }
                                            </td>
                                            <td className="text-right px-4 py-3.5 font-semibold text-green-600">{received > 0 ? formatCurrency(received) : <span className="text-gray-300">--</span>}</td>
                                            <td className="text-right px-5 py-3.5 font-extrabold text-blue-600">{formatCurrency(remaining)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {checkedIds.size > 0 && (
                        <div className="flex items-center justify-between px-5 py-3 bg-blue-50 border-t border-blue-200">
                            <span className="text-sm font-medium text-blue-800">{checkedIds.size} conta(s) selecionada(s)</span>
                            <span className="text-sm font-bold text-blue-800">Total: {formatCurrency(totalChecked)}</span>
                        </div>
                    )}
                </div>
            )}

            {/* Payment Modal */}
            <Dialog open={payModalOpen} onOpenChange={setPayModalOpen}>
                <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0">
                    <DialogHeader className="px-6 pt-5 pb-3 border-b">
                        <DialogTitle>Receber Pagamento</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                        {/* Summary */}
                        <div className="bg-gray-50 rounded-lg border p-3">
                            <p className="text-xs font-semibold text-gray-500 mb-2">Contas selecionadas ({checkedItems.length})</p>
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                                {checkedItems.map((item: any) => {
                                    const remaining = parseFloat(item.totalAmount) - parseFloat(item.receivedAmount || 0);
                                    return (
                                        <div key={item.id} className="flex items-center justify-between text-sm">
                                            <span className="text-gray-700">{item.buyer} - {item.description || "Sem descricao"} ({item.installmentNumber || 1}/{item.totalInstallments || 1})</span>
                                            <span className="font-mono font-semibold text-blue-600">{formatCurrency(remaining)}</span>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
                                <span className="text-sm font-bold text-gray-800">Total a receber</span>
                                <span className="text-lg font-bold text-blue-600">{formatCurrency(totalChecked)}</span>
                            </div>
                        </div>

                        {/* Payment methods */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label className="font-semibold text-emerald-800">Forma de Recebimento</Label>
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
                                                    <SelectItem key={a.id} value={String(a.id)}>{a.name} ({a.currency})</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label className="text-xs text-gray-500">Valor *</Label>
                                        <CurrencyInput value={row.amount} onValueChange={v => updateRow(idx, "amount", v)} />
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

                        {/* Cheque fields */}
                        {hasChequeMethod && (
                            <div className="grid grid-cols-3 gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                                <div><Label className="text-xs text-blue-700">Banco *</Label><Input value={chequeBanco} onChange={e => setChequeBanco(e.target.value)} placeholder="Nome do banco" /></div>
                                <div><Label className="text-xs text-blue-700">Numero *</Label><Input value={chequeNumero} onChange={e => setChequeNumero(e.target.value)} placeholder="000000" /></div>
                                <div><Label className="text-xs text-blue-700">Titular</Label><Input value={chequeTitular} onChange={e => setChequeTitular(e.target.value)} placeholder="Nome" /></div>
                            </div>
                        )}

                        {paymentRows.length > 1 && (
                            <p className={`text-xs font-medium ${Math.abs(totalAllocated - totalChecked) < 0.01 ? "text-green-600" : "text-amber-600"}`}>
                                Total alocado: {formatCurrency(totalAllocated)} / Total selecionado: {formatCurrency(totalChecked)}
                            </p>
                        )}
                    </div>

                    <div className="px-6 py-3 border-t bg-gray-50 flex items-center justify-end gap-3">
                        <Button variant="outline" onClick={() => setPayModalOpen(false)}>Cancelar</Button>
                        <Button className="bg-blue-600 hover:bg-blue-700"
                            disabled={receiving || !allRowsValid || checkedIds.size === 0 || (hasChequeMethod && (!chequeBanco || !chequeNumero))}
                            onClick={handleConfirmReceive}>
                            {receiving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckSquare className="mr-2 h-4 w-4" />}
                            Confirmar Recebimento ({checkedIds.size} conta(s))
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

// ─── Historico Tab ────────────────────────────────────────────────────────────
function HistoricoTab({ items }: { items: any[] }) {
    const [searchTerm, setSearchTerm] = useState("");
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    const { data: transactions = [], isLoading } = useQuery({
        queryKey: ["/api/farm/cash-transactions", "recebimento_venda"],
        queryFn: async () => {
            const r = await apiRequest("GET", "/api/farm/cash-transactions?category=recebimento_venda");
            return r.json();
        },
    });

    // #14 — fetch receipts to display receiptNumber
    const { data: receipts = [] } = useQuery<any[]>({
        queryKey: ["/api/farm/receipts"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/receipts"); return r.json(); },
    });
    const receiptMap = new Map<string, string>((receipts as any[]).map((rc: any) =>
        [String(rc.id), rc.receipt_number || rc.receiptNumber || String(rc.id)]
    ));

    // Extract buyer name from description: "Receb: NomeBuyer - descricao"
    function extractBuyer(desc: string): string {
        if (!desc) return "—";
        const m = desc.match(/^Receb:\s*(.+?)\s*(?:-|$)/);
        return m ? m[1].trim() : desc;
    }

    const sorted = (transactions as any[])
        .sort((a: any, b: any) => new Date(b.transactionDate || b.transaction_date || b.createdAt).getTime() - new Date(a.transactionDate || a.transaction_date || a.createdAt).getTime());

    const filtered = sorted.filter((t: any) =>
        !searchTerm || t.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // #15 — Group by receiptId when available, otherwise by date + buyer
    const groups: { key: string; date: string; buyer: string; receiptId?: string; receiptNumber?: string; items: any[]; total: number }[] = [];
    const groupMap = new Map<string, typeof groups[0]>();
    for (const t of filtered) {
        const rawDate = t.transactionDate || t.transaction_date || t.createdAt;
        const dateStr = rawDate ? new Date(rawDate).toLocaleDateString("pt-BR") : "—";
        const buyer = extractBuyer(t.description || "");
        const receiptId = t.receiptId || t.receipt_id;
        const key = receiptId ? `receipt:${receiptId}` : `${dateStr}|${buyer}`;
        if (!groupMap.has(key)) {
            const g = {
                key, date: dateStr, buyer, items: [], total: 0,
                receiptId: receiptId ? String(receiptId) : undefined,
                receiptNumber: receiptId ? receiptMap.get(String(receiptId)) : undefined,
            };
            groupMap.set(key, g);
            groups.push(g);
        }
        const g = groupMap.get(key)!;
        g.items.push(t);
        g.total += parseFloat(t.amount || 0);
    }

    const toggleGroup = (key: string) => setExpandedGroups(prev => {
        const next = new Set(prev);
        next.has(key) ? next.delete(key) : next.add(key);
        return next;
    });

    // Avatar color from buyer name
    const avatarColor = (name: string) => {
        const colors = ["bg-emerald-600", "bg-blue-600", "bg-purple-600", "bg-amber-600", "bg-rose-600", "bg-teal-600", "bg-indigo-600", "bg-orange-600"];
        let hash = 0;
        for (let i = 0; i < (name || "").length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
        return colors[Math.abs(hash) % colors.length];
    };

    return (
        <div className="space-y-5">
            <div className="bg-gray-100 rounded-xl p-5">
                <div className="flex items-center gap-3">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input placeholder="Buscar no historico..." value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)} className="pl-10 bg-white border-0 shadow-sm h-10" />
                    </div>
                    <span className="text-xs text-gray-400">{groups.length} grupo(s) / {filtered.length} recebimento(s)</span>
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
            ) : groups.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm py-16 text-center">
                    <History className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 font-medium">Nenhum recebimento registrado</p>
                    <p className="text-xs text-gray-400 mt-1">Os recebimentos aparecerao aqui</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {groups.map(group => (
                        <div key={group.key} className="bg-white rounded-xl shadow-sm overflow-hidden">
                            <div
                                className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-emerald-50/20 transition-colors"
                                onClick={() => toggleGroup(group.key)}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`h-8 w-8 rounded-full ${avatarColor(group.buyer)} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                                        {(group.buyer || "?")[0].toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-gray-900">{group.buyer}</p>
                                        <p className="text-xs text-gray-400">{group.date} -- {group.items.length} recebimento(s)</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                                    <span className="font-extrabold text-green-600 text-sm">{formatCurrency(group.total)}</span>
                                    {group.receiptId && (
                                        <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-bold ring-1 ring-blue-200">
                                            Recibo #{group.receiptNumber || group.receiptId}
                                        </span>
                                    )}
                                    <Button
                                        variant="ghost" size="sm"
                                        className="h-7 w-7 p-0 text-gray-400 hover:text-emerald-600"
                                        onClick={() => window.print()}
                                        aria-label="Imprimir recibo"
                                    >
                                        <Printer className="h-3.5 w-3.5" />
                                    </Button>
                                    <span className="text-xs text-gray-400 cursor-pointer" onClick={() => toggleGroup(group.key)}>
                                        {expandedGroups.has(group.key) ? "▲" : "▼"}
                                    </span>
                                </div>
                            </div>
                            {expandedGroups.has(group.key) && (
                                <div className="border-t border-gray-100">
                                    <table className="w-full text-sm">
                                        <tbody className="divide-y divide-gray-50">
                                            {group.items.map((t: any) => (
                                                <tr key={t.id} className="hover:bg-gray-50/50 transition-colors">
                                                    <td className="px-5 py-2.5 text-gray-600 max-w-[300px] truncate">{t.description || "--"}</td>
                                                    <td className="px-4 py-2.5 text-gray-500 capitalize">{t.paymentMethod || t.payment_method || "--"}</td>
                                                    <td className="text-right px-5 py-2.5 font-semibold text-green-600">{formatCurrency(parseFloat(t.amount))}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Ver Notas Emitidas ────────────────────────────────────────────────────────
function ViewNotasContent({ receivableId, items }: { receivableId: string; items: any[] }) {
    const { data: detail, isLoading } = useQuery({
        queryKey: ["/api/farm/accounts-receivable", receivableId],
        queryFn: async () => {
            const r = await apiRequest("GET", `/api/farm/accounts-receivable/${receivableId}`);
            return r.json();
        },
    });

    const receivable = items.find((i: any) => i.id === receivableId);

    if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-emerald-600" /></div>;

    const invoiceItems = detail?.items || [];
    return (
        <div className="space-y-4">
            {receivable?.invoiceNumber && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2">
                    <Receipt className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-medium text-emerald-800">Fatura nº {receivable.invoiceNumber}</span>
                    {receivable.buyer && <span className="text-xs text-gray-500">— {receivable.buyer}</span>}
                </div>
            )}
            {invoiceItems.length > 0 ? (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="text-left p-2 font-semibold text-gray-600">Produto</th>
                                <th className="text-center p-2 font-semibold text-gray-600">Qtd</th>
                                <th className="text-right p-2 font-semibold text-gray-600">Valor Unit.</th>
                                <th className="text-right p-2 font-semibold text-gray-600">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {invoiceItems.map((it: any, idx: number) => (
                                <tr key={idx} className="border-t border-gray-100">
                                    <td className="p-2">{it.productName || it.product_name}</td>
                                    <td className="p-2 text-center">{it.quantity} {it.unit}</td>
                                    <td className="p-2 text-right font-mono">{formatCurrency(it.unitPrice || it.unit_price)}</td>
                                    <td className="p-2 text-right font-mono font-semibold">
                                        {formatCurrency((parseFloat(it.quantity) || 0) * (parseFloat(it.unitPrice || it.unit_price) || 0))}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p className="text-sm text-gray-500 text-center py-4">
                    {receivable?.invoiceNumber
                        ? "Sem itens detalhados para esta fatura."
                        : "Nenhuma fatura associada a esta conta."}
                </p>
            )}
            {receivable?.totalAmount && (
                <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                    <span className="text-sm font-semibold text-gray-700">Total da Conta</span>
                    <span className="font-mono font-bold text-emerald-700">{formatCurrency(receivable.totalAmount)}</span>
                </div>
            )}
        </div>
    );
}

// ─── Invoice Print Overlay (for pre-printed talonario) ────────────────────────
function InvoicePrintOverlay({ receivableId, onClose }: { receivableId: string; onClose: () => void }) {
    const { data: printData, isLoading } = useQuery({
        queryKey: ["/api/farm/accounts-receivable", receivableId, "print-data"],
        queryFn: async () => {
            const r = await apiRequest("GET", `/api/farm/accounts-receivable/${receivableId}/print-data`);
            return r.json();
        },
    });

    useEffect(() => {
        if (printData && !isLoading) {
            setTimeout(() => window.print(), 500);
        }
    }, [printData, isLoading]);

    if (isLoading) {
        return (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
                <div className="bg-white rounded-lg p-8 text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto mb-2" />
                    <p>Carregando dados da fatura...</p>
                </div>
            </div>
        );
    }

    if (!printData) {
        return (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
                <div className="bg-white rounded-lg p-8 text-center">
                    <p className="text-red-600 mb-3">Dados da fatura nao encontrados</p>
                    <Button onClick={onClose}>Fechar</Button>
                </div>
            </div>
        );
    }

    const d = printData;
    const emissionDate = d.receivable?.createdAt ? new Date(d.receivable.createdAt) : new Date();

    return (
        <>
            {/* Screen overlay with close button */}
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center print:hidden">
                <div className="bg-white rounded-lg p-6 max-w-md text-center space-y-3">
                    <Printer className="h-10 w-10 text-emerald-600 mx-auto" />
                    <h3 className="text-lg font-bold">Imprimir Fatura</h3>
                    <p className="text-sm text-gray-600">Coloque o talonario pre-impresso na impressora e clique em Imprimir.</p>
                    <p className="text-xs text-gray-400">Fatura: {d.receivable?.invoiceNumber || "S/N"}</p>
                    <div className="flex gap-2 justify-center">
                        <Button variant="outline" onClick={onClose}>Cancelar</Button>
                        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => window.print()}>
                            <Printer className="mr-2 h-4 w-4" /> Imprimir
                        </Button>
                    </div>
                </div>
            </div>

            {/* Print-only content: positioned data for pre-printed form */}
            <style>{`
                @media print {
                    body * { visibility: hidden !important; }
                    .print-invoice-overlay, .print-invoice-overlay * {
                        visibility: visible !important;
                    }
                    .print-invoice-overlay {
                        display: block !important;
                        position: fixed;
                        top: 0; left: 0;
                        width: 210mm;
                        height: 148mm;
                        padding: 0;
                        margin: 0;
                        font-family: 'Courier New', monospace;
                        font-size: 10pt;
                        color: #000;
                        z-index: 99999;
                    }
                    @page {
                        size: letter;
                        margin: 0;
                    }
                }
                @media screen {
                    .print-invoice-overlay { display: none; }
                }
            `}</style>
            <div className="print-invoice-overlay">
                {/* Date fields - positioned for typical Paraguayan talonario */}
                <div style={{ position: "absolute", top: "18mm", right: "25mm", fontSize: "11pt", fontWeight: "bold" }}>
                    {emissionDate.toLocaleDateString("pt-BR")}
                </div>

                {/* Invoice number */}
                <div style={{ position: "absolute", top: "10mm", right: "25mm", fontSize: "9pt" }}>
                    {d.receivable?.invoiceNumber || ""}
                </div>

                {/* Customer name */}
                <div style={{ position: "absolute", top: "30mm", left: "30mm", fontSize: "10pt" }}>
                    {d.customer?.name || d.receivable?.buyer || ""}
                </div>

                {/* Customer RUC */}
                <div style={{ position: "absolute", top: "36mm", left: "30mm", fontSize: "10pt" }}>
                    {d.customer?.ruc || d.receivable?.customerRuc || ""}
                </div>

                {/* Customer address */}
                <div style={{ position: "absolute", top: "42mm", left: "30mm", fontSize: "9pt" }}>
                    {d.customer?.address || d.receivable?.customerAddress || ""}
                </div>

                {/* Payment condition */}
                <div style={{ position: "absolute", top: "30mm", right: "25mm", fontSize: "10pt" }}>
                    {d.receivable?.paymentCondition === "contado" ? "X CONTADO" : "X CREDITO"}
                </div>

                {/* Items table - starting position */}
                {(d.items || []).map((item: any, idx: number) => (
                    <div key={idx} style={{ position: "absolute", top: `${52 + idx * 6}mm`, left: "10mm", right: "10mm", display: "flex", fontSize: "9pt" }}>
                        <span style={{ width: "15mm", textAlign: "center" }}>{parseFloat(item.quantity).toFixed(2)}</span>
                        <span style={{ flex: 1, paddingLeft: "5mm" }}>{item.productName}</span>
                        <span style={{ width: "25mm", textAlign: "right" }}>{formatCurrency(parseFloat(item.unitPrice))}</span>
                        <span style={{ width: "25mm", textAlign: "right" }}>{item.ivaRate === "exenta" ? formatCurrency(parseFloat(item.totalPrice)) : ""}</span>
                        <span style={{ width: "25mm", textAlign: "right" }}>{item.ivaRate === "5" ? formatCurrency(parseFloat(item.totalPrice)) : ""}</span>
                        <span style={{ width: "25mm", textAlign: "right" }}>{item.ivaRate === "10" ? formatCurrency(parseFloat(item.totalPrice)) : ""}</span>
                    </div>
                ))}

                {/* Totals at bottom */}
                <div style={{ position: "absolute", bottom: "22mm", left: "10mm", right: "10mm", display: "flex", fontSize: "9pt", fontWeight: "bold" }}>
                    <span style={{ flex: 1 }}>TOTAL:</span>
                    <span style={{ width: "25mm", textAlign: "right" }}>{formatCurrency(parseFloat(d.receivable?.subtotalExenta || 0))}</span>
                    <span style={{ width: "25mm", textAlign: "right" }}>{formatCurrency(parseFloat(d.receivable?.subtotalGravada5 || 0))}</span>
                    <span style={{ width: "25mm", textAlign: "right" }}>{formatCurrency(parseFloat(d.receivable?.subtotalGravada10 || 0))}</span>
                </div>

                {/* IVA totals */}
                <div style={{ position: "absolute", bottom: "12mm", right: "10mm", fontSize: "9pt" }}>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "10mm" }}>
                        <span>Total IVA 5%: {formatCurrency(parseFloat(d.receivable?.iva5 || 0))}</span>
                        <span>Total IVA 10%: {formatCurrency(parseFloat(d.receivable?.iva10 || 0))}</span>
                    </div>
                </div>

                {/* Grand total */}
                <div style={{ position: "absolute", bottom: "6mm", right: "25mm", fontSize: "12pt", fontWeight: "bold" }}>
                    TOTAL: {formatCurrency(parseFloat(d.receivable?.totalAmount || 0))}
                </div>
            </div>
        </>
    );
}

// ─── Timbrado Config Form ─────────────────────────────────────────────────────
function TimbradoConfigForm({ config, onSaved }: { config: any; onSaved: () => void }) {
    const [timbrado, setTimbrado] = useState(config?.timbrado || "");
    const [startDate, setStartDate] = useState(config?.timbradoStartDate ? new Date(config.timbradoStartDate).toISOString().split("T")[0] : "");
    const [endDate, setEndDate] = useState(config?.timbradoEndDate ? new Date(config.timbradoEndDate).toISOString().split("T")[0] : "");
    const [establecimiento, setEstablecimiento] = useState(config?.establecimiento || "001");
    const [puntoExpedicion, setPuntoExpedicion] = useState(config?.puntoExpedicion || "001");
    const [ruc, setRuc] = useState(config?.ruc || "");
    const [razonSocial, setRazonSocial] = useState(config?.razonSocial || "");
    const [direccion, setDireccion] = useState(config?.direccion || "");
    const [saving, setSaving] = useState(false);

    async function handleSave() {
        setSaving(true);
        try {
            await apiRequest("POST", "/api/farm/invoice-config", {
                timbrado, timbradoStartDate: startDate, timbradoEndDate: endDate,
                establecimiento, puntoExpedicion, ruc, razonSocial, direccion,
            });
            onSaved();
        } catch {
            // handle error
        }
        setSaving(false);
    }

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Numero do Timbrado *</Label><Input value={timbrado} onChange={e => setTimbrado(e.target.value)} placeholder="15234567" /></div>
                <div>
                    <Label className="text-xs">Ultimo numero usado</Label>
                    <Input value={config?.lastSequence || 0} disabled className="bg-gray-50" />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Vigencia Inicio *</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
                <div><Label className="text-xs">Vigencia Fim *</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Establecimiento</Label><Input value={establecimiento} onChange={e => setEstablecimiento(e.target.value)} placeholder="001" /></div>
                <div><Label className="text-xs">Punto de Expedicion</Label><Input value={puntoExpedicion} onChange={e => setPuntoExpedicion(e.target.value)} placeholder="001" /></div>
            </div>
            <div><Label className="text-xs">RUC *</Label><Input value={ruc} onChange={e => setRuc(e.target.value)} placeholder="1234567-8" /></div>
            <div><Label className="text-xs">Razao Social *</Label><Input value={razonSocial} onChange={e => setRazonSocial(e.target.value)} placeholder="Nome da empresa" /></div>
            <div><Label className="text-xs">Endereco Fiscal</Label><Input value={direccion} onChange={e => setDireccion(e.target.value)} placeholder="Endereco completo" /></div>
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={handleSave}
                disabled={saving || !timbrado || !ruc || !razonSocial}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Settings className="mr-2 h-4 w-4" />}
                Salvar Configuracao
            </Button>
        </div>
    );
}
