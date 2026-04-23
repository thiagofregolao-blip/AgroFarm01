import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import FarmLayout from "@/components/fazenda/layout";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Search, Warehouse, ArrowUpRight, ArrowDownRight, Plus, Camera, Package, Trash2, Pencil, RefreshCw, FileText, Building2, ArrowLeftRight, Upload, Fuel, User, Eye, AlertTriangle, TrendingUp, DollarSign, BarChart3, Leaf, ChevronLeft, ChevronRight, Download, Layers } from "lucide-react";
import { useState, useRef, useMemo } from "react";
import { formatCurrency } from "@/lib/format-currency";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAccessLevel } from "@/hooks/use-access-level";

// ─── Category normalization & colors ─────────────────────────────────────────
function normalizeCategory(cat: string): string {
    const l = (cat || "").toLowerCase().trim();
    if (l.includes("herbicida")) return "Herbicida";
    if (l.includes("fungicida")) return "Fungicida";
    if (l.includes("inseticida") || l.includes("insecticida")) return "Inseticida";
    if (l.includes("fertilizante") || l.includes("foliar")) return "Fertilizante";
    if (l.includes("semente")) return "Semente";
    if (l.includes("adjuvante")) return "Adjuvante";
    if (l.includes("biolog")) return "Biologico";
    if (l.includes("diesel") || l.includes("combusti")) return "Diesel";
    return "Outros";
}

const CAT_COLORS: Record<string, { bg: string; text: string }> = {
    Herbicida: { bg: "bg-red-100", text: "text-red-700" },
    Fungicida: { bg: "bg-yellow-100", text: "text-yellow-700" },
    Inseticida: { bg: "bg-blue-100", text: "text-blue-700" },
    Fertilizante: { bg: "bg-green-100", text: "text-green-700" },
    Semente: { bg: "bg-amber-100", text: "text-amber-700" },
    Adjuvante: { bg: "bg-purple-100", text: "text-purple-700" },
    Biologico: { bg: "bg-lime-100", text: "text-lime-700" },
    Diesel: { bg: "bg-gray-100", text: "text-gray-700" },
    Outros: { bg: "bg-gray-100", text: "text-gray-500" },
};

const CAT_PILL_COLORS: Record<string, string> = {
    Herbicida: "#064e3b",
    Fungicida: "#ca8a04",
    Inseticida: "#2563eb",
    Fertilizante: "#16a34a",
    Semente: "#92400e",
    Adjuvante: "#7c3aed",
    Biologico: "#65a30d",
    Diesel: "#6b7280",
    Outros: "#9ca3af",
};

const CAT_BADGE_STYLES: Record<string, { bg: string; text: string; border: string }> = {
    Herbicida: { bg: "bg-emerald-900", text: "text-white", border: "border-emerald-800" },
    Fungicida: { bg: "bg-yellow-100", text: "text-yellow-800", border: "border-yellow-200" },
    Inseticida: { bg: "bg-blue-100", text: "text-blue-800", border: "border-blue-200" },
    Fertilizante: { bg: "bg-green-100", text: "text-green-800", border: "border-green-200" },
    Semente: { bg: "bg-amber-100", text: "text-amber-800", border: "border-amber-200" },
    Adjuvante: { bg: "bg-purple-100", text: "text-purple-800", border: "border-purple-200" },
    Biologico: { bg: "bg-lime-100", text: "text-lime-800", border: "border-lime-200" },
    Diesel: { bg: "bg-gray-200", text: "text-gray-700", border: "border-gray-300" },
    Outros: { bg: "bg-gray-100", text: "text-gray-600", border: "border-gray-200" },
};

const ITEMS_PER_PAGE = 15;

