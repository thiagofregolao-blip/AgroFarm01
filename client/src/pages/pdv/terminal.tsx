import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Search, Check, ArrowLeft, ArrowRight, Minus, Plus, Loader2, LogOut, Wifi, WifiOff, ShoppingCart, Trash2, Droplets, MapPin } from "lucide-react";

interface CartItem {
    product: any;
    quantity: number;
}

const CATEGORY_COLORS: Record<string, string> = {
    herbicida: "from-green-600 to-green-800",
    fungicida: "from-blue-600 to-blue-800",
    inseticida: "from-red-600 to-red-800",
    fertilizante: "from-amber-600 to-amber-800",
    semente: "from-yellow-600 to-yellow-800",
    adjuvante: "from-purple-600 to-purple-800",
    outro: "from-slate-600 to-slate-800",
};

const CATEGORY_EMOJI: Record<string, string> = {
    herbicida: "🌿",
    fungicida: "🍄",
    inseticida: "🐛",
    fertilizante: "🧪",
    semente: "🌱",
    adjuvante: "💧",
    outro: "📦",
};

export default function PdvTerminal() {
    const [, setLocation] = useLocation();
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const [step, setStep] = useState<"product" | "plot" | "confirm">("product");
    const [search, setSearch] = useState("");
    const [cart, setCart] = useState<CartItem[]>([]);
    const [selectedPlots, setSelectedPlots] = useState<any[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [categoryFilter, setCategoryFilter] = useState<string>("");
    // Manual overrides for distributed qtys: key = `${productId}__${plotId}`
    const [distOverrides, setDistOverrides] = useState<Record<string, number>>({});

    useEffect(() => {
        const setOn = () => setIsOnline(true);
        const setOff = () => setIsOnline(false);
        window.addEventListener("online", setOn);
        window.addEventListener("offline", setOff);
        return () => { window.removeEventListener("online", setOn); window.removeEventListener("offline", setOff); };
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            if (isOnline) apiRequest("POST", "/api/pdv/heartbeat").catch(() => { });
        }, 30000);
        return () => clearInterval(interval);
    }, [isOnline]);

    const { data: pdvData } = useQuery({
        queryKey: ["/api/pdv/data"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/pdv/data");
            if (!res.ok) throw new Error("Not authenticated");
            return res.json();
        },
        retry: false,
        refetchInterval: 60000,
    });

    const products = pdvData?.products || [];
    const stock = pdvData?.stock || [];
    const plots = pdvData?.plots || [];

    const getStockForProduct = (productId: string) => {
        const s = stock.find((s: any) => s.productId === productId);
        return s ? parseFloat(s.quantity) : 0;
    };

    const categories = Array.from(new Set(products.map((p: any) => p.category).filter(Boolean))) as string[];

    const filtered = products.filter((p: any) => {
        const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
        const matchesCategory = !categoryFilter || p.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    const isInCart = (productId: string) => cart.some(c => c.product.id === productId);

    const addToCart = (product: any) => {
        if (!isInCart(product.id)) setCart([...cart, { product, quantity: 1 }]);
    };

    const updateQuantity = (productId: string, qty: number) => {
        if (qty < 0) qty = 0;
        setCart(cart.map(c => c.product.id === productId ? { ...c, quantity: qty } : c));
    };

    const removeFromCart = (productId: string) => {
        setCart(cart.filter(c => c.product.id !== productId));
    };

    const isPlotSelected = (plotId: string) => selectedPlots.some(p => p.id === plotId);

    const togglePlot = (plot: any) => {
        if (isPlotSelected(plot.id)) {
            setSelectedPlots(selectedPlots.filter(p => p.id !== plot.id));
        } else {
            setSelectedPlots([...selectedPlots, plot]);
        }
    };

    const totalAreaSelected = useMemo(() => {
        return selectedPlots.reduce((sum, p) => sum + (parseFloat(p.areaHa) || 0), 0);
    }, [selectedPlots]);

    // ---- Distribution logic ----
    // Distributes total qty across plots based on area × dose
    // Rounds each plot's qty, and adjusts last one to match total
    const getDistribution = (product: any, totalQty: number) => {
        const dose = parseFloat(product.dosePerHa);
        const items: { plotId: string; plotName: string; areaHa: number; idealQty: number; allocatedQty: number }[] = [];

        if (dose && !isNaN(dose) && selectedPlots.length > 0) {
            // Calculate ideal qty per plot: area × dose
            let totalIdeal = 0;
            const ideals = selectedPlots.map(plot => {
                const area = parseFloat(plot.areaHa) || 0;
                const ideal = area * dose;
                totalIdeal += ideal;
                return { plot, area, ideal };
            });

            // Distribute proportionally to match totalQty
            let allocated = 0;
            const results = ideals.map((item, idx) => {
                let qty: number;
                if (idx === ideals.length - 1) {
                    // Last plot gets remainder
                    qty = Math.round(totalQty - allocated);
                } else {
                    // Proportional distribution
                    qty = totalIdeal > 0
                        ? Math.round((item.ideal / totalIdeal) * totalQty)
                        : Math.round(totalQty / selectedPlots.length);
                }
                if (qty < 0) qty = 0;
                allocated += qty;
                return {
                    plotId: item.plot.id,
                    plotName: item.plot.name,
                    areaHa: item.area,
                    idealQty: item.ideal,
                    allocatedQty: qty,
                };
            });
            return results;
        } else {
            // No dose: split evenly
            let allocated = 0;
            return selectedPlots.map((plot, idx) => {
                const area = parseFloat(plot.areaHa) || 0;
                let qty: number;
                if (idx === selectedPlots.length - 1) {
                    qty = Math.round(totalQty - allocated);
                } else {
                    qty = Math.round(totalQty / selectedPlots.length);
                }
                if (qty < 0) qty = 0;
                allocated += qty;
                return {
                    plotId: plot.id,
                    plotName: plot.name,
                    areaHa: area,
                    idealQty: 0,
                    allocatedQty: qty,
                };
            });
        }
    };

    // Build confirmation data
    const confirmationData = useMemo(() => {
        return cart.map(item => {
            const dist = getDistribution(item.product, item.quantity);
            // Apply overrides
            const withOverrides = dist.map(d => {
                const key = `${item.product.id}__${d.plotId}`;
                const overridden = distOverrides[key] !== undefined ? distOverrides[key] : d.allocatedQty;
                return { ...d, allocatedQty: overridden };
            });
            const totalAllocated = withOverrides.reduce((s, d) => s + d.allocatedQty, 0);
            return { product: item.product, totalQty: item.quantity, distribution: withOverrides, totalAllocated };
        });
    }, [cart, selectedPlots, distOverrides]);

    const setOverride = (productId: string, plotId: string, qty: number) => {
        setDistOverrides(prev => ({ ...prev, [`${productId}__${plotId}`]: Math.max(0, qty) }));
    };

    const handleGoToPlot = () => {
        if (cart.length === 0) {
            toast({ title: "Selecione pelo menos um produto", variant: "destructive" });
            return;
        }
        const invalid = cart.filter(c => c.quantity <= 0);
        if (invalid.length > 0) {
            toast({ title: "Informe a quantidade para todos os produtos", variant: "destructive" });
            return;
        }
        setStep("plot");
    };

    const handleGoToConfirm = () => {
        if (selectedPlots.length === 0) {
            toast({ title: "Selecione pelo menos um talhão", variant: "destructive" });
            return;
        }
        setDistOverrides({});
        setStep("confirm");
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            let count = 0;
            for (const item of confirmationData) {
                for (const d of item.distribution) {
                    if (d.allocatedQty <= 0) continue;
                    const plot = selectedPlots.find(p => p.id === d.plotId);
                    await apiRequest("POST", "/api/pdv/withdraw", {
                        productId: item.product.id,
                        quantity: d.allocatedQty,
                        plotId: d.plotId,
                        propertyId: plot?.propertyId,
                    });
                    count++;
                }
            }
            toast({ title: `✅ ${count} saída(s) registrada(s) com sucesso!` });
            queryClient.invalidateQueries({ queryKey: ["/api/pdv/data"] });
            reset();
        } catch (err) {
            toast({ title: "Erro ao registrar saída", variant: "destructive" });
        } finally {
            setSubmitting(false);
        }
    };

    const reset = () => {
        setStep("product");
        setCart([]);
        setSelectedPlots([]);
        setSearch("");
        setCategoryFilter("");
        setDistOverrides({});
    };

    if (!pdvData) {
        setLocation("/pdv/login");
        return null;
    }

    // ==================== STEP: PLOT SELECTION ====================
    if (step === "plot") {
        const properties = pdvData?.properties || [];
        const plotsByProp: Record<string, any[]> = {};
        plots.forEach((p: any) => {
            if (!plotsByProp[p.propertyId]) plotsByProp[p.propertyId] = [];
            plotsByProp[p.propertyId].push(p);
        });

        return (
            <div className="min-h-screen bg-slate-900 text-white flex flex-col">
                <header className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setStep("product")} className="text-slate-400 hover:text-white"><ArrowLeft className="h-5 w-5" /></button>
                        <span className="text-2xl">📍</span>
                        <span className="font-bold text-lg">Selecione os Talhões</span>
                    </div>
                    {selectedPlots.length > 0 && (
                        <span className="bg-orange-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">{selectedPlots.length}</span>
                    )}
                </header>

                <div className="flex-1 p-4 overflow-y-auto pb-32">
                    {/* Cart summary */}
                    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 mb-4">
                        <p className="text-sm text-slate-400 mb-2 font-semibold">🛒 {cart.length} produto(s):</p>
                        <div className="space-y-1">
                            {cart.map(item => (
                                <div key={item.product.id} className="flex justify-between text-sm">
                                    <span className="text-slate-300 truncate">{item.product.name}</span>
                                    <span className="text-orange-400 font-bold ml-2">{item.quantity} {item.product.unit}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Info */}
                    <div className="bg-blue-900/30 border border-blue-700/50 rounded-xl p-3 mb-4 text-sm text-blue-300">
                        <p className="font-semibold">📐 Distribuição automática</p>
                        <p className="text-xs text-blue-400/80 mt-0.5">A quantidade será distribuída entre os talhões selecionados com base na <strong>área × dose/ha</strong></p>
                    </div>

                    {properties.length === 0 && plots.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-slate-400 text-lg">Nenhuma propriedade ou talhão cadastrado</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {properties.map((prop: any) => {
                                const propPlots = plotsByProp[prop.id] || [];
                                return (
                                    <div key={prop.id} className="rounded-xl overflow-hidden border border-slate-700">
                                        <div className="bg-slate-800 px-4 py-3 flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-emerald-900/50 flex items-center justify-center">
                                                <span className="text-lg">🌾</span>
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-bold text-emerald-400">{prop.name}</p>
                                                <p className="text-xs text-slate-400">
                                                    {prop.location || "—"} • {prop.totalAreaHa ? `${prop.totalAreaHa} ha` : ""} • {propPlots.length} talhão(ões)
                                                </p>
                                            </div>
                                        </div>
                                        <div className="divide-y divide-slate-700/50">
                                            {propPlots.length > 0 ? (
                                                propPlots.map((plot: any) => {
                                                    const sel = isPlotSelected(plot.id);
                                                    return (
                                                        <button
                                                            key={plot.id}
                                                            onClick={() => togglePlot(plot)}
                                                            className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left ${sel ? "bg-orange-900/20" : "hover:bg-slate-700/50"}`}
                                                        >
                                                            <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${sel ? "bg-orange-500 border-orange-500" : "border-slate-500"}`}>
                                                                {sel && <Check className="h-4 w-4 text-white" />}
                                                            </div>
                                                            <MapPin className="h-4 w-4 text-orange-400 shrink-0" />
                                                            <div className="flex-1 min-w-0">
                                                                <p className="font-medium">{plot.name}</p>
                                                                <p className="text-xs text-slate-400">{plot.areaHa} ha {plot.crop ? `• ${plot.crop}` : ""}</p>
                                                            </div>
                                                        </button>
                                                    );
                                                })
                                            ) : (
                                                <button
                                                    onClick={() => togglePlot({ id: prop.id, name: prop.name, propertyId: prop.id, areaHa: prop.totalAreaHa })}
                                                    className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left ${isPlotSelected(prop.id) ? "bg-orange-900/20" : "hover:bg-slate-700/50"}`}
                                                >
                                                    <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${isPlotSelected(prop.id) ? "bg-orange-500 border-orange-500" : "border-slate-500"}`}>
                                                        {isPlotSelected(prop.id) && <Check className="h-4 w-4 text-white" />}
                                                    </div>
                                                    <MapPin className="h-4 w-4 text-orange-400 shrink-0" />
                                                    <div className="flex-1">
                                                        <p className="font-medium text-orange-300">Propriedade inteira</p>
                                                        <p className="text-xs text-slate-400">{prop.totalAreaHa || "?"} ha</p>
                                                    </div>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Bottom bar */}
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-800 border-t border-slate-700">
                    <div className="flex items-center justify-between mb-2 text-sm">
                        <span className="text-slate-400">{selectedPlots.length} talhão(ões)</span>
                        <span className="text-emerald-400 font-bold">Área total: {totalAreaSelected.toFixed(1)} ha</span>
                    </div>
                    <Button
                        className="w-full py-5 text-base bg-orange-600 hover:bg-orange-700 font-bold"
                        onClick={handleGoToConfirm}
                        disabled={selectedPlots.length === 0}
                    >
                        <ArrowRight className="mr-2 h-5 w-5" />
                        Ver distribuição
                    </Button>
                </div>
            </div>
        );
    }

    // ==================== STEP: CONFIRM (Distribution) ====================
    if (step === "confirm" && selectedPlots.length > 0 && cart.length > 0) {
        return (
            <div className="min-h-screen bg-slate-900 text-white flex flex-col">
                <header className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setStep("plot")} className="text-slate-400 hover:text-white"><ArrowLeft className="h-5 w-5" /></button>
                        <span className="text-2xl">📋</span>
                        <span className="font-bold text-lg">Distribuição por Talhão</span>
                    </div>
                </header>

                <div className="flex-1 p-4 overflow-y-auto pb-28">
                    <div className="max-w-2xl mx-auto space-y-4">
                        {/* Summary */}
                        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 grid grid-cols-3 gap-3 text-center text-sm">
                            <div><p className="text-slate-400">Produtos</p><p className="font-bold text-lg text-orange-400">{cart.length}</p></div>
                            <div><p className="text-slate-400">Talhões</p><p className="font-bold text-lg text-emerald-400">{selectedPlots.length}</p></div>
                            <div><p className="text-slate-400">Área total</p><p className="font-bold text-lg">{totalAreaSelected.toFixed(1)} ha</p></div>
                        </div>

                        {/* Per product distribution */}
                        {confirmationData.map((item) => {
                            const p = item.product;
                            const dose = parseFloat(p.dosePerHa);
                            const hasDose = dose && !isNaN(dose);
                            const diff = item.totalQty - item.totalAllocated;

                            return (
                                <div key={p.id} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                                    {/* Product header */}
                                    <div className="flex items-center gap-3 p-4 border-b border-slate-700">
                                        {p.imageUrl ? (
                                            <img src={p.imageUrl} className="w-12 h-12 rounded-lg object-contain bg-white" alt="" />
                                        ) : (
                                            <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${CATEGORY_COLORS[p.category] || CATEGORY_COLORS.outro} flex items-center justify-center`}>
                                                <span className="text-2xl">{CATEGORY_EMOJI[p.category] || "📦"}</span>
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold truncate">{p.name}</p>
                                            <div className="flex items-center gap-2 text-xs text-slate-400">
                                                <span>{p.category || "—"}</span>
                                                {hasDose && (
                                                    <span className="text-blue-400 flex items-center gap-0.5">
                                                        <Droplets className="h-3 w-3" />
                                                        {dose.toFixed(1)} {p.unit}/ha
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="font-bold text-orange-400 text-lg">{item.totalQty}</p>
                                            <p className="text-xs text-slate-400">{p.unit} saída</p>
                                        </div>
                                    </div>

                                    {/* Per-plot distribution */}
                                    <div className="divide-y divide-slate-700/50">
                                        {item.distribution.map((d) => (
                                            <div key={d.plotId} className="flex items-center gap-3 px-4 py-3">
                                                <MapPin className="h-4 w-4 text-emerald-400 shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate">{d.plotName}</p>
                                                    <p className="text-[11px] text-slate-500">
                                                        {d.areaHa.toFixed(1)} ha
                                                        {hasDose && <span className="text-blue-400"> × {dose.toFixed(1)} = {(d.areaHa * dose).toFixed(1)} ideal</span>}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <button
                                                        className="w-7 h-7 rounded bg-orange-600 hover:bg-orange-500 flex items-center justify-center"
                                                        onClick={() => setOverride(p.id, d.plotId, d.allocatedQty - 1)}
                                                    >
                                                        <Minus className="h-3 w-3 text-white" />
                                                    </button>
                                                    <Input
                                                        type="number"
                                                        step="1"
                                                        value={d.allocatedQty}
                                                        onChange={(e) => setOverride(p.id, d.plotId, parseFloat(e.target.value) || 0)}
                                                        className="text-center text-sm font-bold w-20 h-7 bg-slate-700 border-slate-600 text-white px-1"
                                                    />
                                                    <button
                                                        className="w-7 h-7 rounded bg-orange-600 hover:bg-orange-500 flex items-center justify-center"
                                                        onClick={() => setOverride(p.id, d.plotId, d.allocatedQty + 1)}
                                                    >
                                                        <Plus className="h-3 w-3 text-white" />
                                                    </button>
                                                    <span className="text-xs text-slate-400 w-8 ml-1">{p.unit}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Total check */}
                                    <div className={`flex items-center justify-between px-4 py-2 text-sm font-bold ${Math.abs(diff) < 0.01 ? "bg-green-900/30 text-green-400" : "bg-yellow-900/30 text-yellow-400"}`}>
                                        <span>Distribuído: {item.totalAllocated} {p.unit}</span>
                                        {Math.abs(diff) < 0.01 ? (
                                            <span className="flex items-center gap-1"><Check className="h-4 w-4" /> Bate com saída</span>
                                        ) : (
                                            <span>{diff > 0 ? `Faltam ${diff.toFixed(0)} ${p.unit}` : `Excede ${Math.abs(diff).toFixed(0)} ${p.unit}`}</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Bottom bar */}
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-800 border-t border-slate-700">
                    <div className="max-w-2xl mx-auto flex gap-3">
                        <Button variant="outline" className="flex-1 py-5 text-base border-slate-700" onClick={reset}>Cancelar</Button>
                        <Button className="flex-1 py-5 text-base bg-green-600 hover:bg-green-700 font-bold" onClick={handleSubmit} disabled={submitting}>
                            {submitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Check className="mr-2 h-5 w-5" />}
                            Confirmar Saída
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // ==================== STEP: PRODUCT SELECTION ====================
    return (
        <div className="h-screen bg-slate-900 text-white flex flex-col">
            <header className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700 shrink-0">
                <div className="flex items-center gap-3">
                    <span className="text-2xl">🏪</span>
                    <span className="font-bold text-lg">PDV Depósito</span>
                </div>
                <div className="flex items-center gap-3">
                    {isOnline ? <Wifi className="h-5 w-5 text-green-400" /> : <WifiOff className="h-5 w-5 text-red-400" />}
                    <Button variant="ghost" size="icon" className="text-slate-400" onClick={() => setLocation("/pdv/login")}>
                        <LogOut className="h-5 w-5" />
                    </Button>
                </div>
            </header>

            {/* Steps */}
            <div className="flex items-center gap-1 px-4 py-2 bg-slate-800/50 border-b border-slate-700/30 shrink-0">
                {["📦 Produtos", "📍 Talhões", "✅ Confirmar"].map((label, i) => {
                    const steps = ["product", "plot", "confirm"];
                    const isActive = steps.indexOf(step) >= i;
                    return (
                        <div key={label} className="flex items-center gap-1 flex-1">
                            <span className={`text-[10px] ${isActive ? "text-white font-bold" : "text-slate-500"}`}>{label}</span>
                            {i < 2 && <div className={`flex-1 h-0.5 mx-1 ${isActive ? "bg-orange-500" : "bg-slate-700"}`} />}
                        </div>
                    );
                })}
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* LEFT: Product catalog */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="p-3 space-y-2 bg-slate-800/30 border-b border-slate-700/50 shrink-0">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                className="pl-10 py-2 bg-slate-800 border-slate-700 text-white text-sm"
                                placeholder="Buscar produto..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                            <button
                                onClick={() => setCategoryFilter("")}
                                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${!categoryFilter ? "bg-orange-500 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"}`}
                            >Todos</button>
                            {categories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setCategoryFilter(categoryFilter === cat ? "" : cat)}
                                    className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${categoryFilter === cat ? "bg-orange-500 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"}`}
                                >
                                    <span>{CATEGORY_EMOJI[cat] || "📦"}</span>
                                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                            {filtered.map((p: any) => {
                                const stockQty = getStockForProduct(p.id);
                                const inCart = isInCart(p.id);
                                const gradient = CATEGORY_COLORS[p.category] || CATEGORY_COLORS.outro;
                                return (
                                    <button
                                        key={p.id}
                                        onClick={() => addToCart(p)}
                                        className={`relative rounded-xl overflow-hidden border-2 transition-all hover:scale-[1.02] ${inCart ? "border-orange-500 ring-2 ring-orange-500/30" : "border-slate-700 hover:border-slate-500"}`}
                                    >
                                        <div className={`aspect-square bg-gradient-to-br ${gradient} flex items-center justify-center relative`}>
                                            {p.imageUrl ? (
                                                <img src={p.imageUrl} alt={p.name} className="w-full h-full object-contain p-2 bg-white"
                                                    onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.nextElementSibling?.classList.remove("hidden"); }} />
                                            ) : null}
                                            <div className={`flex flex-col items-center justify-center ${p.imageUrl ? "hidden" : ""}`}>
                                                <span className="text-4xl">{CATEGORY_EMOJI[p.category] || "📦"}</span>
                                            </div>
                                            <div className={`absolute top-1.5 right-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${stockQty <= 0 ? "bg-red-500" : "bg-black/60"}`}>
                                                {stockQty.toFixed(0)} {p.unit}
                                            </div>
                                            {inCart && (
                                                <div className="absolute top-1.5 left-1.5 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                                                    <Check className="h-4 w-4 text-white" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-2 bg-slate-800 text-left">
                                            <p className="font-medium text-xs leading-tight truncate" title={p.name}>{p.name}</p>
                                            <p className="text-[10px] text-slate-400 mt-0.5 truncate">{p.category || "—"}</p>
                                            {p.dosePerHa && (
                                                <div className="flex items-center gap-1 mt-1">
                                                    <Droplets className="h-3 w-3 text-blue-400" />
                                                    <span className="text-[10px] text-blue-400">{parseFloat(p.dosePerHa).toFixed(1)} {p.unit}/ha</span>
                                                </div>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                        {filtered.length === 0 && <p className="text-slate-500 text-center py-12">Nenhum produto encontrado</p>}
                    </div>
                </div>

                {/* RIGHT: Cart panel */}
                <div className="w-80 lg:w-96 bg-slate-800 border-l border-slate-700 flex flex-col shrink-0 hidden md:flex">
                    <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <ShoppingCart className="h-5 w-5 text-orange-400" />
                            <h3 className="font-bold">Carrinho</h3>
                        </div>
                        {cart.length > 0 && <span className="bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{cart.length}</span>}
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {cart.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-500">
                                <ShoppingCart className="h-12 w-12 mb-3 opacity-30" />
                                <p className="text-sm">Carrinho vazio</p>
                                <p className="text-xs mt-1">Clique nos produtos para adicionar</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-700/50">
                                {cart.map((item) => (
                                    <div key={item.product.id} className="p-3 space-y-2">
                                        <div className="flex items-start gap-2">
                                            {item.product.imageUrl ? (
                                                <img src={item.product.imageUrl} className="w-10 h-10 rounded-lg object-contain bg-white shrink-0" alt="" />
                                            ) : (
                                                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${CATEGORY_COLORS[item.product.category] || CATEGORY_COLORS.outro} flex items-center justify-center shrink-0`}>
                                                    <span className="text-lg">{CATEGORY_EMOJI[item.product.category] || "📦"}</span>
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-sm leading-tight truncate">{item.product.name}</p>
                                                <p className="text-xs text-slate-400">{item.product.category || "—"} • Est: {getStockForProduct(item.product.id).toFixed(0)}</p>
                                            </div>
                                            <button onClick={() => removeFromCart(item.product.id)} className="text-red-400 hover:text-red-300 shrink-0 p-1">
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                        {/* Quantity input */}
                                        <div className="flex items-center gap-2">
                                            <button className="w-8 h-8 rounded-md bg-orange-600 hover:bg-orange-500 flex items-center justify-center"
                                                onClick={() => updateQuantity(item.product.id, item.quantity - 1)}>
                                                <Minus className="h-3 w-3 text-white" />
                                            </button>
                                            <Input type="number" step="1" value={item.quantity}
                                                onChange={(e) => updateQuantity(item.product.id, parseFloat(e.target.value) || 0)}
                                                className="text-center text-sm font-bold flex-1 h-8 bg-slate-700 border-slate-600 text-white" />
                                            <button className="w-8 h-8 rounded-md bg-orange-600 hover:bg-orange-500 flex items-center justify-center"
                                                onClick={() => updateQuantity(item.product.id, item.quantity + 1)}>
                                                <Plus className="h-3 w-3 text-white" />
                                            </button>
                                            <span className="text-xs text-slate-400 w-8">{item.product.unit}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="p-4 border-t border-slate-700 space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-400">{cart.length} itens</span>
                        </div>
                        <Button className="w-full py-5 text-base bg-orange-600 hover:bg-orange-700 font-bold"
                            onClick={handleGoToPlot} disabled={cart.length === 0}>
                            <ArrowRight className="mr-2 h-5 w-5" />
                            Selecionar Talhões
                        </Button>
                    </div>
                </div>
            </div>

            {/* MOBILE bottom bar */}
            {cart.length > 0 && (
                <div className="md:hidden fixed bottom-0 left-0 right-0 p-3 bg-slate-800 border-t border-slate-700 z-50">
                    <Button className="w-full py-5 text-base bg-orange-600 hover:bg-orange-700 font-bold rounded-xl" onClick={handleGoToPlot}>
                        <ShoppingCart className="mr-2 h-5 w-5" />
                        {cart.length} produto(s) → Talhões
                        <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                </div>
            )}
        </div>
    );
}
