import React, { useState, lazy, Suspense } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Edit, Trash2, Search, Sprout, LogOut, BarChart3, Users, TrendingUp, DollarSign, Layers, Map, MapPin, PowerOff, Power, Activity, Filter, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProductsManagement } from "./admin-products";
import { ManualsManagement } from "./admin-manuals";
import { GlobalSilosManagement } from "@/components/admin/global-silos-management";
import { FileText } from "lucide-react";
import { Switch } from "@/components/ui/switch";

const NAV_ITEMS = [
    { value: "dashboard", icon: BarChart3, label: "Dashboard" },
    { value: "mapa", icon: Map, label: "Mapa" },
    { value: "farmers", icon: Users, label: "Agricultores" },
    { value: "products", icon: Sprout, label: "Catálogo" },
    { value: "manuals", icon: FileText, label: "Manuais" },
    { value: "modules", icon: Layers, label: "Módulos" },
    { value: "silos", icon: MapPin, label: "Silos Globais" },
    { value: "logs", icon: Activity, label: "Logs" },
];

export default function AdminFarmersPage() {
    const { user, logoutMutation } = useAuth();
    const [activeTab, setActiveTab] = useState("dashboard");

    return (
        <div className="flex flex-col h-screen bg-gray-50">
            {/* ===== GREEN HEADER WITH TABS ===== */}
            <header className="bg-gradient-to-r from-green-800 via-green-700 to-green-600 shadow-lg">
                {/* Top row */}
                <div className="px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/15 backdrop-blur p-2 rounded-xl">
                            <Sprout className="h-6 w-6 text-yellow-300" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-white">AgroFarm Admin</h1>
                            <p className="text-[11px] text-green-200">Gestão de Agricultores</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="text-right hidden md:block">
                            <p className="text-sm font-medium text-white">{user?.name}</p>
                            <p className="text-[11px] text-green-200 capitalize">{user?.role?.replace('_', ' ')}</p>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-white hover:bg-white/15 border border-white/20"
                            onClick={() => logoutMutation.mutate()}
                        >
                            <LogOut className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Tab Navigation Row */}
                <div className="px-4 pb-0">
                    <nav className="flex gap-1 overflow-x-auto scrollbar-hide">
                        {NAV_ITEMS.map((item) => {
                            const Icon = item.icon;
                            const isActive = activeTab === item.value;
                            return (
                                <button
                                    key={item.value}
                                    onClick={() => setActiveTab(item.value)}
                                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all whitespace-nowrap
                                        ${isActive
                                            ? "bg-gray-50 text-green-800 shadow-sm"
                                            : "text-green-100 hover:bg-white/10 hover:text-white"
                                        }`}
                                >
                                    <Icon className="h-4 w-4" />
                                    {item.label}
                                </button>
                            );
                        })}
                    </nav>
                </div>
            </header>

            {/* ===== CONTENT ===== */}
            {activeTab === "mapa" ? (
                <div className="flex-1 overflow-hidden">
                    <Suspense fallback={<div className="flex justify-center items-center h-full"><Loader2 className="h-10 w-10 animate-spin text-green-600" /></div>}>
                        <GlobalMapView />
                    </Suspense>
                </div>
            ) : (
                <main className="flex-1 overflow-auto p-6 max-w-7xl mx-auto w-full">
                    {activeTab === "dashboard" && <FarmersDashboard />}
                    {activeTab === "farmers" && <FarmersManagement />}
                    {activeTab === "products" && <ProductsManagement />}
                    {activeTab === "manuals" && <ManualsManagement />}
                    {activeTab === "modules" && <ModulesManagement />}
                    {activeTab === "silos" && <GlobalSilosManagement />}
                    {activeTab === "logs" && <ActivityLogsManagement />}
                </main>
            )}
        </div>
    );
}

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, AreaChart, Area, ResponsiveContainer, Legend } from "recharts";
import { MapContainer, TileLayer, Polygon, Popup, LayersControl } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// ==========================================
// COLOR CONFIG FOR PRODUCT CATEGORIES
// ==========================================
const CATEGORY_COLORS: Record<string, string> = {
    herbicida: "#f97316",
    fungicida: "#a855f7",
    inseticida: "#ef4444",
    fertilizante: "#3b82f6",
    semente: "#eab308",
    especialidades: "#06b6d4",
    adjuvante: "#06b6d4",
    nematicida: "#06b6d4",
    "oleo mineral": "#06b6d4",
    none: "#9ca3af",
};

const CHART_COLORS = ["#22c55e", "#16a34a", "#15803d", "#f97316", "#a855f7", "#3b82f6", "#eab308"];

function getCategoryColor(category: string | null) {
    if (!category) return CATEGORY_COLORS.none;
    const key = category.toLowerCase();
    return CATEGORY_COLORS[key] || CATEGORY_COLORS.especialidades;
}

// ==========================================
// FARMERS DASHBOARD — PREMIUM
// ==========================================
function FarmersDashboard() {
    const { data: stats, isLoading } = useQuery<any>({
        queryKey: ['/api/admin/farmers/dashboard/stats'],
    });

    if (isLoading) return (
        <div className="flex justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-green-600" />
        </div>
    );

    const fmt = (n: number) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

    const metricCards = [
        { label: "Área Total", value: `${fmt(stats?.totalArea || 0)} ha`, icon: TrendingUp, color: "#16a34a", bg: "#dcfce7" },
        { label: "Agricultores", value: stats?.totalFarmers || 0, icon: Users, color: "#2563eb", bg: "#dbeafe" },
        { label: "Propriedades", value: stats?.totalProperties || 0, icon: Sprout, color: "#f97316", bg: "#ffedd5" },
        { label: "Produtos", value: stats?.productPrices?.length || 0, icon: BarChart3, color: "#a855f7", bg: "#f3e8ff" },
    ];

    return (
        <div className="space-y-6">
            {/* Metric Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {metricCards.map((m) => {
                    const Icon = m.icon;
                    return (
                        <Card key={m.label} className="border-0 shadow-md">
                            <CardContent className="pt-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground">{m.label}</p>
                                        <p className="text-3xl font-bold mt-1" style={{ color: m.color }}>{m.value}</p>
                                    </div>
                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: m.bg }}>
                                        <Icon className="h-6 w-6" style={{ color: m.color }} />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Charts Row */}
            <div className="grid gap-6 lg:grid-cols-3">
                {/* Bar Chart — Applications by Month */}
                <Card className="border-0 shadow-md lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-base font-semibold">Aplicações por Mês</CardTitle>
                        <CardDescription>Últimos 6 meses — total de aplicações nos talhões</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={stats?.applicationsByMonth || []}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                                <YAxis tick={{ fontSize: 12 }} />
                                <Tooltip />
                                <Bar dataKey="count" name="Aplicações" fill="#16a34a" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Pie Chart — Culture Distribution */}
                <Card className="border-0 shadow-md">
                    <CardHeader>
                        <CardTitle className="text-base font-semibold">Culturas Principais</CardTitle>
                        <CardDescription>Distribuição por cultura dos agricultores</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={220}>
                            <PieChart>
                                <Pie
                                    data={stats?.cultureDistribution?.length > 0 ? stats.cultureDistribution : [{ name: "Sem dados", value: 1 }]}
                                    cx="50%" cy="50%"
                                    innerRadius={50} outerRadius={80}
                                    dataKey="value" nameKey="name"
                                >
                                    {(stats?.cultureDistribution || [{ name: "Sem dados", value: 1 }]).map((_: any, i: number) => (
                                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend iconType="circle" iconSize={10} />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Area Chart — Stock Movements */}
            <Card className="border-0 shadow-md">
                <CardHeader>
                    <CardTitle className="text-base font-semibold">Movimentações de Estoque</CardTitle>
                    <CardDescription>Entradas e saídas dos últimos 6 meses</CardDescription>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={stats?.stockByMonth || []}>
                            <defs>
                                <linearGradient id="colorEntries" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorExits" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                            <YAxis tick={{ fontSize: 12 }} />
                            <Tooltip />
                            <Legend />
                            <Area type="monotone" dataKey="entries" name="Entradas" stroke="#22c55e" fill="url(#colorEntries)" strokeWidth={2} />
                            <Area type="monotone" dataKey="exits" name="Saídas" stroke="#f97316" fill="url(#colorExits)" strokeWidth={2} />
                        </AreaChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Top Products Table */}
            <Card className="border-0 shadow-md">
                <CardHeader>
                    <CardTitle>Produtos Mais Utilizados</CardTitle>
                    <CardDescription>Top 10 produtos mais aplicados pelos agricultores</CardDescription>
                </CardHeader>
                <CardContent>
                    {stats?.mostUsedProducts && stats.mostUsedProducts.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>#</TableHead>
                                    <TableHead>Produto</TableHead>
                                    <TableHead className="text-right">Aplicações</TableHead>
                                    <TableHead className="text-right">Qtd. Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {stats.mostUsedProducts.map((product: any, index: number) => (
                                    <TableRow key={product.productId || index}>
                                        <TableCell className="text-muted-foreground text-sm">{index + 1}</TableCell>
                                        <TableCell className="font-medium">{product.productName || "N/A"}</TableCell>
                                        <TableCell className="text-right">
                                            <span className="bg-green-100 text-green-800 text-xs font-semibold px-2 py-1 rounded-full">{product.applicationCount}</span>
                                        </TableCell>
                                        <TableCell className="text-right">{fmt(product.totalQuantity)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">Nenhum produto utilizado ainda.</div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

// ==========================================
// GLOBAL MAP VIEW
// ==========================================
function GlobalMapView() {
    const { toast } = useToast();
    const [filterProduct, setFilterProduct] = useState<string>("__all__");
    const [filterCategory, setFilterCategory] = useState<string>("__all__");
    const [filterFarmer, setFilterFarmer] = useState<string>("__all__");

    const { data: mapData, isLoading } = useQuery<any>({
        queryKey: ["/api/admin/farmers/map-data"],
    });

    const { data: farmers } = useQuery<any[]>({
        queryKey: ["/api/admin/farmers"],
    });

    if (isLoading) return (
        <div className="flex flex-col items-center justify-center h-full gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-green-600" />
            <p className="text-muted-foreground text-sm">Carregando talhões...</p>
        </div>
    );

    const allPlots: any[] = mapData?.plots || [];
    const allProducts: any[] = mapData?.products || [];
    const categories = Array.from(new Set(allProducts.map((p: any) => p.category).filter(Boolean)));

    const filteredPlots = allPlots.filter((plot: any) => {
        const matchesFarmer = filterFarmer === "__all__" || plot.farmerId === filterFarmer;
        const matchesCategory = filterCategory === "__all__" || plot.applications.some((a: any) => a.category === filterCategory);
        const matchesProduct = filterProduct === "__all__" || plot.applications.some((a: any) => a.productId === filterProduct);
        return matchesFarmer && matchesCategory && matchesProduct;
    });

    const firstPlot = filteredPlots.find((p: any) => p.coordinates?.length > 0);
    const center: [number, number] = firstPlot
        ? [firstPlot.coordinates[0].lat, firstPlot.coordinates[0].lng]
        : [-23.5, -52.0];

    const getPlotColor = (plot: any) => {
        const lastApp = plot.applications[0];
        if (!lastApp) return CATEGORY_COLORS.none;
        return getCategoryColor(lastApp.category);
    };

    const legendItems = [
        { label: "Herbicida", color: "#f97316" },
        { label: "Fungicida", color: "#a855f7" },
        { label: "Inseticida", color: "#ef4444" },
        { label: "Fertilizante", color: "#3b82f6" },
        { label: "Semente", color: "#eab308" },
        { label: "Especialidades", color: "#06b6d4" },
        { label: "Sem aplicação", color: "#9ca3af" },
    ];

    if (allPlots.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Map className="h-16 w-16 mb-4 text-gray-300" />
                <p className="text-lg font-medium">Nenhum talhão com coordenadas</p>
                <p className="text-sm mt-1">Os agricultores precisam desenhar os talhões no mapa.</p>
            </div>
        );
    }

    return (
        <div className="flex h-full">
            {/* ===== LEFT SIDEBAR ===== */}
            <div className="w-[280px] shrink-0 bg-white border-r flex flex-col overflow-y-auto">
                {/* Title */}
                <div className="p-4 border-b bg-green-50">
                    <h3 className="text-base font-bold text-green-900 flex items-center gap-2">
                        <Map className="h-4 w-4" />
                        Mapa Global
                    </h3>
                    <p className="text-xs text-green-700 mt-0.5">
                        {filteredPlots.length} de {allPlots.length} talhões
                    </p>
                </div>

                {/* Filters */}
                <div className="p-4 space-y-3 border-b">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Filtros</p>

                    <div>
                        <label className="text-xs text-gray-500 mb-1 block">Agricultor</label>
                        <Select value={filterFarmer} onValueChange={setFilterFarmer}>
                            <SelectTrigger className="w-full h-8 text-xs">
                                <SelectValue placeholder="Todos" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__all__">Todos os agricultores</SelectItem>
                                {farmers?.map((f: any) => (
                                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <label className="text-xs text-gray-500 mb-1 block">Categoria</label>
                        <Select value={filterCategory} onValueChange={setFilterCategory}>
                            <SelectTrigger className="w-full h-8 text-xs">
                                <SelectValue placeholder="Todas" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__all__">Todas categorias</SelectItem>
                                {categories.map((cat: any) => (
                                    <SelectItem key={cat} value={cat} className="capitalize">{cat}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <label className="text-xs text-gray-500 mb-1 block">Produto</label>
                        <Select value={filterProduct} onValueChange={setFilterProduct}>
                            <SelectTrigger className="w-full h-8 text-xs">
                                <SelectValue placeholder="Todos" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__all__">Todos os produtos</SelectItem>
                                {allProducts.map((p: any) => (
                                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {(filterFarmer !== "__all__" || filterCategory !== "__all__" || filterProduct !== "__all__") && (
                        <button
                            onClick={() => { setFilterFarmer("__all__"); setFilterCategory("__all__"); setFilterProduct("__all__"); }}
                            className="text-xs text-red-500 underline w-full text-left"
                        >
                            ✕ Limpar filtros
                        </button>
                    )}
                </div>

                {/* Legend */}
                <div className="p-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Legenda</p>
                    <div className="space-y-1.5">
                        {legendItems.map(item => (
                            <div key={item.label} className="flex items-center gap-2 text-xs text-gray-700">
                                <div className="w-4 h-3 rounded-sm border border-gray-200" style={{ background: item.color }} />
                                {item.label}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ===== MAP ===== */}
            <div className="flex-1">
                <MapContainer center={center} zoom={12} style={{ height: "100%", width: "100%" }}>
                    <LayersControl position="topright">
                        <LayersControl.BaseLayer checked name="Ruas">
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />
                        </LayersControl.BaseLayer>
                        <LayersControl.BaseLayer name="Satélite">
                            <TileLayer
                                attribution='&copy; Esri'
                                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                            />
                        </LayersControl.BaseLayer>
                    </LayersControl>
                    {filteredPlots.map((plot: any) => {
                        if (!plot.coordinates || plot.coordinates.length < 3) return null;
                        const positions: [number, number][] = plot.coordinates.map((c: any) => [c.lat, c.lng]);
                        const color = getPlotColor(plot);
                        return (
                            <Polygon
                                key={plot.plotId}
                                positions={positions}
                                pathOptions={{ color, weight: 2, fillColor: color, fillOpacity: 0.4 }}
                            >
                                <Popup>
                                    <div className="min-w-[220px]">
                                        <div className="font-bold text-green-800 text-base mb-0.5">{plot.plotName}</div>
                                        <div className="text-xs text-gray-500 mb-2">{plot.propertyName} — {plot.farmerName}</div>
                                        <div className="text-xs mb-3 bg-gray-50 px-2 py-1 rounded">
                                            🌾 {plot.crop || "Cultura não informada"} · {plot.areaHa.toFixed(1)} ha
                                        </div>
                                        {plot.applications.length > 0 ? (
                                            <div>
                                                <p className="text-xs font-semibold text-gray-700 mb-1">Últimas aplicações:</p>
                                                <ul className="space-y-1">
                                                    {plot.applications.map((app: any, i: number) => (
                                                        <li key={i} className="text-xs flex items-start gap-1.5">
                                                            <span className="w-2 h-2 rounded-full mt-0.5 shrink-0" style={{ background: getCategoryColor(app.category), display: "inline-block" }} />
                                                            <span>
                                                                <b>{app.productName}</b> — {parseFloat(app.quantity).toFixed(2)}
                                                                <span className="text-gray-400 ml-1">
                                                                    {new Date(app.appliedAt).toLocaleDateString('pt-BR')}
                                                                </span>
                                                            </span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ) : (
                                            <p className="text-xs text-gray-400 italic">Sem aplicações registradas</p>
                                        )}
                                    </div>
                                </Popup>
                            </Polygon>
                        );
                    })}
                </MapContainer>
            </div>
        </div>
    );
}

function FarmersManagement() {
    const [editingFarmer, setEditingFarmer] = useState<any>(null);
    const [deletingFarmer, setDeletingFarmer] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    // Form states
    const [name, setName] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [whatsappNumber, setWhatsappNumber] = useState("");
    const [propertySize, setPropertySize] = useState("");
    const [mainCulture, setMainCulture] = useState("");
    const [region, setRegion] = useState("");

    const { toast } = useToast();

    // Fetch farmers
    const { data: farmers, isLoading } = useQuery<any[]>({
        queryKey: ['/api/admin/farmers'],
    });

    const createFarmerMutation = useMutation({
        mutationFn: async (data: any) => {
            return apiRequest("POST", "/api/admin/farmers", data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/admin/farmers'] });
            toast({ title: "Agricultor cadastrado com sucesso" });
            setIsCreateOpen(false);
            resetForm();
        },
        onError: (error: any) => {
            toast({
                title: "Erro ao cadastrar",
                description: error.message,
                variant: "destructive"
            });
        }
    });

    const updateFarmerMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: any }) => {
            return apiRequest("PATCH", `/api/admin/farmers/${id}`, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/admin/farmers'] });
            toast({ title: "Agricultor atualizado" });
            setEditingFarmer(null);
            resetForm();
        },
        onError: (error: any) => {
            toast({
                title: "Erro ao atualizar",
                description: error.message,
                variant: "destructive"
            });
        }
    });

    const deleteFarmerMutation = useMutation({
        mutationFn: async (id: string) => {
            return apiRequest("DELETE", `/api/admin/farmers/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/admin/farmers'] });
            toast({ title: "Agricultor removido" });
            setDeletingFarmer(null);
        },
        onError: (error: any) => {
            toast({
                title: "Erro ao remover",
                description: error.message,
                variant: "destructive"
            });
        }
    });

    const toggleActiveMutation = useMutation({
        mutationFn: async (id: string) => {
            return apiRequest("PATCH", `/api/admin/farmers/${id}/toggle-active`);
        },
        onSuccess: (data: any) => {
            queryClient.invalidateQueries({ queryKey: ['/api/admin/farmers'] });
            toast({
                title: data.isActive ? "Agricultor ativado" : "Agricultor desativado",
                description: data.isActive
                    ? `${data.name} voltou a ter acesso ao sistema.`
                    : `${data.name} foi suspenso e não conseguirá logar.`,
            });
        },
        onError: (error: any) => {
            toast({
                title: "Erro ao alterar status",
                description: error.message,
                variant: "destructive"
            });
        }
    });

    const resetForm = () => {
        setName("");
        setUsername("");
        setPassword("");
        setWhatsappNumber("");
        setPropertySize("");
        setMainCulture("");
        setRegion("");
    };

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        createFarmerMutation.mutate({
            name,
            username,
            password,
            whatsapp_number: whatsappNumber,
            property_size: propertySize ? parseFloat(propertySize) : 0,
            main_culture: mainCulture,
            region
        });
    };

    const startEdit = (farmer: any) => {
        setEditingFarmer(farmer);
        setName(farmer.name || "");
        setUsername(farmer.username || "");
        setWhatsappNumber(farmer.phone || "");
        setPropertySize(farmer.propertySize?.toString() || "");
        setMainCulture(farmer.mainCulture || "");
        setRegion(farmer.region || "");
        setPassword(""); // Don't fill password
    };

    const handleUpdate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingFarmer) return;

        const data: any = {
            name,
            username,
            phone: whatsappNumber,
            property_size: propertySize ? parseFloat(propertySize) : 0,
            main_culture: mainCulture,
            region
        };

        if (password) {
            data.password = password;
        }

        updateFarmerMutation.mutate({ id: editingFarmer.id, data });
    };

    const filteredFarmers = farmers?.filter(f =>
        f.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.username?.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Gestão de Agricultores</h2>
                <p className="text-muted-foreground">Cadastre, edite e gerencie os agricultores do sistema</p>
            </div>

            <div className="flex flex-col sm:flex-row justify-between gap-4 items-center">
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar agricultor..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Button onClick={() => { resetForm(); setIsCreateOpen(true); }} className="w-full sm:w-auto bg-green-600 hover:bg-green-700">
                    <Plus className="mr-2 h-4 w-4" /> Novo Agricultor
                </Button>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-green-600" />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredFarmers.map((farmer) => {
                        const isActive = farmer.isActive !== false;
                        return (
                        <Card key={farmer.id} className={`hover:shadow-lg transition-shadow border-l-4 ${isActive ? "border-l-green-500" : "border-l-gray-400 opacity-75"}`}>
                            <CardHeader className="pb-2">
                                <CardTitle className="flex justify-between items-start">
                                    <div className="flex items-center gap-2">
                                        <span className={isActive ? "" : "text-gray-400"}>{farmer.name}</span>
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isActive ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500"}`}>
                                            {isActive ? "Ativo" : "Inativo"}
                                        </span>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            title={isActive ? "Desativar acesso" : "Ativar acesso"}
                                            onClick={() => toggleActiveMutation.mutate(farmer.id)}
                                            disabled={toggleActiveMutation.isPending}
                                        >
                                            {isActive
                                                ? <PowerOff className="h-4 w-4 text-orange-500" />
                                                : <Power className="h-4 w-4 text-green-500" />
                                            }
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(farmer)}>
                                            <Edit className="h-4 w-4 text-blue-500" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeletingFarmer(farmer)}>
                                            <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                    </div>
                                </CardTitle>
                                <CardDescription>@{farmer.username}</CardDescription>
                            </CardHeader>
                            <CardContent className="text-sm space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <p className="text-muted-foreground text-xs">Região</p>
                                        <p className="font-medium">{farmer.region || "N/A"}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground text-xs">Tamanho</p>
                                        <p className="font-medium">{farmer.propertySize ? `${farmer.propertySize} ha` : "N/A"}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground text-xs">Cultura Principal</p>
                                        <p className="font-medium">{farmer.mainCulture || "N/A"}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground text-xs">WhatsApp</p>
                                        <p className="font-medium">{farmer.whatsapp_number || "N/A"}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        );
                    })}
                    {filteredFarmers.length === 0 && (
                        <div className="col-span-full text-center py-12 text-muted-foreground">
                            Nenhum agricultor encontrado.
                        </div>
                    )}
                </div>
            )}

            {/* Create Dialog */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Cadastrar Novo Agricultor</DialogTitle>
                        <DialogDescription>Preencha os dados abaixo para criar um novo acesso de agricultor.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreate} className="space-y-4 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Nome Completo</Label>
                                <Input value={name} onChange={e => setName(e.target.value)} required />
                            </div>
                            <div className="space-y-2">
                                <Label>Usuário de Acesso</Label>
                                <Input value={username} onChange={e => setUsername(e.target.value)} required />
                            </div>
                            <div className="space-y-2">
                                <Label>Senha</Label>
                                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                            </div>
                            <div className="space-y-2">
                                <Label>WhatsApp (595...)</Label>
                                <Input value={whatsappNumber} onChange={e => setWhatsappNumber(e.target.value)} placeholder="5959..." />
                            </div>
                            <div className="space-y-2">
                                <Label>Tamanho da Propriedade (ha)</Label>
                                <Input type="number" value={propertySize} onChange={e => setPropertySize(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Cultura Principal</Label>
                                <Input value={mainCulture} onChange={e => setMainCulture(e.target.value)} placeholder="Soja, Milho..." />
                            </div>
                            <div className="space-y-2">
                                <Label>Região</Label>
                                <Input value={region} onChange={e => setRegion(e.target.value)} placeholder="Cidade/Estado" />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                            <Button type="submit" className="bg-green-600 hover:bg-green-700" disabled={createFarmerMutation.isPending}>
                                {createFarmerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Cadastrar
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog open={!!editingFarmer} onOpenChange={(open) => !open && setEditingFarmer(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Editar Agricultor</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleUpdate} className="space-y-4 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Nome</Label>
                                <Input value={name} onChange={e => setName(e.target.value)} required />
                            </div>
                            <div className="space-y-2">
                                <Label>Usuário</Label>
                                <Input value={username} onChange={e => setUsername(e.target.value)} required />
                            </div>
                            <div className="space-y-2">
                                <Label>Nova Senha (opcional)</Label>
                                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Deixe em branco para manter" />
                            </div>
                            <div className="space-y-2">
                                <Label>WhatsApp</Label>
                                <Input value={whatsappNumber} onChange={e => setWhatsappNumber(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Tamanho (ha)</Label>
                                <Input type="number" value={propertySize} onChange={e => setPropertySize(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Cultura</Label>
                                <Input value={mainCulture} onChange={e => setMainCulture(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Região</Label>
                                <Input value={region} onChange={e => setRegion(e.target.value)} />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setEditingFarmer(null)}>Cancelar</Button>
                            <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={updateFarmerMutation.isPending}>
                                {updateFarmerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Salvar Alterações
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <Dialog open={!!deletingFarmer} onOpenChange={(open) => !open && setDeletingFarmer(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirmar Exclusão</DialogTitle>
                        <DialogDescription>
                            Tem certeza que deseja remover o agricultor <b>{deletingFarmer?.name}</b>?
                            <br /><br />
                            <span className="text-red-600 font-medium">Esta ação é irreversível</span> e irá apagar permanentemente todos os dados do agricultor: faturas, romaneios, talhões, silos, safras, estoque, despesas, fluxo de caixa e demais registros.
                            <br /><br />
                            Se quiser apenas suspender o acesso, use o botão de <b>desativar</b> no card do agricultor.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeletingFarmer(null)}>Cancelar</Button>
                        <Button variant="destructive" onClick={() => deleteFarmerMutation.mutate(deletingFarmer.id)} disabled={deleteFarmerMutation.isPending}>
                            {deleteFarmerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Excluir Definitivamente
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ==================== MODULOS MANAGEMENT ====================

const AVAILABLE_MODULES = [
    { key: "dashboard", label: "Início/Dashboard", defaultEnabled: true, alwaysOn: true },
    { key: "properties", label: "Propriedades", defaultEnabled: true },
    { key: "seasons", label: "Safras", defaultEnabled: true },
    { key: "invoices", label: "Faturas", defaultEnabled: true },
    { key: "stock", label: "Estoque", defaultEnabled: true },
    { key: "fleet", label: "Frota", defaultEnabled: true },
    { key: "applications", label: "Aplicações", defaultEnabled: true },
    { key: "plot_costs", label: "Custo/Talhão", defaultEnabled: true },
    { key: "expenses", label: "Despesas", defaultEnabled: true },
    { key: "cash_flow", label: "Fluxo de Caixa", defaultEnabled: true },
    { key: "terminals", label: "Terminais PDV", defaultEnabled: true },
    { key: "field_notebook", label: "Caderno de Campo", defaultEnabled: true },
    { key: "quotations", label: "Cotações", defaultEnabled: true },
    { key: "ndvi", label: "NDVI Satélite", defaultEnabled: true },
    { key: "weather", label: "Clima", defaultEnabled: true },
    { key: "reports", label: "Relatórios", defaultEnabled: true },
    { key: "romaneios", label: "Romaneios", defaultEnabled: true },
    { key: "accounts_payable", label: "Contas a Pagar", defaultEnabled: true },
    { key: "accounts_receivable", label: "Contas a Receber", defaultEnabled: true },
    { key: "dre", label: "DRE / Resultado", defaultEnabled: true },
    { key: "budget", label: "Orçamento por Safra", defaultEnabled: true },
    { key: "reconciliation", label: "Conciliação Bancária", defaultEnabled: true },
    { key: "profile", label: "Perfil", defaultEnabled: true, alwaysOn: true },
];

function ModulesManagement() {
    const { toast } = useToast();
    const [selectedFarmerId, setSelectedFarmerId] = useState<string | null>(null);

    const { data: farmers, isLoading: isLoadingFarmers } = useQuery<any[]>({
        queryKey: ["/api/admin/farmers"],
    });

    const { data: farmerModules, isLoading: isLoadingModules } = useQuery<any[]>({
        queryKey: [`/api/admin/farmers/${selectedFarmerId}/modules`],
        enabled: !!selectedFarmerId,
    });

    const updateModuleMutation = useMutation({
        mutationFn: async ({ moduleKey, enabled }: { moduleKey: string, enabled: boolean }) => {
            if (!selectedFarmerId) return;
            const res = await apiRequest("PUT", `/api/admin/farmers/${selectedFarmerId}/modules`, {
                moduleKey,
                enabled
            });
            if (!res.ok) throw new Error("Falha ao atualizar módulo");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`/api/admin/farmers/${selectedFarmerId}/modules`] });
            toast({ title: "Módulo atualizado", description: "Configuração do cliente alterada." });
        },
        onError: () => {
            toast({ title: "Erro", description: "Não foi possível atualizar o módulo.", variant: "destructive" });
        }
    });

    if (isLoadingFarmers) return <div className="p-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-green-600" /></div>;

    const handleToggle = (moduleKey: string, currentEnabled: boolean) => {
        updateModuleMutation.mutate({ moduleKey, enabled: !currentEnabled });
    };

    return (
        <Card className="border-0 shadow-md">
            <CardHeader className="bg-white border-b sticky top-0 z-10">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <CardTitle className="text-2xl text-green-900 flex items-center gap-2">
                            <Layers className="h-6 w-6" />
                            Gestão de Módulos por Cliente
                        </CardTitle>
                        <CardDescription>Ative ou desative funcionalidades para cada agricultor de forma individual</CardDescription>
                    </div>

                    <Select value={selectedFarmerId || ""} onValueChange={setSelectedFarmerId}>
                        <SelectTrigger className="w-full md:w-[300px]">
                            <SelectValue placeholder="Selecione um agricultor..." />
                        </SelectTrigger>
                        <SelectContent>
                            {farmers?.map((f: any) => (
                                <SelectItem key={f.id} value={f.id}>
                                    {f.name} - {f.document || "Sem doc"}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent className="p-6">
                {!selectedFarmerId ? (
                    <div className="text-center py-12 text-gray-500">
                        Selecione um agricultor no topo para visualizar e editar seus módulos.
                    </div>
                ) : isLoadingModules ? (
                    <div className="py-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-green-600" /></div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {AVAILABLE_MODULES.map((mod) => {
                            // Find current status from DB, fallback to defaultEnabled
                            const dbModule = farmerModules?.find((m: any) => m.moduleKey === mod.key);
                            const isEnabled = dbModule ? dbModule.enabled : mod.defaultEnabled;

                            return (
                                <div key={mod.key} className="flex items-center justify-between p-4 border rounded-xl bg-white shadow-sm">
                                    <div className="flex flex-col space-y-1">
                                        <Label className={`text-base font-semibold ${mod.alwaysOn ? 'text-gray-400' : 'text-gray-800'}`}>
                                            {mod.label}
                                        </Label>
                                        <span className="text-xs text-muted-foreground font-mono bg-gray-100 flex-none self-start px-2 py-0.5 rounded">
                                            {mod.key}
                                        </span>
                                    </div>
                                    <Switch
                                        checked={isEnabled || mod.alwaysOn}
                                        onCheckedChange={() => handleToggle(mod.key, isEnabled)}
                                        disabled={mod.alwaysOn || updateModuleMutation.isPending}
                                    />
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// ==================== ACTIVITY LOGS ====================

const ENTITY_LABELS: Record<string, string> = {
    invoices: "Faturas",
    stock: "Estoque",
    expenses: "Despesas",
    employees: "Funcionarios",
    equipment: "Equipamentos",
    properties: "Propriedades",
    cash: "Caixa",
    employee_access: "Acesso Func.",
    accounts: "Contas",
    invoice: "Faturas",
    romaneios: "Romaneios",
    applications: "Aplicacoes",
};

const ACTION_CONFIG: Record<string, { label: string; color: string }> = {
    create: { label: "Criar", color: "bg-green-100 text-green-800 border-green-200" },
    update: { label: "Editar", color: "bg-blue-100 text-blue-800 border-blue-200" },
    delete: { label: "Excluir", color: "bg-red-100 text-red-800 border-red-200" },
    confirm: { label: "Confirmar", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
    login: { label: "Login", color: "bg-purple-100 text-purple-800 border-purple-200" },
    enable: { label: "Habilitar", color: "bg-green-100 text-green-800 border-green-200" },
    disable: { label: "Desabilitar", color: "bg-orange-100 text-orange-800 border-orange-200" },
    POST: { label: "POST", color: "bg-green-100 text-green-800 border-green-200" },
    PUT: { label: "PUT", color: "bg-blue-100 text-blue-800 border-blue-200" },
    DELETE: { label: "DELETE", color: "bg-red-100 text-red-800 border-red-200" },
};

function ActivityLogsManagement() {
    const [filterUserId, setFilterUserId] = useState("");
    const [filterEntity, setFilterEntity] = useState("");
    const [filterAction, setFilterAction] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [page, setPage] = useState(1);
    const [expandedRow, setExpandedRow] = useState<string | null>(null);

    const queryParams = new URLSearchParams();
    queryParams.set("page", String(page));
    queryParams.set("limit", "50");
    if (filterUserId) queryParams.set("userId", filterUserId);
    if (filterEntity) queryParams.set("entity", filterEntity);
    if (filterAction) queryParams.set("action", filterAction);
    if (startDate) queryParams.set("startDate", startDate);
    if (endDate) queryParams.set("endDate", endDate);

    const { data, isLoading } = useQuery<{ logs: any[]; total: number; page: number; totalPages: number }>({
        queryKey: [`/api/farm/admin/activity-logs?${queryParams.toString()}`],
    });

    const handleSearch = () => {
        setPage(1);
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return "-";
        const d = new Date(dateStr);
        return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
    };

    return (
        <Card className="border-0 shadow-md">
            <CardHeader className="bg-white border-b">
                <CardTitle className="text-2xl text-green-900 flex items-center gap-2">
                    <Activity className="h-6 w-6" />
                    Logs de Atividade
                </CardTitle>
                <CardDescription>Registro de todas as acoes realizadas no sistema</CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
                {/* Filter bar */}
                <div className="flex flex-wrap gap-3 items-end p-4 bg-gray-50 rounded-xl border">
                    <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-600">Filtros:</span>
                    </div>

                    <div className="flex flex-col gap-1">
                        <Label className="text-xs text-gray-500">Modulo</Label>
                        <Select value={filterEntity} onValueChange={(v) => setFilterEntity(v === "__all__" ? "" : v)}>
                            <SelectTrigger className="w-[160px] h-10">
                                <SelectValue placeholder="Todos" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__all__">Todos</SelectItem>
                                <SelectItem value="invoices">Faturas</SelectItem>
                                <SelectItem value="invoice">Faturas (confirm)</SelectItem>
                                <SelectItem value="stock">Estoque</SelectItem>
                                <SelectItem value="expenses">Despesas</SelectItem>
                                <SelectItem value="employees">Funcionarios</SelectItem>
                                <SelectItem value="employee_access">Acesso Func.</SelectItem>
                                <SelectItem value="equipment">Equipamentos</SelectItem>
                                <SelectItem value="properties">Propriedades</SelectItem>
                                <SelectItem value="cash">Caixa</SelectItem>
                                <SelectItem value="romaneios">Romaneios</SelectItem>
                                <SelectItem value="applications">Aplicacoes</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex flex-col gap-1">
                        <Label className="text-xs text-gray-500">Acao</Label>
                        <Select value={filterAction} onValueChange={(v) => setFilterAction(v === "__all__" ? "" : v)}>
                            <SelectTrigger className="w-[140px] h-10">
                                <SelectValue placeholder="Todas" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__all__">Todas</SelectItem>
                                <SelectItem value="create">Criar</SelectItem>
                                <SelectItem value="update">Editar</SelectItem>
                                <SelectItem value="delete">Excluir</SelectItem>
                                <SelectItem value="confirm">Confirmar</SelectItem>
                                <SelectItem value="enable">Habilitar</SelectItem>
                                <SelectItem value="disable">Desabilitar</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex flex-col gap-1">
                        <Label className="text-xs text-gray-500">Data Inicio</Label>
                        <Input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-[150px] h-10"
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <Label className="text-xs text-gray-500">Data Fim</Label>
                        <Input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-[150px] h-10"
                        />
                    </div>

                    <Button
                        onClick={handleSearch}
                        className="h-10 min-w-[44px] bg-green-700 hover:bg-green-800"
                    >
                        <Search className="h-4 w-4 mr-2" />
                        Buscar
                    </Button>
                </div>

                {/* Results */}
                {isLoading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
                    </div>
                ) : !data?.logs?.length ? (
                    <div className="text-center py-12 text-gray-500">
                        Nenhum registro encontrado.
                    </div>
                ) : (
                    <>
                        <div className="text-sm text-gray-500 px-1">
                            {data.total} registro{data.total !== 1 ? "s" : ""} encontrado{data.total !== 1 ? "s" : ""}
                        </div>
                        <div className="rounded-xl border overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-gray-50">
                                        <TableHead className="w-[150px]">Data/Hora</TableHead>
                                        <TableHead>Usuario</TableHead>
                                        <TableHead className="w-[120px]">Acao</TableHead>
                                        <TableHead className="w-[130px]">Modulo</TableHead>
                                        <TableHead>Detalhes</TableHead>
                                        <TableHead className="w-[120px]">IP</TableHead>
                                        <TableHead className="w-[50px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.logs.map((log: any) => {
                                        const actionCfg = ACTION_CONFIG[log.action] || { label: log.action, color: "bg-gray-100 text-gray-800 border-gray-200" };
                                        const entityLabel = ENTITY_LABELS[log.entity] || log.entity;
                                        const isExpanded = expandedRow === log.id;

                                        return (
                                            <React.Fragment key={log.id}>
                                                <TableRow
                                                    className="cursor-pointer hover:bg-gray-50 transition-colors"
                                                    onClick={() => setExpandedRow(isExpanded ? null : log.id)}
                                                >
                                                    <TableCell className="text-xs font-mono text-gray-600">
                                                        {formatDate(log.created_at)}
                                                    </TableCell>
                                                    <TableCell className="text-sm font-medium">
                                                        {log.user_name || log.user_id?.substring(0, 8)}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className={`text-xs ${actionCfg.color}`}>
                                                            {actionCfg.label}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-sm">{entityLabel}</TableCell>
                                                    <TableCell className="text-xs text-gray-500 max-w-[200px] truncate">
                                                        {log.entity_id ? `ID: ${log.entity_id.substring(0, 8)}...` : "-"}
                                                    </TableCell>
                                                    <TableCell className="text-xs font-mono text-gray-400">
                                                        {log.ip_address || "-"}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Eye className="h-4 w-4 text-gray-400" />
                                                    </TableCell>
                                                </TableRow>
                                                {isExpanded && (
                                                    <TableRow key={`${log.id}-details`}>
                                                        <TableCell colSpan={7} className="bg-gray-50 p-4">
                                                            <div className="space-y-2">
                                                                <p className="text-xs font-semibold text-gray-600">Detalhes completos:</p>
                                                                <pre className="text-xs bg-white p-3 rounded-lg border overflow-x-auto max-h-48 text-gray-700 font-mono">
                                                                    {JSON.stringify(log.details, null, 2) || "Sem detalhes"}
                                                                </pre>
                                                                <div className="flex gap-4 text-xs text-gray-500">
                                                                    <span><b>Farmer ID:</b> {log.farmer_id}</span>
                                                                    <span><b>User ID:</b> {log.user_id}</span>
                                                                    {log.entity_id && <span><b>Entity ID:</b> {log.entity_id}</span>}
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Pagination */}
                        {data.totalPages > 1 && (
                            <div className="flex items-center justify-center gap-3 pt-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={page <= 1}
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    className="min-w-[44px] min-h-[44px]"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <span className="text-sm text-gray-600">
                                    Pagina {data.page} de {data.totalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={page >= data.totalPages}
                                    onClick={() => setPage(p => p + 1)}
                                    className="min-w-[44px] min-h-[44px]"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}
