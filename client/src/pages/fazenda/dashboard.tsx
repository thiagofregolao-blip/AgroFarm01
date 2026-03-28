import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import FarmLayout from "@/components/fazenda/layout";
import { useAuth } from "@/hooks/use-auth";
import {
    Loader2, RefreshCw, Droplets, Wind, Thermometer, Fuel, X, MapPin
} from "lucide-react";
import {
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
    PieChart, Pie, Cell, CartesianGrid
} from "recharts";
import { MapContainer, TileLayer, Polygon, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// ══════════════════════════════════════════════════════════════════════════════
// DESIGN SYSTEM — "The Cultivated Landscape" (from Stitch DESIGN.md)
// ══════════════════════════════════════════════════════════════════════════════
// Colors: primary=#00450d, primary-container=#1b5e20, surface=#f5fced
// surface-container-low=#eff6e7, surface-container-lowest=#ffffff
// surface-container=#e9f0e1, on-surface=#171d14, on-surface-variant=#41493e
// tertiary=#204200, error=#ba1a1a
// Shadow: 0 12px 40px rgba(23,29,20,0.06)
// Fonts: Manrope (headlines), Inter (body/labels)
// No 1px borders. Depth via background color shifts + ambient shadows.
// ══════════════════════════════════════════════════════════════════════════════

const SHADOW = "0 12px 40px rgba(23,29,20,0.06)";
const CATEGORY_COLORS: Record<string, string> = {
    fungicida: "#1b5e20", herbicida: "#204200", inseticida: "#2f5c00",
    fertilizante: "#4a626d", semente: "#334a55", adjuvante: "#506873",
    combustivel: "#717a6d", diesel: "#717a6d", outros: "#41493e", outro: "#41493e",
};

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

// ─── Mini Silo SVG ────────────────────────────────────────────────────────────
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
                        <stop offset="0%" stopColor="#8a9099" /><stop offset="15%" stopColor="#b8c0c8" />
                        <stop offset="50%" stopColor="#e8eef4" /><stop offset="85%" stopColor="#b0b8c0" />
                        <stop offset="100%" stopColor="#858d95" />
                    </linearGradient>
                    <linearGradient id={`gn-${uid}`} x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="black" stopOpacity={0.12} /><stop offset="50%" stopColor="white" stopOpacity={0.06} />
                        <stop offset="100%" stopColor="black" stopOpacity={0.15} />
                    </linearGradient>
                    <clipPath id={`sc-${uid}`}><rect x={bodyX} y={bodyTop} width={bodyW} height={bodyH} rx={4} /></clipPath>
                </defs>
                <ellipse cx={cx} cy={bodyBot + 6} rx={32} ry={4} fill="black" opacity={0.06} />
                <rect x={bodyX} y={bodyTop} width={bodyW} height={bodyH} rx={4} fill={`url(#sb-${uid})`} stroke="#8a9199" strokeWidth={0.8} />
                {[0.167, 0.333, 0.5, 0.667, 0.833].map((pct, i) => (
                    <line key={i} x1={bodyX + 1} y1={bodyTop + bodyH * pct} x2={bodyX + bodyW - 1} y2={bodyTop + bodyH * pct} stroke="#a0a8b0" strokeWidth={0.4} opacity={0.4} />
                ))}
                {[0.25, 0.5, 0.75].map((pct, i) => (
                    <line key={`v${i}`} x1={bodyX + bodyW * pct} y1={bodyTop + 1} x2={bodyX + bodyW * pct} y2={bodyBot - 1} stroke="#a0a8b0" strokeWidth={0.4} opacity={0.25} />
                ))}
                <g clipPath={`url(#sc-${uid})`}>
                    <rect x={bodyX} y={fillTop} width={bodyW} height={fillH + 0.5} fill={color} />
                    <rect x={bodyX} y={fillTop} width={bodyW} height={fillH} fill={`url(#gn-${uid})`} />
                    <rect x={bodyX} y={fillTop} width={bodyW} height={2.5} fill="white" opacity={0.18} rx={1} />
                </g>
                <rect x={bodyX - 2} y={bodyBot - 2} width={bodyW + 4} height={4} rx={2} fill="#8a9199" stroke="#777" strokeWidth={0.4} />
                <polygon points={`${bodyX - 3},${bodyTop + 2} ${cx},${14} ${bodyX + bodyW + 3},${bodyTop + 2}`} fill="#b0b8c2" stroke="#8a9199" strokeWidth={0.8} strokeLinejoin="round" />
                <rect x={cx - 4} y={6} width={8} height={10} rx={1.5} fill="#9aa2aa" stroke="#7a8290" strokeWidth={0.5} />
                <rect x={cx - 5.5} y={4} width={11} height={3} rx={1.5} fill="#8a9199" stroke="#6b7280" strokeWidth={0.3} />
            </svg>
            <span className="text-sm font-black text-[#171d14] -mt-1">{weight}</span>
            <span className="text-[10px] font-bold text-[#41493e] truncate max-w-[80px] text-center tracking-wide">{label}</span>
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
            queryClient.invalidateQueries({ queryKey: ["/api/farm/cash-summary"] }),
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
    const { data: cashSummary } = useQuery<any>({ queryKey: ["/api/farm/cash-summary"], queryFn: async () => (await apiRequest("GET", "/api/farm/cash-summary")).json(), enabled: !!user });

    // ─── Derived: Card 1 — Monthly expenses ───────────────────────────────────
    const monthlyExpenses = useMemo(() => {
        const map: Record<string, number> = {};
        invoices.forEach((inv: any) => {
            if (!inv.issueDate) return;
            const d = new Date(inv.issueDate);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            if (!map[key]) map[key] = 0;
            map[key] += parseFloat(inv.totalAmount || 0);
        });
        const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).slice(-8).map(([key, value]) => {
            const m = parseInt(key.split("-")[1]) - 1;
            return { month: months[m] || "?", value: Math.round(value) };
        });
    }, [invoices]);
    const totalExpenses = monthlyExpenses.reduce((s, m) => s + m.value, 0);
    const lastMonth = monthlyExpenses[monthlyExpenses.length - 1]?.value || 0;
    const prevMonth = monthlyExpenses[monthlyExpenses.length - 2]?.value || 0;
    const pctChange = prevMonth > 0 ? ((lastMonth - prevMonth) / prevMonth * 100) : 0;

    // ─── Derived: Card 2 — Plots with coords ─────────────────────────────────
    const plotsWithCoords = useMemo(() => plots.filter((p: any) => {
        try { const c = typeof p.coordinates === "string" ? JSON.parse(p.coordinates) : p.coordinates; return Array.isArray(c) && c.length >= 3; } catch { return false; }
    }), [plots]);
    const appCountByPlot = useMemo(() => {
        const m: Record<string, number> = {};
        applications.forEach((a: any) => { if (a.plotId) m[a.plotId] = (m[a.plotId] || 0) + 1; });
        return m;
    }, [applications]);

    // ─── Derived: Card 3 — Crop health (apps by culture) ─────────────────────
    const cropHealth = useMemo(() => {
        const map: Record<string, { crop: string; count: number; plotCount: number }> = {};
        applications.forEach((a: any) => {
            const crop = a.cropName || a.crop || "Outros";
            if (!map[crop]) map[crop] = { crop, count: 0, plotCount: 0 };
            map[crop].count += 1;
        });
        return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 4);
    }, [applications]);
    const maxApps = Math.max(...cropHealth.map(c => c.count), 1);

    // ─── Derived: Card 4 — Stock donut ───────────────────────────────────────
    const stockByCategory = useMemo(() => {
        const m: Record<string, { category: string; count: number; value: number }> = {};
        stock.forEach((s: any) => {
            const cat = (s.category || "outros").toLowerCase();
            if (!m[cat]) m[cat] = { category: cat, count: 0, value: 0 };
            m[cat].count += 1; m[cat].value += parseFloat(s.quantity || 0) * parseFloat(s.averageCost || 0);
        });
        return Object.values(m).sort((a, b) => b.value - a.value);
    }, [stock]);
    const totalStockItems = stock.length;

    // ─── Derived: Card 5 — Silos ─────────────────────────────────────────────
    const silos = siloData?.silos || [];
    const totalHarvest = siloData?.totalHarvest || 0;
    const maxSiloWeight = Math.max(...silos.map((s: any) => s.totalWeight || 0), 1);

    // ─── Derived: Card 6 — Financials ────────────────────────────────────────
    const totalIncome = parseFloat(cashSummary?.totalIncome || 0);
    const totalExpense = parseFloat(cashSummary?.totalExpense || 0);
    const netBalance = parseFloat(cashSummary?.totalBalance || 0) || (totalIncome - totalExpense);

    // ─── Derived: Card 7 — Equipment + diesel ────────────────────────────────
    const dieselByEquip = useMemo(() => {
        const m: Record<string, number> = {};
        applications.forEach((a: any) => {
            const isDiesel = (a.productCategory || a.category || "").toLowerCase().includes("diesel") || (a.productName || "").toLowerCase().includes("diesel");
            if (isDiesel && a.equipmentName) { m[a.equipmentName] = (m[a.equipmentName] || 0) + parseFloat(a.quantity || 0); }
        });
        return m;
    }, [applications]);

    // ─── Derived: Card 7 — Weather ───────────────────────────────────────────
    const mainStation = weatherStations[0];
    const cw = mainStation?.currentWeather;

    if (isLoading) return <FarmLayout><div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div></FarmLayout>;

    function fmt(v: number) { if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`; if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`; return `$${v.toFixed(0)}`; }
    function fmtW(kg: number) { return kg >= 1000 ? `${(kg / 1000).toFixed(1)}t` : `${kg.toFixed(0)}kg`; }

    const today = new Date();
    const dateStr = today.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

    // ══════════════════════════════════════════════════════════════════════════
    // RENDER — Stitch "Cultivated Landscape" design system
    // ══════════════════════════════════════════════════════════════════════════
    return (
        <FarmLayout>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&display=swap');
                .headline-font { font-family: 'Manrope', sans-serif; }
                .card-stitch {
                    background: #ffffff;
                    border-radius: 0.75rem;
                    box-shadow: ${SHADOW};
                    border: 1px solid rgba(255,255,255,0.8);
                    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                }
                .card-stitch:hover { transform: translateY(-2px); box-shadow: 0 16px 48px rgba(23,29,20,0.1); }
            `}</style>

            <div ref={containerRef} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
                {/* Pull-to-refresh */}
                {(pullDistance > 0 || refreshing) && (
                    <div className="flex items-center justify-center transition-all duration-200 overflow-hidden" style={{ height: refreshing ? 48 : pullDistance }}>
                        <div className={`flex items-center gap-2 text-emerald-700 ${refreshing ? "animate-pulse" : ""}`}>
                            <RefreshCw className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`} />
                            <span className="text-sm font-medium">{refreshing ? "Atualizando..." : pullDistance >= PULL_THRESHOLD ? "Solte" : "Puxe"}</span>
                        </div>
                    </div>
                )}

                {/* ─── HEADER ─── */}
                <header className="mb-8 flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
                    <div>
                        <h2 className="text-3xl sm:text-4xl font-extrabold text-emerald-950 headline-font tracking-tight mb-1">Comando Operacional</h2>
                        <p className="text-sm font-medium text-[#41493e]">Analitico em tempo real da sua fazenda.</p>
                    </div>
                    <div className="flex gap-3 items-center">
                        <button onClick={handleRefresh} disabled={refreshing}
                            className="px-4 py-2 bg-white rounded-full flex items-center gap-2 text-emerald-800 text-sm font-semibold cursor-pointer hover:bg-emerald-50 transition-colors" style={{ boxShadow: SHADOW }}>
                            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
                            Atualizar
                        </button>
                        <div className="px-4 py-2 bg-emerald-950 text-white rounded-full text-sm font-semibold headline-font" style={{ boxShadow: SHADOW }}>
                            {dateStr}
                        </div>
                    </div>
                </header>

                {/* ─── BENTO GRID ─── */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-8">

                    {/* ══ CARD 1: Farm Performance (8 col) ══ */}
                    {hasModule("invoices") && (
                        <section className="md:col-span-8 card-stitch p-6 cursor-pointer" onClick={() => setLocation("/fazenda/faturas")}>
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h3 className="headline-font font-bold text-lg text-emerald-950">Despesas Mensais</h3>
                                    <p className="text-sm text-[#41493e]">Trajetoria anual de faturas</p>
                                </div>
                                <div className="text-right">
                                    <span className="text-3xl font-black text-emerald-950">{fmt(totalExpenses)}</span>
                                    <span className="text-sm font-semibold text-emerald-700 ml-1">Total</span>
                                    {pctChange !== 0 && (
                                        <div className={`text-[10px] font-bold uppercase tracking-wider ${pctChange > 0 ? "text-red-700" : "text-[#2f5c00]"}`}>
                                            {pctChange > 0 ? "+" : ""}{pctChange.toFixed(1)}% vs mes anterior
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="h-52 w-full">
                                {monthlyExpenses.length > 1 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={monthlyExpenses}>
                                            <defs>
                                                <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="rgba(27,94,32,0.2)" /><stop offset="100%" stopColor="rgba(27,94,32,0)" />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid vertical={true} horizontal={false} strokeDasharray="3 3" stroke="#e9f0e1" />
                                            <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#41493e", fontWeight: 700 }} axisLine={false} tickLine={false} />
                                            <YAxis tick={{ fontSize: 9, fill: "#717a6d" }} axisLine={false} tickLine={false} width={40} tickFormatter={(v: number) => fmt(v)} />
                                            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12, border: "none", boxShadow: SHADOW, padding: "8px 14px" }} formatter={(v: number) => [`$${v.toLocaleString()}`, "Despesa"]} />
                                            <Area type="monotone" dataKey="value" stroke="#1b5e20" strokeWidth={3} fill="url(#perfGrad)" dot={{ r: 4, fill: "#1b5e20" }} activeDot={{ r: 6, fill: "#1b5e20" }} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                ) : <div className="h-full flex items-center justify-center text-[#717a6d] text-sm">Sem faturas registradas</div>}
                            </div>
                        </section>
                    )}

                    {/* ══ CARD 2: Field Monitoring / Mapa (4 col) ══ */}
                    {hasModule("properties") && (
                        <section className="md:col-span-4 card-stitch overflow-hidden relative" style={{ minHeight: 400 }}>
                            <div className="absolute inset-0 z-0">
                                {plotsWithCoords.length > 0 ? (
                                    <MapContainer center={[-25.5, -54.6]} zoom={13} className="h-full w-full" zoomControl={false} attributionControl={false}>
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
                                ) : <div className="h-full bg-emerald-50 flex items-center justify-center text-[#41493e] text-sm">Cadastre talhoes com coordenadas</div>}
                                <div className="absolute inset-0 bg-emerald-900/10 mix-blend-multiply pointer-events-none"></div>
                            </div>
                            <div className="relative z-10 p-6 flex flex-col h-full">
                                <div className="flex justify-between items-start">
                                    <div className="bg-white/70 backdrop-blur-[12px] p-3 rounded-xl">
                                        <h3 className="headline-font font-bold text-sm text-emerald-950">Monitoramento de Campo</h3>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Satelite em tempo real</p>
                                    </div>
                                </div>
                                {plotsWithCoords.length > 0 && (
                                    <div className="mt-auto">
                                        <div className="bg-white/70 backdrop-blur-[12px] p-4 rounded-xl">
                                            <div className="flex items-center gap-2 mb-2">
                                                <MapPin className="w-4 h-4 text-emerald-700" />
                                                <span className="text-xs font-bold text-emerald-950">{plots.length} Talhoes Cadastrados</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="bg-emerald-950/10 p-2 rounded-lg">
                                                    <div className="text-[8px] uppercase font-bold text-emerald-800">Area Total</div>
                                                    <div className="text-sm font-black text-emerald-950">{plots.reduce((s: number, p: any) => s + parseFloat(p.areaHa || 0), 0).toFixed(0)} ha</div>
                                                </div>
                                                <div className="bg-emerald-950/10 p-2 rounded-lg">
                                                    <div className="text-[8px] uppercase font-bold text-emerald-800">Aplicacoes</div>
                                                    <div className="text-sm font-black text-emerald-950">{applications.length}</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>
                    )}

                    {/* Plot detail modal */}
                    {selectedPlot && (
                        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setSelectedPlot(null)}>
                            <div className="card-stitch w-[90%] max-w-md p-6 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                                <div className="flex justify-between mb-4"><h3 className="text-xl font-bold text-emerald-950 headline-font">{selectedPlot.name}</h3><button onClick={() => setSelectedPlot(null)} className="p-1 hover:bg-gray-100 rounded-lg cursor-pointer"><X className="w-5 h-5 text-[#41493e]" /></button></div>
                                {selectedPlot.crop && <p className="text-sm text-[#41493e] mb-1">Cultura: <strong className="text-emerald-950">{selectedPlot.crop}</strong></p>}
                                <p className="text-sm text-[#41493e]">Area: <strong className="text-emerald-950">{parseFloat(selectedPlot.areaHa || 0).toFixed(1)} ha</strong></p>
                                <div className="mt-4 p-4 bg-[#eff6e7] rounded-xl text-center"><p className="text-4xl font-black text-emerald-950">{selectedPlot.appCount}</p><p className="text-sm text-[#41493e] font-semibold">Aplicacoes Realizadas</p></div>
                                <button onClick={() => { setSelectedPlot(null); setLocation("/fazenda/aplicacoes"); }} className="mt-4 w-full py-3 bg-gradient-to-b from-[#00450d] to-[#1b5e20] text-white rounded-full text-sm font-bold headline-font cursor-pointer hover:opacity-90 transition-opacity">Ver Detalhes</button>
                            </div>
                        </div>
                    )}

                    {/* ══ CARD 3: Crop Health (4 col) ══ */}
                    <section className="md:col-span-4 card-stitch p-6 cursor-pointer" onClick={() => setLocation("/fazenda/aplicacoes")}>
                        <h3 className="headline-font font-bold text-lg text-emerald-950 mb-6">Saude das Culturas</h3>
                        {cropHealth.length > 0 ? (
                            <div className="space-y-5">
                                {cropHealth.map(ch => {
                                    const pct = Math.round((ch.count / maxApps) * 100);
                                    return (
                                        <div key={ch.crop}>
                                            <div className="flex justify-between items-end mb-2">
                                                <span className="text-sm font-bold text-[#171d14]">{ch.crop}</span>
                                                <span className="text-xl font-black text-emerald-700">{ch.count}</span>
                                            </div>
                                            <div className="h-3 bg-[#e9f0e1] rounded-full overflow-hidden">
                                                <div className="h-full bg-[#1b5e20] rounded-full transition-all duration-700" style={{ width: `${pct}%` }}></div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : <div className="h-32 flex items-center justify-center text-[#717a6d] text-sm">Sem aplicacoes</div>}
                    </section>

                    {/* ══ CARD 4: Stock Inventory (4 col) ══ */}
                    {hasModule("stock") && (
                        <section className="md:col-span-4 card-stitch p-6 cursor-pointer" onClick={() => setLocation("/fazenda/estoque")}>
                            <h3 className="headline-font font-bold text-lg text-emerald-950 mb-6">Inventario de Estoque</h3>
                            <div className="flex items-center gap-4">
                                <div className="relative w-36 h-36 shrink-0">
                                    {stockByCategory.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart><Pie data={stockByCategory} dataKey="value" nameKey="category" cx="50%" cy="50%" outerRadius={60} innerRadius={38} paddingAngle={2} strokeWidth={0}>
                                                {stockByCategory.map((e, i) => <Cell key={i} fill={CATEGORY_COLORS[e.category] || CATEGORY_COLORS.outros} />)}
                                            </Pie></PieChart>
                                        </ResponsiveContainer>
                                    ) : null}
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                                        <span className="text-2xl font-black text-emerald-950">{totalStockItems.toLocaleString()}</span>
                                        <span className="text-[8px] uppercase font-bold tracking-widest text-[#41493e]">Itens</span>
                                    </div>
                                </div>
                                <div className="flex-1 space-y-2">
                                    {stockByCategory.slice(0, 5).map(cat => (
                                        <div key={cat.category} className="flex items-center gap-2 text-[10px] font-bold">
                                            <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: CATEGORY_COLORS[cat.category] || CATEGORY_COLORS.outros }}></div>
                                            <span className="text-[#41493e] capitalize">{cat.category}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>
                    )}

                    {/* ══ CARD 5: Silos — dark card (4 col) ══ */}
                    <section className="md:col-span-4 rounded-xl p-6 text-white relative overflow-hidden cursor-pointer" style={{ background: "#00450d", boxShadow: SHADOW }} onClick={() => setLocation("/fazenda/romaneios")}>
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-800/50 rounded-bl-full"></div>
                        <div className="relative z-10 h-full flex flex-col justify-between">
                            <div>
                                <h3 className="headline-font font-bold text-lg text-emerald-50 mb-4">Status dos Silos</h3>
                                <div className="space-y-1">
                                    <div className="text-3xl font-black">{fmtW(totalHarvest)}</div>
                                    <div className="text-xs text-emerald-300 font-bold uppercase tracking-widest">Colheita total armazenada</div>
                                </div>
                            </div>
                            <div className="mt-6 space-y-3">
                                {silos.slice(0, 3).map((silo: any, i: number) => (
                                    <div key={silo.buyer} className={`flex justify-between items-center ${i < silos.length - 1 ? "border-b border-emerald-800 pb-2" : ""}`}>
                                        <span className="text-xs font-medium text-emerald-200 uppercase truncate max-w-[60%]">{silo.buyer}</span>
                                        <span className="text-sm font-bold">{fmtW(silo.totalWeight || 0)}</span>
                                    </div>
                                ))}
                                {silos.length === 0 && <p className="text-emerald-300 text-sm">Sem romaneios confirmados</p>}
                            </div>
                        </div>
                    </section>

                    {/* ══ CARD 6: Financial Performance (7 col) ══ */}
                    <section className="md:col-span-7 card-stitch p-6 cursor-pointer" onClick={() => setLocation("/fazenda/fluxo-caixa")}>
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="headline-font font-bold text-lg text-emerald-950">Desempenho Financeiro</h3>
                                <p className="text-sm text-[#41493e]">Visao geral do periodo</p>
                            </div>
                            <div className="text-right">
                                <div className="text-[10px] text-[#41493e] font-bold uppercase">Saldo</div>
                                <div className={`text-xl font-black ${netBalance >= 0 ? "text-emerald-700" : "text-red-700"}`}>{fmt(Math.abs(netBalance))}</div>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4 mb-6">
                            <div className="bg-[#eff6e7] p-4 rounded-xl">
                                <div className="text-[10px] uppercase font-bold text-[#41493e] mb-1">Receita Total</div>
                                <div className="text-2xl font-black text-emerald-950">{fmt(totalIncome)}</div>
                            </div>
                            <div className="bg-[#eff6e7] p-4 rounded-xl">
                                <div className="text-[10px] uppercase font-bold text-[#41493e] mb-1">Despesas</div>
                                <div className="text-2xl font-black text-red-700">{fmt(totalExpense)}</div>
                            </div>
                            <div className="bg-emerald-950 p-4 rounded-xl text-white">
                                <div className="text-[10px] uppercase font-bold text-emerald-300 mb-1">Valor Estoque</div>
                                <div className="text-2xl font-black">{fmt(stock.reduce((s: number, st: any) => s + parseFloat(st.quantity || 0) * parseFloat(st.averageCost || 0), 0))}</div>
                            </div>
                        </div>
                        <div className="h-28 flex items-end gap-2 px-2">
                            {monthlyExpenses.map((m, i) => {
                                const maxV = Math.max(...monthlyExpenses.map(e => e.value), 1);
                                const h = (m.value / maxV) * 100;
                                const isRecent = i >= monthlyExpenses.length - 3;
                                return (
                                    <div key={m.month} className="flex-1 rounded-t-sm transition-all duration-500" style={{ height: `${Math.max(h, 5)}%`, background: isRecent ? "#1b5e20" : "#e9f0e1" }}></div>
                                );
                            })}
                        </div>
                    </section>

                    {/* ══ CARD 7: Machinery Deployment (5 col) ══ */}
                    {hasModule("fleet") && (
                        <section className="md:col-span-5 card-stitch p-6 cursor-pointer" onClick={() => setLocation("/fazenda/equipamentos")}>
                            <h3 className="headline-font font-bold text-lg text-emerald-950 mb-6">Frota</h3>
                            <div className="grid grid-cols-1 gap-3">
                                {equipment.length > 0 ? equipment.slice(0, 5).map((eq: any) => {
                                    const isActive = eq.status === "Ativo" || !eq.status;
                                    const isMaint = eq.status === "Manutenção" || eq.status === "Manutencao";
                                    const isAlert = eq.status === "Inativo";
                                    const diesel = dieselByEquip[eq.name];
                                    const isColheitadeira = eq.type === "Colheitadeira";
                                    const statusColor = isAlert ? "bg-red-50 text-red-800 border-l-4 border-red-500" : isMaint ? "bg-[#e9f0e1]" : "bg-[#eff6e7]";
                                    const badgeColor = isActive ? "bg-[#b7f481] text-[#204200]" : isMaint ? "bg-[#dee5d6] text-[#41493e]" : "bg-red-100 text-red-800";
                                    const badgeText = isActive ? "ATIVO" : isMaint ? "PARADO" : "ALERTA";
                                    return (
                                        <div key={eq.id} className={`flex items-center justify-between p-3 rounded-xl ${statusColor}`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center overflow-hidden ${isAlert ? "bg-red-100" : "bg-emerald-100"}`}>
                                                    <img src={isColheitadeira ? "/colheitadeira.png" : "/trator.png"} alt={eq.type} className="w-8 h-8 object-contain" />
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold text-[#171d14]">{eq.name}</div>
                                                    <div className="text-[10px] text-[#41493e] font-medium">
                                                        {eq.type}{diesel ? ` • ${diesel.toFixed(0)}L diesel` : ""}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className={`px-3 py-1 ${badgeColor} text-[10px] font-bold rounded-full uppercase`}>{badgeText}</div>
                                        </div>
                                    );
                                }) : <div className="h-20 flex items-center justify-center text-[#717a6d] text-sm">Nenhum equipamento</div>}
                            </div>
                        </section>
                    )}
                </div>
            </div>
        </FarmLayout>
    );
}
