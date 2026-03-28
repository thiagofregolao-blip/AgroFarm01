import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import FarmLayout from "@/components/fazenda/layout";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import {
    Loader2, RefreshCw, TrendingUp, Droplets, Wind, Thermometer, Fuel, X
} from "lucide-react";
import {
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
    PieChart, Pie, Cell, BarChart, Bar, CartesianGrid
} from "recharts";
import { MapContainer, TileLayer, Polygon, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// ─── Colors ───────────────────────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
    fungicida: "#16a34a", herbicida: "#eab308", inseticida: "#f97316",
    fertilizante: "#3b82f6", semente: "#8b5cf6", adjuvante: "#ec4899",
    combustivel: "#78716c", diesel: "#78716c", outros: "#6b7280", outro: "#6b7280",
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

// ─── Mini Silo SVG (BIGGER version) ───────────────────────────────────────────
function MiniSilo({ fillPercent, color, label, weight }: { fillPercent: number; color: string; label: string; weight: string }) {
    const W = 80, H = 130;
    const bodyX = 12, bodyW = 56, bodyTop = 32, bodyBot = 108;
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
                        <stop offset="15%" stopColor="#b8c0c8" />
                        <stop offset="35%" stopColor="#d8dfe6" />
                        <stop offset="50%" stopColor="#e8eef4" />
                        <stop offset="65%" stopColor="#d8dfe6" />
                        <stop offset="85%" stopColor="#b0b8c0" />
                        <stop offset="100%" stopColor="#858d95" />
                    </linearGradient>
                    <linearGradient id={`gn-${uid}`} x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="black" stopOpacity={0.12} />
                        <stop offset="20%" stopColor="black" stopOpacity={0.04} />
                        <stop offset="50%" stopColor="white" stopOpacity={0.06} />
                        <stop offset="80%" stopColor="black" stopOpacity={0.04} />
                        <stop offset="100%" stopColor="black" stopOpacity={0.15} />
                    </linearGradient>
                    <clipPath id={`sc-${uid}`}><rect x={bodyX} y={bodyTop} width={bodyW} height={bodyH} rx={4} /></clipPath>
                </defs>
                {/* Ground shadow */}
                <ellipse cx={cx} cy={bodyBot + 6} rx={32} ry={4} fill="black" opacity={0.06} />
                {/* Body */}
                <rect x={bodyX} y={bodyTop} width={bodyW} height={bodyH} rx={4} fill={`url(#sb-${uid})`} stroke="#8a9199" strokeWidth={0.8} />
                {/* Panel lines */}
                {[0.167, 0.333, 0.5, 0.667, 0.833].map((pct, i) => (
                    <line key={i} x1={bodyX + 1} y1={bodyTop + bodyH * pct} x2={bodyX + bodyW - 1} y2={bodyTop + bodyH * pct}
                        stroke="#a0a8b0" strokeWidth={0.4} opacity={0.4} />
                ))}
                {/* Vertical ribs */}
                {[0.25, 0.5, 0.75].map((pct, i) => (
                    <line key={`v${i}`} x1={bodyX + bodyW * pct} y1={bodyTop + 1} x2={bodyX + bodyW * pct} y2={bodyBot - 1}
                        stroke="#a0a8b0" strokeWidth={0.4} opacity={0.25} />
                ))}
                {/* Fill */}
                <g clipPath={`url(#sc-${uid})`}>
                    <rect x={bodyX} y={fillTop} width={bodyW} height={fillH + 0.5} fill={color} />
                    <rect x={bodyX} y={fillTop} width={bodyW} height={fillH} fill={`url(#gn-${uid})`} />
                    <rect x={bodyX} y={fillTop} width={bodyW} height={2.5} fill="white" opacity={0.18} rx={1} />
                </g>
                {/* Base ring */}
                <rect x={bodyX - 2} y={bodyBot - 2} width={bodyW + 4} height={4} rx={2} fill="#8a9199" stroke="#777" strokeWidth={0.4} />
                {/* Roof cone */}
                <polygon points={`${bodyX - 3},${bodyTop + 2} ${cx},${14} ${bodyX + bodyW + 3},${bodyTop + 2}`}
                    fill="#b0b8c2" stroke="#8a9199" strokeWidth={0.8} strokeLinejoin="round" />
                {/* Roof ridges */}
                <line x1={cx} y1={14} x2={bodyX + 10} y2={bodyTop + 2} stroke="#b0b8c0" strokeWidth={0.3} opacity={0.5} />
                <line x1={cx} y1={14} x2={bodyX + bodyW - 10} y2={bodyTop + 2} stroke="#a0a8b0" strokeWidth={0.3} opacity={0.4} />
                {/* Chimney */}
                <rect x={cx - 4} y={6} width={8} height={10} rx={1.5} fill="#9aa2aa" stroke="#7a8290" strokeWidth={0.5} />
                <rect x={cx - 5.5} y={4} width={11} height={3} rx={1.5} fill="#8a9199" stroke="#6b7280" strokeWidth={0.3} />
                {/* Railing */}
                <line x1={bodyX + 2} y1={bodyTop} x2={bodyX + 8} y2={bodyTop - 6} stroke="#9aa2aa" strokeWidth={0.5} />
                <line x1={bodyX + bodyW - 2} y1={bodyTop} x2={bodyX + bodyW - 8} y2={bodyTop - 6} stroke="#9aa2aa" strokeWidth={0.5} />
                <line x1={bodyX + 8} y1={bodyTop - 6} x2={bodyX + bodyW - 8} y2={bodyTop - 6} stroke="#9aa2aa" strokeWidth={0.4} opacity={0.5} />
            </svg>
            <span className="text-sm font-bold text-gray-700 -mt-1">{weight}</span>
            <span className="text-[10px] text-gray-500 truncate max-w-[80px] text-center">{label}</span>
        </div>
    );
}

