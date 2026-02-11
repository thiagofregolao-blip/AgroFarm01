import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Search, Check, ArrowLeft, ArrowRight, Minus, Plus, Loader2, LogOut, Package, Wifi, WifiOff, X, ShoppingCart, Trash2, Droplets } from "lucide-react";

interface CartItem {
    product: any;
    quantity: number;
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
    const [selectedPlot, setSelectedPlot] = useState<any>(null);
    const [submitting, setSubmitting] = useState(false);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [categoryFilter, setCategoryFilter] = useState<string>("");

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

    // Get unique categories from products
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

    const handleGoToPlot = () => {
        const invalid = cart.filter(c => c.quantity <= 0);
        if (invalid.length > 0) {
            toast({ title: "Informe a quantidade para todos os produtos", variant: "destructive" });
            return;
        }
        if (cart.length === 0) {
            toast({ title: "Selecione pelo menos um produto", variant: "destructive" });
            return;
        }
        setStep("plot");
    };

    const handleSelectPlot = (plot: any) => {
        setSelectedPlot(plot);
        setStep("confirm");
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            let successCount = 0;
            for (const item of cart) {
                await apiRequest("POST", "/api/pdv/withdraw", {
                    productId: item.product.id,
                    quantity: item.quantity,
                    plotId: selectedPlot.id,
                    propertyId: selectedPlot.propertyId,
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
        setSelectedPlot(null);
        setSearch("");
        setCategoryFilter("");
    };

    if (!pdvData) {
        setLocation("/pdv/login");
        return null;
    }

    // ==================== STEP: PLOT SELECTION ====================
    if (step === "plot") {
        return (
            <div className="min-h-screen bg-slate-900 text-white flex flex-col">
                <header className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setStep("product")} className="flex items-center gap-2 text-slate-400 hover:text-white">
                            <ArrowLeft className="h-5 w-5" />
                        </button>
                        <span className="text-2xl">🏪</span>
                        <span className="font-bold text-lg">Selecione o Talhão</span>
                    </div>
                </header>

                <div className="flex-1 p-4 overflow-y-auto">
                    {/* Cart summary */}
                    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 mb-4">
                        <p className="text-sm text-slate-400 mb-2 font-semibold">{cart.length} produto(s) no carrinho:</p>
                        <div className="space-y-1">
                            {cart.map(item => (
                                <div key={item.product.id} className="flex justify-between text-sm">
                                    <span className="text-slate-300 truncate">{item.product.name}</span>
                                    <span className="text-orange-400 font-bold ml-2">{item.quantity} {item.product.unit}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {(() => {
                        const properties = pdvData?.properties || [];
                        const plotsByProperty: Record<string, any[]> = {};
                        plots.forEach((plot: any) => {
                            if (!plotsByProperty[plot.propertyId]) plotsByProperty[plot.propertyId] = [];
                            plotsByProperty[plot.propertyId].push(plot);
                        });

                        if (properties.length === 0 && plots.length === 0) {
                            return (
                                <div className="text-center py-12">
                                    <p className="text-slate-400 text-lg">Nenhuma propriedade ou talhão cadastrado</p>
                                    <p className="text-slate-500 text-sm mt-2">Cadastre propriedades e talhões no painel da fazenda</p>
                                </div>
                            );
                        }

                        return (
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
                                                    propPlots.map((plot: any) => (
                                                        <button key={plot.id} onClick={() => handleSelectPlot(plot)} className="w-full flex items-center gap-3 px-6 py-3 hover:bg-slate-700/50 transition-colors text-left">
                                                            <div className="w-8 h-8 rounded-lg bg-orange-900/30 flex items-center justify-center"><span className="text-sm">📍</span></div>
                                                            <div className="flex-1">
                                                                <p className="font-medium">{plot.name}</p>
                                                                <p className="text-xs text-slate-400">{plot.areaHa} ha {plot.crop ? `• ${plot.crop}` : ""}</p>
                                                            </div>
                                                        </button>
                                                    ))
                                                ) : (
                                                    <button onClick={() => handleSelectPlot({ id: prop.id, name: prop.name, propertyId: prop.id, propertyName: prop.name, areaHa: prop.totalAreaHa })} className="w-full flex items-center gap-3 px-6 py-3 hover:bg-slate-700/50 transition-colors text-left">
                                                        <div className="w-8 h-8 rounded-lg bg-orange-900/30 flex items-center justify-center"><span className="text-sm">🏠</span></div>
                                                        <div className="flex-1">
                                                            <p className="font-medium text-orange-300">Selecionar esta propriedade</p>
                                                            <p className="text-xs text-slate-400">Sem talhões cadastrados</p>
                                                        </div>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })()}
                </div>
            </div>
        );
    }

    // ==================== STEP: CONFIRM ====================
    if (step === "confirm" && selectedPlot && cart.length > 0) {
        return (
            <div className="min-h-screen bg-slate-900 text-white flex flex-col">
                <header className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setStep("plot")} className="flex items-center gap-2 text-slate-400 hover:text-white">
                            <ArrowLeft className="h-5 w-5" />
                        </button>
                        <span className="text-2xl">🏪</span>
                        <span className="font-bold text-lg">Confirmar Saída</span>
                    </div>
                </header>

                <div className="flex-1 p-4 overflow-y-auto">
                    <div className="max-w-lg mx-auto space-y-6">
                        <div className="bg-slate-800 rounded-xl p-6 space-y-4 border border-slate-700">
                            <h2 className="text-xl font-bold text-center text-orange-400">📋 Resumo da Saída</h2>

                            <div className="flex justify-between py-2 border-b border-slate-700">
                                <span className="text-slate-400">Talhão</span>
                                <span className="font-semibold">{selectedPlot.name}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-slate-700">
                                <span className="text-slate-400">Propriedade</span>
                                <span className="font-semibold">{selectedPlot.propertyName}</span>
                            </div>

                            <div className="pt-2">
                                <p className="text-sm text-slate-400 mb-3 font-semibold">Produtos ({cart.length}):</p>
                                <div className="space-y-2">
                                    {cart.map((item) => (
                                        <div key={item.product.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-700/50">
                                            {item.product.imageUrl ? (
                                                <img src={item.product.imageUrl} className="w-10 h-10 rounded-lg object-contain bg-white" alt="" />
                                            ) : (
                                                <div className="w-10 h-10 rounded-lg bg-slate-600 flex items-center justify-center">
                                                    <Package className="h-5 w-5 text-orange-400" />
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-sm truncate">{item.product.name}</p>
                                                <p className="text-xs text-slate-400">{item.product.category || "—"}</p>
                                            </div>
                                            <span className="font-bold text-orange-400">{item.quantity} {item.product.unit}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <Button variant="outline" className="flex-1 py-6 text-lg border-slate-700" onClick={reset}>Cancelar</Button>
                            <Button className="flex-1 py-6 text-lg bg-green-600 hover:bg-green-700" onClick={handleSubmit} disabled={submitting}>
                                {submitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Check className="mr-2 h-5 w-5" />}
                                Confirmar ({cart.length})
                            </Button>
                        </div>
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
                                        {/* Product image or gradient */}
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

                                            {/* Stock badge */}
                                            <div className={`absolute top-1.5 right-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${stockQty <= 0 ? "bg-red-500" : "bg-black/60"}`}>
                                                {stockQty.toFixed(0)} {p.unit}
                                            </div>

                                            {/* In cart indicator */}
                                            {inCart && (
                                                <div className="absolute top-1.5 left-1.5 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                                                    <Check className="h-4 w-4 text-white" />
                                                </div>
                                            )}
                                        </div>

                                        {/* Product info */}
                                        <div className="p-2 bg-slate-800 text-left">
                                            <p className="font-medium text-xs leading-tight truncate" title={p.name}>{p.name}</p>
                                            <p className="text-[10px] text-slate-400 mt-0.5 truncate">{p.category || "—"}</p>
                                            {p.dosePerHa && (
                                                <div className="flex items-center gap-1 mt-1">
                                                    <Droplets className="h-3 w-3 text-blue-400" />
                                                    <span className="text-[10px] text-blue-400">{p.dosePerHa} {p.unit}/ha</span>
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
                    {/* Cart header */}
                    <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <ShoppingCart className="h-5 w-5 text-orange-400" />
                            <h3 className="font-bold">Carrinho</h3>
                        </div>
                        {cart.length > 0 && (
                            <span className="bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{cart.length}</span>
                        )}
                    </div>

                    {/* Cart items */}
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
                                            {/* Product thumbnail */}
                                            {item.product.imageUrl ? (
                                                <img src={item.product.imageUrl} className="w-10 h-10 rounded-lg object-contain bg-white shrink-0" alt="" />
                                            ) : (
                                                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${CATEGORY_COLORS[item.product.category] || CATEGORY_COLORS.outro} flex items-center justify-center shrink-0`}>
                                                    <span className="text-lg">{CATEGORY_EMOJI[item.product.category] || "📦"}</span>
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-sm leading-tight truncate">{item.product.name}</p>
                                                <p className="text-xs text-slate-400">{item.product.category || "—"} • Estoque: {getStockForProduct(item.product.id).toFixed(1)}</p>
                                            </div>
                                            <button onClick={() => removeFromCart(item.product.id)} className="text-red-400 hover:text-red-300 shrink-0 p-1">
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>

                                        {/* Quantity controls */}
                                        <div className="flex items-center gap-2">
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
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Cart footer */}
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
                            Selecionar Talhão
                        </Button>
                    </div>
                </div>
            </div>

            {/* MOBILE: Bottom cart bar (visible when cart has items, md:hidden) */}
            {cart.length > 0 && (
                <div className="md:hidden fixed bottom-0 left-0 right-0 p-3 bg-slate-800 border-t border-slate-700 z-50">
                    <Button
                        className="w-full py-5 text-base bg-orange-600 hover:bg-orange-700 font-bold rounded-xl"
                        onClick={handleGoToPlot}
                    >
                        <ShoppingCart className="mr-2 h-5 w-5" />
                        Continuar com {cart.length} produto(s)
                        <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                </div>
            )}
        </div>
    );
}
