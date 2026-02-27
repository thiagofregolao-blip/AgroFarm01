import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import FarmLayout from "@/components/fazenda/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Printer, FileBarChart, Package, ArrowDownUp, DollarSign, FileText, BarChart3, TrendingUp, Sprout, Tractor, X } from "lucide-react";

// ============================================================
// HELPERS
// ============================================================
const fmt = (n: number | string) => {
    const v = typeof n === "string" ? parseFloat(n) : n;
    if (isNaN(v)) return "0,00";
    return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtDate = (d: string | Date | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("pt-BR");
};

const typeLabel: Record<string, string> = {
    entry: "Entrada", exit: "Saída", adjustment: "Ajuste",
};
const refLabel: Record<string, string> = {
    invoice: "Fatura", pdv: "PDV", manual_adjustment: "Manual",
};
const categoryLabel: Record<string, string> = {
    diesel: "Diesel", frete: "Frete", mao_de_obra: "Mão de Obra",
    manutencao: "Manutenção", outro: "Outro",
    herbicida: "Herbicida", fungicida: "Fungicida", inseticida: "Inseticida",
    fertilizante: "Fertilizante", semente: "Semente", adjuvante: "Adjuvante",
};

// ============================================================
// TAB DEFINITIONS
// ============================================================
const TABS = [
    { key: "stock", label: "Estoque", icon: Package },
    { key: "movements", label: "Movimentações", icon: ArrowDownUp },
    { key: "expenses", label: "Despesas", icon: DollarSign },
    { key: "invoices", label: "Faturas", icon: FileText },
    { key: "cost-per-ha", label: "Custo/ha", icon: BarChart3 },
    { key: "price-history", label: "Preços", icon: TrendingUp },
    { key: "applications", label: "Aplicações", icon: Sprout },
    { key: "fleet", label: "Frota", icon: Tractor },
    { key: "season-summary", label: "Safra", icon: FileBarChart },
] as const;

type TabKey = typeof TABS[number]["key"];

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function FarmReports() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<TabKey>("stock");
    const printRef = useRef<HTMLDivElement>(null);

    // Filters state
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [category, setCategory] = useState("");
    const [supplier, setSupplier] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [propertyId, setPropertyId] = useState("");
    const [productName, setProductName] = useState("");
    const [equipmentId, setEquipmentId] = useState("");
    const [movementType, setMovementType] = useState("");
    const [seasonId, setSeasonId] = useState("");

    // Fetch dropdown options
    const { data: filterOptions } = useQuery({
        queryKey: ["farm-report-filter-options"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/reports/options/filters"); return r.json(); },
        enabled: !!user,
    });

    // Build query URL with all active filters
    const queryUrl = (() => {
        let url = `/api/farm/reports/${activeTab}`;
        const params = new URLSearchParams();
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);
        if (category) params.set("category", category);
        if (supplier) params.set("supplier", supplier);
        if (statusFilter) params.set("status", statusFilter);
        if (propertyId) params.set("propertyId", propertyId);
        if (productName) params.set("productName", productName);
        if (equipmentId) params.set("equipmentId", equipmentId);
        if (movementType) params.set("movementType", movementType);
        if (seasonId) params.set("seasonId", seasonId);
        const qs = params.toString();
        return qs ? `${url}?${qs}` : url;
    })();

    const { data, isLoading } = useQuery({
        queryKey: ["farm-reports", activeTab, startDate, endDate, category, supplier, statusFilter, propertyId, productName, equipmentId, movementType, seasonId],
        queryFn: async () => { const r = await apiRequest("GET", queryUrl); return r.json(); },
        enabled: !!user,
    });

    const clearFilters = () => {
        setStartDate(""); setEndDate(""); setCategory(""); setSupplier("");
        setStatusFilter(""); setPropertyId(""); setProductName(""); setEquipmentId("");
        setMovementType(""); setSeasonId("");
    };

    const hasActiveFilters = startDate || endDate || category || supplier || statusFilter || propertyId || productName || equipmentId || movementType || seasonId;

    const handleTabChange = (tab: TabKey) => {
        clearFilters();
        setActiveTab(tab);
    };

    const needsDateFilter = !["stock", "season-summary"].includes(activeTab);

    return (
        <FarmLayout>
            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    #print-area, #print-area * { visibility: visible; }
                    #print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 20px; }
                    .no-print { display: none !important; }
                    table { font-size: 11px; }
                    th, td { padding: 4px 8px !important; }
                }
            `}</style>

            <div className="space-y-4 p-2 lg:p-6 max-w-7xl mx-auto">
                {/* Title */}
                <div className="flex items-center justify-between no-print">
                    <div>
                        <h1 className="text-2xl font-bold text-emerald-800 flex items-center gap-2">
                            <FileBarChart className="h-6 w-6" /> Relatórios
                        </h1>
                        <p className="text-sm text-emerald-600">Dados consolidados da sua fazenda</p>
                    </div>
                    <Button onClick={() => window.print()} variant="outline" className="gap-2">
                        <Printer className="h-4 w-4" /> Imprimir PDF
                    </Button>
                </div>

                {/* Tab bar */}
                <div className="no-print overflow-x-auto">
                    <div className="flex gap-1 bg-gray-100 p-1 rounded-xl min-w-max">
                        {TABS.map(tab => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.key;
                            return (
                                <button
                                    key={tab.key}
                                    onClick={() => handleTabChange(tab.key)}
                                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${isActive
                                        ? "bg-emerald-600 text-white shadow-md"
                                        : "text-gray-600 hover:bg-white hover:text-emerald-700"
                                        }`}
                                >
                                    <Icon className="h-4 w-4" />
                                    <span className="hidden sm:inline">{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* FILTERS */}
                <Card className="no-print border-emerald-100">
                    <CardContent className="py-3">
                        <div className="flex flex-wrap items-end gap-3">
                            {/* Date filters — for most tabs */}
                            {needsDateFilter && (
                                <>
                                    <div className="min-w-[130px]">
                                        <Label className="text-xs text-gray-500">Data Início</Label>
                                        <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9" />
                                    </div>
                                    <div className="min-w-[130px]">
                                        <Label className="text-xs text-gray-500">Data Fim</Label>
                                        <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-9" />
                                    </div>
                                </>
                            )}

                            {/* Stock: filter by category */}
                            {activeTab === "stock" && filterOptions?.categories?.length > 0 && (
                                <div className="min-w-[160px]">
                                    <Label className="text-xs text-gray-500">Categoria</Label>
                                    <Select value={category} onValueChange={setCategory}>
                                        <SelectTrigger className="h-9"><SelectValue placeholder="Todas" /></SelectTrigger>
                                        <SelectContent>
                                            {filterOptions.categories.map((c: string) => (
                                                <SelectItem key={c} value={c}>{categoryLabel[c] || c}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {/* Movements: filter by type */}
                            {activeTab === "movements" && (
                                <div className="min-w-[140px]">
                                    <Label className="text-xs text-gray-500">Tipo</Label>
                                    <Select value={movementType} onValueChange={setMovementType}>
                                        <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="entry">Entrada</SelectItem>
                                            <SelectItem value="exit">Saída</SelectItem>
                                            <SelectItem value="adjustment">Ajuste</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {/* Expenses: filter by category */}
                            {activeTab === "expenses" && filterOptions?.expenseCategories?.length > 0 && (
                                <div className="min-w-[160px]">
                                    <Label className="text-xs text-gray-500">Categoria</Label>
                                    <Select value={category} onValueChange={setCategory}>
                                        <SelectTrigger className="h-9"><SelectValue placeholder="Todas" /></SelectTrigger>
                                        <SelectContent>
                                            {filterOptions.expenseCategories.map((c: string) => (
                                                <SelectItem key={c} value={c}>{categoryLabel[c] || c}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {/* Invoices: filter by supplier + status + season */}
                            {activeTab === "invoices" && (
                                <>
                                    {filterOptions?.suppliers?.length > 0 && (
                                        <div className="min-w-[180px]">
                                            <Label className="text-xs text-gray-500">Fornecedor</Label>
                                            <Select value={supplier} onValueChange={setSupplier}>
                                                <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                                                <SelectContent>
                                                    {filterOptions.suppliers.map((s: string) => (
                                                        <SelectItem key={s} value={s}>{s}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                    <div className="min-w-[140px]">
                                        <Label className="text-xs text-gray-500">Status</Label>
                                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                                            <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="pending">Pendente</SelectItem>
                                                <SelectItem value="confirmed">Confirmada</SelectItem>
                                                <SelectItem value="cancelled">Cancelada</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    {filterOptions?.seasons?.length > 0 && (
                                        <div className="min-w-[160px]">
                                            <Label className="text-xs text-gray-500">Safra</Label>
                                            <Select value={seasonId} onValueChange={setSeasonId}>
                                                <SelectTrigger className="h-9"><SelectValue placeholder="Todas" /></SelectTrigger>
                                                <SelectContent>
                                                    {filterOptions.seasons.map((s: any) => (
                                                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* Cost/ha + Applications: filter by property */}
                            {(activeTab === "cost-per-ha" || activeTab === "applications") && filterOptions?.properties?.length > 0 && (
                                <div className="min-w-[180px]">
                                    <Label className="text-xs text-gray-500">Propriedade</Label>
                                    <Select value={propertyId} onValueChange={setPropertyId}>
                                        <SelectTrigger className="h-9"><SelectValue placeholder="Todas" /></SelectTrigger>
                                        <SelectContent>
                                            {filterOptions.properties.map((p: any) => (
                                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {/* Price history: filter by product */}
                            {activeTab === "price-history" && filterOptions?.productNames?.length > 0 && (
                                <div className="min-w-[200px]">
                                    <Label className="text-xs text-gray-500">Produto</Label>
                                    <Select value={productName} onValueChange={setProductName}>
                                        <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                                        <SelectContent>
                                            {filterOptions.productNames.map((p: string) => (
                                                <SelectItem key={p} value={p}>{p}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {/* Fleet: filter by equipment */}
                            {activeTab === "fleet" && filterOptions?.equipment?.length > 0 && (
                                <div className="min-w-[180px]">
                                    <Label className="text-xs text-gray-500">Equipamento</Label>
                                    <Select value={equipmentId} onValueChange={setEquipmentId}>
                                        <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                                        <SelectContent>
                                            {filterOptions.equipment.map((e: any) => (
                                                <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {/* Clear button */}
                            {hasActiveFilters && (
                                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-red-500 hover:text-red-700 gap-1">
                                    <X className="h-3.5 w-3.5" /> Limpar
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Loading */}
                {isLoading && (
                    <div className="flex justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                    </div>
                )}

                {/* Report content */}
                {!isLoading && data && (
                    <div id="print-area" ref={printRef}>
                        <div className="hidden print:block text-center mb-4">
                            <h2 className="text-xl font-bold">AgroFarm — {TABS.find(t => t.key === activeTab)?.label}</h2>
                            <p className="text-sm text-gray-500">{new Date().toLocaleDateString("pt-BR")}</p>
                        </div>

                        {activeTab === "stock" && <StockReport data={data} />}
                        {activeTab === "movements" && <MovementsReport data={data} />}
                        {activeTab === "expenses" && <ExpensesReport data={data} />}
                        {activeTab === "invoices" && <InvoicesReport data={data} />}
                        {activeTab === "cost-per-ha" && <CostPerHaReport data={data} />}
                        {activeTab === "price-history" && <PriceHistoryReport data={data} />}
                        {activeTab === "applications" && <ApplicationsReport data={data} />}
                        {activeTab === "fleet" && <FleetReport data={data} />}
                        {activeTab === "season-summary" && <SeasonSummaryReport data={data} />}
                    </div>
                )}
            </div>
        </FarmLayout>
    );
}

// ============================================================
// SUMMARY CARDS
// ============================================================
function SummaryCards({ items }: { items: { label: string; value: string; color?: string }[] }) {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {items.map((item, i) => (
                <Card key={i} className="border-gray-100">
                    <CardContent className="py-3 px-4">
                        <p className="text-xs text-gray-500 mb-1">{item.label}</p>
                        <p className={`text-lg font-bold ${item.color || "text-emerald-700"}`}>{item.value}</p>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

// ============================================================
// REPORT TABLE WRAPPER
// ============================================================
function ReportTable({ headers, children }: { headers: string[]; children: React.ReactNode }) {
    return (
        <Card className="border-emerald-100 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-emerald-50 border-b border-emerald-100">
                        <tr>
                            {headers.map((h, i) => (
                                <th key={i} className="text-left px-4 py-3 text-xs font-semibold text-emerald-800 uppercase tracking-wider whitespace-nowrap">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {children}
                    </tbody>
                </table>
            </div>
        </Card>
    );
}

// ============================================================
// 1. STOCK REPORT
// ============================================================
function StockReport({ data }: { data: any[] }) {
    const totalValue = data.reduce((s: number, d: any) => s + (parseFloat(d.quantity) * parseFloat(d.averageCost)), 0);
    const totalItems = data.length;
    const byCategory: Record<string, number> = {};
    data.forEach((d: any) => {
        const cat = d.category || "sem_categoria";
        byCategory[cat] = (byCategory[cat] || 0) + (parseFloat(d.quantity) * parseFloat(d.averageCost));
    });

    return (
        <>
            <SummaryCards items={[
                { label: "Itens em Estoque", value: String(totalItems) },
                { label: "Valor Total", value: `R$ ${fmt(totalValue)}` },
                { label: "Categorias", value: String(Object.keys(byCategory).length) },
                { label: "Média/Item", value: `R$ ${fmt(totalItems > 0 ? totalValue / totalItems : 0)}` },
            ]} />
            {Object.keys(byCategory).length > 0 && (
                <Card className="border-gray-100 mb-4">
                    <CardContent className="py-4">
                        <p className="text-xs font-semibold text-gray-500 mb-3">VALOR POR CATEGORIA</p>
                        <div className="space-y-2">
                            {Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([cat, val]) => (
                                <div key={cat} className="flex items-center gap-3">
                                    <span className="text-xs w-24 text-gray-600 truncate">{categoryLabel[cat] || cat}</span>
                                    <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                                        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${Math.min((val / totalValue) * 100, 100)}%` }} />
                                    </div>
                                    <span className="text-xs font-semibold text-gray-700 w-24 text-right">R$ {fmt(val)}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
            <ReportTable headers={["Produto", "Categoria", "Qtd", "Unidade", "Custo Médio", "Valor Total"]}>
                {data.map((d: any) => (
                    <tr key={d.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium">{d.productName}</td>
                        <td className="px-4 py-2.5"><span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-xs">{categoryLabel[d.category] || d.category || "—"}</span></td>
                        <td className="px-4 py-2.5">{fmt(d.quantity)}</td>
                        <td className="px-4 py-2.5 text-gray-500">{d.unit}</td>
                        <td className="px-4 py-2.5">R$ {fmt(d.averageCost)}</td>
                        <td className="px-4 py-2.5 font-semibold">R$ {fmt(parseFloat(d.quantity) * parseFloat(d.averageCost))}</td>
                    </tr>
                ))}
                {data.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-gray-400">Nenhum item em estoque</td></tr>}
            </ReportTable>
        </>
    );
}

// ============================================================
// 2. MOVEMENTS REPORT
// ============================================================
function MovementsReport({ data }: { data: any[] }) {
    const entries = data.filter((d: any) => d.type === "entry" || parseFloat(d.quantity) > 0);
    const exits = data.filter((d: any) => d.type === "exit" || parseFloat(d.quantity) < 0);
    return (
        <>
            <SummaryCards items={[
                { label: "Total Movimentações", value: String(data.length) },
                { label: "Entradas", value: String(entries.length), color: "text-green-600" },
                { label: "Saídas", value: String(exits.length), color: "text-red-600" },
                { label: "Ajustes", value: String(data.filter((d: any) => d.type === "adjustment").length), color: "text-amber-600" },
            ]} />
            <ReportTable headers={["Data", "Produto", "Tipo", "Qtd", "Custo Unit.", "Referência", "Notas"]}>
                {data.map((d: any) => (
                    <tr key={d.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 whitespace-nowrap">{fmtDate(d.createdAt)}</td>
                        <td className="px-4 py-2.5 font-medium">{d.productName}</td>
                        <td className="px-4 py-2.5">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${d.type === "entry" ? "bg-green-50 text-green-700" : d.type === "exit" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
                                {typeLabel[d.type] || d.type}
                            </span>
                        </td>
                        <td className="px-4 py-2.5">{fmt(d.quantity)}</td>
                        <td className="px-4 py-2.5">{d.unitCost ? `R$ ${fmt(d.unitCost)}` : "—"}</td>
                        <td className="px-4 py-2.5 text-gray-500 text-xs">{refLabel[d.referenceType] || d.referenceType || "—"}</td>
                        <td className="px-4 py-2.5 text-gray-500 text-xs max-w-[200px] truncate">{d.notes || "—"}</td>
                    </tr>
                ))}
                {data.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-gray-400">Nenhuma movimentação encontrada</td></tr>}
            </ReportTable>
        </>
    );
}

// ============================================================
// 3. EXPENSES REPORT
// ============================================================
function ExpensesReport({ data }: { data: any[] }) {
    const totalAmount = data.reduce((s: number, d: any) => s + parseFloat(d.amount || 0), 0);
    const byCategory: Record<string, number> = {};
    data.forEach((d: any) => { const cat = d.category || "outro"; byCategory[cat] = (byCategory[cat] || 0) + parseFloat(d.amount || 0); });
    return (
        <>
            <SummaryCards items={[
                { label: "Total Despesas", value: `R$ ${fmt(totalAmount)}` },
                { label: "Quantidade", value: String(data.length) },
                { label: "Categorias", value: String(Object.keys(byCategory).length) },
                { label: "Média", value: `R$ ${fmt(data.length > 0 ? totalAmount / data.length : 0)}` },
            ]} />
            {Object.keys(byCategory).length > 0 && (
                <Card className="border-gray-100 mb-4">
                    <CardContent className="py-4">
                        <p className="text-xs font-semibold text-gray-500 mb-3">DESPESAS POR CATEGORIA</p>
                        <div className="space-y-2">
                            {Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([cat, val]) => (
                                <div key={cat} className="flex items-center gap-3">
                                    <span className="text-xs w-28 text-gray-600 truncate">{categoryLabel[cat] || cat}</span>
                                    <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                                        <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.min((val / totalAmount) * 100, 100)}%` }} />
                                    </div>
                                    <span className="text-xs font-semibold text-gray-700 w-24 text-right">R$ {fmt(val)}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
            <ReportTable headers={["Data", "Descrição", "Categoria", "Valor"]}>
                {data.map((d: any) => (
                    <tr key={d.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 whitespace-nowrap">{fmtDate(d.expenseDate)}</td>
                        <td className="px-4 py-2.5 font-medium">{d.description || "—"}</td>
                        <td className="px-4 py-2.5"><span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-xs">{categoryLabel[d.category] || d.category}</span></td>
                        <td className="px-4 py-2.5 font-semibold">R$ {fmt(d.amount)}</td>
                    </tr>
                ))}
                {data.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-gray-400">Nenhuma despesa encontrada</td></tr>}
            </ReportTable>
        </>
    );
}

// ============================================================
// 4. INVOICES REPORT
// ============================================================
function InvoicesReport({ data }: { data: any[] }) {
    const totalAmount = data.reduce((s: number, d: any) => s + parseFloat(d.totalAmount || 0), 0);
    const confirmed = data.filter((d: any) => d.status === "confirmed").length;
    return (
        <>
            <SummaryCards items={[
                { label: "Total Faturas", value: `R$ ${fmt(totalAmount)}` },
                { label: "Quantidade", value: String(data.length) },
                { label: "Confirmadas", value: String(confirmed), color: "text-green-600" },
                { label: "Pendentes", value: String(data.length - confirmed), color: "text-amber-600" },
            ]} />
            <ReportTable headers={["Data", "Nº Fatura", "Fornecedor", "Status", "Itens", "Valor"]}>
                {data.map((d: any) => (
                    <tr key={d.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 whitespace-nowrap">{fmtDate(d.issueDate || d.createdAt)}</td>
                        <td className="px-4 py-2.5">{d.invoiceNumber || "—"}</td>
                        <td className="px-4 py-2.5 font-medium">{d.supplier || "—"}</td>
                        <td className="px-4 py-2.5">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${d.status === "confirmed" ? "bg-green-50 text-green-700" : d.status === "cancelled" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
                                {d.status === "confirmed" ? "Confirmada" : d.status === "cancelled" ? "Cancelada" : "Pendente"}
                            </span>
                        </td>
                        <td className="px-4 py-2.5 text-center">{d.itemCount || 0}</td>
                        <td className="px-4 py-2.5 font-semibold">R$ {fmt(d.totalAmount)}</td>
                    </tr>
                ))}
                {data.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-gray-400">Nenhuma fatura encontrada</td></tr>}
            </ReportTable>
        </>
    );
}

// ============================================================
// 5. COST PER HA REPORT
// ============================================================
function CostPerHaReport({ data }: { data: any[] }) {
    const totalCost = data.reduce((s: number, d: any) => s + parseFloat(d.totalCost || 0), 0);
    const totalArea = data.reduce((s: number, d: any) => s + parseFloat(d.areaHa || 0), 0);
    return (
        <>
            <SummaryCards items={[
                { label: "Custo Total", value: `R$ ${fmt(totalCost)}` },
                { label: "Área Total", value: `${fmt(totalArea)} ha` },
                { label: "Custo Médio/ha", value: `R$ ${fmt(totalArea > 0 ? totalCost / totalArea : 0)}` },
                { label: "Talhões", value: String(data.length) },
            ]} />
            <ReportTable headers={["Propriedade", "Talhão", "Cultura", "Área (ha)", "Custo Total", "Custo/ha", "Aplicações"]}>
                {data.map((d: any, i: number) => (
                    <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-gray-500">{d.propertyName}</td>
                        <td className="px-4 py-2.5 font-medium">{d.plotName}</td>
                        <td className="px-4 py-2.5">{d.crop || "—"}</td>
                        <td className="px-4 py-2.5">{fmt(d.areaHa)}</td>
                        <td className="px-4 py-2.5 font-semibold">R$ {fmt(d.totalCost)}</td>
                        <td className="px-4 py-2.5 font-semibold text-emerald-700">R$ {fmt(d.costPerHa)}</td>
                        <td className="px-4 py-2.5 text-center">{d.applicationCount}</td>
                    </tr>
                ))}
                {data.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-gray-400">Nenhum talhão com aplicações</td></tr>}
            </ReportTable>
        </>
    );
}

// ============================================================
// 6. PRICE HISTORY REPORT
// ============================================================
function PriceHistoryReport({ data }: { data: any[] }) {
    const products = Array.from(new Set(data.map((d: any) => d.productName)));
    return (
        <>
            <SummaryCards items={[
                { label: "Registros", value: String(data.length) },
                { label: "Produtos", value: String(products.length) },
                { label: "Fornecedores", value: String(new Set(data.map((d: any) => d.supplier)).size) },
                { label: "Período", value: data.length > 0 ? `${fmtDate(data[data.length - 1]?.purchaseDate)} – ${fmtDate(data[0]?.purchaseDate)}` : "—" },
            ]} />
            <ReportTable headers={["Data", "Produto", "Fornecedor", "Preço Unit.", "Qtd", "Princípio Ativo"]}>
                {data.map((d: any) => (
                    <tr key={d.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 whitespace-nowrap">{fmtDate(d.purchaseDate)}</td>
                        <td className="px-4 py-2.5 font-medium">{d.productName}</td>
                        <td className="px-4 py-2.5">{d.supplier || "—"}</td>
                        <td className="px-4 py-2.5 font-semibold">R$ {fmt(d.unitPrice)}</td>
                        <td className="px-4 py-2.5">{fmt(d.quantity)}</td>
                        <td className="px-4 py-2.5 text-gray-500 text-xs">{d.activeIngredient || "—"}</td>
                    </tr>
                ))}
                {data.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-gray-400">Nenhum histórico de preço</td></tr>}
            </ReportTable>
        </>
    );
}

// ============================================================
// 7. APPLICATIONS REPORT
// ============================================================
function ApplicationsReport({ data }: { data: any[] }) {
    return (
        <>
            <SummaryCards items={[
                { label: "Total Aplicações", value: String(data.length) },
                { label: "Produtos", value: String(new Set(data.map((d: any) => d.productName)).size) },
                { label: "Talhões", value: String(new Set(data.filter((d: any) => d.plotName).map((d: any) => d.plotName)).size) },
                { label: "Operadores", value: String(new Set(data.filter((d: any) => d.appliedBy).map((d: any) => d.appliedBy)).size) },
            ]} />
            <ReportTable headers={["Data", "Produto", "Talhão", "Propriedade", "Qtd", "Operador", "Notas"]}>
                {data.map((d: any) => (
                    <tr key={d.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 whitespace-nowrap">{fmtDate(d.appliedAt)}</td>
                        <td className="px-4 py-2.5 font-medium">{d.productName}</td>
                        <td className="px-4 py-2.5">{d.plotName || "—"}</td>
                        <td className="px-4 py-2.5 text-gray-500">{d.propertyName || "—"}</td>
                        <td className="px-4 py-2.5">{fmt(d.quantity)}</td>
                        <td className="px-4 py-2.5">{d.appliedBy || "—"}</td>
                        <td className="px-4 py-2.5 text-gray-500 text-xs max-w-[200px] truncate">{d.notes || "—"}</td>
                    </tr>
                ))}
                {data.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-gray-400">Nenhuma aplicação encontrada</td></tr>}
            </ReportTable>
        </>
    );
}

// ============================================================
// 8. FLEET REPORT
// ============================================================
function FleetReport({ data }: { data: any[] }) {
    const totalQty = data.reduce((s: number, d: any) => s + parseFloat(d.quantity || 0), 0);
    const equipments = Array.from(new Set(data.map((d: any) => d.equipmentName)));
    return (
        <>
            <SummaryCards items={[
                { label: "Abastecimentos", value: String(data.length) },
                { label: "Total Litros", value: fmt(totalQty) },
                { label: "Equipamentos", value: String(equipments.length) },
                { label: "Média/Abast.", value: fmt(data.length > 0 ? totalQty / data.length : 0) },
            ]} />
            <ReportTable headers={["Data", "Equipamento", "Tipo", "Produto", "Qtd", "Horímetro", "Odômetro", "Operador"]}>
                {data.map((d: any) => (
                    <tr key={d.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 whitespace-nowrap">{fmtDate(d.appliedAt)}</td>
                        <td className="px-4 py-2.5 font-medium">{d.equipmentName}</td>
                        <td className="px-4 py-2.5 text-gray-500 text-xs">{d.equipmentType || "—"}</td>
                        <td className="px-4 py-2.5">{d.productName}</td>
                        <td className="px-4 py-2.5">{fmt(d.quantity)}</td>
                        <td className="px-4 py-2.5">{d.horimeter || "—"}</td>
                        <td className="px-4 py-2.5">{d.odometer || "—"}</td>
                        <td className="px-4 py-2.5">{d.appliedBy || "—"}</td>
                    </tr>
                ))}
                {data.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-gray-400">Nenhum abastecimento encontrado</td></tr>}
            </ReportTable>
        </>
    );
}

// ============================================================
// 9. SEASON SUMMARY REPORT
// ============================================================
function SeasonSummaryReport({ data }: { data: any }) {
    if (!data) return null;
    const costPerHa = parseFloat(data.totalArea) > 0
        ? (parseFloat(data.totalExpenses || 0) + parseFloat(data.totalInvoices || 0)) / parseFloat(data.totalArea)
        : 0;
    return (
        <>
            <SummaryCards items={[
                { label: "Área Total", value: `${fmt(data.totalArea)} ha` },
                { label: "Talhões", value: String(data.plotCount) },
                { label: "Valor Estoque", value: `R$ ${fmt(data.stockValue)}` },
                { label: "Itens Estoque", value: String(data.stockItems) },
            ]} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <Card className="border-emerald-100 bg-gradient-to-br from-emerald-50 to-white">
                    <CardContent className="py-4 text-center">
                        <p className="text-xs text-gray-500 mb-1">Faturas</p>
                        <p className="text-2xl font-bold text-emerald-700">R$ {fmt(data.totalInvoices)}</p>
                        <p className="text-xs text-gray-400 mt-1">{data.invoiceCount} faturas ({data.confirmedInvoices} confirmadas)</p>
                    </CardContent>
                </Card>
                <Card className="border-amber-100 bg-gradient-to-br from-amber-50 to-white">
                    <CardContent className="py-4 text-center">
                        <p className="text-xs text-gray-500 mb-1">Despesas</p>
                        <p className="text-2xl font-bold text-amber-700">R$ {fmt(data.totalExpenses)}</p>
                        <p className="text-xs text-gray-400 mt-1">{data.expenseCount} registros</p>
                    </CardContent>
                </Card>
                <Card className="border-blue-100 bg-gradient-to-br from-blue-50 to-white">
                    <CardContent className="py-4 text-center">
                        <p className="text-xs text-gray-500 mb-1">Custo Médio/ha</p>
                        <p className="text-2xl font-bold text-blue-700">R$ {fmt(costPerHa)}</p>
                        <p className="text-xs text-gray-400 mt-1">{data.applicationCount} aplicações realizadas</p>
                    </CardContent>
                </Card>
            </div>
            {data.seasons?.length > 0 && (
                <Card className="border-gray-100">
                    <CardContent className="py-4">
                        <p className="text-xs font-semibold text-gray-500 mb-3">SAFRAS CADASTRADAS</p>
                        <div className="space-y-2">
                            {data.seasons.map((s: any) => (
                                <div key={s.id} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50">
                                    <Sprout className="h-4 w-4 text-emerald-500" />
                                    <span className="font-medium text-sm">{s.name}</span>
                                    <span className={`ml-auto text-xs px-2 py-0.5 rounded ${s.isActive ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500"}`}>
                                        {s.isActive ? "Ativa" : "Encerrada"}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </>
    );
}