// ─── Equipment icon (real PNG images) ─────────────────────────────────────────
function EquipmentIcon({ type, isActive, isMaint }: { type: string; isActive: boolean; isMaint: boolean }) {
    const isColheitadeira = type === "Colheitadeira";
    const src = isColheitadeira ? "/colheitadeira.png" : "/trator.png";
    return (
        <div className={`w-14 h-11 rounded-lg flex items-center justify-center ${isActive ? "bg-emerald-50" : isMaint ? "bg-yellow-50" : "bg-gray-100"}`}>
            <img src={src} alt={type} className={`h-9 w-auto object-contain ${!isActive && !isMaint ? "opacity-40 grayscale" : ""}`} />
        </div>
    );
}

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
        setRefreshing(true); setPullDistance(0);
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
        if (!isPulling.current) return; isPulling.current = false;
        if (pullDistance >= PULL_THRESHOLD && !refreshing) handleRefresh(); else setPullDistance(0);
    }, [pullDistance, refreshing, handleRefresh]);

    // Module access
    const isEmployee = user?.role === "funcionario_fazenda";
    const { data: myModules = [] } = useQuery<any[]>({ queryKey: ["/api/farm/my-modules"], enabled: !!user && isEmployee });
    const enabledModules = useMemo(() => {
        if (!isEmployee) return null;
        const s = new Set<string>(); for (const m of myModules) { if (m.enabled) s.add(m.moduleKey); } return s;
    }, [isEmployee, myModules]);
    const hasModule = (k: string) => enabledModules === null || enabledModules.has(k);

    // ─── Data queries ─────────────────────────────────────────────────────────
    const { data: stock = [] } = useQuery({ queryKey: ["/api/farm/stock"], queryFn: async () => (await apiRequest("GET", "/api/farm/stock")).json(), enabled: !!user });
    const { data: invoices = [] } = useQuery<any[]>({ queryKey: ["/api/farm/invoices"], queryFn: async () => (await apiRequest("GET", "/api/farm/invoices")).json(), enabled: !!user });
    const { data: plots = [] } = useQuery<any[]>({ queryKey: ["/api/farm/plots"], queryFn: async () => (await apiRequest("GET", "/api/farm/plots")).json(), enabled: !!user });
    const { data: applications = [] } = useQuery<any[]>({ queryKey: ["/api/farm/applications"], queryFn: async () => (await apiRequest("GET", "/api/farm/applications")).json(), enabled: !!user });
    const { data: siloData } = useQuery<any>({ queryKey: ["/api/farm/romaneios/silos"], queryFn: async () => (await apiRequest("GET", "/api/farm/romaneios/silos")).json(), enabled: !!user });
    const { data: equipment = [] } = useQuery<any[]>({ queryKey: ["/api/farm/equipment"], queryFn: async () => (await apiRequest("GET", "/api/farm/equipment")).json(), enabled: !!user });
    const { data: plotCostsData } = useQuery<any>({ queryKey: ["/api/farm/plot-costs"], queryFn: async () => (await apiRequest("GET", "/api/farm/plot-costs")).json(), enabled: !!user });
    const { data: weatherStations = [] } = useQuery<any[]>({ queryKey: ["/api/farm/weather/stations"], queryFn: async () => (await apiRequest("GET", "/api/farm/weather/stations")).json(), enabled: !!user });

    // ─── Card 1: Despesas mensais ─────────────────────────────────────────────
    const monthlyExpenses = useMemo(() => {
        const map: Record<string, number> = {};
        invoices.forEach((inv: any) => {
            if (!inv.issueDate) return;
            const d = new Date(inv.issueDate);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            if (!map[key]) map[key] = 0;
            map[key] += parseFloat(inv.totalAmount || 0);
        });
        const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
        return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).slice(-8).map(([key, value]) => {
            const m = parseInt(key.split("-")[1]) - 1;
            return { month: months[m] || "?", value: Math.round(value) };
        });
    }, [invoices]);
    const totalExpenses = monthlyExpenses.reduce((s, m) => s + m.value, 0);
    const lastMonth = monthlyExpenses[monthlyExpenses.length - 1]?.value || 0;
    const prevMonth = monthlyExpenses[monthlyExpenses.length - 2]?.value || 0;
    const pctChange = prevMonth > 0 ? ((lastMonth - prevMonth) / prevMonth * 100) : 0;

    // ─── Card 2: Plots with coords ───────────────────────────────────────────
    const plotsWithCoords = useMemo(() => plots.filter((p: any) => {
        try { const c = typeof p.coordinates === "string" ? JSON.parse(p.coordinates) : p.coordinates; return Array.isArray(c) && c.length >= 3; } catch { return false; }
    }), [plots]);
    const appCountByPlot = useMemo(() => {
        const m: Record<string, number> = {};
        applications.forEach((a: any) => { if (a.plotId) m[a.plotId] = (m[a.plotId] || 0) + 1; });
        return m;
    }, [applications]);

    // ─── Card 3: Silos ───────────────────────────────────────────────────────
    const silos = siloData?.silos || [];
    const totalHarvest = siloData?.totalHarvest || 0;
    const maxSiloWeight = Math.max(...silos.map((s: any) => s.totalWeight || 0), 1);

    // ─── Card 4: Stock donut ─────────────────────────────────────────────────
    const stockByCategory = useMemo(() => {
        const m: Record<string, { category: string; count: number; value: number }> = {};
        stock.forEach((s: any) => {
            const cat = (s.category || "outros").toLowerCase();
            if (!m[cat]) m[cat] = { category: cat, count: 0, value: 0 };
            m[cat].count += 1; m[cat].value += parseFloat(s.quantity || 0) * parseFloat(s.averageCost || 0);
        });
        return Object.values(m).sort((a, b) => b.value - a.value);
    }, [stock]);

    // ─── Card 5: Plot costs (FIX: response is { plots: [...] }) ──────────────
    const plotCostBars = useMemo(() => {
        const arr = plotCostsData?.plots || [];
        return arr.slice(0, 8).map((p: any) => ({
            name: (p.plotName || p.name || "?").length > 10 ? (p.plotName || p.name || "?").slice(0, 10) + ".." : (p.plotName || p.name || "?"),
            cost: Math.round(parseFloat(p.totalCost || 0)),
        }));
    }, [plotCostsData]);

    const dailyAppCosts = useMemo(() => {
        const m: Record<string, number> = {};
        applications.forEach((a: any) => {
            const d = new Date(a.appliedAt || a.createdAt);
            const key = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
            // Use totalCost if available, otherwise try to compute
            const cost = parseFloat(a.totalCost || 0) || (parseFloat(a.quantity || 0) * parseFloat(a.unitCost || 0));
            if (!m[key]) m[key] = 0;
            m[key] += cost;
        });
        return Object.entries(m).sort(([a], [b]) => {
            const [da, ma] = a.split("/").map(Number);
            const [db, mb] = b.split("/").map(Number);
            return (ma * 100 + da) - (mb * 100 + db);
        }).slice(-14).map(([date, value]) => ({ date, value: Math.round(value) }));
    }, [applications]);

    // ─── Card 6: Equipment + diesel ──────────────────────────────────────────
    const equipByStatus = useMemo(() => ({
        active: equipment.filter((e: any) => e.status === "Ativo" || !e.status),
        maint: equipment.filter((e: any) => e.status === "Manutenção" || e.status === "Manutencao"),
        inactive: equipment.filter((e: any) => e.status === "Inativo"),
    }), [equipment]);
    const dieselByEquip = useMemo(() => {
        const m: Record<string, { name: string; liters: number }> = {};
        applications.forEach((a: any) => {
            const isDiesel = (a.productCategory || a.category || "").toLowerCase().includes("diesel") || (a.productName || "").toLowerCase().includes("diesel");
            if (isDiesel && a.equipmentName) {
                if (!m[a.equipmentName]) m[a.equipmentName] = { name: a.equipmentName, liters: 0 };
                m[a.equipmentName].liters += parseFloat(a.quantity || 0);
            }
        });
        return Object.values(m).sort((a, b) => b.liters - a.liters);
    }, [applications]);

    // ─── Card 7: Weather ─────────────────────────────────────────────────────
    const mainStation = weatherStations[0];
    const cw = mainStation?.currentWeather;

    if (isLoading) return <FarmLayout><div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div></FarmLayout>;

    function fmt(v: number) { if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`; if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`; return `$${v.toFixed(0)}`; }
    function fmtW(kg: number) { return kg >= 1000 ? `${(kg / 1000).toFixed(1)}t` : `${kg.toFixed(0)}kg`; }

    // ══════════════════════════════════════════════════════════════════════════
    // CardTitle helper — green bg strip with black text, like the reference
    const CT = ({ children, extra }: { children: React.ReactNode; extra?: React.ReactNode }) => (
        <div className="bg-emerald-50/80 border-b border-emerald-100 px-3 py-1.5 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-800">{children}</h3>
            {extra}
        </div>
    );

    return (
        <FarmLayout>
            <div ref={containerRef} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} className="space-y-2">
                {/* Pull-to-refresh */}
                {(pullDistance > 0 || refreshing) && (
                    <div className="flex items-center justify-center transition-all duration-200 overflow-hidden" style={{ height: refreshing ? 48 : pullDistance }}>
                        <div className={`flex items-center gap-2 text-emerald-600 ${refreshing ? "animate-pulse" : ""}`}>
                            <RefreshCw className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`} style={{ transform: refreshing ? undefined : `rotate(${(pullDistance / PULL_THRESHOLD) * 360}deg)` }} />
                            <span className="text-sm font-medium">{refreshing ? "Atualizando..." : pullDistance >= PULL_THRESHOLD ? "Solte para atualizar" : "Puxe para atualizar"}</span>
                        </div>
                    </div>
                )}


                {/* ═══ ROW 1 ═══ */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                    {/* Card 1: Despesas */}
                    {hasModule("invoices") && (
                        <Card className="md:col-span-3 border-gray-200 cursor-pointer hover:shadow-lg transition-shadow overflow-hidden"
                            onClick={() => setLocation("/fazenda/faturas")}>
                            <CT extra={pctChange !== 0 ? (
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${pctChange > 0 ? "text-red-600" : "text-emerald-600"}`}>
                                    <TrendingUp className={`w-2.5 h-2.5 ${pctChange < 0 ? "rotate-180" : ""}`} /> {Math.abs(pctChange).toFixed(1)}%
                                </span>
                            ) : undefined}>Despesas Mensais</CT>
                            <CardContent className="p-3">
                                <div className="h-[120px]">
                                    {monthlyExpenses.length > 1 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={monthlyExpenses}>
                                                <defs><linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#16a34a" stopOpacity={0.3} /><stop offset="95%" stopColor="#16a34a" stopOpacity={0} /></linearGradient></defs>
                                                <CartesianGrid vertical={true} horizontal={false} strokeDasharray="3 3" stroke="#e5e7eb" />
                                                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                                                <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={35} tickFormatter={(v: number) => fmt(v)} />
                                                <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, "Despesa"]} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                                                <Area type="monotone" dataKey="value" stroke="#16a34a" fill="url(#expGrad)" strokeWidth={2} dot={false} />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    ) : <div className="h-full flex items-center justify-center text-gray-300 text-xs">Sem faturas</div>}
                                </div>
                                <div className="flex items-baseline gap-2 mt-1">
                                    <span className="text-xl font-bold text-gray-800">{fmt(totalExpenses)}</span>
                                    <span className="text-xs text-gray-400">Total</span>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Card 2: Mapa */}
                    {hasModule("properties") && (
                        <Card className="md:col-span-5 border-gray-200 overflow-hidden">
                            <CT>Mapa dos Talhoes</CT>
                            <div className="h-[170px] relative">
                                {plotsWithCoords.length > 0 ? (
                                    <MapContainer center={[-25.5, -54.6]} zoom={13} className="h-full w-full z-0" zoomControl={false} attributionControl={false}>
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
                                                    <Popup><div className="text-sm"><strong>{p.name}</strong>{p.crop && <span> — {p.crop}</span>}<br/>{parseFloat(p.areaHa || 0).toFixed(1)} ha<br/><b className="text-emerald-700">{appCount} aplicacoes</b></div></Popup>
                                                </Polygon>
                                            );
                                        })}
                                    </MapContainer>
                                ) : <div className="h-full bg-emerald-50 flex items-center justify-center text-gray-400 text-sm">Cadastre talhoes com coordenadas</div>}
                                {plotsWithCoords.length > 0 && (
                                    <div className="absolute bottom-2 left-2 z-[400] bg-white/90 backdrop-blur-sm rounded px-2 py-1 flex gap-3">
                                        {Array.from(new Set(plotsWithCoords.map((p: any) => p.crop).filter(Boolean)) as Set<string>).slice(0, 4).map((c: string) => (
                                            <div key={c} className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm" style={{ backgroundColor: getCropColor(c) }} /><span className="text-[9px] text-gray-600">{c}</span></div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </Card>
                    )}

                    {/* Plot modal */}
                    {selectedPlot && (
                        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/30" onClick={() => setSelectedPlot(null)}>
                            <Card className="w-[90%] max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
                                <CardContent className="p-5">
                                    <div className="flex justify-between mb-3"><h3 className="text-lg font-bold text-emerald-800">{selectedPlot.name}</h3><button onClick={() => setSelectedPlot(null)} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5 text-gray-400" /></button></div>
                                    {selectedPlot.crop && <p className="text-sm text-gray-600 mb-1">Cultura: <strong>{selectedPlot.crop}</strong></p>}
                                    <p className="text-sm text-gray-600">Area: <strong>{parseFloat(selectedPlot.areaHa || 0).toFixed(1)} ha</strong></p>
                                    <div className="mt-3 p-3 bg-emerald-50 rounded-lg text-center"><p className="text-3xl font-extrabold text-emerald-700">{selectedPlot.appCount}</p><p className="text-sm text-emerald-600">Aplicacoes Realizadas</p></div>
                                    <button onClick={() => { setSelectedPlot(null); setLocation("/fazenda/aplicacoes"); }} className="mt-3 w-full py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 cursor-pointer">Ver Detalhes</button>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Card 3: Silos */}
                    <Card className="md:col-span-4 border-gray-200 cursor-pointer hover:shadow-lg transition-shadow overflow-hidden"
                        onClick={() => setLocation("/fazenda/romaneios")}>
                        <CT extra={totalHarvest > 0 ? <span className="text-[10px] text-gray-500">{fmtW(totalHarvest)} total</span> : undefined}>Silos</CT>
                        <CardContent className="p-2">
                            {silos.length > 0 ? (
                                <div className="flex items-end justify-center gap-2 overflow-x-auto">
                                    {silos.slice(0, 4).map((silo: any) => {
                                        const fillPct = Math.min(90, Math.max(10, (silo.totalWeight / maxSiloWeight) * 100));
                                        const siloColorMap: Record<string, string> = { soja: "#c89520", milho: "#dbb830", trigo: "#b87030" };
                                        const cropKey = (silo.crops?.[0]?.crop?.toLowerCase() || "") as string;
                                        return <MiniSilo key={silo.buyer} fillPercent={fillPct} color={siloColorMap[cropKey] || "#6b8e23"}
                                            label={silo.buyer?.split(" ").slice(0, 2).join(" ") || "Silo"} weight={fmtW(silo.totalWeight || 0)} />;
                                    })}
                                </div>
                            ) : <div className="h-[130px] flex items-center justify-center text-gray-300 text-sm">Sem dados</div>}
                        </CardContent>
                    </Card>
                </div>

                {/* ═══ ROW 2 ═══ */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                    {/* Card 4: Estoque */}
                    {hasModule("stock") && (
                        <Card className="md:col-span-5 border-gray-200 cursor-pointer hover:shadow-lg transition-shadow overflow-hidden"
                            onClick={() => setLocation("/fazenda/estoque")}>
                            <CT>Niveis de Estoque</CT>
                            <CardContent className="p-3 flex items-center gap-3">
                                <div className="w-[120px] h-[120px] shrink-0">
                                    {stockByCategory.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart><Pie data={stockByCategory} dataKey="value" nameKey="category" cx="50%" cy="50%" outerRadius={50} innerRadius={25} paddingAngle={2}>
                                                {stockByCategory.map((e, i) => <Cell key={i} fill={CATEGORY_COLORS[e.category] || CATEGORY_COLORS.outros} />)}
                                            </Pie><Tooltip formatter={(v: number) => [`$${Math.round(v).toLocaleString()}`, ""]} contentStyle={{ fontSize: 11, borderRadius: 8 }} /></PieChart>
                                        </ResponsiveContainer>
                                    ) : <div className="h-full flex items-center justify-center text-gray-300 text-xs">-</div>}
                                </div>
                                <div className="space-y-1.5 flex-1 min-w-0">
                                    {stockByCategory.slice(0, 6).map(cat => (
                                        <div key={cat.category} className="flex items-center gap-2 text-xs">
                                            <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: CATEGORY_COLORS[cat.category] || CATEGORY_COLORS.outros }} />
                                            <span className="text-gray-700 font-medium capitalize truncate flex-1">{cat.category}</span>
                                            <span className="text-gray-500 font-semibold">{cat.count}</span>
                                            <span className="text-gray-400 text-[10px]">{fmt(cat.value)}</span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Card 5: Custos */}
                    <Card className="md:col-span-7 border-gray-200 cursor-pointer hover:shadow-lg transition-shadow overflow-hidden"
                        onClick={() => setLocation("/fazenda/custos")}>
                        <CT>Custos por Talhao</CT>
                        <CardContent className="p-3 flex gap-2" style={{ height: 160 }}>
                            <div className="flex-1 h-full">
                                {plotCostBars.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={plotCostBars} layout="vertical" margin={{ left: 0, right: 5 }}>
                                            <XAxis type="number" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => fmt(v)} />
                                            <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: "#6b7280" }} width={65} axisLine={false} tickLine={false} />
                                            <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, "Custo"]} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                                            <Bar dataKey="cost" fill="#16803C" radius={[0, 4, 4, 0]} barSize={14} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : <div className="h-full flex items-center justify-center text-gray-300 text-xs">Sem custos</div>}
                            </div>
                            <div className="w-[40%] h-full">
                                {dailyAppCosts.length > 1 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={dailyAppCosts}>
                                            <defs><linearGradient id="dailyGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#16a34a" stopOpacity={0.25} /><stop offset="95%" stopColor="#16a34a" stopOpacity={0} /></linearGradient></defs>
                                            <CartesianGrid vertical={true} horizontal={false} strokeDasharray="3 3" stroke="#e5e7eb" />
                                            <XAxis dataKey="date" tick={{ fontSize: 8, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                                            <YAxis tick={{ fontSize: 8, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={30} tickFormatter={(v: number) => fmt(v)} />
                                            <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, "Gasto"]} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                                            <Area type="monotone" dataKey="value" stroke="#16a34a" fill="url(#dailyGrad)" strokeWidth={2} dot={false} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                ) : <div className="h-full flex items-center justify-center text-gray-300 text-xs">Sem dados</div>}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* ═══ ROW 3 ═══ */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                    {/* Card 6: Equipamentos */}
                    {hasModule("fleet") && (
                        <Card className="md:col-span-6 border-gray-200 cursor-pointer hover:shadow-lg transition-shadow overflow-hidden"
                            onClick={() => setLocation("/fazenda/equipamentos")}>
                            <CT>Equipamentos</CT>
                            <CardContent className="p-3">
                                {equipment.length > 0 ? (
                                    <>
                                        <div className="flex flex-wrap gap-4">
                                            {equipment.slice(0, 5).map((eq: any) => {
                                                const isActive = eq.status === "Ativo" || !eq.status;
                                                const isMaint = eq.status === "Manutenção" || eq.status === "Manutencao";
                                                const diesel = dieselByEquip.find(d => d.name === eq.name);
                                                return (
                                                    <div key={eq.id} className="flex flex-col items-center gap-0.5 min-w-[70px]">
                                                        <EquipmentIcon type={eq.type} isActive={isActive} isMaint={isMaint} />
                                                        <span className={`text-[10px] font-semibold ${isActive ? "text-emerald-600" : isMaint ? "text-yellow-600" : "text-gray-400"}`}>
                                                            {isActive ? "Ativo" : isMaint ? "Manut." : "Inativo"}
                                                        </span>
                                                        {diesel && <span className="text-[9px] text-amber-600 flex items-center gap-0.5"><Fuel className="w-2.5 h-2.5" />{diesel.liters.toFixed(0)}L</span>}
                                                        <span className="text-[10px] text-gray-500 truncate max-w-[72px] text-center">{eq.name?.split(" ").slice(0, 2).join(" ")}</span>
                                                    </div>
                                                );
                                            })}
                                            {equipment.length > 5 && <div className="flex items-center"><span className="text-xs font-bold text-gray-400">+{equipment.length - 5}</span></div>}
                                        </div>
                                        <div className="flex gap-4 mt-2 pt-2 border-t border-gray-100">
                                            <span className="text-xs text-emerald-600 font-medium">{equipByStatus.active.length} Ativos</span>
                                            {equipByStatus.maint.length > 0 && <span className="text-xs text-yellow-600 font-medium">{equipByStatus.maint.length} Manut.</span>}
                                            {dieselByEquip.length > 0 && <span className="text-xs text-amber-600 font-medium ml-auto flex items-center gap-1"><Fuel className="w-3 h-3" />{dieselByEquip.reduce((s, d) => s + d.liters, 0).toFixed(0)}L total</span>}
                                        </div>
                                    </>
                                ) : <div className="h-[80px] flex items-center justify-center text-gray-300 text-sm">Nenhum equipamento</div>}
                            </CardContent>
                        </Card>
                    )}

                    {/* Card 7: Clima */}
                    <Card className="md:col-span-6 border-gray-200 cursor-pointer hover:shadow-lg transition-shadow overflow-hidden"
                        onClick={() => setLocation("/fazenda/clima")}>
                        <CT extra={<span className="text-[10px] text-gray-500">{mainStation?.name || ""}</span>}>Previsao do Tempo</CT>
                        <CardContent className="p-3">
                            {cw ? (
                                <div className="flex items-center gap-4">
                                    <div className="text-center"><p className="text-3xl font-bold text-gray-800">{parseFloat(cw.temperature || 0).toFixed(1)}°C</p></div>
                                    <div className="flex-1 grid grid-cols-3 gap-2 text-center">
                                        <div><Droplets className="w-4 h-4 text-blue-400 mx-auto mb-0.5" /><p className="text-xs font-bold text-gray-700">{cw.humidity || 0}%</p><p className="text-[10px] text-gray-400">Umidade</p></div>
                                        <div><Wind className="w-4 h-4 text-gray-400 mx-auto mb-0.5" /><p className="text-xs font-bold text-gray-700">{parseFloat(cw.windSpeed || 0).toFixed(0)} km/h</p><p className="text-[10px] text-gray-400">Vento</p></div>
                                        <div><Droplets className="w-4 h-4 text-cyan-400 mx-auto mb-0.5" /><p className="text-xs font-bold text-gray-700">{parseFloat(cw.precipitation || 0).toFixed(1)} mm</p><p className="text-[10px] text-gray-400">Chuva</p></div>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-[70px] flex flex-col items-center justify-center text-gray-300 text-sm">
                                    <Thermometer className="w-6 h-6 mb-1" />
                                    <span className="text-xs">Configure uma estacao meteorologica</span>
                                    <span className="text-[10px] text-gray-400">Inteligencia → Clima</span>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </FarmLayout>
    );
}
