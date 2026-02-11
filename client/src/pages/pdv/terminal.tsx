import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Search, Check, ArrowLeft, ArrowRight, Minus, Plus, Loader2, LogOut, Package, Wifi, WifiOff, X, ShoppingCart, Trash2, Droplets, MapPin, Calculator } from "lucide-react";

interface CartItem {
    product: any;
    quantity: number; // manual qty (used only when product has no dosePerHa)
}

// Category colors and icons
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
    // Override quantities per product+plot (key: `${productId}__${plotId}`)
    const [qtyOverrides, setQtyOverrides] = useState<Record<string, number>>({});

    // Monitor connectivity
    useEffect(() => {
        const setOnline = () => setIsOnline(true);
        const setOffline = () => setIsOnline(false);
        window.addEventListener("online", setOnline);
        window.addEventListener("offline", setOffline);
        return () => { window.removeEventListener("online", setOnline); window.removeEventListener("offline", setOffline); };
    }, []);

    // Heartbeat
    useEffect(() => {
        const interval = setInterval(() => {
            if (isOnline) {
                apiRequest("POST", "/api/pdv/heartbeat").catch(() => { });
            }
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
        if (!isInCart(product.id)) {
            setCart([...cart, { product, quantity: 1 }]);
        }
    };

    const updateQuantity = (productId: string, qty: number) => {
        if (qty < 0) qty = 0;
        setCart(cart.map(c => c.product.id === productId ? { ...c, quantity: qty } : c));
    };

    const removeFromCart = (productId: string) => {
        setCart(cart.filter(c => c.product.id !== productId));
    };

    // Plot toggle
    const isPlotSelected = (plotId: string) => selectedPlots.some(p => p.id === plotId);

    const togglePlot = (plot: any) => {
        if (isPlotSelected(plot.id)) {
            setSelectedPlots(selectedPlots.filter(p => p.id !== plot.id));
        } else {
            setSelectedPlots([...selectedPlots, plot]);
        }
    };

    // Calculate quantity per product per plot
    const getCalculatedQty = (product: any, plot: any): number => {
        const overrideKey = `${product.id}__${plot.id}`;
        if (qtyOverrides[overrideKey] !== undefined) return qtyOverrides[overrideKey];

        const dose = parseFloat(product.dosePerHa);
        const area = parseFloat(plot.areaHa);
        if (dose && area && !isNaN(dose) && !isNaN(area)) {
            return parseFloat((area * dose).toFixed(2));
        }
        // No dose: use cart manual quantity
        const cartItem = cart.find(c => c.product.id === product.id);
        return cartItem?.quantity || 1;
    };

    const setOverrideQty = (productId: string, plotId: string, qty: number) => {
        setQtyOverrides(prev => ({ ...prev, [`${productId}__${plotId}`]: qty }));
    };

    // Generate the full breakdown for confirmation
    const confirmationItems = useMemo(() => {
        const items: { product: any; plot: any; quantity: number; isCalculated: boolean }[] = [];
        for (const cartItem of cart) {
            for (const plot of selectedPlots) {
                const qty = getCalculatedQty(cartItem.product, plot);
                const dose = parseFloat(cartItem.product.dosePerHa);
                const area = parseFloat(plot.areaHa);
                const isCalculated = !!(dose && area && !isNaN(dose) && !isNaN(area));
                items.push({ product: cartItem.product, plot, quantity: qty, isCalculated });
            }
        }
        return items;
    }, [cart, selectedPlots, qtyOverrides]);

    // Total qty per product (summed across all plots)
    const totalPerProduct = useMemo(() => {
        const totals: Record<string, number> = {};
        for (const item of confirmationItems) {
            totals[item.product.id] = (totals[item.product.id] || 0) + item.quantity;
        }
        return totals;
    }, [confirmationItems]);

    const totalAreaSelected = useMemo(() => {
        return selectedPlots.reduce((sum, p) => sum + (parseFloat(p.areaHa) || 0), 0);
    }, [selectedPlots]);

    const handleGoToPlot = () => {
        if (cart.length === 0) {
            toast({ title: "Selecione pelo menos um produto", variant: "destructive" });
            return;
        }
        // For products without dose, check manual qty
        const noDoseProducts = cart.filter(c => !c.product.dosePerHa);
        const invalid = noDoseProducts.filter(c => c.quantity <= 0);
        if (invalid.length > 0) {
            toast({ title: "Informe a quantidade para produtos sem dose", variant: "destructive" });
            return;
        }
        setStep("plot");
    };

    const handleGoToConfirm = () => {
        if (selectedPlots.length === 0) {
            toast({ title: "Selecione pelo menos um talhão", variant: "destructive" });
            return;
        }
        setQtyOverrides({}); // Reset overrides
        setStep("confirm");
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            let successCount = 0;
            for (const item of confirmationItems) {
                if (item.quantity <= 0) continue;
                await apiRequest("POST", "/api/pdv/withdraw", {
                    productId: item.product.id,
                    quantity: item.quantity,
                    plotId: item.plot.id,
                    propertyId: item.plot.propertyId,
                });
                successCount++;
            }
            toast({ title: `✅ ${successCount} saída(s) registrada(s) com sucesso!` });
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
        setQtyOverrides({});
    };

    if (!pdvData) {
        setLocation("/pdv/login");
        return null;
    }

    // ==================== STEP: PLOT SELECTION (MULTI) ====================
    if (step === "plot") {
        const properties = pdvData?.properties || [];
        const plotsByProperty: Record<string, any[]> = {};
        plots.forEach((plot: any) => {
            if (!plotsByProperty[plot.propertyId]) plotsByProperty[plot.propertyId] = [];
            plotsByProperty[plot.propertyId].push(plot);
        });

        return (
            <div className="min-h-screen bg-slate-900 text-white flex flex-col">
                <header className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setStep("product")} className="flex items-center gap-2 text-slate-400 hover:text-white">
                            <ArrowLeft className="h-5 w-5" />
                        </button>
                        <span className="text-2xl">📍</span>
                        <span className="font-bold text-lg">Selecione os Talhões</span>
                    </div>
                    {selectedPlots.length > 0 && (
                        <span className="bg-orange-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">{selectedPlots.length} selecionado(s)</span>
                    )}
                </header>

                <div className="flex-1 p-4 overflow-y-auto pb-28">
                    {/* Cart summary */}
                    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 mb-4">
                        <p className="text-sm text-slate-400 mb-2 font-semibold">🛒 {cart.length} produto(s) no carrinho:</p>
                        <div className="space-y-1">
                            {cart.map(item => (
                                <div key={item.product.id} className="flex justify-between text-sm">
                                    <span className="text-slate-300 truncate">{item.product.name}</span>
                                    <span className="text-blue-400 font-medium ml-2">
                                        {item.product.dosePerHa
                                            ? `${parseFloat(item.product.dosePerHa).toFixed(1)} ${item.product.unit}/ha`
                                            : `${item.quantity} ${item.product.unit} (manual)`
                                        }
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Info box */}
                    <div className="bg-blue-900/30 border border-blue-700/50 rounded-xl p-3 mb-4 flex items-start gap-3">
                        <Calculator className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
                        <div className="text-sm text-blue-300">
                            <p className="font-semibold">Cálculo automático</p>
                            <p className="text-xs text-blue-400/80 mt-0.5">A quantidade de cada produto será calculada automaticamente: <strong>Área (ha) × Dose/ha</strong></p>
                        </div>
                    </div>

                    {properties.length === 0 && plots.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-slate-400 text-lg">Nenhuma propriedade ou talhão cadastrado</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {properties.map((prop: any) => {
                                const propPlots = plotsByProperty[prop.id] || [];
                                return (
                                    <div key={prop.id} className="rounded-xl overflow-hidden border border-slate-700">
                                        <div className="bg-slate-800 px-4 py-3 flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-emerald-900/50 flex items-center justify-center">
                                                <span className="text-lg">🌾</span>
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-bold text-emerald-400">{prop.name}</p>
                                                <p className="text-xs text-slate-400">
                                                    {prop.location || "Sem localização"} • {prop.totalAreaHa ? `${prop.totalAreaHa} ha` : ""} • {propPlots.length} talhão(ões)
                                                </p>
                                            </div>
                                        </div>
                                        <div className="divide-y divide-slate-700/50">
                                            {propPlots.length > 0 ? (
                                                propPlots.map((plot: any) => {
                                                    const selected = isPlotSelected(plot.id);
                                                    return (
                                                        <button
                                                            key={plot.id}
                                                            onClick={() => togglePlot(plot)}
                                                            className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left ${selected ? "bg-orange-900/20" : "hover:bg-slate-700/50"}`}
                                                        >
                                                            {/* Checkbox */}
                                                            <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors shrink-0 ${selected ? "bg-orange-500 border-orange-500" : "border-slate-500"}`}>
                                                                {selected && <Check className="h-4 w-4 text-white" />}
                                                            </div>
                                                            <div className="w-8 h-8 rounded-lg bg-orange-900/30 flex items-center justify-center shrink-0">
                                                                <span className="text-sm">📍</span>
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="font-medium">{plot.name}</p>
                                                                <p className="text-xs text-slate-400">{plot.areaHa} ha {plot.crop ? `• ${plot.crop}` : ""}</p>
                                                            </div>
                                                            {selected && (
                                                                <span className="text-xs text-orange-400 font-bold shrink-0">{plot.areaHa} ha</span>
                                                            )}
                                                        </button>
                                                    );
                                                })
                                            ) : (
                                                <button
                                                    onClick={() => togglePlot({ id: prop.id, name: prop.name, propertyId: prop.id, propertyName: prop.name, areaHa: prop.totalAreaHa })}
                                                    className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left ${isPlotSelected(prop.id) ? "bg-orange-900/20" : "hover:bg-slate-700/50"}`}
                                                >
                                                    <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors shrink-0 ${isPlotSelected(prop.id) ? "bg-orange-500 border-orange-500" : "border-slate-500"}`}>
                                                        {isPlotSelected(prop.id) && <Check className="h-4 w-4 text-white" />}
                                                    </div>
                                                    <div className="w-8 h-8 rounded-lg bg-orange-900/30 flex items-center justify-center shrink-0">
                                                        <span className="text-sm">🏠</span>
                                                    </div>
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
                        Ver Resumo e Confirmar
                    </Button>
                </div>
            </div>
        );
    }

    // ==================== STEP: CONFIRM ====================
    if (step === "confirm" && selectedPlots.length > 0 && cart.length > 0) {
        return (
            <div className="min-h-screen bg-slate-900 text-white flex flex-col">
                <header className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setStep("plot")} className="flex items-center gap-2 text-slate-400 hover:text-white">
                            <ArrowLeft className="h-5 w-5" />
                        </button>
                        <span className="text-2xl">📋</span>
                        <span className="font-bold text-lg">Confirmar Saída</span>
                    </div>
                </header>

                <div className="flex-1 p-4 overflow-y-auto pb-28">
                    <div className="max-w-2xl mx-auto space-y-4">
                        {/* Summary header */}
                        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-slate-400">Produtos</p>
                                    <p className="font-bold text-lg text-orange-400">{cart.length}</p>
                                </div>
                                <div>
                                    <p className="text-slate-400">Talhões</p>
                                    <p className="font-bold text-lg text-emerald-400">{selectedPlots.length}</p>
                                </div>
                                <div>
                                    <p className="text-slate-400">Área total</p>
                                    <p className="font-bold text-lg">{totalAreaSelected.toFixed(1)} ha</p>
                                </div>
                                <div>
                                    <p className="text-slate-400">Total operações</p>
                                    <p className="font-bold text-lg">{confirmationItems.length}</p>
                                </div>
                            </div>
                        </div>

                        {/* Per-product breakdown */}
                        {cart.map((cartItem) => {
                            const productItems = confirmationItems.filter(ci => ci.product.id === cartItem.product.id);
                            const totalQty = totalPerProduct[cartItem.product.id] || 0;
                            const p = cartItem.product;

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
                                            <p className="text-xs text-slate-400">{p.category || "—"} {p.dosePerHa ? ` • Dose: ${parseFloat(p.dosePerHa).toFixed(1)} ${p.unit}/ha` : ""}</p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="font-bold text-orange-400 text-lg">{totalQty.toFixed(1)}</p>
                                            <p className="text-xs text-slate-400">{p.unit} total</p>
                                        </div>
                                    </div>

                                    {/* Per-plot rows */}
                                    <div className="divide-y divide-slate-700/50">
                                        {productItems.map((item) => (
                                            <div key={item.plot.id} className="flex items-center gap-3 px-4 py-3">
                                                <MapPin className="h-4 w-4 text-emerald-400 shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate">{item.plot.name}</p>
                                                    <p className="text-xs text-slate-500">{parseFloat(item.plot.areaHa || "0").toFixed(1)} ha</p>
                                                </div>
                                                {item.isCalculated && (
                                                    <span className="text-[10px] text-blue-400 bg-blue-900/30 px-1.5 py-0.5 rounded shrink-0">auto</span>
                                                )}
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <button
                                                        className="w-7 h-7 rounded bg-orange-600 hover:bg-orange-500 flex items-center justify-center"
                                                        onClick={() => setOverrideQty(item.product.id, item.plot.id, Math.max(0, item.quantity - 1))}
                                                    >
                                                        <Minus className="h-3 w-3 text-white" />
                                                    </button>
                                                    <Input
                                                        type="number"
                                                        step="0.1"
                                                        value={item.quantity}
                                                        onChange={(e) => setOverrideQty(item.product.id, item.plot.id, parseFloat(e.target.value) || 0)}
                                                        className="text-center text-sm font-bold w-20 h-7 bg-slate-700 border-slate-600 text-white px-1"
                                                    />
                                                    <button
                                                        className="w-7 h-7 rounded bg-orange-600 hover:bg-orange-500 flex items-center justify-center"
                                                        onClick={() => setOverrideQty(item.product.id, item.plot.id, item.quantity + 1)}
                                                    >
                                                        <Plus className="h-3 w-3 text-white" />
                                                    </button>
                                                    <span className="text-xs text-slate-400 w-8 ml-1">{p.unit}</span>
                                                </div>
                                            </div>
                                        ))}
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
                            Confirmar Saída ({confirmationItems.filter(i => i.quantity > 0).length})
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // ==================== STEP: PRODUCT SELECTION (MAIN POS LAYOUT) ====================
    return (
        <div className="h-screen bg-slate-900 text-white flex flex-col">
            {/* Header */}
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

            {/* Steps indicator */}
            <div className="flex items-center gap-1 px-4 py-2 bg-slate-800/50 border-b border-slate-700/30 shrink-0">
                {[
                    { label: "Produtos", icon: "📦" },
                    { label: "Talhões", icon: "📍" },
                    { label: "Confirmar", icon: "✅" },
                ].map((s, i) => {
                    const steps = ["product", "plot", "confirm"];
                    const isActive = steps.indexOf(step) >= i;
                    return (
                        <div key={s.label} className="flex items-center gap-1 flex-1">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${isActive ? "bg-orange-500" : "bg-slate-700"}`}>
                                {s.icon}
                            </div>
                            <span className={`text-[10px] hidden sm:inline ${isActive ? "text-white" : "text-slate-500"}`}>{s.label}</span>
                            {i < 2 && <div className={`flex-1 h-0.5 mx-1 ${isActive ? "bg-orange-500" : "bg-slate-700"}`} />}
                        </div>
                    );
                })}
            </div>

            {/* Main split layout */}
            <div className="flex-1 flex overflow-hidden">
                {/* LEFT: Product catalog */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Search & Category filter */}
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
                            >
                                Todos
                            </button>
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

                    {/* Product grid */}
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
                                                <img
                                                    src={p.imageUrl}
                                                    alt={p.name}
                                                    className="w-full h-full object-contain p-2 bg-white"
                                                    onError={(e) => {
                                                        e.currentTarget.style.display = "none";
                                                        e.currentTarget.nextElementSibling?.classList.remove("hidden");
                                                    }}
                                                />
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
                        {filtered.length === 0 && (
                            <p className="text-slate-500 text-center py-12">Nenhum produto encontrado</p>
                        )}
                    </div>
                </div>

                {/* RIGHT: Cart panel */}
                <div className="w-80 lg:w-96 bg-slate-800 border-l border-slate-700 flex flex-col shrink-0 hidden md:flex">
                    <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <ShoppingCart className="h-5 w-5 text-orange-400" />
                            <h3 className="font-bold">Carrinho</h3>
                        </div>
                        {cart.length > 0 && (
                            <span className="bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{cart.length}</span>
                        )}
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

                                        {/* Show dose info or manual qty */}
                                        {item.product.dosePerHa ? (
                                            <div className="flex items-center gap-2 bg-blue-900/20 rounded-lg px-3 py-1.5">
                                                <Droplets className="h-3 w-3 text-blue-400" />
                                                <span className="text-xs text-blue-300">Dose: {parseFloat(item.product.dosePerHa).toFixed(1)} {item.product.unit}/ha</span>
                                                <span className="text-[10px] text-blue-400/60 ml-auto">cálculo auto</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-slate-400">Qtd:</span>
                                                <button
                                                    className="w-8 h-8 rounded-md bg-orange-600 hover:bg-orange-500 flex items-center justify-center transition-colors"
                                                    onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                                                >
                                                    <Minus className="h-3 w-3 text-white" />
                                                </button>
                                                <Input
                                                    type="number"
                                                    step="0.1"
                                                    value={item.quantity}
                                                    onChange={(e) => updateQuantity(item.product.id, parseFloat(e.target.value) || 0)}
                                                    className="text-center text-sm font-bold flex-1 h-8 bg-slate-700 border-slate-600 text-white"
                                                />
                                                <button
                                                    className="w-8 h-8 rounded-md bg-orange-600 hover:bg-orange-500 flex items-center justify-center transition-colors"
                                                    onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                                                >
                                                    <Plus className="h-3 w-3 text-white" />
                                                </button>
                                                <span className="text-xs text-slate-400 w-8">{item.product.unit}</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="p-4 border-t border-slate-700 space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-400">{cart.length} itens</span>
                        </div>
                        <Button
                            className="w-full py-5 text-base bg-orange-600 hover:bg-orange-700 font-bold"
                            onClick={handleGoToPlot}
                            disabled={cart.length === 0}
                        >
                            <ArrowRight className="mr-2 h-5 w-5" />
                            Selecionar Talhões
                        </Button>
                    </div>
                </div>
            </div>

            {/* MOBILE: Bottom cart bar */}
            {cart.length > 0 && (
                <div className="md:hidden fixed bottom-0 left-0 right-0 p-3 bg-slate-800 border-t border-slate-700 z-50">
                    <Button
                        className="w-full py-5 text-base bg-orange-600 hover:bg-orange-700 font-bold rounded-xl"
                        onClick={handleGoToPlot}
                    >
                        <ShoppingCart className="mr-2 h-5 w-5" />
                        {cart.length} produto(s) → Selecionar Talhões
                        <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                </div>
            )}
        </div>
    );
}
