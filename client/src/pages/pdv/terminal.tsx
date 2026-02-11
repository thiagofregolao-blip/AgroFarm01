import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Search, Check, ArrowLeft, Minus, Plus, Loader2, LogOut, Package, Wifi, WifiOff } from "lucide-react";

export default function PdvTerminal() {
    const [, setLocation] = useLocation();
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const [step, setStep] = useState<"product" | "quantity" | "plot" | "confirm">("product");
    const [search, setSearch] = useState("");
    const [selectedProduct, setSelectedProduct] = useState<any>(null);
    const [quantity, setQuantity] = useState("");
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

    const handleSelectProduct = (product: any) => {
        setSelectedProduct(product);
        setStep("quantity");
        setQuantity("");
    };

    const handleConfirmQty = () => {
        if (!quantity || parseFloat(quantity) <= 0) {
            toast({ title: "Informe uma quantidade válida", variant: "destructive" });
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
            await apiRequest("POST", "/api/pdv/withdraw", {
                productId: selectedProduct.id,
                quantity: parseFloat(quantity),
                plotId: selectedPlot.id,
                propertyId: selectedPlot.propertyId,
            });

            toast({ title: "✅ Saída registrada com sucesso!" });
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
        setSelectedProduct(null);
        setQuantity("");
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
                {["Produto", "Quantidade", "Talhão", "Confirmar"].map((label, i) => {
                    const steps = ["product", "quantity", "plot", "confirm"];
                    const isActive = steps.indexOf(step) >= i;
                    return (
                        <div key={label} className="flex items-center gap-2 flex-1">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${isActive ? "bg-orange-500" : "bg-slate-700"}`}>
                                {i + 1}
                            </div>
                            <span className={`text-xs hidden sm:inline ${isActive ? "text-white" : "text-slate-500"}`}>{label}</span>
                            {i < 3 && <div className={`flex-1 h-0.5 ${isActive ? "bg-orange-500" : "bg-slate-700"}`} />}
                        </div>
                    );
                })}
            </div>

            {/* Content */}
            <div className="flex-1 p-4 overflow-y-auto">
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
                                return (
                                    <button
                                        key={p.id}
                                        onClick={() => handleSelectProduct(p)}
                                        className="flex items-center gap-4 p-4 rounded-xl bg-slate-800 border border-slate-700 hover:border-orange-500 transition-colors text-left"
                                    >
                                        <div className="w-12 h-12 rounded-xl bg-slate-700 flex items-center justify-center">
                                            <Package className="h-6 w-6 text-orange-400" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-medium">{p.name}</p>
                                            <p className="text-sm text-slate-400">{p.category || "—"} • {p.unit}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className={`font-bold text-lg ${stockQty <= 0 ? "text-red-400" : "text-green-400"}`}>
                                                {stockQty.toFixed(1)}
                                            </p>
                                            <p className="text-xs text-slate-500">{p.unit}</p>
                                        </div>
                                    </button>
                                );
                            })}
                            {filtered.length === 0 && (
                                <p className="text-slate-500 text-center py-8 col-span-2">Nenhum produto encontrado</p>
                            )}
                        </div>
                    </div>
                )}

                {step === "quantity" && selectedProduct && (
                    <div className="max-w-md mx-auto space-y-6">
                        <button onClick={() => setStep("product")} className="flex items-center gap-2 text-slate-400 hover:text-white">
                            <ArrowLeft className="h-4 w-4" /> Voltar
                        </button>
                        <div className="text-center">
                            <h2 className="text-xl font-bold">{selectedProduct.name}</h2>
                            <p className="text-slate-400">Estoque: {getStockForProduct(selectedProduct.id).toFixed(2)} {selectedProduct.unit}</p>
                        </div>
                        <div className="flex items-center gap-4 justify-center">
                            <Button
                                size="lg"
                                variant="outline"
                                className="w-14 h-14 text-2xl border-slate-700"
                                onClick={() => setQuantity(String(Math.max(0, (parseFloat(quantity) || 0) - 1)))}
                            >
                                <Minus className="h-6 w-6" />
                            </Button>
                            <Input
                                type="number"
                                step="0.1"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                className="text-center text-3xl font-bold w-40 py-6 bg-slate-800 border-slate-700 text-white"
                                autoFocus
                            />
                            <Button
                                size="lg"
                                variant="outline"
                                className="w-14 h-14 text-2xl border-slate-700"
                                onClick={() => setQuantity(String((parseFloat(quantity) || 0) + 1))}
                            >
                                <Plus className="h-6 w-6" />
                            </Button>
                        </div>
                        <p className="text-center text-slate-500">{selectedProduct.unit}</p>
                        <Button
                            className="w-full py-6 text-lg bg-orange-600 hover:bg-orange-700"
                            onClick={handleConfirmQty}
                            disabled={!quantity || parseFloat(quantity) <= 0}
                        >
                            Confirmar Quantidade
                        </Button>
                    </div>
                )}

                {step === "plot" && (
                    <div className="space-y-4">
                        <button onClick={() => setStep("quantity")} className="flex items-center gap-2 text-slate-400 hover:text-white">
                            <ArrowLeft className="h-4 w-4" /> Voltar
                        </button>
                        <h2 className="text-xl font-bold text-center">Selecione o Talhão</h2>

                        {(() => {
                            const properties = pdvData?.properties || [];
                            // Group plots by property
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
                                                {/* Property header */}
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

                                                {/* Plots inside property */}
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

                {step === "confirm" && selectedProduct && selectedPlot && (
                    <div className="max-w-md mx-auto space-y-6">
                        <button onClick={() => setStep("plot")} className="flex items-center gap-2 text-slate-400 hover:text-white">
                            <ArrowLeft className="h-4 w-4" /> Voltar
                        </button>

                        <div className="bg-slate-800 rounded-xl p-6 space-y-4 border border-slate-700">
                            <h2 className="text-xl font-bold text-center text-orange-400">Confirmar Saída</h2>
                            <div className="space-y-3">
                                <div className="flex justify-between py-2 border-b border-slate-700">
                                    <span className="text-slate-400">Produto</span>
                                    <span className="font-semibold">{selectedProduct.name}</span>
                                </div>
                                <div className="flex justify-between py-2 border-b border-slate-700">
                                    <span className="text-slate-400">Quantidade</span>
                                    <span className="font-semibold text-orange-400">{quantity} {selectedProduct.unit}</span>
                                </div>
                                <div className="flex justify-between py-2 border-b border-slate-700">
                                    <span className="text-slate-400">Talhão</span>
                                    <span className="font-semibold">{selectedPlot.name}</span>
                                </div>
                                <div className="flex justify-between py-2">
                                    <span className="text-slate-400">Propriedade</span>
                                    <span className="font-semibold">{selectedPlot.propertyName}</span>
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
                                Confirmar
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
