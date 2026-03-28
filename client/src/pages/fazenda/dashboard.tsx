import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import FarmLayout from "@/components/fazenda/layout";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import {
    Warehouse, Loader2, RefreshCw, TrendingUp,
    Tractor, Wrench, Droplets, Wind, Thermometer, Fuel,
    X
} from "lucide-react";
import {
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
    PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, CartesianGrid,
    Legend
} from "recharts";
import { MapContainer, TileLayer, Polygon, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// ─── Colors ───────────────────────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
    fungicida: "#16a34a", herbicida: "#eab308", inseticida: "#f97316",
    fertilizante: "#3b82f6", semente: "#8b5cf6", adjuvante: "#ec4899",
    diesel: "#78716c", outros: "#6b7280",
};
const CROP_MAP_COLORS: Record<string, string> = {
    soja: "#22c55e", milho: "#eab308", trigo: "#f59e0b", algodao: "#e5e7eb", feijao: "#92400e",
};
function getCropColor(crop: string | null | undefined) {
    if (!crop) return "#6b7280";
    const k = crop.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return CROP_MAP_COLORS[k] || "#3b82f6";
}

// ─── Map auto-fit ─────────────────────────────────────────────────────────────
function MapAutoFit({ plots }: { plots: any[] }) {
    const map = useMap();
    useEffect(() => {
        const all: [number, number][] = [];
        plots.forEach((p: any) => {
            try {
                const c = typeof p.coordinates === "string" ? JSON.parse(p.coordinates) : p.coordinates;
                if (Array.isArray(c)) c.forEach((pt: any) => { if (pt.lat && pt.lng) all.push([pt.lat, pt.lng]); });
            } catch { }
        });
        if (all.length > 0) {
            const L = (window as any).L;
            if (L) map.fitBounds(L.latLngBounds(all), { padding: [20, 20] });
        }
    }, [plots, map]);
    return null;
}

