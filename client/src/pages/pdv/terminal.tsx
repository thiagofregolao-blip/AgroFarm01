import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Search, Check, ArrowLeft, Minus, Plus, Loader2, LogOut, Package, Wifi, WifiOff, X, ShoppingCart } from "lucide-react";

interface CartItem {
    product: any;
    quantity: number;
}

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

    const filtered = products.filter((p: any) =>
        p.name.toLowerCase().includes(search.toLowerCase())
    );

    const isInCart = (productId: string) => cart.some(c => c.product.id === productId);

    const toggleProduct = (product: any) => {
        if (isInCart(product.id)) {
            setCart(cart.filter(c => c.product.id !== product.id));
        } else {
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
    };

    if (!pdvData) {
        setLocation("/pdv/login");
        return null;
    }

    return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col">
            {/* Header */}
            <header className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700">
                <div className="flex items-center gap-3">
                    <span className="text-2xl">🏪</span>
                    <span className="font-bold text-lg">PDV Depósito</span>
                </div>
                <div className="flex items-center gap-3">
                    {cart.length > 0 && step === "product" && (
                        <div className="flex items-center gap-2 bg-orange-600 px-3 py-1.5 rounded-full text-sm font-bold">
                            <ShoppingCart className="h-4 w-4" />
                            {cart.length}
                        </div>
                    )}
                    {isOnline ? (
                        <Wifi className="h-5 w-5 text-green-400" />
                    ) : (
                        <WifiOff className="h-5 w-5 text-red-400" />
                    )}
                    <Button variant="ghost" size="icon" className="text-slate-400" onClick={() => setLocation("/pdv/login")}>
                        <LogOut className="h-5 w-5" />
                    </Button>
                </div>
            </header>

            {/* Steps indicator */}
            <div className="flex items-center gap-2 px-4 py-3 bg-slate-800/50">
                {["Produtos", "Talhão", "Confirmar"].map((label, i) => {
                    const steps = ["product", "plot", "confirm"];
                    const isActive = steps.indexOf(step) >= i;
                    return (
                        <div key={label} className="flex items-center gap-2 flex-1">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${isActive ? "bg-orange-500" : "bg-slate-700"}`}>
                                {i + 1}
                            </div>
                            <span className={`text-xs hidden sm:inline ${isActive ? "text-white" : "text-slate-500"}`}>{label}</span>
                            {i < 2 && <div className={`flex-1 h-0.5 ${isActive ? "bg-orange-500" : "bg-slate-700"}`} />}
                        </div>
                    );
                })}
            </div>

            {/* Content */}
            <div className="flex-1 p-4 overflow-y-auto pb-32">
                {step === "product" && (
                    <div className="space-y-4">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                            <Input
                                className="pl-12 py-6 text-lg bg-slate-800 border-slate-700 text-white"
                                placeholder="Buscar produto..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {filtered.map((p: any) => {
                                const stockQty = getStockForProduct(p.id);
                                const inCart = isInCart(p.id);
                                const cartItem = cart.find(c => c.product.id === p.id);
                                return (
                                    <div
                                        key={p.id}
                                        className={`rounded-xl bg-slate-800 border transition-colors overflow-hidden ${inCart ? "border-orange-500 ring-1 ring-orange-500/30" : "border-slate-700"}`}
                                    >
                                        {/* Product row */}
                                        <button
                                            onClick={() => toggleProduct(p)}
                                            className="flex items-center gap-4 p-4 w-full text-left"
                                        >
                                            {/* Checkbox */}
                                            <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${inCart ? "bg-orange-500 border-orange-500" : "border-slate-500"}`}>
                                                {inCart && <Check className="h-4 w-4 text-white" />}
                                            </div>
                                            <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center">
                                                <Package className="h-5 w-5 text-orange-400" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium truncate">{p.name}</p>
                                                <p className="text-sm text-slate-400">{p.category || "—"} • {p.unit}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className={`font-bold text-lg ${stockQty <= 0 ? "text-red-400" : "text-green-400"}`}>
                                                    {stockQty.toFixed(1)}
                                                </p>
                                                <p className="text-xs text-slate-500">{p.unit}</p>
                                            </div>
                                        </button>

                                        {/* Inline quantity editor */}
                                        {inCart && cartItem && (
                                            <div className="flex items-center gap-3 px-4 pb-3 pt-0">
                                                <span className="text-xs text-slate-400 w-12">Qtd:</span>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="w-9 h-9 border-slate-600"
                                                    onClick={(e) => { e.stopPropagation(); updateQuantity(p.id, cartItem.quantity - 1); }}
                                                >
                                                    <Minus className="h-4 w-4" />
                                                </Button>
                                                <Input
                                                    type="number"
                                                    step="0.1"
                                                    value={cartItem.quantity}
                                                    onChange={(e) => updateQuantity(p.id, parseFloat(e.target.value) || 0)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="text-center text-lg font-bold w-24 h-9 bg-slate-700 border-slate-600 text-white"
                                                />
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="w-9 h-9 border-slate-600"
                                                    onClick={(e) => { e.stopPropagation(); updateQuantity(p.id, cartItem.quantity + 1); }}
                                                >
                                                    <Plus className="h-4 w-4" />
                                                </Button>
                                                <span className="text-xs text-slate-400">{p.unit}</span>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="ml-auto text-red-400 hover:text-red-300 h-9"
                                                    onClick={(e) => { e.stopPropagation(); removeFromCart(p.id); }}
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            {filtered.length === 0 && (
                                <p className="text-slate-500 text-center py-8 col-span-2">Nenhum produto encontrado</p>
                            )}
                        </div>
                    </div>
                )}

                {step === "plot" && (
                    <div className="space-y-4">
                        <button onClick={() => setStep("product")} className="flex items-center gap-2 text-slate-400 hover:text-white">
                            <ArrowLeft className="h-4 w-4" /> Voltar
                        </button>
                        <h2 className="text-xl font-bold text-center">Selecione o Talhão</h2>

                        {/* Cart summary */}
                        <div className="bg-slate-800 rounded-xl p-3 border border-slate-700">
                            <p className="text-xs text-slate-400 mb-2">{cart.length} produto(s) selecionado(s):</p>
                            <div className="space-y-1">
                                {cart.map(item => (
                                    <div key={item.product.id} className="flex justify-between text-sm">
                                        <span className="text-slate-300 truncate">{item.product.name}</span>
                                        <span className="text-orange-400 font-medium ml-2">{item.quantity} {item.product.unit}</span>
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
                                                <div className="bg-slate-850 divide-y divide-slate-700/50">
                                                    {propPlots.length > 0 ? (
                                                        propPlots.map((plot: any) => (
                                                            <button
                                                                key={plot.id}
                                                                onClick={() => handleSelectPlot(plot)}
                                                                className="w-full flex items-center gap-3 px-6 py-3 hover:bg-slate-700/50 transition-colors text-left"
                                                            >
                                                                <div className="w-8 h-8 rounded-lg bg-orange-900/30 flex items-center justify-center">
                                                                    <span className="text-sm">📍</span>
                                                                </div>
                                                                <div className="flex-1">
                                                                    <p className="font-medium">{plot.name}</p>
                                                                    <p className="text-xs text-slate-400">
                                                                        {plot.areaHa} ha {plot.crop ? `• ${plot.crop}` : ""}
                                                                    </p>
                                                                </div>
                                                            </button>
                                                        ))
                                                    ) : (
                                                        <button
                                                            onClick={() => handleSelectPlot({ id: prop.id, name: prop.name, propertyId: prop.id, propertyName: prop.name, areaHa: prop.totalAreaHa })}
                                                            className="w-full flex items-center gap-3 px-6 py-3 hover:bg-slate-700/50 transition-colors text-left"
                                                        >
                                                            <div className="w-8 h-8 rounded-lg bg-orange-900/30 flex items-center justify-center">
                                                                <span className="text-sm">🏠</span>
                                                            </div>
                                                            <div className="flex-1">
                                                                <p className="font-medium text-orange-300">Selecionar esta propriedade</p>
                                                                <p className="text-xs text-slate-400">Sem talhões cadastrados — usar propriedade diretamente</p>
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
                )}

                {step === "confirm" && selectedPlot && cart.length > 0 && (
                    <div className="max-w-lg mx-auto space-y-6">
                        <button onClick={() => setStep("plot")} className="flex items-center gap-2 text-slate-400 hover:text-white">
                            <ArrowLeft className="h-4 w-4" /> Voltar
                        </button>

                        <div className="bg-slate-800 rounded-xl p-6 space-y-4 border border-slate-700">
                            <h2 className="text-xl font-bold text-center text-orange-400">Confirmar Saída</h2>

                            {/* Plot info */}
                            <div className="flex justify-between py-2 border-b border-slate-700">
                                <span className="text-slate-400">Talhão</span>
                                <span className="font-semibold">{selectedPlot.name}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-slate-700">
                                <span className="text-slate-400">Propriedade</span>
                                <span className="font-semibold">{selectedPlot.propertyName}</span>
                            </div>

                            {/* Products list */}
                            <div className="pt-2">
                                <p className="text-sm text-slate-400 mb-3">Produtos ({cart.length}):</p>
                                <div className="space-y-2">
                                    {cart.map((item) => (
                                        <div key={item.product.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-700/50">
                                            <Package className="h-5 w-5 text-orange-400 shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-sm truncate">{item.product.name}</p>
                                                <p className="text-xs text-slate-400">{item.product.category || "—"}</p>
                                            </div>
                                            <span className="font-bold text-orange-400 text-lg">{item.quantity} {item.product.unit}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                className="flex-1 py-6 text-lg border-slate-700"
                                onClick={reset}
                            >
                                Cancelar
                            </Button>
                            <Button
                                className="flex-1 py-6 text-lg bg-green-600 hover:bg-green-700"
                                onClick={handleSubmit}
                                disabled={submitting}
                            >
                                {submitting ? (
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                ) : (
                                    <Check className="mr-2 h-5 w-5" />
                                )}
                                Confirmar ({cart.length})
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Floating cart button (step 1 only) */}
            {step === "product" && cart.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-slate-900 via-slate-900 to-transparent">
                    <Button
                        className="w-full py-6 text-lg bg-orange-600 hover:bg-orange-700 rounded-xl shadow-xl shadow-orange-900/30"
                        onClick={handleGoToPlot}
                    >
                        <ShoppingCart className="mr-2 h-5 w-5" />
                        Continuar com {cart.length} produto(s)
                    </Button>
                </div>
            )}
        </div>
    );
}
