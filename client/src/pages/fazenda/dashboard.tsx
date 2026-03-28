import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import FarmLayout from "@/components/fazenda/layout";
import { useAuth } from "@/hooks/use-auth";
import {
    Loader2, RefreshCw, Droplets, Wind, Thermometer, Fuel, X, MapPin, ChevronDown, ChevronUp, Clock
} from "lucide-react";
import {
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
    PieChart, Pie, Cell, CartesianGrid
} from "recharts";
import { MapContainer, TileLayer, Polygon, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// ══════════════════════════════════════════════════════════════════════════════
// DESIGN SYSTEM — "The Cultivated Landscape"
// ══════════════════════════════════════════════════════════════════════════════
const SHADOW = "0 12px 40px rgba(23,29,20,0.06)";
const CATEGORY_COLORS: Record<string, string> = {
    fungicida: "#1b5e20", herbicida: "#204200", inseticida: "#2f5c00",
    fertilizante: "#4a626d", semente: "#334a55", adjuvante: "#506873",
    biologico: "#6b8e23", combustivel: "#717a6d", diesel: "#717a6d",
    outros: "#c0c9bb", outro: "#c0c9bb",
};

function normalizeCategory(cat: string): string {
    const l = (cat || "").toLowerCase().trim();
    if (l.includes("fungicida")) return "Fungicida";
    if (l.includes("herbicida")) return "Herbicida";
    if (l.includes("inseticida") || l.includes("insecticida")) return "Inseticida";
    if (l.includes("fertilizante") || l.includes("foliar")) return "Fertilizante";
    if (l.includes("semente") || l.includes("curasemilla")) return "Semente";
    if (l.includes("adjuvante") || l.includes("coadyuvante")) return "Adjuvante";
    if (l.includes("biolog")) return "Biologico";
    if (l.includes("diesel") || l.includes("combusti")) return "Diesel";
    return "Outros";
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

// ══════════════════════════════════════════════════════════════════════════════
export default function FarmDashboard() {
    const [, setLocation] = useLocation();
    const { user, isLoading } = useAuth();
    const queryClient = useQueryClient();
    const [selectedPlot, setSelectedPlot] = useState<any>(null);
    const [expandedApp, setExpandedApp] = useState<string | null>(null);

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
            queryClient.invalidateQueries({ queryKey: ["/api/farm/accounts-payable"] }),
            queryClient.invalidateQueries({ queryKey: ["/api/farm/invoices/summary/by-supplier"] }),
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
    const { data: weatherStations = [] } = useQuery<any[]>({ queryKey: ["/api/farm/weather/stations"], queryFn: async () => (await apiRequest("GET", "/api/farm/weather/stations")).json(), enabled: !!user });
    const { data: accountsPayable = [] } = useQuery<any[]>({ queryKey: ["/api/farm/accounts-payable"], queryFn: async () => (await apiRequest("GET", "/api/farm/accounts-payable")).json(), enabled: !!user });
    const { data: supplierSummary = [] } = useQuery<any[]>({ queryKey: ["/api/farm/invoices/summary/by-supplier"], queryFn: async () => (await apiRequest("GET", "/api/farm/invoices/summary/by-supplier")).json(), enabled: !!user });

    // ─── Card 1: Despesas Mensais (filtrado ate mes atual, com ano) ─────────
    const monthlyExpenses = useMemo(() => {
        const now = new Date();
        const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const map: Record<string, number> = {};
        invoices.forEach((inv: any) => {
            if (!inv.issueDate) return;
            const d = new Date(inv.issueDate);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            if (key > currentKey) return;
            if (!map[key]) map[key] = 0;
            map[key] += parseFloat(inv.totalAmount || 0);
        });
        const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([key, value]) => {
            const [year, m] = key.split("-");
            const shortYear = year.slice(2);
            return { month: `${months[parseInt(m) - 1]}/${shortYear}`, value: Math.round(value) };
        });
    }, [invoices]);
    const totalExpenses = monthlyExpenses.reduce((s, m) => s + m.value, 0);
    const lastMonth = monthlyExpenses[monthlyExpenses.length - 1]?.value || 0;
    const prevMonth = monthlyExpenses[monthlyExpenses.length - 2]?.value || 0;
    const pctChange = prevMonth > 0 ? ((lastMonth - prevMonth) / prevMonth * 100) : 0;

    // ─── Card 2: Plots + last application date per plot ──────────────────────
    const plotsWithCoords = useMemo(() => plots.filter((p: any) => {
        try { const c = typeof p.coordinates === "string" ? JSON.parse(p.coordinates) : p.coordinates; return Array.isArray(c) && c.length >= 3; } catch { return false; }
    }), [plots]);

    const plotAppInfo = useMemo(() => {
        const m: Record<string, { count: number; lastDate: string | null }> = {};
        applications.forEach((a: any) => {
            if (!a.plotId) return;
            if (!m[a.plotId]) m[a.plotId] = { count: 0, lastDate: null };
            m[a.plotId].count += 1;
            const dt = a.appliedAt || a.createdAt;
            if (dt && (!m[a.plotId].lastDate || dt > m[a.plotId].lastDate!)) m[a.plotId].lastDate = dt;
        });
        return m;
    }, [applications]);

    // ─── Card 3: Ultimas 3 aplicacoes ────────────────────────────────────────
    const recentApps = useMemo(() => {
        return [...applications]
            .sort((a: any, b: any) => new Date(b.appliedAt || b.createdAt).getTime() - new Date(a.appliedAt || a.createdAt).getTime())
            .slice(0, 3);
    }, [applications]);

    // ─── Card 4: Estoque por categoria (normalizado — tenta category, productCategory, product_name) ─
    const stockByCategory = useMemo(() => {
        const m: Record<string, { category: string; count: number; value: number }> = {};
        stock.forEach((s: any) => {
            // A API retorna 'category' do JOIN com farm_products_catalog
            const rawCat = s.category || s.productCategory || s.product_category || "";
            const cat = normalizeCategory(rawCat);
            const key = cat.toLowerCase();
            if (!m[key]) m[key] = { category: cat, count: 0, value: 0 };
            m[key].count += 1;
            m[key].value += parseFloat(s.quantity || 0) * parseFloat(s.averageCost || s.average_cost || 0);
        });
        return Object.values(m).sort((a, b) => b.count - a.count);
    }, [stock]);

    // ─── Card 5: Silos ──────────────────────────────────────────────────────
    const silos = siloData?.silos || [];
    const totalHarvest = siloData?.totalHarvest || 0;

    // ─── Card 6: Divida por empresa (contas a pagar + faturas pendentes) ────
    const debtByCompany = useMemo(() => {
        const m: Record<string, { name: string; amount: number }> = {};
        // Contas a pagar pendentes
        accountsPayable.forEach((ap: any) => {
            if (ap.status === "paid") return;
            const name = ap.supplier || "Outros";
            if (!m[name]) m[name] = { name, amount: 0 };
            m[name].amount += parseFloat(ap.totalAmount || ap.amount || 0);
        });
        // Faturas pendentes
        invoices.forEach((inv: any) => {
            if (inv.status !== "pending") return;
            const name = inv.supplierName || inv.supplier || "Outros";
            if (!m[name]) m[name] = { name, amount: 0 };
            m[name].amount += parseFloat(inv.totalAmount || 0);
        });
        return Object.values(m).sort((a, b) => b.amount - a.amount).slice(0, 6);
    }, [accountsPayable, invoices]);
    const maxDebt = Math.max(...debtByCompany.map(d => d.amount), 1);
    const totalDebt = debtByCompany.reduce((s, d) => s + d.amount, 0);

    // ─── Card 7: Equipment + ultimo abastecimento ───────────────────────────
    const lastDieselByEquip = useMemo(() => {
        const m: Record<string, { liters: number; date: string; totalLiters: number }> = {};
        applications.forEach((a: any) => {
            const isDiesel = (a.productCategory || a.category || "").toLowerCase().includes("diesel") || (a.productName || "").toLowerCase().includes("diesel");
            if (!isDiesel || !a.equipmentName) return;
            const dt = a.appliedAt || a.createdAt;
            const qty = parseFloat(a.quantity || 0);
            if (!m[a.equipmentName]) m[a.equipmentName] = { liters: 0, date: dt, totalLiters: 0 };
            m[a.equipmentName].totalLiters += qty;
            if (dt > m[a.equipmentName].date) { m[a.equipmentName].date = dt; m[a.equipmentName].liters = qty; }
        });
        return m;
    }, [applications]);

    // Weather
    const cw = weatherStations[0]?.currentWeather;

    if (isLoading) return <FarmLayout><div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div></FarmLayout>;

    function fmt(v: number) { if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`; if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`; return `$${v.toFixed(0)}`; }
    function fmtW(kg: number) { return kg >= 1000 ? `${(kg / 1000).toFixed(1)}t` : `${kg.toFixed(0)}kg`; }
    function fmtDate(d: string | null) { if (!d) return "—"; try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return "—"; } }
    function fmtDateTime(d: string | null) { if (!d) return "—"; try { const dt = new Date(d); return `${dt.toLocaleDateString("pt-BR")} ${dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`; } catch { return "—"; } }

    const dateStr = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

    return (
        <FarmLayout>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&display=swap');
                .headline-font { font-family: 'Manrope', sans-serif; }
                .card-stitch { background:#fff; border-radius:0.75rem; box-shadow:${SHADOW}; border:1px solid rgba(255,255,255,0.8); transition:all 0.3s cubic-bezier(0.16,1,0.3,1); }
                .card-stitch:hover { transform:translateY(-2px); box-shadow:0 16px 48px rgba(23,29,20,0.1); }
            `}</style>

            <div ref={containerRef} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
                {(pullDistance > 0 || refreshing) && (
                    <div className="flex items-center justify-center transition-all duration-200 overflow-hidden" style={{ height: refreshing ? 48 : pullDistance }}>
                        <div className={`flex items-center gap-2 text-emerald-700 ${refreshing ? "animate-pulse" : ""}`}>
                            <RefreshCw className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`} />
                            <span className="text-sm font-medium">{refreshing ? "Atualizando..." : pullDistance >= PULL_THRESHOLD ? "Solte" : "Puxe"}</span>
                        </div>
                    </div>
                )}

                <header className="mb-8 flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
                    <div>
                        <h2 className="text-3xl sm:text-4xl font-extrabold text-emerald-950 headline-font tracking-tight mb-1">Comando Operacional</h2>
                        <p className="text-sm font-medium text-[#41493e]">Analitico em tempo real da sua fazenda.</p>
                    </div>
                    <div className="flex gap-3 items-center">
                        <button onClick={handleRefresh} disabled={refreshing} className="px-4 py-2 bg-white rounded-full flex items-center gap-2 text-emerald-800 text-sm font-semibold cursor-pointer hover:bg-emerald-50 transition-colors" style={{ boxShadow: SHADOW }}>
                            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} /> Atualizar
                        </button>
                        <div className="px-4 py-2 bg-emerald-950 text-white rounded-full text-sm font-semibold headline-font" style={{ boxShadow: SHADOW }}>{dateStr}</div>
                    </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-8">

                    {/* ══ CARD 1: Despesas Mensais (8 col) — filtrado ate mes atual ══ */}
                    {hasModule("invoices") && (
                        <section className="md:col-span-8 card-stitch p-6 cursor-pointer" onClick={() => setLocation("/fazenda/faturas")}>
                            <div className="flex justify-between items-center mb-6">
                                <div><h3 className="headline-font font-bold text-lg text-emerald-950">Despesas Mensais</h3><p className="text-sm text-[#41493e]">Trajetoria anual de faturas</p></div>
                                <div className="text-right">
                                    <span className="text-3xl font-black text-emerald-950">{fmt(totalExpenses)}</span>
                                    <span className="text-sm font-semibold text-emerald-700 ml-1">Total</span>
                                    {pctChange !== 0 && <div className={`text-[10px] font-bold uppercase tracking-wider ${pctChange > 0 ? "text-red-700" : "text-[#2f5c00]"}`}>{pctChange > 0 ? "+" : ""}{pctChange.toFixed(1)}% vs mes anterior</div>}
                                </div>
                            </div>
                            <div className="h-52 w-full">
                                {monthlyExpenses.length > 1 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={monthlyExpenses}>
                                            <defs><linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="rgba(27,94,32,0.2)" /><stop offset="100%" stopColor="rgba(27,94,32,0)" /></linearGradient></defs>
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

                    {/* ══ CARD 2: Mapa (4 col) — dragging + touch habilitados ══ */}
                    {hasModule("properties") && (
                        <section className="md:col-span-4 card-stitch overflow-hidden relative" style={{ minHeight: 400 }}>
                            <div className="absolute inset-0 z-0">
                                {plotsWithCoords.length > 0 ? (
                                    <MapContainer center={[-25.5, -54.6]} zoom={13} className="h-full w-full"
                                        zoomControl={false} attributionControl={false}
                                        dragging={true} touchZoom={true} scrollWheelZoom={true} doubleClickZoom={true}>
                                        <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
                                        <MapAutoFit plots={plotsWithCoords} />
                                        {plotsWithCoords.map((p: any) => {
                                            const coords = typeof p.coordinates === "string" ? JSON.parse(p.coordinates) : p.coordinates;
                                            const positions = coords.map((c: any) => [c.lat, c.lng] as [number, number]);
                                            const info = plotAppInfo[p.id] || { count: 0, lastDate: null };
                                            return (
                                                <Polygon key={p.id} positions={positions}
                                                    pathOptions={{ color: "#f59e0b", weight: 2, fillOpacity: 0.15, fillColor: "#f59e0b" }}
                                                    eventHandlers={{ click: () => setSelectedPlot({ ...p, appCount: info.count, lastAppDate: info.lastDate }) }}>
                                                    <Popup>
                                                        <div className="text-sm min-w-[170px]">
                                                            <strong>{p.name}</strong>{p.crop && <span> — {p.crop}</span>}<br/>
                                                            {parseFloat(p.areaHa || 0).toFixed(1)} ha<br/>
                                                            <b className="text-emerald-700">{info.count} aplicacoes</b><br/>
                                                            {info.lastDate && <span className="text-gray-500 text-xs">Ultima: {fmtDate(info.lastDate)}</span>}
                                                        </div>
                                                    </Popup>
                                                </Polygon>
                                            );
                                        })}
                                    </MapContainer>
                                ) : <div className="h-full bg-emerald-50 flex items-center justify-center text-[#41493e] text-sm">Cadastre talhoes com coordenadas</div>}
                                <div className="absolute inset-0 bg-emerald-900/10 mix-blend-multiply pointer-events-none"></div>
                            </div>
                            <div className="relative z-10 p-6 flex flex-col h-full pointer-events-none">
                                <div className="pointer-events-auto">
                                    <div className="bg-white/70 backdrop-blur-[12px] p-3 rounded-xl inline-block">
                                        <h3 className="headline-font font-bold text-sm text-emerald-950">Monitoramento de Campo</h3>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Satelite em tempo real</p>
                                    </div>
                                </div>
                                {plotsWithCoords.length > 0 && (
                                    <div className="mt-auto pointer-events-auto">
                                        <div className="bg-white/70 backdrop-blur-[12px] p-4 rounded-xl">
                                            <div className="flex items-center gap-2 mb-2"><MapPin className="w-4 h-4 text-emerald-700" /><span className="text-xs font-bold text-emerald-950">{plots.length} Talhoes</span></div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="bg-emerald-950/10 p-2 rounded-lg"><div className="text-[8px] uppercase font-bold text-emerald-800">Area</div><div className="text-sm font-black text-emerald-950">{plots.reduce((s: number, p: any) => s + parseFloat(p.areaHa || 0), 0).toFixed(0)} ha</div></div>
                                                <div className="bg-emerald-950/10 p-2 rounded-lg"><div className="text-[8px] uppercase font-bold text-emerald-800">Aplicacoes</div><div className="text-sm font-black text-emerald-950">{applications.length}</div></div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>
                    )}

                    {/* Plot modal — com data ultima aplicacao */}
                    {selectedPlot && (
                        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setSelectedPlot(null)}>
                            <div className="card-stitch w-[90%] max-w-md p-6 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                                <div className="flex justify-between mb-4"><h3 className="text-xl font-bold text-emerald-950 headline-font">{selectedPlot.name}</h3><button onClick={() => setSelectedPlot(null)} className="p-1 hover:bg-gray-100 rounded-lg cursor-pointer"><X className="w-5 h-5 text-[#41493e]" /></button></div>
                                {selectedPlot.crop && <p className="text-sm text-[#41493e] mb-1">Cultura: <strong className="text-emerald-950">{selectedPlot.crop}</strong></p>}
                                <p className="text-sm text-[#41493e]">Area: <strong className="text-emerald-950">{parseFloat(selectedPlot.areaHa || 0).toFixed(1)} ha</strong></p>
                                <div className="mt-4 grid grid-cols-2 gap-3">
                                    <div className="p-4 bg-[#eff6e7] rounded-xl text-center"><p className="text-3xl font-black text-emerald-950">{selectedPlot.appCount}</p><p className="text-xs text-[#41493e] font-semibold">Aplicacoes</p></div>
                                    <div className="p-4 bg-[#eff6e7] rounded-xl text-center"><p className="text-sm font-black text-emerald-950">{fmtDate(selectedPlot.lastAppDate)}</p><p className="text-xs text-[#41493e] font-semibold">Ultima Aplicacao</p></div>
                                </div>
                                <button onClick={() => { setSelectedPlot(null); setLocation("/fazenda/aplicacoes"); }} className="mt-4 w-full py-3 bg-gradient-to-b from-[#00450d] to-[#1b5e20] text-white rounded-full text-sm font-bold headline-font cursor-pointer hover:opacity-90 transition-opacity">Ver Detalhes</button>
                            </div>
                        </div>
                    )}

                    {/* ══ CARD 3: Ultimas Aplicacoes (4 col) — clique abre modal ══ */}
                    <section className="md:col-span-4 card-stitch p-6">
                        <h3 className="headline-font font-bold text-lg text-emerald-950 mb-4">Ultimas Aplicacoes</h3>
                        {recentApps.length > 0 ? (
                            <div className="space-y-3">
                                {recentApps.map((app: any) => (
                                    <div key={app.id} className="bg-[#eff6e7] rounded-xl p-3 cursor-pointer hover:bg-[#e9f0e1] transition-colors"
                                        onClick={() => setExpandedApp(app.id)}>
                                        <div className="text-sm font-bold text-[#171d14] truncate">{app.plotName || "Talhao"}</div>
                                        <div className="flex items-center gap-1.5 text-[10px] text-[#41493e] font-medium">
                                            <Clock className="w-3 h-3" />
                                            {fmtDateTime(app.appliedAt || app.createdAt)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : <div className="h-32 flex items-center justify-center text-[#717a6d] text-sm">Sem aplicacoes</div>}
                    </section>

                    {/* Modal flutuante da aplicacao */}
                    {expandedApp && (() => {
                        const app = recentApps.find((a: any) => a.id === expandedApp) || applications.find((a: any) => a.id === expandedApp);
                        if (!app) return null;
                        return (
                            <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setExpandedApp(null)}>
                                <div className="card-stitch w-[90%] max-w-md p-6 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                                    <div className="flex justify-between mb-4">
                                        <h3 className="text-xl font-bold text-emerald-950 headline-font">{app.plotName || "Talhao"}</h3>
                                        <button onClick={() => setExpandedApp(null)} className="p-1 hover:bg-gray-100 rounded-lg cursor-pointer"><X className="w-5 h-5 text-[#41493e]" /></button>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 text-sm text-[#41493e]">
                                            <Clock className="w-4 h-4" />
                                            {fmtDateTime(app.appliedAt || app.createdAt)}
                                        </div>
                                        <div className="bg-[#eff6e7] rounded-xl p-4 space-y-2">
                                            <div className="text-[10px] font-bold text-[#41493e] uppercase tracking-wider">Produto</div>
                                            <div className="text-base font-bold text-[#171d14]">{app.productName || "—"}</div>
                                            {app.quantity && <div className="text-sm text-[#41493e]">Quantidade: <strong>{parseFloat(app.quantity).toFixed(2)} {app.unit || app.productUnit || ""}</strong></div>}
                                            {app.equipmentName && <div className="text-sm text-[#41493e]">Equipamento: <strong>{app.equipmentName}</strong></div>}
                                            {app.crop && <div className="text-sm text-[#41493e]">Cultura: <strong>{app.crop}</strong></div>}
                                        </div>
                                    </div>
                                    <button onClick={() => { setExpandedApp(null); setLocation("/fazenda/aplicacoes"); }}
                                        className="mt-4 w-full py-3 bg-gradient-to-b from-[#00450d] to-[#1b5e20] text-white rounded-full text-sm font-bold headline-font cursor-pointer hover:opacity-90 transition-opacity">
                                        Ver Todas Aplicacoes
                                    </button>
                                </div>
                            </div>
                        );
                    })()}

                    {/* ══ CARD 4: Inventario Estoque — categorias corretas + quantidade (4 col) ══ */}
                    {hasModule("stock") && (
                        <section className="md:col-span-4 card-stitch p-6 cursor-pointer" onClick={() => setLocation("/fazenda/estoque")}>
                            <h3 className="headline-font font-bold text-lg text-emerald-950 mb-4">Inventario de Estoque</h3>
                            <div className="flex items-center gap-4">
                                <div className="relative w-36 h-36 shrink-0">
                                    {stockByCategory.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart><Pie data={stockByCategory} dataKey="count" nameKey="category" cx="50%" cy="50%" outerRadius={60} innerRadius={38} paddingAngle={2} strokeWidth={0}>
                                                {stockByCategory.map((e, i) => <Cell key={i} fill={CATEGORY_COLORS[e.category.toLowerCase()] || CATEGORY_COLORS.outros} />)}
                                            </Pie></PieChart>
                                        </ResponsiveContainer>
                                    ) : null}
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                                        <span className="text-2xl font-black text-emerald-950">{stock.length}</span>
                                        <span className="text-[8px] uppercase font-bold tracking-widest text-[#41493e]">Itens</span>
                                    </div>
                                </div>
                                <div className="flex-1 space-y-2">
                                    {stockByCategory.map(cat => (
                                        <div key={cat.category} className="flex items-center gap-2 text-[11px] font-bold">
                                            <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: CATEGORY_COLORS[cat.category.toLowerCase()] || CATEGORY_COLORS.outros }}></div>
                                            <span className="text-[#41493e] flex-1">{cat.category}</span>
                                            <span className="text-emerald-700 font-black">{cat.count}</span>
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
                            <div><h3 className="headline-font font-bold text-lg text-emerald-50 mb-4">Status dos Silos</h3><div className="space-y-1"><div className="text-3xl font-black">{fmtW(totalHarvest)}</div><div className="text-xs text-emerald-300 font-bold uppercase tracking-widest">Colheita total</div></div></div>
                            <div className="mt-6 space-y-3">
                                {silos.slice(0, 3).map((silo: any, i: number) => (
                                    <div key={silo.buyer} className={`flex justify-between items-center ${i < 2 ? "border-b border-emerald-800 pb-2" : ""}`}>
                                        <span className="text-xs font-medium text-emerald-200 uppercase truncate max-w-[60%]">{silo.buyer}</span>
                                        <span className="text-sm font-bold">{fmtW(silo.totalWeight || 0)}</span>
                                    </div>
                                ))}
                                {silos.length === 0 && <p className="text-emerald-300 text-sm">Sem romaneios</p>}
                            </div>
                        </div>
                    </section>

                    {/* ══ CARD 6: Divida por Empresa (7 col) — barras por fornecedor ══ */}
                    <section className="md:col-span-7 card-stitch p-6 cursor-pointer" onClick={() => setLocation("/fazenda/contas-pagar")}>
                        <div className="flex justify-between items-center mb-6">
                            <div><h3 className="headline-font font-bold text-lg text-emerald-950">Divida por Empresa</h3><p className="text-sm text-[#41493e]">Contas a pagar + faturas pendentes</p></div>
                            <div className="text-right"><div className="text-[10px] text-[#41493e] font-bold uppercase">Total</div><div className="text-xl font-black text-red-700">{fmt(totalDebt)}</div></div>
                        </div>
                        {debtByCompany.length > 0 ? (
                            <div className="h-44 flex items-end gap-3 px-2">
                                {debtByCompany.map((d, i) => {
                                    const pct = (d.amount / maxDebt) * 100;
                                    const colors = ["#1b5e20", "#1b5e20", "#204200", "#2f5c00", "#41493e", "#717a6d"];
                                    return (
                                        <div key={d.name} className="flex-1 flex flex-col items-center gap-1">
                                            <span className="text-[10px] font-black text-emerald-950">{fmt(d.amount)}</span>
                                            <div className="w-full bg-[#e9f0e1] rounded-t-sm relative overflow-hidden" style={{ height: "120px" }}>
                                                <div className="absolute bottom-0 left-0 right-0 rounded-t-sm transition-all duration-700"
                                                    style={{ height: `${Math.max(pct, 5)}%`, background: colors[i] || "#717a6d" }}></div>
                                            </div>
                                            <span className="text-[8px] font-bold text-[#41493e] text-center truncate max-w-full uppercase leading-tight">{d.name.split(" ").slice(0, 2).join(" ")}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : <div className="h-32 flex items-center justify-center text-[#717a6d] text-sm">Sem dividas pendentes</div>}
                    </section>

                    {/* ══ CARD 7: Frota (5 col) — com ultimo abastecimento ══ */}
                    {hasModule("fleet") && (
                        <section className="md:col-span-5 card-stitch p-6 cursor-pointer" onClick={() => setLocation("/fazenda/equipamentos")}>
                            <h3 className="headline-font font-bold text-lg text-emerald-950 mb-6">Frota</h3>
                            <div className="grid grid-cols-1 gap-3">
                                {equipment.length > 0 ? equipment.slice(0, 5).map((eq: any) => {
                                    const isActive = eq.status === "Ativo" || !eq.status;
                                    const isMaint = eq.status === "Manutenção" || eq.status === "Manutencao";
                                    const isAlert = eq.status === "Inativo";
                                    const diesel = lastDieselByEquip[eq.name];
                                    const isColheitadeira = eq.type === "Colheitadeira";
                                    const statusColor = isAlert ? "bg-red-50 border-l-4 border-red-500" : isMaint ? "bg-[#e9f0e1]" : "bg-[#eff6e7]";
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
                                                        {eq.type}
                                                        {diesel && <span> • <Fuel className="w-2.5 h-2.5 inline" /> {diesel.liters.toFixed(0)}L em {fmtDateTime(diesel.date)}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className={`px-3 py-1 ${badgeColor} text-[10px] font-bold rounded-full uppercase shrink-0`}>{badgeText}</div>
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
