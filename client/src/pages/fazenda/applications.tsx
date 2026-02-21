import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import FarmLayout from "@/components/fazenda/layout";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Calendar, Package, MapPin, User, Clock, Filter, X, Search } from "lucide-react";

export default function FarmApplications() {
    const [, setLocation] = useLocation();
    const { user } = useAuth();

    // Filter state
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [selectedProduct, setSelectedProduct] = useState("");
    const [showFilters, setShowFilters] = useState(false);

    const { data: applications = [], isLoading } = useQuery({
        queryKey: ["/api/farm/applications"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/applications"); return r.json(); },
        enabled: !!user,
    });

    // Extract unique product names for filter dropdown
    const uniqueProducts = useMemo(() => {
        const names = new Set<string>();
        for (const app of applications) {
            if (app.productName) names.add(app.productName);
        }
        return Array.from(names).sort();
    }, [applications]);

    const hasActiveFilters = dateFrom || dateTo || selectedProduct;

    // Filter applications first, then group
    const filtered = useMemo(() => {
        return applications.filter((app: any) => {
            // Date filter
            if (dateFrom) {
                const appDate = new Date(app.appliedAt).toISOString().slice(0, 10);
                if (appDate < dateFrom) return false;
            }
            if (dateTo) {
                const appDate = new Date(app.appliedAt).toISOString().slice(0, 10);
                if (appDate > dateTo) return false;
            }
            // Product filter
            if (selectedProduct && app.productName !== selectedProduct) return false;
            return true;
        });
    }, [applications, dateFrom, dateTo, selectedProduct]);

    // Group filtered applications by batch
    const grouped = useMemo(() => {
        const groups = new Map<string, { date: string; propertyName: string; propertyId: string; appliedBy: string; items: any[] }>();

        for (const app of filtered) {
            const dateKey = new Date(app.appliedAt).toISOString().slice(0, 19);
            const batchKey = `${dateKey}__${app.propertyId}`;

            if (!groups.has(batchKey)) {
                groups.set(batchKey, {
                    date: app.appliedAt,
                    propertyName: app.propertyName,
                    propertyId: app.propertyId,
                    appliedBy: app.appliedBy || "—",
                    items: [],
                });
            }
            groups.get(batchKey)!.items.push(app);
        }

        return Array.from(groups.values()).sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
    }, [filtered]);

    const clearFilters = () => {
        setDateFrom("");
        setDateTo("");
        setSelectedProduct("");
    };

    return (
        <FarmLayout>
            <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                        <h1 className="text-2xl font-bold text-emerald-800">Aplicações</h1>
                        <p className="text-emerald-600 text-sm">Registro de aplicações de insumos por talhão</p>
                    </div>
                    {applications.length > 0 && (
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${showFilters || hasActiveFilters
                                    ? "bg-emerald-600 text-white shadow-md"
                                    : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                                }`}
                        >
                            <Filter className="h-4 w-4" />
                            Filtros
                            {hasActiveFilters && (
                                <span className="w-5 h-5 bg-white text-emerald-700 rounded-full text-[10px] font-bold flex items-center justify-center">
                                    {[dateFrom, dateTo, selectedProduct].filter(Boolean).length}
                                </span>
                            )}
                        </button>
                    )}
                </div>

                {/* Filter panel */}
                {showFilters && (
                    <Card className="border-emerald-200 bg-emerald-50/50 overflow-hidden">
                        <CardContent className="p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-semibold text-emerald-800 flex items-center gap-2">
                                    <Search className="h-4 w-4" /> Filtrar aplicações
                                </p>
                                {hasActiveFilters && (
                                    <button onClick={clearFilters} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                                        <X className="h-3 w-3" /> Limpar
                                    </button>
                                )}
                            </div>

                            {/* Date range */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-medium text-gray-600 mb-1 block">Data início</label>
                                    <input
                                        type="date"
                                        value={dateFrom}
                                        onChange={(e) => setDateFrom(e.target.value)}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-gray-600 mb-1 block">Data fim</label>
                                    <input
                                        type="date"
                                        value={dateTo}
                                        onChange={(e) => setDateTo(e.target.value)}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                </div>
                            </div>

                            {/* Product select */}
                            <div>
                                <label className="text-xs font-medium text-gray-600 mb-1 block">Produto</label>
                                <select
                                    value={selectedProduct}
                                    onChange={(e) => setSelectedProduct(e.target.value)}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                >
                                    <option value="">Todos os produtos</option>
                                    {uniqueProducts.map((name) => (
                                        <option key={name} value={name}>{name}</option>
                                    ))}
                                </select>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Results count when filtered */}
                {hasActiveFilters && !isLoading && (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-xs font-bold">{filtered.length}</span>
                        <span>aplicações encontradas</span>
                        {filtered.length !== applications.length && (
                            <span className="text-gray-400">de {applications.length} total</span>
                        )}
                    </div>
                )}

                {isLoading ? (
                    <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
                ) : applications.length === 0 ? (
                    <Card className="border-emerald-100"><CardContent className="py-12 text-center">
                        <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">Nenhuma aplicação registrada</p>
                        <p className="text-gray-400 text-sm mt-1">Aplicações são registradas pelo PDV do depósito</p>
                    </CardContent></Card>
                ) : grouped.length === 0 ? (
                    <Card className="border-emerald-100"><CardContent className="py-12 text-center">
                        <Search className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">Nenhuma aplicação encontrada</p>
                        <p className="text-gray-400 text-sm mt-1">Tente alterar os filtros</p>
                        <button onClick={clearFilters} className="mt-3 text-sm text-emerald-600 hover:text-emerald-800 font-medium">
                            Limpar filtros
                        </button>
                    </CardContent></Card>
                ) : (
                    <div className="space-y-4">
                        {grouped.map((batch, idx) => {
                            const dateObj = new Date(batch.date);
                            const formattedDate = dateObj.toLocaleDateString("pt-BR", {
                                day: "2-digit", month: "2-digit", year: "numeric"
                            });
                            const formattedTime = dateObj.toLocaleTimeString("pt-BR", {
                                hour: "2-digit", minute: "2-digit"
                            });

                            // Group items by plot within the batch
                            const plotGroups = new Map<string, { plotName: string; products: any[] }>();
                            for (const item of batch.items) {
                                if (!plotGroups.has(item.plotId)) {
                                    plotGroups.set(item.plotId, { plotName: item.plotName, products: [] });
                                }
                                plotGroups.get(item.plotId)!.products.push(item);
                            }

                            return (
                                <Card key={idx} className="border-emerald-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                    {/* Header */}
                                    <div className="bg-gradient-to-r from-emerald-50 to-emerald-100/50 px-4 py-3 border-b border-emerald-100 flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                                                <Calendar className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-emerald-800 text-sm">{formattedDate}</p>
                                                <div className="flex items-center gap-2 text-xs text-emerald-600">
                                                    <Clock className="h-3 w-3" />
                                                    <span>{formattedTime}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-gray-500">
                                            <span className="flex items-center gap-1">
                                                <MapPin className="h-3 w-3" />
                                                {batch.propertyName}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <User className="h-3 w-3" />
                                                {batch.appliedBy}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Products grouped by plot */}
                                    <CardContent className="p-0">
                                        {Array.from(plotGroups.entries()).map(([plotId, plotGroup], pIdx) => (
                                            <div key={plotId} className={pIdx > 0 ? "border-t border-gray-100" : ""}>
                                                {/* Plot label */}
                                                <div className="px-4 py-2 bg-gray-50/80 flex items-center gap-2">
                                                    <MapPin className="h-3.5 w-3.5 text-emerald-500" />
                                                    <span className="text-xs font-semibold text-gray-600">{plotGroup.plotName}</span>
                                                </div>
                                                {/* Product list */}
                                                <div className="divide-y divide-gray-50">
                                                    {plotGroup.products.map((item: any) => (
                                                        <div key={item.id} className="px-4 py-2.5 flex items-center justify-between hover:bg-emerald-50/30 transition-colors">
                                                            <div className="flex items-center gap-3 min-w-0">
                                                                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                                                                    <Package className="h-4 w-4" />
                                                                </div>
                                                                <span className="text-sm font-medium text-gray-800 truncate">{item.productName}</span>
                                                            </div>
                                                            <span className="text-sm font-bold text-emerald-700 font-mono shrink-0 ml-2">
                                                                {parseFloat(item.quantity).toFixed(2)}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </CardContent>

                                    {/* Footer summary */}
                                    <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                                        <span>{batch.items.length} {batch.items.length === 1 ? "produto" : "produtos"} aplicados</span>
                                        <span>{plotGroups.size} {plotGroups.size === 1 ? "talhão" : "talhões"}</span>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>
        </FarmLayout>
    );
}