// ─── Mini Silo SVG (compact version for dashboard) ────────────────────────────
function MiniSilo({ fillPercent, color, label, weight }: { fillPercent: number; color: string; label: string; weight: string }) {
    const W = 60, H = 90;
    const bodyX = 10, bodyW = 40, bodyTop = 25, bodyBot = 75;
    const cx = bodyX + bodyW / 2;
    const bodyH = bodyBot - bodyTop;
    const fillH = (Math.min(fillPercent, 100) / 100) * bodyH;
    const fillTop = bodyBot - fillH;
    const uid = label.replace(/[^a-zA-Z0-9]/g, "");

    return (
        <div className="flex flex-col items-center">
            <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
                <defs>
                    <linearGradient id={`sb-${uid}`} x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#8a9099" />
                        <stop offset="30%" stopColor="#c5cdd5" />
                        <stop offset="50%" stopColor="#e0e5ea" />
                        <stop offset="70%" stopColor="#c5cdd5" />
                        <stop offset="100%" stopColor="#8a9099" />
                    </linearGradient>
                    <clipPath id={`sc-${uid}`}><rect x={bodyX} y={bodyTop} width={bodyW} height={bodyH} rx={3} /></clipPath>
                </defs>
                {/* Body */}
                <rect x={bodyX} y={bodyTop} width={bodyW} height={bodyH} rx={3} fill={`url(#sb-${uid})`} stroke="#8a9199" strokeWidth={0.8} />
                {/* Panel lines */}
                {[0.25, 0.5, 0.75].map((pct, i) => (
                    <line key={i} x1={bodyX + 1} y1={bodyTop + bodyH * pct} x2={bodyX + bodyW - 1} y2={bodyTop + bodyH * pct}
                        stroke="#a0a8b0" strokeWidth={0.4} opacity={0.4} />
                ))}
                {/* Fill */}
                <g clipPath={`url(#sc-${uid})`}>
                    <rect x={bodyX} y={fillTop} width={bodyW} height={fillH + 0.5} fill={color} opacity={0.85} />
                </g>
                {/* Base */}
                <rect x={bodyX - 2} y={bodyBot - 1} width={bodyW + 4} height={3} rx={1.5} fill="#8a9199" />
                {/* Roof cone */}
                <polygon points={`${bodyX - 2},${bodyTop + 1} ${cx},${10} ${bodyX + bodyW + 2},${bodyTop + 1}`}
                    fill="#b0b8c2" stroke="#8a9199" strokeWidth={0.8} />
                {/* Chimney */}
                <rect x={cx - 3} y={4} width={6} height={8} rx={1} fill="#9aa2aa" stroke="#7a8290" strokeWidth={0.4} />
                <rect x={cx - 4.5} y={2} width={9} height={3} rx={1.5} fill="#8a9199" />
            </svg>
            <span className="text-xs font-bold text-gray-700 -mt-1">{weight}</span>
            <span className="text-[10px] text-gray-500 truncate max-w-[65px] text-center">{label}</span>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════
export default function FarmDashboard() {
    const [, setLocation] = useLocation();
    const { user, isLoading } = useAuth();
    const queryClient = useQueryClient();
    const [selectedPlot, setSelectedPlot] = useState<any>(null);

    // Pull-to-refresh
    const [refreshing, setRefreshing] = useState(false);
    const [pullDistance, setPullDistance] = useState(0);
    const touchStartY = useRef(0);
    const isPulling = useRef(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const PULL_THRESHOLD = 80;

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        setPullDistance(0);
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["/api/farm/stock"] }),
            queryClient.invalidateQueries({ queryKey: ["/api/farm/invoices"] }),
            queryClient.invalidateQueries({ queryKey: ["/api/farm/plots"] }),
            queryClient.invalidateQueries({ queryKey: ["/api/farm/romaneios/silos"] }),
            queryClient.invalidateQueries({ queryKey: ["/api/farm/equipment"] }),
            queryClient.invalidateQueries({ queryKey: ["/api/farm/applications"] }),
            queryClient.invalidateQueries({ queryKey: ["/api/farm/plot-costs"] }),
            queryClient.invalidateQueries({ queryKey: ["/api/farm/weather/stations"] }),
        ]);
        await new Promise(r => setTimeout(r, 400));
        setRefreshing(false);
    }, [queryClient]);

    const onTouchStart = useCallback((e: React.TouchEvent) => {
        const scrollTop = containerRef.current?.closest("main")?.scrollTop || 0;
        if (scrollTop <= 5) { touchStartY.current = e.touches[0].clientY; isPulling.current = true; }
    }, []);
    const onTouchMove = useCallback((e: React.TouchEvent) => {
        if (!isPulling.current || refreshing) return;
        const d = e.touches[0].clientY - touchStartY.current;
        if (d > 0) setPullDistance(Math.min(d * 0.5, PULL_THRESHOLD + 20));
    }, [refreshing]);
    const onTouchEnd = useCallback(() => {
        if (!isPulling.current) return;
        isPulling.current = false;
        if (pullDistance >= PULL_THRESHOLD && !refreshing) handleRefresh();
        else setPullDistance(0);
    }, [pullDistance, refreshing, handleRefresh]);

    // ─── Module access ─────────────────
    const isEmployee = user?.role === "funcionario_fazenda";
    const { data: myModules = [] } = useQuery<any[]>({
        queryKey: ["/api/farm/my-modules"], enabled: !!user && isEmployee,
    });
    const enabledModules = useMemo(() => {
        if (!isEmployee) return null;
        const s = new Set<string>();
        for (const m of myModules) { if (m.enabled) s.add(m.moduleKey); }
        return s;
    }, [isEmployee, myModules]);
    const hasModule = (k: string) => enabledModules === null || enabledModules.has(k);

    // ─── Data queries ─────────────────
    const { data: stock = [] } = useQuery({
        queryKey: ["/api/farm/stock"],
        queryFn: async () => (await apiRequest("GET", "/api/farm/stock")).json(),
        enabled: !!user,
    });

    const { data: invoices = [] } = useQuery<any[]>({
        queryKey: ["/api/farm/invoices"],
        queryFn: async () => (await apiRequest("GET", "/api/farm/invoices")).json(),
        enabled: !!user,
    });

    const { data: plots = [] } = useQuery<any[]>({
        queryKey: ["/api/farm/plots"],
        queryFn: async () => (await apiRequest("GET", "/api/farm/plots")).json(),
        enabled: !!user,
    });

    const { data: applications = [] } = useQuery<any[]>({
        queryKey: ["/api/farm/applications"],
        queryFn: async () => (await apiRequest("GET", "/api/farm/applications")).json(),
        enabled: !!user,
    });

    const { data: siloData } = useQuery<any>({
        queryKey: ["/api/farm/romaneios/silos"],
        queryFn: async () => (await apiRequest("GET", "/api/farm/romaneios/silos")).json(),
        enabled: !!user,
    });

    const { data: equipment = [] } = useQuery<any[]>({
        queryKey: ["/api/farm/equipment"],
        queryFn: async () => (await apiRequest("GET", "/api/farm/equipment")).json(),
        enabled: !!user,
    });

    const { data: plotCosts = [] } = useQuery<any[]>({
        queryKey: ["/api/farm/plot-costs"],
        queryFn: async () => (await apiRequest("GET", "/api/farm/plot-costs")).json(),
        enabled: !!user,
    });

    const { data: weatherStations = [] } = useQuery<any[]>({
        queryKey: ["/api/farm/weather/stations"],
        queryFn: async () => (await apiRequest("GET", "/api/farm/weather/stations")).json(),
        enabled: !!user,
    });

    // ─── Derived: Card 1 — Despesas mensais (faturas de entrada) ──────────────
    const monthlyExpenses = useMemo(() => {
        const map: Record<string, number> = {};
        invoices.forEach((inv: any) => {
            if (!inv.issueDate) return;
            const d = new Date(inv.issueDate);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            const label = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
            if (!map[key]) map[key] = 0;
            map[key] += parseFloat(inv.totalAmount || 0);
        });
        return Object.entries(map)
            .sort(([a], [b]) => a.localeCompare(b))
            .slice(-8)
            .map(([key, value]) => {
                const [, m] = key.split("-");
                const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
                return { month: months[parseInt(m) - 1] || m, value: Math.round(value) };
            });
    }, [invoices]);

    const totalExpenses = monthlyExpenses.reduce((s, m) => s + m.value, 0);
    const lastMonthVal = monthlyExpenses[monthlyExpenses.length - 1]?.value || 0;
    const prevMonthVal = monthlyExpenses[monthlyExpenses.length - 2]?.value || 0;
    const pctChange = prevMonthVal > 0 ? ((lastMonthVal - prevMonthVal) / prevMonthVal * 100) : 0;

    // ─── Derived: Card 2 — Plots with coordinates ────────────────────────────
    const plotsWithCoords = useMemo(() => plots.filter((p: any) => {
        try {
            const c = typeof p.coordinates === "string" ? JSON.parse(p.coordinates) : p.coordinates;
            return Array.isArray(c) && c.length >= 3;
        } catch { return false; }
    }), [plots]);

    // Applications count per plot
    const appCountByPlot = useMemo(() => {
        const map: Record<string, number> = {};
        applications.forEach((a: any) => {
            if (a.plotId) map[a.plotId] = (map[a.plotId] || 0) + 1;
        });
        return map;
    }, [applications]);

    // ─── Derived: Card 3 — Silos ──────────────────────────────────────────────
    const silos = siloData?.silos || [];
    const totalHarvest = siloData?.totalHarvest || 0;
    const maxSiloWeight = Math.max(...silos.map((s: any) => s.totalWeight || 0), 1);

    // ─── Derived: Card 4 — Stock by category ─────────────────────────────────
    const stockByCategory = useMemo(() => {
        const map: Record<string, { category: string; count: number; value: number }> = {};
        stock.forEach((s: any) => {
            const cat = (s.category || "outros").toLowerCase();
            if (!map[cat]) map[cat] = { category: cat, count: 0, value: 0 };
            map[cat].count += 1;
            map[cat].value += parseFloat(s.quantity || 0) * parseFloat(s.averageCost || 0);
        });
        return Object.values(map).sort((a, b) => b.value - a.value);
    }, [stock]);

    // ─── Derived: Card 5 — Plot costs bars + daily line ──────────────────────
    const plotCostBars = useMemo(() => {
        if (!plotCosts || !Array.isArray(plotCosts)) return [];
        // plotCosts may have .plots or be the array directly
        const arr = (plotCosts as any).plots || plotCosts;
        if (!Array.isArray(arr)) return [];
        return arr.slice(0, 8).map((p: any) => ({
            name: p.plotName || p.name || "?",
            cost: Math.round(parseFloat(p.totalCost || p.cost || 0)),
        }));
    }, [plotCosts]);

    const dailyAppCosts = useMemo(() => {
        const map: Record<string, number> = {};
        applications.forEach((a: any) => {
            const d = new Date(a.appliedAt || a.createdAt);
            const key = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
            if (!map[key]) map[key] = 0;
            map[key] += parseFloat(a.totalCost || a.quantity || 0) * parseFloat(a.unitPrice || a.cost || 0);
        });
        return Object.entries(map).sort(([a], [b]) => {
            const [da, ma] = a.split("/").map(Number);
            const [db, mb] = b.split("/").map(Number);
            return (ma * 100 + da) - (mb * 100 + db);
        }).slice(-14).map(([date, value]) => ({ date, value: Math.round(value) }));
    }, [applications]);

    // ─── Derived: Card 6 — Equipment + diesel ────────────────────────────────
    const equipmentByStatus = useMemo(() => {
        const active = equipment.filter((e: any) => e.status === "Ativo" || !e.status);
        const maint = equipment.filter((e: any) => e.status === "Manutenção" || e.status === "Manutencao");
        const inactive = equipment.filter((e: any) => e.status === "Inativo");
        return { active, maint, inactive };
    }, [equipment]);

    // Diesel consumption from applications (type = diesel or category = diesel)
    const dieselByEquipment = useMemo(() => {
        const map: Record<string, { name: string; liters: number }> = {};
        applications.forEach((a: any) => {
            const isDiesel = (a.productCategory || a.category || "").toLowerCase().includes("diesel") ||
                (a.productName || "").toLowerCase().includes("diesel");
            if (isDiesel && a.equipmentName) {
                if (!map[a.equipmentName]) map[a.equipmentName] = { name: a.equipmentName, liters: 0 };
                map[a.equipmentName].liters += parseFloat(a.quantity || 0);
            }
        });
        return Object.values(map).sort((a, b) => b.liters - a.liters);
    }, [applications]);

    // ─── Derived: Card 7 — Weather (first station) ───────────────────────────
    const mainStation = weatherStations[0];
    const currentWeather = mainStation?.currentWeather;

    // ─── Loading ─────────────────────────────────────────────────────────────
    if (isLoading) {
        return <FarmLayout><div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div></FarmLayout>;
    }

    function fmtCurrency(v: number) {
        if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
        if (v >= 1000) return `$${(v / 1000).toFixed(0)}K`;
        return `$${v.toFixed(0)}`;
    }
    function fmtWeight(kg: number) {
        if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`;
        return `${kg.toFixed(0)}kg`;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // RENDER
    // ══════════════════════════════════════════════════════════════════════════
    return (
        <FarmLayout>
            <div ref={containerRef} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} className="space-y-3">
                {/* Pull-to-refresh */}
                {(pullDistance > 0 || refreshing) && (
                    <div className="flex items-center justify-center transition-all duration-200 overflow-hidden" style={{ height: refreshing ? 48 : pullDistance }}>
                        <div className={`flex items-center gap-2 text-emerald-600 ${refreshing ? "animate-pulse" : ""}`}>
                            <RefreshCw className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`} style={{ transform: refreshing ? undefined : `rotate(${(pullDistance / PULL_THRESHOLD) * 360}deg)` }} />
                            <span className="text-sm font-medium">{refreshing ? "Atualizando..." : pullDistance >= PULL_THRESHOLD ? "Solte para atualizar" : "Puxe para atualizar"}</span>
                        </div>
                    </div>
                )}

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Painel Geral</h1>
                        <p className="text-sm text-gray-500">Ola, {user?.name?.split(" ")[0]}</p>
                    </div>
                    <button onClick={handleRefresh} disabled={refreshing}
                        className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors text-sm font-medium disabled:opacity-50">
                        <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Atualizar
                    </button>
                </div>

                {/* ═══════════════════════════════════════════════════════════
                    ROW 1: Despesas Mensais | Mapa Talhoes | Silos
                ═══════════════════════════════════════════════════════════ */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">

                    {/* CARD 1 — Despesas Mensais (Area Chart) */}
                    {hasModule("invoices") && (
                        <Card className="md:col-span-3 border-emerald-200/50 cursor-pointer hover:shadow-lg transition-shadow"
                            onClick={() => setLocation("/fazenda/faturas")}>
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between mb-1">
                                    <h3 className="text-sm font-bold text-gray-700">Despesas Mensais</h3>
                                    {pctChange !== 0 && (
                                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-0.5 ${pctChange > 0 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"}`}>
                                            <TrendingUp className={`w-3 h-3 ${pctChange < 0 ? "rotate-180" : ""}`} />
                                            {Math.abs(pctChange).toFixed(1)}%
                                        </span>
                                    )}
                                </div>
                                <div className="h-[110px] -mx-2">
                                    {monthlyExpenses.length > 1 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={monthlyExpenses}>
                                                <defs>
                                                    <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3} />
                                                        <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                                                <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={35}
                                                    tickFormatter={(v: number) => fmtCurrency(v)} />
                                                <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, "Despesa"]} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                                                <Area type="monotone" dataKey="value" stroke="#16a34a" fill="url(#expGrad)" strokeWidth={2} dot={false} />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-gray-300 text-xs">Sem faturas</div>
                                    )}
                                </div>
                                <div className="flex items-baseline gap-2 mt-1">
                                    <span className="text-xl font-bold text-gray-800">{fmtCurrency(totalExpenses)}</span>
                                    <span className="text-xs text-gray-400">Total periodo</span>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* CARD 2 — Mapa Talhoes (Leaflet satellite + polygon outlines) */}
                    {hasModule("properties") && (
                        <Card className="md:col-span-5 border-emerald-200/50 overflow-hidden">
                            <CardContent className="p-0 relative">
                                <div className="absolute top-3 left-3 z-[400] bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 shadow-sm">
                                    <h3 className="text-sm font-bold text-gray-700">Mapa dos Talhoes</h3>
                                </div>
                                <div className="h-[200px] md:h-[195px]">
                                    {plotsWithCoords.length > 0 ? (
                                        <MapContainer center={[-25.5, -54.6]} zoom={13} className="h-full w-full z-0"
                                            zoomControl={false} attributionControl={false}>
                                            <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
                                            <MapAutoFit plots={plotsWithCoords} />
                                            {plotsWithCoords.map((p: any) => {
                                                const coords = typeof p.coordinates === "string" ? JSON.parse(p.coordinates) : p.coordinates;
                                                const positions = coords.map((c: any) => [c.lat, c.lng] as [number, number]);
                                                const appCount = appCountByPlot[p.id] || 0;
                                                return (
                                                    <Polygon key={p.id} positions={positions}
                                                        pathOptions={{ color: "#f59e0b", weight: 2, fillOpacity: 0.15, fillColor: "#f59e0b" }}
                                                        eventHandlers={{ click: () => setSelectedPlot({ ...p, appCount }) }}>
                                                        <Popup>
                                                            <div className="text-sm min-w-[160px]">
                                                                <strong className="text-emerald-800">{p.name}</strong>
                                                                {p.crop && <p className="text-gray-600">Cultura: {p.crop}</p>}
                                                                <p className="text-gray-600">Area: {parseFloat(p.areaHa || 0).toFixed(1)} ha</p>
                                                                <p className="font-semibold text-emerald-700 mt-1">{appCount} aplicacoes realizadas</p>
                                                            </div>
                                                        </Popup>
                                                    </Polygon>
                                                );
                                            })}
                                        </MapContainer>
                                    ) : (
                                        <div className="h-full bg-gradient-to-br from-emerald-50 to-emerald-100 flex flex-col items-center justify-center text-gray-400 text-sm">
                                            Cadastre talhoes com coordenadas
                                        </div>
                                    )}
                                </div>
                                {/* Legend */}
                                {plotsWithCoords.length > 0 && (
                                    <div className="absolute bottom-2 left-2 z-[400] bg-white/90 backdrop-blur-sm rounded-lg px-2 py-1 shadow-sm flex gap-3">
                                        {(() => {
                                            const crops = Array.from(new Set(plotsWithCoords.map((p: any) => p.crop).filter(Boolean))) as string[];
                                            return crops.slice(0, 4).map((c: string) => (
                                                <div key={c} className="flex items-center gap-1">
                                                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: getCropColor(c) }} />
                                                    <span className="text-[10px] font-medium text-gray-600">{c}</span>
                                                </div>
                                            ));
                                        })()}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Selected plot detail card */}
                    {selectedPlot && (
                        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/30" onClick={() => setSelectedPlot(null)}>
                            <Card className="w-[90%] max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
                                <CardContent className="p-5">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-lg font-bold text-emerald-800">{selectedPlot.name}</h3>
                                        <button onClick={() => setSelectedPlot(null)} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-5 h-5 text-gray-400" /></button>
                                    </div>
                                    {selectedPlot.crop && <p className="text-sm text-gray-600 mb-1">Cultura: <strong>{selectedPlot.crop}</strong></p>}
                                    <p className="text-sm text-gray-600 mb-1">Area: <strong>{parseFloat(selectedPlot.areaHa || 0).toFixed(1)} ha</strong></p>
                                    <div className="mt-3 p-3 bg-emerald-50 rounded-lg text-center">
                                        <p className="text-3xl font-extrabold text-emerald-700">{selectedPlot.appCount}</p>
                                        <p className="text-sm text-emerald-600">Aplicacoes Realizadas</p>
                                    </div>
                                    <button onClick={() => { setSelectedPlot(null); setLocation("/fazenda/aplicacoes"); }}
                                        className="mt-3 w-full py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors cursor-pointer">
                                        Ver Detalhes
                                    </button>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* CARD 3 — Silos (visual SVG como romaneios) */}
                    <Card className="md:col-span-4 border-emerald-200/50 cursor-pointer hover:shadow-lg transition-shadow"
                        onClick={() => setLocation("/fazenda/romaneios")}>
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-sm font-bold text-gray-700">Silos</h3>
                                {totalHarvest > 0 && (
                                    <span className="text-[10px] text-gray-400">{fmtWeight(totalHarvest)} total</span>
                                )}
                            </div>
                            {silos.length > 0 ? (
                                <div className="flex items-end justify-center gap-2 overflow-x-auto">
                                    {silos.slice(0, 5).map((silo: any, i: number) => {
                                        const fillPct = Math.min(90, Math.max(10, (silo.totalWeight / maxSiloWeight) * 100));
                                        const mainCrop = silo.crops?.[0];
                                        const siloColorMap: Record<string, string> = { soja: "#c89520", milho: "#dbb830", trigo: "#b87030" };
                                        const cropKey = (mainCrop?.crop?.toLowerCase() || "") as string;
                                        const cropColor = mainCrop ? (siloColorMap[cropKey] || "#6b8e23") : "#6b8e23";
                                        return (
                                            <MiniSilo
                                                key={silo.buyer}
                                                fillPercent={fillPct}
                                                color={cropColor}
                                                label={silo.buyer?.split(" ").slice(0, 2).join(" ") || `Silo ${i + 1}`}
                                                weight={fmtWeight(silo.totalWeight || 0)}
                                            />
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="h-[100px] flex items-center justify-center text-gray-300 text-sm">
                                    Sem dados de silos
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* ═══════════════════════════════════════════════════════════
                    ROW 2: Estoque (Donut) | Custos por Talhao
                ═══════════════════════════════════════════════════════════ */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">

                    {/* CARD 4 — Estoque Donut */}
                    {hasModule("stock") && (
                        <Card className="md:col-span-5 border-emerald-200/50 cursor-pointer hover:shadow-lg transition-shadow"
                            onClick={() => setLocation("/fazenda/estoque")}>
                            <CardContent className="p-4">
                                <h3 className="text-sm font-bold text-gray-700 mb-2">Niveis de Estoque</h3>
                                <div className="flex items-center gap-4">
                                    <div className="w-[130px] h-[130px] shrink-0">
                                        {stockByCategory.length > 0 ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie data={stockByCategory} dataKey="value" nameKey="category"
                                                        cx="50%" cy="50%" outerRadius={55} innerRadius={30} paddingAngle={2}>
                                                        {stockByCategory.map((e, i) => (
                                                            <Cell key={i} fill={CATEGORY_COLORS[e.category] || CATEGORY_COLORS.outros} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip formatter={(v: number) => [`$${Math.round(v).toLocaleString()}`, ""]} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        ) : <div className="h-full flex items-center justify-center text-gray-300 text-xs">-</div>}
                                    </div>
                                    <div className="space-y-1.5 flex-1 min-w-0">
                                        {stockByCategory.slice(0, 6).map(cat => (
                                            <div key={cat.category} className="flex items-center gap-2 text-xs">
                                                <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: CATEGORY_COLORS[cat.category] || CATEGORY_COLORS.outros }} />
                                                <span className="text-gray-700 font-medium capitalize truncate flex-1">{cat.category}</span>
                                                <span className="text-gray-500 font-semibold">{cat.count}</span>
                                                <span className="text-gray-400 text-[10px]">{fmtCurrency(cat.value)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* CARD 5 — Custos por Talhao (barras) + Gasto diario (linha) */}
                    <Card className="md:col-span-7 border-emerald-200/50 cursor-pointer hover:shadow-lg transition-shadow"
                        onClick={() => setLocation("/fazenda/custos")}>
                        <CardContent className="p-4">
                            <h3 className="text-sm font-bold text-gray-700 mb-2">Custos por Talhao</h3>
                            <div className="flex gap-3">
                                {/* Bars */}
                                <div className="flex-1 h-[130px]">
                                    {plotCostBars.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={plotCostBars} layout="vertical" margin={{ left: 0, right: 5 }}>
                                                <XAxis type="number" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false}
                                                    tickFormatter={(v: number) => fmtCurrency(v)} />
                                                <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: "#6b7280" }} width={60} axisLine={false} tickLine={false} />
                                                <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, "Custo"]} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                                                <Bar dataKey="cost" fill="#16803C" radius={[0, 4, 4, 0]} barSize={14} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    ) : <div className="h-full flex items-center justify-center text-gray-300 text-xs">Sem custos</div>}
                                </div>
                                {/* Daily line */}
                                <div className="w-[40%] h-[130px]">
                                    {dailyAppCosts.length > 1 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={dailyAppCosts}>
                                                <defs>
                                                    <linearGradient id="dailyGrad" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#16a34a" stopOpacity={0.25} />
                                                        <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <XAxis dataKey="date" tick={{ fontSize: 8, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                                                <YAxis tick={{ fontSize: 8, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={30}
                                                    tickFormatter={(v: number) => fmtCurrency(v)} />
                                                <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, "Gasto"]} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                                                <Area type="monotone" dataKey="value" stroke="#16a34a" fill="url(#dailyGrad)" strokeWidth={2} dot={false} />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    ) : <div className="h-full flex items-center justify-center text-gray-300 text-xs">Sem dados</div>}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* ═══════════════════════════════════════════════════════════
                    ROW 3: Equipamentos | Clima
                ═══════════════════════════════════════════════════════════ */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">

                    {/* CARD 6 — Equipamentos + Abastecimento */}
                    {hasModule("fleet") && (
                        <Card className="md:col-span-6 border-emerald-200/50 cursor-pointer hover:shadow-lg transition-shadow"
                            onClick={() => setLocation("/fazenda/equipamentos")}>
                            <CardContent className="p-4">
                                <h3 className="text-sm font-bold text-gray-700 mb-3">Equipamentos</h3>
                                {equipment.length > 0 ? (
                                    <>
                                        <div className="flex flex-wrap gap-3">
                                            {equipment.slice(0, 6).map((eq: any) => {
                                                const isActive = eq.status === "Ativo" || !eq.status;
                                                const isMaint = eq.status === "Manutenção" || eq.status === "Manutencao";
                                                const diesel = dieselByEquipment.find(d => d.name === eq.name);
                                                return (
                                                    <div key={eq.id} className="flex flex-col items-center gap-1 min-w-[72px]">
                                                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${isActive ? "bg-emerald-100" : isMaint ? "bg-yellow-100" : "bg-gray-100"}`}>
                                                            {eq.type === "Trator" || eq.type === "Colheitadeira" ? (
                                                                <Tractor className={`w-5 h-5 ${isActive ? "text-emerald-600" : isMaint ? "text-yellow-600" : "text-gray-400"}`} />
                                                            ) : (
                                                                <Wrench className={`w-5 h-5 ${isActive ? "text-emerald-600" : isMaint ? "text-yellow-600" : "text-gray-400"}`} />
                                                            )}
                                                        </div>
                                                        <span className={`text-[10px] font-semibold ${isActive ? "text-emerald-600" : isMaint ? "text-yellow-600" : "text-gray-400"}`}>
                                                            {isActive ? "Ativo" : isMaint ? "Manut." : "Inativo"}
                                                        </span>
                                                        {diesel && (
                                                            <span className="text-[9px] text-amber-600 flex items-center gap-0.5">
                                                                <Fuel className="w-2.5 h-2.5" /> {diesel.liters.toFixed(0)}L
                                                            </span>
                                                        )}
                                                        <span className="text-[10px] text-gray-500 truncate max-w-[72px] text-center" title={eq.name}>
                                                            {eq.name?.split(" ").slice(0, 2).join(" ")}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                            {equipment.length > 6 && (
                                                <div className="flex items-center justify-center min-w-[50px]">
                                                    <span className="text-xs font-bold text-gray-400">+{equipment.length - 6}</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex gap-4 mt-3 pt-2 border-t border-gray-100">
                                            <span className="text-xs text-emerald-600 font-medium">{equipmentByStatus.active.length} Ativos</span>
                                            {equipmentByStatus.maint.length > 0 && <span className="text-xs text-yellow-600 font-medium">{equipmentByStatus.maint.length} Manut.</span>}
                                            {equipmentByStatus.inactive.length > 0 && <span className="text-xs text-gray-400 font-medium">{equipmentByStatus.inactive.length} Inativos</span>}
                                            {dieselByEquipment.length > 0 && (
                                                <span className="text-xs text-amber-600 font-medium ml-auto flex items-center gap-1">
                                                    <Fuel className="w-3 h-3" /> {dieselByEquipment.reduce((s, d) => s + d.liters, 0).toFixed(0)}L total
                                                </span>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <div className="h-[80px] flex items-center justify-center text-gray-300 text-sm">Nenhum equipamento</div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* CARD 7 — Previsao do Tempo (API existente: weather stations) */}
                    <Card className="md:col-span-6 border-emerald-200/50 cursor-pointer hover:shadow-lg transition-shadow"
                        onClick={() => setLocation("/fazenda/clima")}>
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-sm font-bold text-gray-700">Previsao do Tempo</h3>
                                <span className="text-[10px] text-gray-400">{mainStation?.name || "Configure uma estacao"}</span>
                            </div>
                            {currentWeather ? (
                                <div className="flex items-center gap-4">
                                    <div className="text-center">
                                        <p className="text-3xl font-bold text-gray-800">{parseFloat(currentWeather.temperature || 0).toFixed(1)}°C</p>
                                        <p className="text-xs text-gray-500 capitalize">{currentWeather.description || ""}</p>
                                    </div>
                                    <div className="flex-1 grid grid-cols-3 gap-2 text-center">
                                        <div>
                                            <Droplets className="w-4 h-4 text-blue-400 mx-auto mb-0.5" />
                                            <p className="text-xs font-bold text-gray-700">{currentWeather.humidity || 0}%</p>
                                            <p className="text-[10px] text-gray-400">Umidade</p>
                                        </div>
                                        <div>
                                            <Wind className="w-4 h-4 text-gray-400 mx-auto mb-0.5" />
                                            <p className="text-xs font-bold text-gray-700">{parseFloat(currentWeather.windSpeed || 0).toFixed(0)} km/h</p>
                                            <p className="text-[10px] text-gray-400">Vento</p>
                                        </div>
                                        <div>
                                            <Droplets className="w-4 h-4 text-cyan-400 mx-auto mb-0.5" />
                                            <p className="text-xs font-bold text-gray-700">{parseFloat(currentWeather.precipitation || 0).toFixed(1)} mm</p>
                                            <p className="text-[10px] text-gray-400">Chuva</p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-[80px] flex flex-col items-center justify-center text-gray-300 text-sm">
                                    <Thermometer className="w-8 h-8 mb-1" />
                                    <span>Configure uma estacao meteorologica</span>
                                    <span className="text-[10px] text-gray-400 mt-1">Menu Inteligencia → Clima</span>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </FarmLayout>
    );
}