export default function FarmStock() {
    const [, setLocation] = useLocation();
    const queryClient = useQueryClient();
    const [search, setSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("");
    const [showZeroStock, setShowZeroStock] = useState(false);
    const [dieselReceipt, setDieselReceipt] = useState<any>(null);
    const [loadingReceiptId, setLoadingReceiptId] = useState<string | null>(null);
    const { toast } = useToast();

    const { user } = useAuth();
    const { canEdit } = useAccessLevel("stock");
    const [currentPage, setCurrentPage] = useState(1);

    const { data: stock = [], isLoading } = useQuery({
        queryKey: ["/api/farm/stock"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/stock"); return r.json(); },
        enabled: !!user,
    });

    const { data: movements = [] } = useQuery({
        queryKey: ["/api/farm/stock/movements"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/stock/movements?limit=100"); return r.json(); },
        enabled: !!user,
    });

    const { data: properties = [] } = useQuery({
        queryKey: ["/api/farm/properties"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/properties"); return r.json(); },
        enabled: !!user,
    });

    const { data: depositsMain = [] } = useQuery({
        queryKey: ["/api/farm/deposits"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/deposits"); return r.json(); },
        enabled: !!user,
    });

    // Extrato filters
    const [extratoProduct, setExtratoProduct] = useState("");
    const [extratoType, setExtratoType] = useState("");
    const [extratoDeposit, setExtratoDeposit] = useState("");
    const [extratoStartDate, setExtratoStartDate] = useState("");
    const [extratoEndDate, setExtratoEndDate] = useState("");

    const extratoQueryUrl = (() => {
        const params = new URLSearchParams();
        params.set("limit", "500");
        if (extratoProduct) params.set("productName", extratoProduct);
        if (extratoType) params.set("type", extratoType);
        if (extratoStartDate) params.set("startDate", extratoStartDate);
        if (extratoEndDate) params.set("endDate", extratoEndDate);
        return `/api/farm/stock/movements?${params.toString()}`;
    })();

    const { data: extratoMovementsRaw = [], isLoading: extratoLoading } = useQuery({
        queryKey: ["/api/farm/stock/movements/extrato", extratoProduct, extratoType, extratoStartDate, extratoEndDate],
        queryFn: async () => { const r = await apiRequest("GET", extratoQueryUrl); return r.json(); },
        enabled: !!user,
    });

    // Client-side deposit filter (depositId comes from server join)
    const extratoMovements = useMemo(() => {
        if (!extratoDeposit) return extratoMovementsRaw;
        if (extratoDeposit === "__none__") return extratoMovementsRaw.filter((m: any) => !m.depositId);
        return extratoMovementsRaw.filter((m: any) => m.depositId === extratoDeposit);
    }, [extratoMovementsRaw, extratoDeposit]);

    const productNames: string[] = Array.from(new Set(stock.map((s: any) => s.productName).filter(Boolean))) as string[];

    const deleteStock = useMutation({
        mutationFn: async (id: string) => {
            await apiRequest("DELETE", `/api/farm/stock/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/stock"] });
            toast({ title: "Produto excluído", description: "O item foi removido do estoque." });
        },
        onError: (err: any) => {
            toast({ title: "Erro", description: err.message, variant: "destructive" });
        }
    });

    const deleteDepositMutation = useMutation({
        mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/farm/deposits/${id}`); },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/deposits"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/stock"] });
            toast({ title: "Deposito removido" });
        },
        onError: (err: any) => { toast({ title: "Erro", description: err.message, variant: "destructive" }); },
    });

    // Transfer state
    const [transferProductId, setTransferProductId] = useState("");
    const [transferFromWarehouse, setTransferFromWarehouse] = useState("");
    const [transferToWarehouse, setTransferToWarehouse] = useState("");
    const [transferQty, setTransferQty] = useState("");
    const [transferNotes, setTransferNotes] = useState("");

    const transferMutation = useMutation({
        mutationFn: async () => {
            const res = await apiRequest("POST", "/api/farm/stock/transfer", {
                productId: transferProductId,
                fromWarehouseId: transferFromWarehouse || null,
                toWarehouseId: transferToWarehouse || null,
                quantity: transferQty,
                notes: transferNotes,
            });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/stock"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/stock/movements"] });
            toast({ title: "Transferencia realizada", description: "Estoque movimentado com sucesso." });
            setTransferProductId("");
            setTransferFromWarehouse("");
            setTransferToWarehouse("");
            setTransferQty("");
            setTransferNotes("");
        },
        onError: (err: any) => {
            toast({ title: "Erro na transferencia", description: err.message, variant: "destructive" });
        },
    });

    const handleTransfer = () => {
        if (!transferProductId) {
            toast({ title: "Selecione um produto", variant: "destructive" }); return;
        }
        const qty = parseFloat(transferQty);
        if (!qty || qty <= 0) {
            toast({ title: "Quantidade deve ser maior que zero", variant: "destructive" }); return;
        }
        if (transferFromWarehouse && transferFromWarehouse === transferToWarehouse) {
            toast({ title: "Deposito origem e destino devem ser diferentes", variant: "destructive" }); return;
        }
        // Check available stock for selected product in source warehouse
        const sourceItem = stock.find((s: any) =>
            s.productId === transferProductId &&
            (transferFromWarehouse ? String(s.depositId) === transferFromWarehouse : !s.depositId)
        );
        if (sourceItem && qty > parseFloat(sourceItem.quantity)) {
            toast({ title: "Quantidade excede estoque disponivel", description: `Disponivel: ${parseFloat(sourceItem.quantity).toFixed(2)}`, variant: "destructive" }); return;
        }
        transferMutation.mutate();
    };

    // Filter transfer movements
    const transferMovements = movements.filter((m: any) =>
        m.referenceType === "transfer" || (m.notes && m.notes.toLowerCase().includes("transferencia"))
    );

    const handleDelete = (id: string, name: string) => {
        if (confirm(`Tem certeza que deseja excluir '${name}' do estoque?`)) {
            deleteStock.mutate(id);
        }
    };

    // Group stock by productId — sum quantities, weighted average cost
    const grouped = useMemo(() => {
        const map: Record<string, any> = {};
        for (const s of stock as any[]) {
            const key = s.productId || s.id;
            if (!map[key]) {
                map[key] = {
                    ...s,
                    quantity: "0",
                    averageCost: "0",
                    _totalQty: 0,
                    _totalValue: 0,
                    _deposits: [] as string[],
                    _rows: [] as any[],
                };
            }
            const qty = parseFloat(s.quantity || 0);
            const cost = parseFloat(s.averageCost || 0);
            map[key]._totalQty += qty;
            map[key]._totalValue += qty * cost;
            map[key]._rows.push(s);
            const depName = s.depositName || s.propertyName || "Sem deposito";
            if (!map[key]._deposits.includes(depName)) map[key]._deposits.push(depName);
            // Keep latest lote/expiryDate
            if (s.lote && !map[key].lote) map[key].lote = s.lote;
            if (s.expiryDate && (!map[key].expiryDate || s.expiryDate > map[key].expiryDate)) map[key].expiryDate = s.expiryDate;
        }
        return Object.values(map).map((g: any) => ({
            ...g,
            quantity: String(g._totalQty),
            averageCost: String(g._totalQty > 0 ? g._totalValue / g._totalQty : 0),
            depositCount: g._deposits.length,
            depositNames: g._deposits,
            subRows: g._rows.length > 1 ? g._rows : null,
        }));
    }, [stock]);

    const filtered = grouped.filter((s: any) => {
        const matchesSearch = s.productName.toLowerCase().includes(search.toLowerCase()) ||
            (s.productCategory || "").toLowerCase().includes(search.toLowerCase());
        const matchesCategory = !categoryFilter || normalizeCategory(s.productCategory) === categoryFilter;
        // Esconder produtos com saldo agrupado = 0 quando toggle desligado.
        // Positivos e negativos continuam aparecendo; apenas zero exato some.
        const matchesZero = showZeroStock || (s._totalQty ?? parseFloat(s.quantity || 0)) !== 0;
        return matchesSearch && matchesCategory && matchesZero;
    });

    // KPI computations — usa "filtered" (agrupado + com toggle de zero aplicado)
    // para refletir exatamente o que o usuario ve na tabela.
    const kpiData = useMemo(() => {
        const negativeCount = filtered.filter((s: any) => parseFloat(s.quantity) < 0).length;
        const lowStockCount = filtered.filter((s: any) => {
            const q = parseFloat(s.quantity);
            return q > 0 && q < 5;
        }).length;
        const catCounts: Record<string, number> = {};
        filtered.forEach((s: any) => {
            const cat = normalizeCategory(s.productCategory);
            catCounts[cat] = (catCounts[cat] || 0) + 1;
        });
        const allCategories = Object.keys(catCounts);
        const topCategory = allCategories.length > 0
            ? allCategories.reduce((a, b) => catCounts[a] >= catCounts[b] ? a : b)
            : "—";
        const topCategoryCount = catCounts[topCategory] || 0;
        return { negativeCount, lowStockCount, catCounts, allCategories, topCategory, topCategoryCount };
    }, [filtered]);

    // Group stock by deposit/property for warehouse view
    const stockByProperty: Record<string, any[]> = {};
    filtered.forEach((s: any) => {
        const prop = s.depositName || s.propertyName || "Sem deposito";
        if (!stockByProperty[prop]) stockByProperty[prop] = [];
        stockByProperty[prop].push(s);
    });

    const totalValue = stock.reduce((s: number, i: any) =>
        s + (parseFloat(i.quantity) * parseFloat(i.averageCost)), 0
    );

    // Pagination
    const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
    const safePage = Math.min(currentPage, totalPages);
    const paginatedItems = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);
    const showingFrom = filtered.length === 0 ? 0 : (safePage - 1) * ITEMS_PER_PAGE + 1;
    const showingTo = Math.min(safePage * ITEMS_PER_PAGE, filtered.length);

    return (
        <FarmLayout>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');
                .font-manrope { font-family: 'Manrope', sans-serif; }
            `}</style>
            <div className="space-y-6 font-manrope">
                {/* PAGE HEADER + KPI — grid 12 cols */}
                <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Left: Title */}
                    <div className="lg:col-span-4">
                        <p className="text-[10px] uppercase font-bold tracking-widest text-emerald-700 mb-1">ESTOQUE &gt; GESTAO DE DEPOSITO</p>
                        <h1 className="text-4xl font-extrabold tracking-tight text-gray-900" style={{ fontFamily: "'Manrope', sans-serif" }}>Deposito / Estoque</h1>
                        <p className="text-gray-500 text-sm mt-3 leading-relaxed max-w-sm">Gerencie seu inventario de insumos e produtos agricolas.</p>
                    </div>
                    {/* Right: KPI Cards */}
                    <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-white rounded-xl shadow-sm border-l-4 border-emerald-600 p-5">
                            <div className="flex items-center gap-2 mb-2">
                                <Package className="h-4 w-4 text-emerald-700" />
                                <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Total Itens</span>
                            </div>
                            <p className="text-2xl font-extrabold text-gray-900" style={{ fontFamily: "'Manrope', sans-serif" }}>{stock.length}</p>
                            <p className="text-xs text-gray-400 mt-1">produtos cadastrados</p>
                        </div>
                        <div className="bg-white rounded-xl shadow-sm border-l-4 border-emerald-800 p-5">
                            <div className="flex items-center gap-2 mb-2">
                                <DollarSign className="h-4 w-4 text-emerald-700" />
                                <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Valor do Estoque</span>
                            </div>
                            <p className="text-2xl font-extrabold text-gray-900" style={{ fontFamily: "'Manrope', sans-serif" }}>{formatCurrency(totalValue)}</p>
                            <p className="text-xs text-gray-400 mt-1">valor total estimado</p>
                        </div>
                        <div className="bg-white rounded-xl shadow-sm border-l-4 border-red-500 p-5">
                            <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle className="h-4 w-4 text-red-500" />
                                <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Alerta Estoque Baixo</span>
                            </div>
                            <p className="text-2xl font-extrabold text-red-600" style={{ fontFamily: "'Manrope', sans-serif" }}>{kpiData.lowStockCount}</p>
                            <p className="text-xs text-red-400 mt-1">itens com qtd &lt; 5 ou negativa</p>
                        </div>
                    </div>
                </section>

                {/* Action buttons */}
                {canEdit && (
                <div className="flex gap-2 flex-wrap items-center justify-end">
                    <NewDepositDialog onSuccess={() => queryClient.invalidateQueries({ queryKey: ["/api/farm/deposits"] })} />
                    <DieselEntryDialog onSuccess={() => { queryClient.invalidateQueries({ queryKey: ["/api/farm/stock"] }); queryClient.invalidateQueries({ queryKey: ["/api/farm/stock/movements"] }); }} />
                    <ManualStockEntryDialog onSuccess={() => queryClient.invalidateQueries({ queryKey: ["/api/farm/stock"] })} />
                </div>
                )}

                <Tabs defaultValue="stock">
                    <TabsList>
                        <TabsTrigger value="stock">Estoque Atual</TabsTrigger>
                        <TabsTrigger value="deposits"><Building2 className="h-4 w-4 mr-1" />Depósitos</TabsTrigger>
                        <TabsTrigger value="extrato"><FileText className="h-4 w-4 mr-1" />Extrato</TabsTrigger>
                        <TabsTrigger value="transferencias"><ArrowLeftRight className="h-4 w-4 mr-1" />Transferencias</TabsTrigger>
                        <TabsTrigger value="diesel"><Fuel className="h-4 w-4 mr-1" />Diesel</TabsTrigger>
                    </TabsList>

                    <TabsContent value="stock" className="mt-4 space-y-4">
                        {/* CATEGORY FILTER PILLS + SEARCH */}
                        <div className="bg-gray-100 rounded-xl p-4">
                            <div className="flex flex-col md:flex-row md:items-center gap-3">
                                <div className="flex flex-wrap gap-2 flex-1">
                                    <button
                                        type="button"
                                        className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                                            !categoryFilter
                                                ? "bg-emerald-900 text-white shadow-sm"
                                                : "bg-white text-gray-600 hover:bg-gray-50 shadow-sm"
                                        }`}
                                        onClick={() => { setCategoryFilter(""); setCurrentPage(1); }}
                                    >
                                        Todos ({stock.length})
                                    </button>
                                    {kpiData.allCategories
                                        .filter(c => c !== "Outros")
                                        .sort((a, b) => (kpiData.catCounts[b] || 0) - (kpiData.catCounts[a] || 0))
                                        .map(cat => {
                                            const isActive = categoryFilter === cat;
                                            return (
                                                <button
                                                    key={cat}
                                                    type="button"
                                                    className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all shadow-sm ${
                                                        isActive
                                                            ? "bg-emerald-900 text-white"
                                                            : "bg-white text-gray-600 hover:bg-gray-50"
                                                    }`}
                                                    onClick={() => { setCategoryFilter(isActive ? "" : cat); setCurrentPage(1); }}
                                                >
                                                    {cat} ({kpiData.catCounts[cat]})
                                                </button>
                                            );
                                        })}
                                    {kpiData.catCounts["Outros"] > 0 && (
                                        <button
                                            type="button"
                                            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all shadow-sm ${
                                                categoryFilter === "Outros"
                                                    ? "bg-emerald-900 text-white"
                                                    : "bg-white text-gray-600 hover:bg-gray-50"
                                            }`}
                                            onClick={() => { setCategoryFilter(categoryFilter === "Outros" ? "" : "Outros"); setCurrentPage(1); }}
                                        >
                                            Outros ({kpiData.catCounts["Outros"]})
                                        </button>
                                    )}
                                </div>
                                <div className="flex gap-2 items-center flex-wrap">
                                    <label className="flex items-center gap-2 bg-white border-0 shadow-sm rounded-lg h-10 px-3 text-xs font-semibold text-gray-600 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={showZeroStock}
                                            onChange={e => { setShowZeroStock(e.target.checked); setCurrentPage(1); }}
                                            className="h-4 w-4 cursor-pointer accent-emerald-600"
                                        />
                                        Mostrar sem estoque
                                    </label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                        <Input
                                            className="pl-10 bg-white border-0 shadow-sm rounded-lg h-10 w-full md:w-56"
                                            placeholder="Buscar produto..."
                                            value={search}
                                            onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                                        />
                                    </div>
                                    <Button variant="outline" size="sm" className="bg-white border-0 shadow-sm h-10 px-4 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50">
                                        <Download className="h-4 w-4 mr-1.5" />
                                        Export PDF
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {isLoading ? (
                            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
                        ) : filtered.length === 0 ? (
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 py-16 text-center">
                                <Warehouse className="h-14 w-14 text-gray-200 mx-auto mb-4" />
                                <p className="text-gray-400 text-sm font-medium">Estoque vazio</p>
                            </div>
                        ) : (<>
                            {/* DATA TABLE — Desktop */}
                            <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-100">
                                            <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400">Produto</th>
                                            <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400">Categoria</th>
                                            <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400">Especificacao</th>
                                            <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400">Custo Medio</th>
                                            <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400">Quantidade</th>
                                            <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400">Valor Total</th>
                                            <th className="text-center px-4 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400">Status</th>
                                            <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400">Acoes</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedItems.map((s: any) => {
                                            const qty = parseFloat(s.quantity);
                                            const cost = parseFloat(s.averageCost);
                                            const isNegative = qty < 0;
                                            const isLow = qty >= 0 && qty < 5;
                                            const cat = normalizeCategory(s.productCategory);
                                            const badge = CAT_BADGE_STYLES[cat] || CAT_BADGE_STYLES.Outros;
                                            const isMerged = (s.mergedCount ?? 1) > 1;
                                            const displayName = s.productName?.length > 50
                                                ? s.productName.substring(0, 50) + "..."
                                                : s.productName;
                                            return (
                                                <tr key={s.id} className={`border-b border-gray-50 transition-colors duration-150 hover:bg-emerald-50/30 group ${isNegative ? "bg-red-50/40" : ""}`}>
                                                    {/* Produto */}
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                                                                <Leaf className="h-5 w-5 text-emerald-600" />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-1.5">
                                                                    <p className="font-bold text-sm text-gray-900 truncate" title={s.productName}>{displayName}</p>
                                                                    {isMerged && (
                                                                        <span
                                                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-indigo-100 text-indigo-700 flex-shrink-0"
                                                                            title={`${s.mergedCount} registros duplicados no catalogo foram agrupados. Totais somados.`}
                                                                        >
                                                                            <Layers className="h-2.5 w-2.5" />
                                                                            {s.mergedCount}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {s.activeIngredient ? (
                                                                    <p className="text-[11px] text-gray-400 break-words">{s.activeIngredient}</p>
                                                                ) : s.depositCount > 1 ? (
                                                                    <p className="text-[11px] text-blue-500 font-medium">{s.depositCount} depositos: {s.depositNames.join(", ")}</p>
                                                                ) : s.depositName ? (
                                                                    <p className="text-[11px] text-gray-400">{s.depositName}</p>
                                                                ) : (
                                                                    <p className="text-[11px] text-gray-300">ID: {String(s.productId || s.id).substring(0, 8)}</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    {/* Categoria */}
                                                    <td className="px-4 py-3">
                                                        <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide ${badge.bg} ${badge.text}`}>
                                                            {cat}
                                                        </span>
                                                    </td>
                                                    {/* Especificacao */}
                                                    <td className="px-4 py-3 text-sm text-gray-500">
                                                        {s.productUnit || "—"}
                                                    </td>
                                                    {/* Custo Medio */}
                                                    <td className="text-right px-4 py-3">
                                                        <span className="text-sm font-semibold text-gray-600">
                                                            {cost > 0 ? `$ ${cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                                                        </span>
                                                    </td>
                                                    {/* Quantidade */}
                                                    <td className="text-right px-4 py-3">
                                                        <span className={`font-bold text-sm font-mono ${isNegative ? "text-red-600" : isLow ? "text-amber-600" : "text-gray-900"}`}>
                                                            {isNegative && <AlertTriangle className="h-3.5 w-3.5 text-red-500 inline mr-1" />}
                                                            {qty.toFixed(2)} {s.productUnit}
                                                        </span>
                                                    </td>
                                                    {/* Valor Total */}
                                                    <td className="text-right px-4 py-3">
                                                        <span className="font-extrabold text-sm text-gray-900">{formatCurrency(qty * cost)}</span>
                                                    </td>
                                                    {/* Status */}
                                                    <td className="text-center px-4 py-3">
                                                        {isNegative ? (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                                                                NEGATIVO
                                                            </span>
                                                        ) : isLow ? (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                                                                LOW STOCK
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                                                                IN STOCK
                                                            </span>
                                                        )}
                                                    </td>
                                                    {/* Acoes */}
                                                    <td className="text-right px-4 py-3">
                                                        {canEdit && (isMerged ? (
                                                            <span
                                                                className="inline-block text-[10px] text-indigo-600 font-semibold cursor-help"
                                                                title="Este produto tem duplicatas no catalogo. Edicao desabilitada ate a mesclagem no catalogo."
                                                            >
                                                                agrupado
                                                            </span>
                                                        ) : (
                                                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <EditStockDialog stockItem={s} onSuccess={() => queryClient.invalidateQueries({ queryKey: ["/api/farm/stock"] })} />
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg" onClick={() => handleDelete(s.id, s.productName)} disabled={deleteStock.isPending}>
                                                                    {deleteStock.isPending && deleteStock.variables === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                                                </Button>
                                                            </div>
                                                        ))}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* DATA TABLE — Mobile cards */}
                            <div className="md:hidden flex flex-col gap-3">
                                {paginatedItems.map((s: any) => {
                                    const qty = parseFloat(s.quantity);
                                    const cost = parseFloat(s.averageCost);
                                    const isNegative = qty < 0;
                                    const isLow = qty >= 0 && qty < 5;
                                    const cat = normalizeCategory(s.productCategory);
                                    const badge = CAT_BADGE_STYLES[cat] || CAT_BADGE_STYLES.Outros;
                                    const isMerged = (s.mergedCount ?? 1) > 1;
                                    return (
                                        <div key={s.id} className={`rounded-xl border p-4 shadow-sm ${isNegative ? "bg-red-50 border-red-200" : "bg-white border-gray-100"}`}>
                                            <div className="flex items-start gap-3 mb-3">
                                                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                                                    <Leaf className="h-5 w-5 text-emerald-600" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <p className="font-bold text-sm text-gray-900 truncate">{s.productName}</p>
                                                        {isMerged && (
                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-indigo-100 text-indigo-700 flex-shrink-0">
                                                                <Layers className="h-2.5 w-2.5" />
                                                                {s.mergedCount}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {s.activeIngredient && <p className="text-[11px] text-gray-400 break-words">{s.activeIngredient}</p>}
                                                    <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${badge.bg} ${badge.text}`}>{cat}</span>
                                                </div>
                                                {canEdit && !isMerged && (
                                                    <div className="flex gap-1 flex-shrink-0">
                                                        <EditStockDialog stockItem={s} onSuccess={() => queryClient.invalidateQueries({ queryKey: ["/api/farm/stock"] })} />
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600" onClick={() => handleDelete(s.id, s.productName)} disabled={deleteStock.isPending}>
                                                            {deleteStock.isPending && deleteStock.variables === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                            {isMerged && (
                                                <div className="mb-3 px-3 py-2 bg-indigo-50 rounded-lg border border-indigo-100">
                                                    <p className="text-[10px] text-indigo-700 leading-relaxed">
                                                        <span className="font-semibold">Agrupado:</span> {s.mergedCount} registros duplicados somados. A mesclagem no catalogo ficara disponivel em breve.
                                                    </p>
                                                </div>
                                            )}
                                            <div className="grid grid-cols-2 gap-3 text-sm">
                                                <div>
                                                    <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Quantidade</p>
                                                    <p className={`font-bold ${isNegative ? "text-red-600" : isLow ? "text-amber-600" : "text-gray-900"}`}>
                                                        {qty.toFixed(2)} {s.productUnit}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Valor Total</p>
                                                    <p className="font-extrabold text-gray-900">{formatCurrency(qty * cost)}</p>
                                                </div>
                                            </div>
                                            <div className="mt-3 flex justify-between items-center">
                                                <span className="text-[10px] uppercase text-gray-400 font-semibold">Status</span>
                                                {isNegative ? (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">NEGATIVO</span>
                                                ) : isLow ? (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">LOW STOCK</span>
                                                ) : (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">IN STOCK</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* PAGINATION */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-between pt-2">
                                    <p className="text-xs text-gray-400">
                                        Showing <span className="font-semibold text-gray-600">{showingFrom}</span> to <span className="font-semibold text-gray-600">{showingTo}</span> of <span className="font-semibold text-gray-600">{filtered.length}</span> items
                                    </p>
                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 transition-colors"
                                            disabled={safePage <= 1}
                                            onClick={() => setCurrentPage(safePage - 1)}
                                            aria-label="Pagina anterior"
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                        </button>
                                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                                            .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                                            .map((p, idx, arr) => {
                                                const prev = arr[idx - 1];
                                                const showEllipsis = prev != null && p - prev > 1;
                                                return (
                                                    <span key={p} className="flex items-center">
                                                        {showEllipsis && <span className="px-1 text-gray-300 text-xs">...</span>}
                                                        <button
                                                            type="button"
                                                            className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-semibold transition-colors ${
                                                                safePage === p
                                                                    ? "bg-emerald-900 text-white shadow-sm"
                                                                    : "text-gray-500 hover:bg-gray-100"
                                                            }`}
                                                            onClick={() => setCurrentPage(p)}
                                                        >
                                                            {p}
                                                        </button>
                                                    </span>
                                                );
                                            })}
                                        <button
                                            type="button"
                                            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 transition-colors"
                                            disabled={safePage >= totalPages}
                                            onClick={() => setCurrentPage(safePage + 1)}
                                            aria-label="Proxima pagina"
                                        >
                                            <ChevronRight className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            )}

                        </>)}
                    </TabsContent>

                    {/* Deposits tab - horizontal tabs per deposit */}
                    <TabsContent value="deposits" className="mt-4">
                        <DepositTabsView
                            depositsMain={depositsMain as any[]}
                            properties={properties as any[]}
                            stockByProperty={stockByProperty}
                            onDeleteDeposit={(depId: string, depName: string, hasItems: boolean) => {
                                if (hasItems) {
                                    if (!confirm(`O deposito "${depName}" tem produtos vinculados. Os produtos ficarao "Sem deposito". Tem certeza que deseja remover?`)) return;
                                } else {
                                    if (!confirm(`Tem certeza que deseja remover o deposito "${depName}"?`)) return;
                                }
                                deleteDepositMutation.mutate(depId);
                            }}
                            deletingDeposit={deleteDepositMutation.isPending}
                        />
                    </TabsContent>

                    {/* Extrato de Estoque tab */}
                    <TabsContent value="extrato" className="mt-4 space-y-4">
                        {/* Extrato filters */}
                        <div className="bg-white rounded-xl shadow-sm p-4">
                            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-end gap-2 sm:gap-3">
                                <div className="w-full sm:min-w-[180px] sm:w-auto">
                                    <Label className="text-[10px] uppercase tracking-widest font-bold text-gray-400">Produto</Label>
                                    <Select value={extratoProduct} onValueChange={setExtratoProduct}>
                                        <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                                        <SelectContent>
                                            {productNames.map((p: string) => (
                                                <SelectItem key={p} value={p}>{p}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="w-full sm:min-w-[130px] sm:w-auto">
                                    <Label className="text-[10px] uppercase tracking-widest font-bold text-gray-400">Tipo</Label>
                                    <Select value={extratoType} onValueChange={setExtratoType}>
                                        <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="entry">Entrada</SelectItem>
                                            <SelectItem value="exit">Saida</SelectItem>
                                            <SelectItem value="adjustment">Ajuste</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="w-full sm:min-w-[150px] sm:w-auto">
                                    <Label className="text-[10px] uppercase tracking-widest font-bold text-gray-400">Deposito</Label>
                                    <Select value={extratoDeposit} onValueChange={setExtratoDeposit}>
                                        <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__none__">Sem deposito</SelectItem>
                                            {(depositsMain as any[]).map((d: any) => (
                                                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="w-full sm:min-w-[130px] sm:w-auto">
                                    <Label className="text-[10px] uppercase tracking-widest font-bold text-gray-400">Data Inicio</Label>
                                    <Input type="date" value={extratoStartDate} onChange={e => setExtratoStartDate(e.target.value)} className="h-9" />
                                </div>
                                <div className="w-full sm:min-w-[130px] sm:w-auto">
                                    <Label className="text-[10px] uppercase tracking-widest font-bold text-gray-400">Data Fim</Label>
                                    <Input type="date" value={extratoEndDate} onChange={e => setExtratoEndDate(e.target.value)} className="h-9" />
                                </div>
                                {(extratoProduct || extratoType || extratoDeposit || extratoStartDate || extratoEndDate) && (
                                    <Button variant="ghost" size="sm" className="h-9 text-red-500 hover:text-red-700" onClick={() => { setExtratoProduct(""); setExtratoType(""); setExtratoDeposit(""); setExtratoStartDate(""); setExtratoEndDate(""); }}>
                                        Limpar
                                    </Button>
                                )}
                            </div>
                        </div>

                        {extratoLoading ? (
                            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
                        ) : extratoMovements.length === 0 ? (
                            <div className="bg-white rounded-xl shadow-sm py-16 text-center">
                                <FileText className="h-14 w-14 text-gray-200 mx-auto mb-4" />
                                <p className="text-gray-400 text-sm font-medium">Nenhuma movimentacao encontrada</p>
                            </div>
                        ) : (
                            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-gray-50 border-b border-gray-100">
                                                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Data</th>
                                                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Produto</th>
                                                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Deposito</th>
                                                <th className="text-center px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Tipo</th>
                                                <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Quantidade</th>
                                                <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Custo Unit.</th>
                                                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Lote</th>
                                                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Validade</th>
                                                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Nº Fatura</th>
                                                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Fornecedor</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {extratoMovements.map((m: any) => (
                                                <tr key={m.id} className="border-b border-gray-50 hover:bg-emerald-50/20 transition-colors">
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{new Date(m.createdAt).toLocaleDateString("pt-BR")}</td>
                                                    <td className="px-4 py-3 font-bold text-sm text-gray-900">{m.productName}</td>
                                                    <td className="px-4 py-3 text-sm text-gray-500">{m.depositName || "—"}</td>
                                                    <td className="px-4 py-3 text-center">
                                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${m.type === "entry" ? "bg-emerald-100 text-emerald-700" : m.type === "exit" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                                                            {m.type === "entry" ? "Entrada" : m.type === "exit" ? "Saida" : "Ajuste"}
                                                        </span>
                                                    </td>
                                                    <td className="text-right px-4 py-3">
                                                        <span className={`font-extrabold font-mono ${m.type === "entry" ? "text-emerald-600" : m.type === "exit" ? "text-red-600" : "text-amber-600"}`}>
                                                            {m.type === "entry" ? "+" : ""}{parseFloat(m.quantity).toFixed(2)}
                                                        </span>
                                                    </td>
                                                    <td className="text-right px-4 py-3 font-mono font-bold text-gray-900">{m.unitCost ? formatCurrency(m.unitCost) : "—"}</td>
                                                    <td className="px-4 py-3 text-xs text-gray-600">
                                                        {m.lote || <span className="text-gray-400">—</span>}
                                                    </td>
                                                    <td className="px-4 py-3 text-xs">
                                                        {(() => {
                                                            if (!m.expiryDate) return <span className="text-gray-400">—</span>;
                                                            const exp = new Date(m.expiryDate);
                                                            const now = new Date();
                                                            const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                                                            const formatted = exp.toLocaleDateString("pt-BR");
                                                            if (diffDays < 0) return <span className="text-red-600 font-bold">{formatted}</span>;
                                                            if (diffDays <= 30) return <span className="text-amber-600 font-bold">{formatted}</span>;
                                                            return <span className="text-gray-600">{formatted}</span>;
                                                        })()}
                                                    </td>
                                                    <td className="px-4 py-3 text-xs">
                                                        {m.referenceType === "invoice" && m.invoiceNumber ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 font-mono">
                                                                {m.invoiceNumber}
                                                            </span>
                                                        ) : m.referenceType === "correcao_caderno" ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                                                                Correção Caderno
                                                            </span>
                                                        ) : m.referenceType === "nota_credito_provedor" ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700">
                                                                NC Provedor
                                                            </span>
                                                        ) : m.referenceType === "nota_credito_emissao" ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700">
                                                                NC Emissão
                                                            </span>
                                                        ) : <span className="text-gray-400">—</span>}
                                                    </td>
                                                    <td className="px-4 py-3 text-xs text-gray-600 max-w-[220px] truncate" title={m.referenceType === "invoice" ? (m.invoiceSupplier || "") : "Entrada manual"}>
                                                        {m.referenceType === "invoice"
                                                            ? (m.invoiceSupplier || <span className="text-gray-400">—</span>)
                                                            : "Entrada manual"}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="transferencias" className="mt-4 space-y-6">
                        <div className="bg-white rounded-xl shadow-sm p-6">
                            <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <ArrowLeftRight className="h-4 w-4 text-emerald-600" />
                                Nova Transferencia
                            </h3>
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="transfer-product" className="text-[10px] uppercase tracking-widest font-bold text-gray-400">Produto</Label>
                                        <Select value={transferProductId} onValueChange={setTransferProductId}>
                                            <SelectTrigger id="transfer-product">
                                                <SelectValue placeholder="Selecione o produto" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {stock.map((s: any) => (
                                                    <SelectItem key={s.id} value={s.productId}>
                                                        {s.productName} ({parseFloat(s.quantity).toFixed(2)} {s.productUnit})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="transfer-qty" className="text-[10px] uppercase tracking-widest font-bold text-gray-400">Quantidade</Label>
                                        <Input
                                            id="transfer-qty"
                                            type="number"
                                            min="0.01"
                                            step="0.01"
                                            placeholder="0.00"
                                            value={transferQty}
                                            onChange={e => setTransferQty(e.target.value)}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="transfer-from" className="text-[10px] uppercase tracking-widest font-bold text-gray-400">Deposito Origem</Label>
                                        <Select value={transferFromWarehouse} onValueChange={setTransferFromWarehouse}>
                                            <SelectTrigger id="transfer-from">
                                                <SelectValue placeholder="Selecione origem" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Sem deposito</SelectItem>
                                                {depositsMain.map((p: any) => (
                                                    <SelectItem key={p.id} value={String(p.id)}>
                                                        {p.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="transfer-to" className="text-[10px] uppercase tracking-widest font-bold text-gray-400">Deposito Destino</Label>
                                        <Select value={transferToWarehouse} onValueChange={setTransferToWarehouse}>
                                            <SelectTrigger id="transfer-to">
                                                <SelectValue placeholder="Selecione destino" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Sem deposito</SelectItem>
                                                {depositsMain.filter((p: any) => String(p.id) !== transferFromWarehouse).map((p: any) => (
                                                    <SelectItem key={p.id} value={String(p.id)}>
                                                        {p.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="transfer-notes" className="text-[10px] uppercase tracking-widest font-bold text-gray-400">Observacao (opcional)</Label>
                                    <Input
                                        id="transfer-notes"
                                        placeholder="Motivo da transferencia..."
                                        value={transferNotes}
                                        onChange={e => setTransferNotes(e.target.value)}
                                    />
                                </div>

                                <Button
                                    onClick={handleTransfer}
                                    disabled={transferMutation.isPending}
                                    className="bg-emerald-700 hover:bg-emerald-800 text-white"
                                >
                                    {transferMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowLeftRight className="h-4 w-4 mr-2" />}
                                    Transferir
                                </Button>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100">
                                <h3 className="text-sm font-bold text-gray-900">Historico de Transferencias</h3>
                            </div>
                            {transferMovements.length === 0 ? (
                                <div className="py-16 text-center">
                                    <ArrowLeftRight className="h-14 w-14 text-gray-200 mx-auto mb-4" />
                                    <p className="text-gray-400 text-sm font-medium">Nenhuma transferencia registrada</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-gray-50 border-b border-gray-100">
                                                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Data</th>
                                                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Produto</th>
                                                <th className="text-center px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Tipo</th>
                                                <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Quantidade</th>
                                                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Deposito</th>
                                                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Observacao</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {transferMovements.map((m: any) => (
                                                <tr key={m.id} className="border-b border-gray-50 hover:bg-emerald-50/20 transition-colors">
                                                    <td className="px-4 py-3 text-sm text-gray-500">{new Date(m.date || m.createdAt).toLocaleDateString("pt-BR")}</td>
                                                    <td className="px-4 py-3 font-bold text-sm text-gray-900">{m.productName || m.product_name || "—"}</td>
                                                    <td className="px-4 py-3 text-center">
                                                        {m.type === "entrada" || m.type === "entry" ? (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                                                                <ArrowDownRight className="h-3 w-3" /> Entrada
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                                                                <ArrowUpRight className="h-3 w-3" /> Saida
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="text-right px-4 py-3 font-extrabold font-mono text-gray-900">{parseFloat(m.quantity).toFixed(2)}</td>
                                                    <td className="px-4 py-3 text-sm text-gray-500">{m.warehouseName || m.warehouse_name || "—"}</td>
                                                    <td className="px-4 py-3 text-gray-400 text-xs max-w-[200px] truncate">{m.notes || "—"}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="diesel" className="mt-4 space-y-4">
                        {(() => {
                            const dieselStock = (stock as any[]).filter((s: any) =>
                                s.productCategory === "Combustível" || s.productName?.toLowerCase().includes("diesel")
                            );
                            const dieselMovements = (movements as any[]).filter((m: any) =>
                                m.productCategory === "Combustível" || m.productName?.toLowerCase().includes("diesel")
                            );
                            const totalDieselL = dieselStock.reduce((sum: number, s: any) => sum + (parseFloat(s.quantity) || 0), 0);
                            const totalDieselValue = dieselStock.reduce((sum: number, s: any) => sum + ((parseFloat(s.quantity) || 0) * (parseFloat(s.averageCost) || 0)), 0);

                            return (
                                <>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                        <div className="bg-white rounded-xl shadow-sm border-l-4 border-amber-500 p-5">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Fuel className="h-4 w-4 text-amber-600" />
                                                <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Estoque Atual</span>
                                            </div>
                                            <p className="text-2xl font-extrabold text-gray-900">{fmtNum(totalDieselL)} L</p>
                                            <p className="text-xs text-gray-400 mt-1">litros disponiveis</p>
                                        </div>
                                        <div className="bg-white rounded-xl shadow-sm border-l-4 border-emerald-600 p-5">
                                            <div className="flex items-center gap-2 mb-2">
                                                <DollarSign className="h-4 w-4 text-emerald-600" />
                                                <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Valor em Estoque</span>
                                            </div>
                                            <p className="text-2xl font-extrabold text-emerald-700">{formatCurrency(totalDieselValue)}</p>
                                            <p className="text-xs text-gray-400 mt-1">valor total estimado</p>
                                        </div>
                                        <div className="bg-white rounded-xl shadow-sm border-l-4 border-blue-500 p-5">
                                            <div className="flex items-center gap-2 mb-2">
                                                <BarChart3 className="h-4 w-4 text-blue-500" />
                                                <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Movimentacoes</span>
                                            </div>
                                            <p className="text-2xl font-extrabold text-gray-900">{dieselMovements.length}</p>
                                            <p className="text-xs text-gray-400 mt-1">registros de diesel</p>
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                                        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                                            <Fuel className="h-4 w-4 text-amber-600" />
                                            <h3 className="text-sm font-bold text-gray-900">Movimentacoes de Diesel</h3>
                                        </div>
                                        {dieselMovements.length === 0 ? (
                                            <div className="py-16 text-center">
                                                <Fuel className="h-14 w-14 text-gray-200 mx-auto mb-4" />
                                                <p className="text-gray-400 text-sm font-medium">Nenhuma movimentacao de diesel registrada</p>
                                                <p className="text-xs text-gray-300 mt-1">Use o botao "Adicionar Diesel" para cadastrar entradas</p>
                                            </div>
                                        ) : (
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="bg-gray-50 border-b border-gray-100">
                                                            <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Data</th>
                                                            <th className="text-center px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Tipo</th>
                                                            <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Quantidade (L)</th>
                                                            <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Custo Unit.</th>
                                                            <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Equipamento</th>
                                                            <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Funcionario</th>
                                                            <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Horimetro/Km</th>
                                                            <th className="text-center px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Comprov.</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {dieselMovements.map((m: any) => (
                                                            <tr key={m.id} className="border-b border-gray-50 hover:bg-emerald-50/20 transition-colors">
                                                                <td className="px-4 py-3 text-sm text-gray-500">{new Date(m.createdAt).toLocaleDateString("pt-BR")}</td>
                                                                <td className="px-4 py-3 text-center">
                                                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${m.type === "entry" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                                                                        {m.type === "entry" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                                                        {m.type === "entry" ? "Entrada" : "Saida"}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-3 text-right font-extrabold font-mono text-gray-900">{fmtNum(parseFloat(m.quantity))}</td>
                                                                <td className="px-4 py-3 text-right font-bold font-mono text-gray-900">{m.unitCost ? formatCurrency(parseFloat(m.unitCost)) : "—"}</td>
                                                                <td className="px-4 py-3 text-sm text-gray-700">{m.equipmentName || "—"}</td>
                                                                <td className="px-4 py-3">
                                                                    {m.employeeName ? (
                                                                        <span className="inline-flex items-center gap-1 text-xs text-gray-700">
                                                                            <User className="h-3 w-3 text-emerald-600" />
                                                                            {m.employeeName}
                                                                        </span>
                                                                    ) : <span className="text-sm text-gray-400">—</span>}
                                                                </td>
                                                                <td className="px-4 py-3 text-right font-mono text-sm text-gray-500">{(() => {
                                                                    const match = m.notes?.match(/\(([^)]+)\)/);
                                                                    return match ? match[1] : "—";
                                                                })()}</td>
                                                                <td className="px-4 py-3 text-center">
                                                                    {m.referenceType === "pdv" && m.referenceId ? (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-7 w-7 p-0 hover:bg-emerald-50"
                                                                            disabled={loadingReceiptId === m.referenceId}
                                                                            onClick={async () => {
                                                                                setLoadingReceiptId(m.referenceId);
                                                                                try {
                                                                                    const res = await apiRequest("GET", `/api/farm/stock/receipt/${m.referenceId}`);
                                                                                    const data = await res.json();
                                                                                    setDieselReceipt(data);
                                                                                } catch {
                                                                                    toast({ title: "Erro", description: "Nao foi possivel carregar o comprovante", variant: "destructive" });
                                                                                } finally {
                                                                                    setLoadingReceiptId(null);
                                                                                }
                                                                            }}
                                                                        >
                                                                            {loadingReceiptId === m.referenceId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4 text-emerald-600" />}
                                                                        </Button>
                                                                    ) : <span className="text-sm text-gray-400">—</span>}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>

                                    {/* Modal de Comprovante de Abastecimento */}
                                    {dieselReceipt && (
                                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDieselReceipt(null)}>
                                            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                                                <div className="bg-emerald-700 text-white px-6 py-4 rounded-t-xl flex justify-between items-center">
                                                    <h3 className="font-bold text-lg flex items-center gap-2">
                                                        <FileText className="h-5 w-5" />
                                                        Comprovante de Abastecimento
                                                    </h3>
                                                    <button onClick={() => setDieselReceipt(null)} className="text-white/80 hover:text-white text-xl">&times;</button>
                                                </div>
                                                <div className="p-6 space-y-4">
                                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                                        <div>
                                                            <span className="text-gray-500 text-xs uppercase">Data</span>
                                                            <p className="font-medium">{new Date(dieselReceipt.appliedAt).toLocaleString("pt-BR")}</p>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-500 text-xs uppercase">Equipamento</span>
                                                            <p className="font-medium">{dieselReceipt.equipmentName || "—"}</p>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-500 text-xs uppercase">Quantidade</span>
                                                            <p className="font-medium">{parseFloat(dieselReceipt.quantity).toFixed(0)} L</p>
                                                        </div>
                                                        {dieselReceipt.odometer && (
                                                            <div>
                                                                <span className="text-gray-500 text-xs uppercase">Km</span>
                                                                <p className="font-medium">{dieselReceipt.odometer} km</p>
                                                            </div>
                                                        )}
                                                        {dieselReceipt.horimeter && (
                                                            <div>
                                                                <span className="text-gray-500 text-xs uppercase">Horímetro</span>
                                                                <p className="font-medium">{dieselReceipt.horimeter}h</p>
                                                            </div>
                                                        )}
                                                        {dieselReceipt.notes && (
                                                            <div className="col-span-2">
                                                                <span className="text-gray-500 text-xs uppercase">Observações</span>
                                                                <p className="font-medium">{dieselReceipt.notes}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="border-t pt-4">
                                                        <span className="text-gray-500 text-xs uppercase block mb-2">Assinatura</span>
                                                        {dieselReceipt.signatureBase64 ? (
                                                            <img src={dieselReceipt.signatureBase64} alt="Assinatura" className="max-h-32 mx-auto border rounded-lg p-2 bg-gray-50" />
                                                        ) : (
                                                            <p className="text-gray-400 text-sm text-center py-4">Sem assinatura registrada</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            );
                        })()}
                    </TabsContent>
                </Tabs>
            </div>
        </FarmLayout>
    );
}

function fmtNum(n: number, decimals = 2): string {
    return n.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

const CATEGORIES = [
    { value: "Herbicida", label: "Herbicida" },
    { value: "Fungicida", label: "Fungicida" },
    { value: "Inseticida", label: "Inseticida" },
    { value: "Fertilizante", label: "Fertilizante" },
    { value: "Semente", label: "Semente" },
    { value: "Adjuvante", label: "Adjuvante" },
    { value: "Outro", label: "Outro" },
];

const UNITS = ["LT", "KG", "UNI", "SC"];

function DieselEntryDialog({ onSuccess }: { onSuccess: () => void }) {
    const [open, setOpen] = useState(false);
    const { toast } = useToast();
    const [quantity, setQuantity] = useState("");
    const [unitCost, setUnitCost] = useState("");
    const [supplier, setSupplier] = useState("");
    const [depositId, setDepositId] = useState("");

    const { data: deposits = [] } = useQuery({
        queryKey: ["/api/farm/deposits"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/deposits"); return r.json(); },
    });

    const saveDiesel = useMutation({
        mutationFn: async () => {
            return apiRequest("POST", "/api/farm/stock", {
                name: "DIESEL",
                category: "Combustível",
                unit: "LT",
                quantity: parseFloat(quantity),
                unitCost: parseFloat(unitCost) || 0,
                depositId: depositId === "__none__" ? null : depositId || null,
            });
        },
        onSuccess: () => {
            toast({ title: "Diesel adicionado ao estoque!" });
            setOpen(false);
            setQuantity(""); setUnitCost(""); setSupplier(""); setDepositId("");
            onSuccess();
        },
        onError: (e: any) => {
            toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
        }
    });

    return (
        <Dialog open={open} onOpenChange={(o) => {
            setOpen(o);
            if (!o) { setQuantity(""); setUnitCost(""); setSupplier(""); setDepositId(""); }
        }}>
            <DialogTrigger asChild>
                <Button variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50">
                    <Fuel className="mr-2 h-4 w-4" /> Adicionar Diesel
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Fuel className="h-5 w-5 text-amber-600" />
                        Entrada de Diesel
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div>
                        <Label>Depósito</Label>
                        <Select value={depositId} onValueChange={setDepositId}>
                            <SelectTrigger><SelectValue placeholder="Selecione o depósito..." /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__none__">Sem depósito</SelectItem>
                                {(deposits as any[]).map((d: any) => (
                                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Quantidade (Litros) *</Label>
                            <Input
                                type="number"
                                step="any"
                                value={quantity}
                                onChange={e => setQuantity(e.target.value)}
                                placeholder="Ex: 5000"
                            />
                        </div>
                        <div>
                            <Label>Custo por Litro ($) *</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={unitCost}
                                onChange={e => setUnitCost(e.target.value)}
                                placeholder="Ex: 1.50"
                            />
                        </div>
                    </div>

                    {quantity && unitCost && (
                        <div className="bg-amber-50 p-3 rounded-lg text-sm">
                            <p className="text-amber-800 font-semibold">
                                Total: {formatCurrency(parseFloat(quantity) * parseFloat(unitCost))}
                            </p>
                        </div>
                    )}

                    <div>
                        <Label>Fornecedor (opcional)</Label>
                        <Input
                            value={supplier}
                            onChange={e => setSupplier(e.target.value)}
                            placeholder="Ex: Petrobras"
                        />
                    </div>

                    <Button
                        className="w-full bg-amber-600 hover:bg-amber-700 mt-2"
                        onClick={() => saveDiesel.mutate()}
                        disabled={saveDiesel.isPending || !quantity || parseFloat(quantity) <= 0}
                    >
                        {saveDiesel.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Confirmar Entrada de Diesel"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function ManualStockEntryDialog({ onSuccess }: { onSuccess: () => void }) {
    const [open, setOpen] = useState(false);
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const excelInputRef = useRef<HTMLInputElement>(null);

    const [name, setName] = useState("");
    const [category, setCategory] = useState("");
    const [unit, setUnit] = useState("");
    const [activeIngredient, setActiveIngredient] = useState("");
    const [quantity, setQuantity] = useState("");
    const [unitCost, setUnitCost] = useState("");
    const [lote, setLote] = useState("");
    const [expiryDate, setExpiryDate] = useState("");
    const [previewUrl, setPreviewUrl] = useState("");
    const [depositId, setDepositId] = useState("__none__");

    const { data: deposits = [] } = useQuery({
        queryKey: ["/api/farm/deposits"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/deposits"); return r.json(); },
    });

    const extractPhoto = useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData();
            formData.append("file", file);
            const res = await fetch("/api/farm/stock/extract-photo", {
                method: "POST",
                body: formData
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Falha ao analisar a foto");
            }
            return res.json();
        },
        onSuccess: (data: any) => {
            setName(data.name || "");
            setCategory(data.category || "");
            setUnit(data.unit || "LT");
            setActiveIngredient(data.activeIngredient || "");
            if (data.lote) setLote(data.lote);
            if (data.expiryDate) setExpiryDate(data.expiryDate);
            toast({ title: "Dados extraídos com sucesso!", description: "Revise e insira as quantidades." });
        },
        onError: (e) => {
            toast({ title: "Erro na IA", description: e.message, variant: "destructive" });
        }
    });

    const importExcel = useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData();
            formData.append("file", file);
            if (depositId !== "__none__") formData.append("depositId", depositId);
            const res = await fetch("/api/farm/stock/import-excel", {
                method: "POST",
                body: formData,
                credentials: "include",
            });
            if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Falha na importacao"); }
            return res.json();
        },
        onSuccess: (data: any) => {
            toast({ title: "Importacao concluida", description: `${data.imported} de ${data.total} produtos importados.` });
            setOpen(false);
            onSuccess();
        },
        onError: (e: any) => {
            toast({ title: "Erro na importacao", description: e.message, variant: "destructive" });
        },
    });

    const ingredientInputRef = useRef<HTMLInputElement>(null);
    const updateIngredients = useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData();
            formData.append("file", file);
            const res = await fetch("/api/farm/stock/update-ingredients", {
                method: "POST",
                body: formData,
                credentials: "include",
            });
            if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Falha ao atualizar"); }
            return res.json();
        },
        onSuccess: (data: any) => {
            toast({ title: "Ingredientes atualizados", description: `${data.updated} produtos atualizados de ${data.total} linhas.` });
            onSuccess();
        },
        onError: (e: any) => {
            toast({ title: "Erro ao atualizar ingredientes", description: e.message, variant: "destructive" });
        },
    });

    const saveStock = useMutation({
        mutationFn: async () => {
            return apiRequest("POST", "/api/farm/stock", {
                name,
                category,
                unit,
                activeIngredient,
                quantity: parseFloat(quantity),
                unitCost: parseFloat(unitCost),
                depositId: depositId === "__none__" ? null : depositId,
                lote: lote || null,
                expiryDate: expiryDate || null,
            });
        },
        onSuccess: () => {
            toast({ title: "Produto adicionado ao estoque!" });
            setOpen(false);
            onSuccess();
        },
        onError: (e: any) => {
            toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
        }
    });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setPreviewUrl(URL.createObjectURL(file));
            extractPhoto.mutate(file);
        }
    };

    const resetForm = () => {
        setName("");
        setCategory("");
        setUnit("");
        setActiveIngredient("");
        setQuantity("");
        setUnitCost("");
        setLote("");
        setExpiryDate("");
        setPreviewUrl("");
        setDepositId("__none__");
    };

    return (
        <Dialog open={open} onOpenChange={(o) => {
            setOpen(o);
            if (!o) resetForm();
        }}>
            <DialogTrigger asChild>
                <Button className="bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="mr-2 h-4 w-4" /> Adicionar Produto
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Entrada Avulsa no Estoque</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Deposito */}
                    <div>
                        <Label>Deposito</Label>
                        <Select value={depositId} onValueChange={setDepositId}>
                            <SelectTrigger><SelectValue placeholder="Selecione o deposito..." /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__none__">Sem deposito</SelectItem>
                                {(deposits as any[]).map((d: any) => (
                                    <SelectItem key={d.id} value={d.id}>
                                        {d.name} {d.depositType === "comercial" ? "(Comercial)" : "(Fazenda)"}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Hidden file inputs */}
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleFileChange} />
                    <input type="file" ref={excelInputRef} className="hidden" accept=".xlsx,.xls,.csv" onChange={(e) => { const file = e.target.files?.[0]; if (file) importExcel.mutate(file); e.target.value = ""; }} />
                    <input type="file" ref={ingredientInputRef} className="hidden" accept=".xlsx,.xls,.csv" onChange={(e) => { const file = e.target.files?.[0]; if (file) updateIngredients.mutate(file); e.target.value = ""; }} />

                    {/* Action buttons row */}
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="flex-1 h-10 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={extractPhoto.isPending}
                        >
                            {extractPhoto.isPending ? (
                                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Camera className="mr-1 h-3.5 w-3.5" />
                            )}
                            Foto (IA)
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="flex-1 h-10 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                            onClick={() => excelInputRef.current?.click()}
                            disabled={importExcel.isPending}
                        >
                            {importExcel.isPending ? (
                                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Upload className="mr-1 h-3.5 w-3.5" />
                            )}
                            Planilha
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="flex-1 h-10 text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
                            onClick={() => ingredientInputRef.current?.click()}
                            disabled={updateIngredients.isPending}
                        >
                            {updateIngredients.isPending ? (
                                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Upload className="mr-1 h-3.5 w-3.5" />
                            )}
                            Princ. Ativo
                        </Button>
                    </div>

                    {previewUrl && (
                        <div className="relative h-16 rounded-md overflow-hidden border">
                            <img src={previewUrl} className="w-full h-full object-cover opacity-50" />
                            <span className="absolute inset-0 flex items-center justify-center text-xs text-emerald-700 font-medium">Foto capturada</span>
                        </div>
                    )}

                    <hr className="my-1 border-emerald-100" />

                    {/* Formulário de Produto */}
                    <div className="space-y-3">
                        <Label className="text-emerald-800 font-semibold">Revise e Insira Quantidades</Label>

                        <div>
                            <Label>Nome do Produto *</Label>
                            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: SPHERE MAX" disabled={saveStock.isPending} />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Categoria</Label>
                                <Select value={category} onValueChange={setCategory}>
                                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                    <SelectContent>
                                        {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Unidade</Label>
                                <Select value={unit} onValueChange={setUnit}>
                                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                    <SelectContent>
                                        {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div>
                            <Label>Ingrediente Ativo <span className="text-gray-400 font-normal">(Opcional)</span></Label>
                            <Input value={activeIngredient} onChange={e => setActiveIngredient(e.target.value)} placeholder="Ex: Ciproconazol" disabled={saveStock.isPending} />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Quantidade Adicionada *</Label>
                                <Input type="number" step="0.01" min="0" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="Ex: 50" disabled={saveStock.isPending} />
                            </div>
                            <div>
                                <Label>Custo Unitário ($) *</Label>
                                <CurrencyInput value={unitCost} onValueChange={setUnitCost} disabled={saveStock.isPending} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Lote <span className="text-gray-400 font-normal">(Opcional)</span></Label>
                                <Input value={lote} onChange={e => setLote(e.target.value)} placeholder="Ex: PLN4I002" disabled={saveStock.isPending} />
                            </div>
                            <div>
                                <Label>Validade <span className="text-gray-400 font-normal">(Opcional)</span></Label>
                                <Input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} disabled={saveStock.isPending} />
                            </div>
                        </div>
                    </div>

                    <Button
                        className="w-full bg-emerald-600 hover:bg-emerald-700 mt-4"
                        onClick={() => saveStock.mutate()}
                        disabled={saveStock.isPending || extractPhoto.isPending || !name || !quantity || !unitCost}
                    >
                        {saveStock.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Package className="mr-2 h-4 w-4" />}
                        Confirmar Entrada no Estoque
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function NewDepositDialog({ onSuccess }: { onSuccess: () => void }) {
    const [open, setOpen] = useState(false);
    const [depositName, setDepositName] = useState("");
    const [depositType, setDepositType] = useState("fazenda");
    const [location, setLocation] = useState("");
    const { toast } = useToast();

    const createDeposit = useMutation({
        mutationFn: async () => {
            return apiRequest("POST", "/api/farm/deposits", {
                name: depositName,
                depositType,
                location: location || null,
            });
        },
        onSuccess: () => {
            toast({ title: "Deposito criado", description: `"${depositName}" foi adicionado.` });
            setDepositName("");
            setDepositType("fazenda");
            setLocation("");
            setOpen(false);
            onSuccess();
        },
        onError: (e: any) => {
            toast({ title: "Erro", description: e.message, variant: "destructive" });
        }
    });

    return (
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setDepositName(""); setDepositType("fazenda"); setLocation(""); } }}>
            <DialogTrigger asChild>
                <Button variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                    <Building2 className="mr-2 h-4 w-4" /> Novo Deposito
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>Novo Deposito / Armazem</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div>
                        <Label>Nome do Deposito *</Label>
                        <Input value={depositName} onChange={e => setDepositName(e.target.value)} placeholder="Ex: Armazem Central, Silo 1..." disabled={createDeposit.isPending} />
                    </div>
                    <div>
                        <Label>Tipo de Deposito *</Label>
                        <Select value={depositType} onValueChange={setDepositType}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="fazenda">Fazenda (uso proprio)</SelectItem>
                                <SelectItem value="comercial">Comercial (revenda)</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-1">
                            {depositType === "comercial" ? "Produtos deste deposito aparecerao nas vendas (Contas a Receber)" : "Produtos para uso interno da fazenda"}
                        </p>
                    </div>
                    <div>
                        <Label>Localizacao <span className="text-gray-400 font-normal">(Opcional)</span></Label>
                        <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Ex: Sede, Lote 5..." disabled={createDeposit.isPending} />
                    </div>
                    <Button
                        className="w-full bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => createDeposit.mutate()}
                        disabled={createDeposit.isPending || !depositName.trim()}
                    >
                        {createDeposit.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                        Criar Deposito
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function EditStockDialog({ stockItem, onSuccess }: { stockItem: any; onSuccess: () => void }) {
    const [open, setOpen] = useState(false);
    const { toast } = useToast();

    const { data: deposits = [] } = useQuery({
        queryKey: ["/api/farm/deposits"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/deposits"); return r.json(); },
    });

    const [productName, setProductName] = useState(stockItem.productName || "");
    const [productCategory, setProductCategory] = useState(stockItem.productCategory || "");
    const [productUnit, setProductUnit] = useState(stockItem.productUnit || "");
    const [quantity, setQuantity] = useState(stockItem.quantity.toString());
    const [averageCost, setAverageCost] = useState(stockItem.averageCost.toString());
    const [depositId, setDepositId] = useState(stockItem.depositId || "__none__");
    const [reason, setReason] = useState("");

    const updateStock = useMutation({
        mutationFn: async () => {
            return apiRequest("PUT", `/api/farm/stock/${stockItem.id}`, {
                quantity: parseFloat(quantity),
                averageCost: parseFloat(averageCost),
                reason,
                productName,
                productCategory,
                productUnit,
                depositId: depositId === "__none__" ? null : depositId,
            });
        },
        onSuccess: () => {
            toast({ title: "Estoque atualizado", description: "O ajuste foi registrado com sucesso." });
            setOpen(false);
            onSuccess();
        },
        onError: (e: any) => {
            toast({ title: "Erro na edição", description: e.message, variant: "destructive" });
        }
    });

    const resetForm = () => {
        setProductName(stockItem.productName || "");
        setProductCategory(stockItem.productCategory || "");
        setProductUnit(stockItem.productUnit || "");
        setQuantity(stockItem.quantity.toString());
        setAverageCost(stockItem.averageCost.toString());
        setDepositId(stockItem.depositId || "__none__");
        setReason("");
    };

    return (
        <Dialog open={open} onOpenChange={(o) => {
            setOpen(o);
            if (!o) resetForm();
        }}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-500 hover:text-amber-700 hover:bg-amber-50">
                    <Pencil className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Editar {stockItem.productName}</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div>
                        <Label>Nome do Produto</Label>
                        <Input value={productName} onChange={e => setProductName(e.target.value)} placeholder="Nome do produto" disabled={updateStock.isPending} />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label>Categoria</Label>
                            <Select value={productCategory} onValueChange={setProductCategory}>
                                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                <SelectContent>
                                    {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Unidade</Label>
                            <Select value={productUnit} onValueChange={setProductUnit}>
                                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                <SelectContent>
                                    {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div>
                        <Label>Deposito</Label>
                        <Select value={depositId} onValueChange={setDepositId}>
                            <SelectTrigger><SelectValue placeholder="Selecione o deposito..." /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__none__">Sem deposito</SelectItem>
                                {(deposits as any[]).map((d: any) => (
                                    <SelectItem key={d.id} value={d.id}>{d.name} {d.depositType === "comercial" || d.deposit_type === "comercial" ? "(Comercial)" : "(Fazenda)"}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <hr className="border-gray-200" />

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Quantidade Hoje</Label>
                            <Input type="number" step="0.01" value={quantity} onChange={e => setQuantity(e.target.value)} disabled={updateStock.isPending} />
                        </div>
                        <div>
                            <Label>Custo Medio ($)</Label>
                            <CurrencyInput value={averageCost} onValueChange={setAverageCost} disabled={updateStock.isPending} />
                        </div>
                    </div>

                    <div>
                        <Label>Motivo da Correcao *</Label>
                        <Input placeholder="Ex: Quebra, erro de recontagem..." value={reason} onChange={e => setReason(e.target.value)} disabled={updateStock.isPending} />
                    </div>

                    <Button
                        className="w-full bg-amber-600 hover:bg-amber-700 mt-4"
                        onClick={() => updateStock.mutate()}
                        disabled={updateStock.isPending || !quantity || !averageCost || !reason.trim()}
                    >
                        {updateStock.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        Aplicar Correcao
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ─── Deposit Tabs View (horizontal tabs instead of stacked cards) ────────────
function DepositTabsView({ depositsMain, properties, stockByProperty, onDeleteDeposit, deletingDeposit }: {
    depositsMain: any[]; properties: any[]; stockByProperty: Record<string, any[]>;
    onDeleteDeposit: (id: string, name: string, hasItems: boolean) => void; deletingDeposit: boolean;
}) {
    // Build deposit entries — only from real farmDeposits, not from properties
    const allDepositNames = new Set<string>();
    depositsMain.forEach((d: any) => allDepositNames.add(d.name));
    Object.keys(stockByProperty).forEach(k => allDepositNames.add(k));

    const depositEntries = Array.from(allDepositNames).map(name => {
        const items = stockByProperty[name] || [];
        const dep = depositsMain.find((d: any) => d.name === name);
        const depType = dep?.depositType || dep?.deposit_type || null;
        const depId = dep?.id || null;
        return { name, items, depType, depId };
    });
    depositEntries.sort((a, b) => {
        if (a.name === "Sem deposito") return 1;
        if (b.name === "Sem deposito") return -1;
        return b.items.length - a.items.length;
    });

    const [activeDeposit, setActiveDeposit] = useState(depositEntries[0]?.name || "");

    if (depositEntries.length === 0) return (
        <div className="bg-white rounded-xl shadow-sm py-16 text-center">
            <Building2 className="h-14 w-14 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-400 text-sm font-medium">Nenhum deposito cadastrado</p>
        </div>
    );

    const active = depositEntries.find(d => d.name === activeDeposit) || depositEntries[0];

    return (
        <div className="space-y-4">
            {/* Horizontal tab buttons */}
            <div className="flex gap-2 overflow-x-auto pb-2">
                {depositEntries.map(({ name: depName, items: depItems, depType }) => (
                    <button key={depName} type="button"
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all shadow-sm ${
                            activeDeposit === depName
                                ? "bg-emerald-900 text-white"
                                : "bg-white text-gray-600 hover:bg-gray-50"
                        }`}
                        onClick={() => setActiveDeposit(depName)}>
                        <Building2 className="h-3.5 w-3.5" />
                        {depName}
                        {depType && (
                            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                                activeDeposit === depName
                                    ? "bg-emerald-800 text-emerald-200"
                                    : depType === "comercial" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"
                            }`}>
                                {depType === "comercial" ? "COM" : "FAZ"}
                            </span>
                        )}
                        <span className={`text-[10px] ml-1 ${activeDeposit === depName ? "text-emerald-300" : "text-gray-400"}`}>({depItems.length})</span>
                    </button>
                ))}
            </div>

            {/* Active deposit content */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-emerald-600" />
                    <h3 className="text-sm font-bold text-gray-900">{active.name}</h3>
                    {active.depType && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${active.depType === "comercial" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>
                            {active.depType === "comercial" ? "Comercial" : "Fazenda"}
                        </span>
                    )}
                    <span className="ml-auto text-sm font-normal text-gray-400">
                        {active.items.length > 0
                            ? `${active.items.length} itens — ${formatCurrency(active.items.reduce((s: number, i: any) => s + (parseFloat(i.quantity) * parseFloat(i.averageCost)), 0))}`
                            : "Vazio"}
                    </span>
                    {active.depId && active.name !== "Sem deposito" && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                            onClick={() => onDeleteDeposit(active.depId, active.name, active.items.length > 0)}
                            disabled={deletingDeposit}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    )}
                </div>
                {active.items.length === 0 ? (
                    <div className="py-16 text-center">
                        <Package className="h-14 w-14 text-gray-200 mx-auto mb-4" />
                        <p className="text-gray-400 text-sm font-medium">Nenhum produto neste deposito</p>
                        <p className="text-xs text-gray-300 mt-1">Use "Adicionar Produto" para dar entrada</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Produto</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Categoria</th>
                                    <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Qtd</th>
                                    <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Custo Medio</th>
                                    <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Valor</th>
                                </tr>
                            </thead>
                            <tbody>
                                {active.items.map((s: any) => {
                                    const q = parseFloat(s.quantity);
                                    const c = parseFloat(s.averageCost);
                                    const cat = normalizeCategory(s.productCategory);
                                    const badge = CAT_BADGE_STYLES[cat] || CAT_BADGE_STYLES.Outros;
                                    return (
                                        <tr key={s.id} className="border-b border-gray-50 hover:bg-emerald-50/20 transition-colors">
                                            <td className="px-4 py-3 font-bold text-sm text-gray-900">{s.productName}</td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold ${badge.bg} ${badge.text}`}>{cat}</span>
                                            </td>
                                            <td className="text-right px-4 py-3 font-bold font-mono text-gray-900">{q.toFixed(2)} {s.productUnit}</td>
                                            <td className="text-right px-4 py-3 font-mono text-gray-500">{formatCurrency(c)}</td>
                                            <td className="text-right px-4 py-3 font-extrabold font-mono text-gray-900">{formatCurrency(q * c)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
