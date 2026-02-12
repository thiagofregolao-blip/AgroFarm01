import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { Search, Check, ArrowLeft, ArrowRight, Minus, Plus, Loader2, LogOut, Wifi, WifiOff, ShoppingCart, Trash2, Droplets, MapPin, FileText, Share2 } from "lucide-react";
import { generateReceituarioPDF, shareViaWhatsApp, downloadPDF, openPDF, type ReceituarioData } from "@/lib/pdf-receituario";

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

const exitFullscreen = () => {
    if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => { });
    } else if ((document as any).webkitFullscreenElement) {
        (document as any).webkitExitFullscreen();
    }
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
    const [distOverrides, setDistOverrides] = useState<Record<string, number>>({});
    const [instructions, setInstructions] = useState<string>("");

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

    const { data: pdvData, isLoading: pdvLoading, isError: pdvError } = useQuery({
        queryKey: ["/api/pdv/data"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/pdv/data");
            if (!res.ok) throw new Error("Not authenticated");
            return res.json();
        },
        retry: false,
        refetchInterval: 60000,
        // Try to initialize from sessionStorage as fallback
        initialData: () => {
            try {
                const cached = sessionStorage.getItem("pdvData");
                if (cached) return JSON.parse(cached);
            } catch { }
            return undefined;
        },
    });

    // Query para histórico de saídas (Moved to top level to avoid Hook rules violation)
    const { data: withdrawalsHistory } = useQuery({
        queryKey: ["/api/pdv/withdrawals"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/pdv/withdrawals");
            if (!res.ok) throw new Error("Failed to fetch withdrawals");
            return res.json();
        },
        enabled: step === "product",
        refetchInterval: 30000, // Atualizar a cada 30 segundos
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

    const getDistribution = (product: any, totalQty: number) => {
        const dose = parseFloat(product.dosePerHa);

        if (dose && !isNaN(dose) && selectedPlots.length > 0) {
            let totalIdeal = 0;
            const ideals = selectedPlots.map(plot => {
                const area = parseFloat(plot.areaHa) || 0;
                const ideal = area * dose;
                totalIdeal += ideal;
                return { plot, area, ideal };
            });

            let allocated = 0;
            return ideals.map((item, idx) => {
                let qty: number;
                if (idx === ideals.length - 1) {
                    qty = Math.round(totalQty - allocated);
                } else {
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
        } else {
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

    const confirmationData = useMemo(() => {
        return cart.map(item => {
            const dist = getDistribution(item.product, item.quantity);
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

    const handleSubmit = async (generatePDF = false) => {
        setSubmitting(true);
        try {
            let count = 0;
            const applications: Array<{ productId: string; plotId: string; quantity: number; propertyId?: string; plotName: string; productName: string; dosePerHa?: number; unit: string }> = [];

            for (const item of confirmationData) {
                for (const d of item.distribution) {
                    if (d.allocatedQty <= 0) continue;
                    const plot = selectedPlots.find(p => p.id === d.plotId);
                    await apiRequest("POST", "/api/pdv/withdraw", {
                        productId: item.product.id,
                        quantity: d.allocatedQty,
                        plotId: d.plotId,
                        propertyId: plot?.propertyId,
                        notes: count === 0 ? instructions : undefined, // Salvar instruções apenas na primeira aplicação
                    });

                    applications.push({
                        productId: item.product.id,
                        plotId: d.plotId,
                        quantity: d.allocatedQty,
                        propertyId: plot?.propertyId,
                        plotName: d.plotName,
                        productName: item.product.name,
                        dosePerHa: item.product.dosePerHa ? parseFloat(item.product.dosePerHa) : undefined,
                        unit: item.product.unit,
                    });
                    count++;
                }
            }

            toast({ title: `✅ ${count} saída(s) registrada(s) com sucesso!` });
            queryClient.invalidateQueries({ queryKey: ["/api/pdv/data"] });
            queryClient.invalidateQueries({ queryKey: ["/api/pdv/withdrawals"] });

            // Gerar PDF se solicitado ou automaticamente após confirmar (opção b)
            if (applications.length > 0) {
                // Organizar dados para o PDF
                const properties = pdvData?.properties || [];
                const firstProperty = properties.find((p: any) =>
                    applications.some(app => app.propertyId === p.id)
                ) || properties[0];

                // Reorganizar para a estrutura correta (produtos com seus talhões)
                const productsByProduct = new Map<string, { productName: string; dosePerHa?: number; unit: string; plots: Array<{ plotName: string; quantity: number }> }>();

                applications.forEach(app => {
                    if (!productsByProduct.has(app.productName)) {
                        productsByProduct.set(app.productName, {
                            productName: app.productName,
                            dosePerHa: app.dosePerHa,
                            unit: app.unit,
                            plots: [],
                        });
                    }
                    const product = productsByProduct.get(app.productName)!;
                    const existingPlot = product.plots.find(p => p.plotName === app.plotName);
                    if (existingPlot) {
                        existingPlot.quantity += app.quantity;
                    } else {
                        product.plots.push({
                            plotName: app.plotName,
                            quantity: app.quantity,
                        });
                    }
                });

                // Criar estrutura de dados para PDF
                const pdfData: ReceituarioData = {
                    propertyName: firstProperty?.name || "Propriedade",
                    appliedAt: new Date(),
                    instructions: instructions || undefined,
                    products: Array.from(productsByProduct.values()),
                };

                // Gerar PDF
                const pdfBlob = generateReceituarioPDF(pdfData);

                if (generatePDF) {
                    // Abrir PDF diretamente em nova aba
                    openPDF(pdfBlob);
                    toast({
                        title: "Receituário gerado",
                        description: "O arquivo foi aberto em uma nova aba."
                    });
                } else {
                    // Geração automática após confirmar: apenas fazer download silencioso
                    downloadPDF(pdfBlob);
                    toast({
                        title: "Receituário gerado automaticamente",
                        description: "O PDF foi baixado automaticamente. Você pode consultá-lo no histórico de saídas."
                    });
                }
            }

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
        setInstructions("");
    };

    const handleRegenerateReceituario = async (batch: any) => {
        try {
            const properties = pdvData?.properties || [];
            const firstProperty = properties.find((p: any) =>
                batch.applications.some((app: any) => app.propertyId === p.id)
            ) || properties[0];

            // Reorganizar aplicações para estrutura do PDF
            const productsByProduct = new Map<string, { productName: string; dosePerHa?: number; unit: string; plots: Array<{ plotName: string; quantity: number }> }>();

            batch.applications.forEach((app: any) => {
                const dosePerHa = app.productName ? undefined : undefined; // Precisa buscar do produto
                if (!productsByProduct.has(app.productName)) {
                    productsByProduct.set(app.productName, {
                        productName: app.productName,
                        dosePerHa: dosePerHa,
                        unit: "L", // Precisa buscar do produto
                        plots: [],
                    });
                }
                const product = productsByProduct.get(app.productName)!;
                const existingPlot = product.plots.find(p => p.plotName === app.plotName);
                if (existingPlot) {
                    existingPlot.quantity += parseFloat(app.quantity);
                } else {
                    product.plots.push({
                        plotName: app.plotName,
                        quantity: parseFloat(app.quantity),
                    });
                }
            });

            // Buscar informações completas dos produtos
            const products = pdvData?.products || [];
            const productsWithDetails = Array.from(productsByProduct.values()).map(product => {
                const productInfo = products.find((p: any) => p.name === product.productName);
                return {
                    ...product,
                    dosePerHa: productInfo?.dosePerHa ? parseFloat(productInfo.dosePerHa) : undefined,
                    unit: productInfo?.unit || product.unit,
                };
            });

            const pdfData: ReceituarioData = {
                propertyName: firstProperty?.name || batch.propertyName || "Propriedade",
                appliedAt: new Date(batch.appliedAt),
                instructions: batch.notes || undefined,
                products: productsWithDetails,
            };

            const pdfBlob = generateReceituarioPDF(pdfData);
            openPDF(pdfBlob);
            toast({ title: "Receituário aberto em nova aba" });
        } catch (error) {
            toast({ title: "Erro ao gerar receituário", variant: "destructive" });
        }
    };

    const totalCartQty = cart.reduce((sum, c) => sum + c.quantity, 0);

    const handleLogout = () => {
        exitFullscreen();
        setLocation("/pdv/login");
    };

    if (pdvLoading) {
        return (
            <div className="h-screen bg-gray-50 flex items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
            </div>
        );
    }

    if (pdvError || !pdvData) {
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
            <div className="h-screen bg-gradient-to-br from-gray-50 to-emerald-50/30 text-gray-800 flex flex-col">
                {/* Header with gradient */}
                <header className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shrink-0 shadow-md">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setStep("product")} className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors">
                            <ArrowLeft className="h-5 w-5 text-white" />
                        </button>
                        <div>
                            <span className="font-bold text-base leading-tight block">Selecionar Talhões</span>
                            <span className="text-[10px] text-emerald-200">Passo 2 de 3</span>
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                    {/* LEFT: Cart Summary (Sidebar on desktop) */}
                    <div className="w-full md:w-80 bg-white border-r border-gray-100 flex flex-col shadow-lg z-10 shrink-0 h-48 md:h-auto">
                        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Resumo do Pedido</p>
                            <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-bold text-emerald-600">{cart.length}</span>
                                <span className="text-sm text-gray-500">produtos selecionados</span>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-3">
                            {cart.map(item => (
                                <div key={item.product.id} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 border border-gray-100">
                                    {item.product.imageUrl ? (
                                        <img src={item.product.imageUrl} className="w-10 h-10 rounded-md object-contain bg-white shrink-0" alt="" />
                                    ) : (
                                        <div className={`w-10 h-10 rounded-md bg-gradient-to-br ${CATEGORY_COLORS[item.product.category] || CATEGORY_COLORS.outro} flex items-center justify-center shrink-0`}>
                                            <span className="text-lg">{CATEGORY_EMOJI[item.product.category] || "📦"}</span>
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm truncate text-gray-800">{item.product.name}</p>
                                        <p className="text-xs text-gray-500">{item.quantity} {item.product.unit}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* RIGHT: Plot Selection Grid */}
                    <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50/50">
                        {/* Info Banner */}


                        {properties.length === 0 && plots.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-gray-400 text-center">
                                <span className="text-4xl mb-3">🌾</span>
                                <p className="text-lg font-medium">Nenhum talhão encontrado</p>
                                <p className="text-sm">Cadastre propriedades e talhões para continuar</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {properties.map((prop: any) => {
                                    const propPlots = plotsByProp[prop.id] || [];
                                    const allSelected = propPlots.every((p: any) => isPlotSelected(p.id));

                                    return (
                                        <div key={prop.id} className="space-y-3">
                                            <div className="flex items-center justify-between px-1">
                                                <h3 className="font-bold text-gray-700 flex items-center gap-2">
                                                    <span className="w-1 h-4 rounded-full bg-emerald-500 block"></span>
                                                    {prop.name}
                                                    <span className="text-xs font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{propPlots.length} talhões</span>
                                                </h3>
                                                {propPlots.length > 0 && (
                                                    <button
                                                        onClick={() => {
                                                            const ids = propPlots.map((p: any) => p.id);
                                                            const newPlots = allSelected
                                                                ? selectedPlots.filter(p => !ids.includes(p.id))
                                                                : [...selectedPlots.filter(p => !ids.includes(p.id)), ...propPlots];
                                                            setSelectedPlots(newPlots);
                                                        }}
                                                        className="text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:underline"
                                                    >
                                                        {allSelected ? "Desmarcar todos" : "Selecionar todos"}
                                                    </button>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                                {propPlots.length > 0 ? (
                                                    propPlots.map((plot: any) => {
                                                        const sel = isPlotSelected(plot.id);
                                                        return (
                                                            <button
                                                                key={plot.id}
                                                                onClick={() => togglePlot(plot)}
                                                                className={`group relative p-4 rounded-xl border-2 text-left transition-all duration-200 ${sel ? "bg-emerald-50/50 border-emerald-500 shadow-md shadow-emerald-100" : "bg-white border-transparent shadow-sm hover:shadow-md hover:-translate-y-0.5"}`}
                                                            >
                                                                <div className="flex items-start justify-between mb-2">
                                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${sel ? "bg-emerald-500 text-white" : "bg-gray-100 text-gray-400 group-hover:bg-gray-200"}`}>
                                                                        <MapPin className="h-4 w-4" />
                                                                    </div>
                                                                    {sel && <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm"><Check className="h-3 w-3 text-white" /></div>}
                                                                </div>
                                                                <h4 className={`font-bold text-sm mb-0.5 ${sel ? "text-emerald-900" : "text-gray-800"}`}>{plot.name}</h4>
                                                                <p className="text-xs text-gray-500">{plot.areaHa} hectares</p>
                                                                {plot.crop && <span className="absolute bottom-4 right-4 text-[10px] font-medium px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">{plot.crop}</span>}
                                                            </button>
                                                        );
                                                    })
                                                ) : (
                                                    <div className="col-span-full py-4 text-center text-gray-400 text-sm italic bg-white rounded-xl border border-dashed border-gray-200">
                                                        Nenhum talhão cadastrado nesta propriedade
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Bottom bar */}
                <div className="p-4 bg-white/90 backdrop-blur-sm border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
                    <div className="max-w-4xl mx-auto flex items-center justify-between gap-6">
                        <div className="hidden sm:block">
                            <p className="text-gray-500 text-sm">Próximo passo: <strong>Confirmar Distribuição</strong></p>
                            <p className="text-xs text-gray-400">Total de área selecionada: {totalAreaSelected.toFixed(1)} ha</p>
                        </div>
                        <div className="flex items-center gap-4 flex-1 sm:flex-none justify-end">
                            <span className="font-bold text-emerald-600 text-lg mr-2 sm:hidden">{selectedPlots.length} talhões</span>
                            <Button
                                className="w-full sm:w-auto px-8 py-6 text-base bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 font-bold rounded-xl shadow-lg shadow-emerald-200 transition-all active:scale-[0.98]"
                                onClick={handleGoToConfirm}
                                disabled={selectedPlots.length === 0}
                            >
                                Avançar
                                <ArrowRight className="ml-2 h-5 w-5" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ==================== STEP: CONFIRM (Distribution) ====================
    if (step === "confirm" && selectedPlots.length > 0 && cart.length > 0) {
        return (
            <div className="h-screen bg-gradient-to-br from-gray-50 to-emerald-50/30 text-gray-800 flex flex-col">
                <header className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shrink-0 shadow-md">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setStep("plot")} className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors">
                            <ArrowLeft className="h-5 w-5 text-white" />
                        </button>
                        <div>
                            <span className="font-bold text-base leading-tight block">Confirmar Saída</span>
                            <span className="text-[10px] text-emerald-200">Passo 3 de 3</span>
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-64 md:pb-32">
                    <div className="max-w-4xl mx-auto space-y-6">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col items-center justify-center">
                                <span className="text-2xl mb-1">📦</span>
                                <p className="text-gray-400 text-xs uppercase font-bold tracking-wide">Produtos</p>
                                <p className="text-xl font-bold text-gray-800">{cart.length}</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col items-center justify-center">
                                <span className="text-2xl mb-1">📍</span>
                                <p className="text-gray-400 text-xs uppercase font-bold tracking-wide">Talhões</p>
                                <p className="text-xl font-bold text-gray-800">{selectedPlots.length}</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col items-center justify-center">
                                <span className="text-2xl mb-1">📏</span>
                                <p className="text-gray-400 text-xs uppercase font-bold tracking-wide">Área Total</p>
                                <p className="text-xl font-bold text-gray-800">{totalAreaSelected.toFixed(1)} <span className="text-sm font-normal text-gray-400">ha</span></p>
                            </div>
                        </div>

                        {/* Campo de Instruções */}
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                            <Label htmlFor="instructions" className="text-sm font-semibold text-gray-700 mb-2 block">
                                Instruções para Aplicação (Opcional)
                            </Label>
                            <Textarea
                                id="instructions"
                                placeholder="Ex: Aplicar em condições de baixa umidade. Evitar aplicação em dias de vento forte..."
                                value={instructions}
                                onChange={(e) => setInstructions(e.target.value)}
                                className="min-h-[80px] resize-none"
                                rows={3}
                            />
                        </div>

                        {/* Per product distribution */}
                        <div className="space-y-4">
                            {confirmationData.map((item) => {
                                const p = item.product;
                                const dose = parseFloat(p.dosePerHa);
                                const hasDose = dose && !isNaN(dose);
                                const diff = item.totalQty - item.totalAllocated;

                                return (
                                    <div key={p.id} className="bg-white rounded-2xl border border-gray-100 shadow-md overflow-hidden transition-all hover:shadow-lg">
                                        {/* Product header */}
                                        <div className="flex items-center gap-4 p-4 border-b border-gray-100 bg-gray-50/30">
                                            {p.imageUrl ? (
                                                <img src={p.imageUrl} className="w-14 h-14 rounded-xl object-contain bg-white border border-gray-100 shadow-sm" alt="" />
                                            ) : (
                                                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${CATEGORY_COLORS[p.category] || CATEGORY_COLORS.outro} flex items-center justify-center shadow-sm`}>
                                                    <span className="text-2xl">{CATEGORY_EMOJI[p.category] || "📦"}</span>
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-lg text-gray-800 leading-tight">{p.name}</p>
                                                <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                                                    <span className="px-2 py-0.5 bg-gray-100 rounded-full font-medium">{p.category || "Geral"}</span>
                                                    {hasDose && (
                                                        <span className="text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                                                            <Droplets className="h-3 w-3" />
                                                            {dose.toFixed(1)} {p.unit}/ha
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xs text-gray-400 font-bold uppercase tracking-wide mb-0.5">Total Saída</div>
                                                <p className="font-bold text-emerald-600 text-2xl leading-none">{item.totalQty}</p>
                                                <p className="text-xs text-gray-400">{p.unit}</p>
                                            </div>
                                        </div>

                                        {/* Per-plot distribution */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:gap-px bg-gray-100">
                                            {item.distribution.map((d) => (
                                                <div key={d.plotId} className="flex items-center gap-3 p-4 bg-white">
                                                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                                                        <span className="text-xs font-bold">PT</span>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-bold text-gray-700 truncate">{d.plotName}</p>
                                                        <p className="text-[10px] text-gray-400">
                                                            {d.areaHa.toFixed(1)} ha
                                                            {hasDose && <span className="text-blue-400 ml-1">• Ideal: {(d.areaHa * dose).toFixed(0)}</span>}
                                                        </p>
                                                    </div>
                                                    {/* Quantity Input */}
                                                    <div className="flex items-center gap-1 shrink-0 bg-gray-50 p-1 rounded-lg border border-gray-200">
                                                        <button
                                                            className="w-7 h-7 rounded bg-white hover:bg-gray-100 text-emerald-600 border border-gray-200 flex items-center justify-center shadow-sm transition-all active:scale-95"
                                                            onClick={() => setOverride(p.id, d.plotId, d.allocatedQty - 1)}
                                                        >
                                                            <Minus className="h-3 w-3" />
                                                        </button>
                                                        <Input
                                                            type="number"
                                                            step="1"
                                                            value={d.allocatedQty}
                                                            onChange={(e) => setOverride(p.id, d.plotId, parseFloat(e.target.value) || 0)}
                                                            className="text-center text-sm font-bold w-16 h-7 bg-transparent border-none p-0 focus-visible:ring-0 text-gray-800"
                                                        />
                                                        <button
                                                            className="w-7 h-7 rounded bg-white hover:bg-gray-100 text-emerald-600 border border-gray-200 flex items-center justify-center shadow-sm transition-all active:scale-95"
                                                            onClick={() => setOverride(p.id, d.plotId, d.allocatedQty + 1)}
                                                        >
                                                            <Plus className="h-3 w-3" />
                                                        </button>
                                                    </div>
                                                    <span className="text-xs text-gray-400 font-medium w-6 text-center">{p.unit}</span>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Total check footer */}
                                        <div className={`flex items-center justify-between px-5 py-3 text-sm font-bold border-t ${Math.abs(diff) < 0.01 ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-amber-50 border-amber-100 text-amber-700"}`}>
                                            <div className="flex items-center gap-2">
                                                <span className="uppercase text-[10px] tracking-wide opacity-70">Status da Distribuição:</span>
                                                <span>{item.totalAllocated} {p.unit} alocados</span>
                                            </div>
                                            {Math.abs(diff) < 0.01 ? (
                                                <span className="flex items-center gap-1.5 bg-white/50 px-2 py-0.5 rounded-full text-xs border border-emerald-200/50">
                                                    <Check className="h-3.5 w-3.5" />
                                                    Perfeito
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1.5 bg-white/50 px-2 py-0.5 rounded-full text-xs border border-amber-200/50">
                                                    {diff > 0 ? `Faltam ${diff.toFixed(0)} ${p.unit}` : `Excede ${Math.abs(diff).toFixed(0)} ${p.unit}`}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Bottom bar */}
                <div className="p-4 bg-white/90 backdrop-blur-sm border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
                    <div className="max-w-4xl mx-auto flex flex-col sm:flex-row gap-4 mb-safe">
                        <Button variant="outline" className="flex-1 py-4 text-sm border-gray-200 hover:bg-gray-50 text-gray-600 font-medium rounded-xl order-3 sm:order-1" onClick={reset}>
                            Cancelar
                        </Button>
                        <Button
                            className="flex-1 py-4 text-sm bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 font-bold rounded-xl shadow-lg shadow-emerald-200 transition-all active:scale-[0.98] order-2 sm:order-2"
                            onClick={() => handleSubmit(false)}
                            disabled={submitting}
                        >
                            {submitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Check className="mr-2 h-5 w-5" />}
                            Confirmar Saída
                        </Button>
                        <Button
                            className="flex-1 py-4 text-sm bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 font-bold rounded-xl shadow-lg shadow-blue-200 transition-all active:scale-[0.98] order-1 sm:order-3"
                            onClick={() => handleSubmit(true)}
                            disabled={submitting}
                        >
                            {submitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <FileText className="mr-2 h-5 w-5" />}
                            Confirmar e Gerar Receituário
                        </Button>
                    </div>
                </div>
            </div>
        );
    }



    return (
        <div className="h-screen bg-gradient-to-br from-gray-50 to-emerald-50/30 text-gray-800 flex flex-col">
            {/* Header with gradient */}
            <header className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shrink-0 shadow-md">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        <span className="text-lg">🏪</span>
                    </div>
                    <div>
                        <span className="font-bold text-base leading-tight block">PDV Depósito</span>
                        <span className="text-[10px] text-emerald-200">AgroFarm Digital</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* History Trigger (Visible on all screens) */}
                    <div>
                        <Sheet>
                            <SheetTrigger asChild>
                                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-sm font-medium transition-colors text-white">
                                    <FileText className="h-4 w-4" />
                                    <span className="hidden xs:inline">Histórico</span>
                                </button>
                            </SheetTrigger>
                            <SheetContent side="left" className="w-[300px] sm:w-[400px] bg-slate-50 p-0">
                                <SheetHeader className="p-4 border-b border-gray-200 bg-white">
                                    <SheetTitle className="flex items-center gap-2 text-emerald-700">
                                        <FileText className="h-5 w-5" />
                                        Saídas Recentes
                                    </SheetTitle>
                                </SheetHeader>
                                <div className="flex-1 overflow-y-auto p-4 space-y-3 h-[calc(100vh-70px)]">
                                    {withdrawalsHistory && withdrawalsHistory.length > 0 ? (
                                        withdrawalsHistory.slice(0, 10).map((batch: any) => (
                                            <div key={batch.batchId} className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm hover:shadow-md transition-all">
                                                <div className="mb-3">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <span className="text-[10px] text-gray-400 font-medium bg-gray-50 px-1.5 py-0.5 rounded">
                                                            {new Date(batch.appliedAt).toLocaleString("pt-BR", {
                                                                day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
                                                            })}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs font-bold text-gray-800 line-clamp-1" title={batch.propertyName}>
                                                        {batch.propertyName || "Propriedade sem nome"}
                                                    </p>
                                                    <p className="text-[10px] text-emerald-600 font-medium mt-0.5">
                                                        {batch.applications.length} itens aplicados
                                                    </p>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="w-full text-xs h-7 border-dashed border-gray-300 text-gray-500 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 transition-colors"
                                                    onClick={() => {
                                                        handleRegenerateReceituario(batch);
                                                        // Close sheet logic if needed, usually clicking outside or built-in close works
                                                    }}
                                                >
                                                    <FileText className="h-3 w-3 mr-1" />
                                                    Ver Receituário
                                                </Button>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-10 text-gray-400">
                                            <p className="text-sm">Nenhuma saída recente</p>
                                        </div>
                                    )}
                                </div>
                            </SheetContent>
                        </Sheet>
                    </div>

                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${isOnline ? "bg-emerald-500/30 text-emerald-100" : "bg-red-500/30 text-red-200"}`}>
                        {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
                        {isOnline ? "Online" : "Offline"}
                    </div>
                    <button onClick={handleLogout} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-sm font-medium transition-colors">
                        <LogOut className="h-4 w-4" />
                        Sair
                    </button>
                </div>
            </header>

            {/* Stepper */}
            <div className="flex items-center px-5 py-2.5 bg-white border-b border-gray-100 shrink-0">
                {[
                    { label: "Produtos", emoji: "📦", key: "product" },
                    { label: "Talhões", emoji: "📍", key: "plot" },
                    { label: "Confirmar", emoji: "✅", key: "confirm" },
                ].map((s, i) => {
                    const steps = ["product", "plot", "confirm"];
                    const isActive = steps.indexOf(step) >= i;
                    const isCurrent = step === s.key;
                    return (
                        <div key={s.key} className="flex items-center flex-1">
                            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${isCurrent ? "bg-emerald-100 text-emerald-700" : isActive ? "text-emerald-600" : "text-gray-300"}`}>
                                <span>{s.emoji}</span>
                                <span className="hidden sm:inline">{s.label}</span>
                            </div>
                            {i < 2 && (
                                <div className="flex-1 mx-2">
                                    <div className={`h-0.5 rounded-full transition-colors ${isActive ? "bg-emerald-400" : "bg-gray-200"}`} />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>



            <div className="flex-1 flex overflow-hidden">
                {/* MIDDLE: Product catalog (Expanded to full width) */}
                <div className="flex-1 flex flex-col overflow-hidden">

                    {/* Search & filters */}
                    <div className="p-3 space-y-2.5 bg-white border-b border-gray-100 shrink-0 shadow-sm">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                className="pl-10 h-10 bg-gray-50 border-gray-200 text-gray-800 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500"
                                placeholder="Buscar produto..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
                            <button
                                onClick={() => setCategoryFilter("")}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${!categoryFilter ? "bg-emerald-600 text-white shadow-sm shadow-emerald-200" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
                            >Todos ({products.length})</button>
                            {categories.map(cat => {
                                const count = products.filter((p: any) => p.category === cat).length;
                                return (
                                    <button
                                        key={cat}
                                        onClick={() => setCategoryFilter(categoryFilter === cat ? "" : cat)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1 ${categoryFilter === cat ? "bg-emerald-600 text-white shadow-sm shadow-emerald-200" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
                                    >
                                        <span>{CATEGORY_EMOJI[cat] || "📦"}</span>
                                        {cat.charAt(0).toUpperCase() + cat.slice(1)} ({count})
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Product grid — 4 per row */}
                    <div className="flex-1 overflow-y-auto p-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {filtered.map((p: any) => {
                                const stockQty = getStockForProduct(p.id);
                                const inCart = isInCart(p.id);
                                const gradient = CATEGORY_COLORS[p.category] || CATEGORY_COLORS.outro;
                                const lowStock = stockQty <= 0;
                                return (
                                    <button
                                        key={p.id}
                                        onClick={() => addToCart(p)}
                                        className={`group relative rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-xl hover:-translate-y-1 bg-white text-left ${inCart ? "ring-2 ring-emerald-500 shadow-lg shadow-emerald-100" : "shadow-md hover:shadow-lg border border-gray-100/80"}`}
                                    >
                                        {/* Product image / icon */}
                                        <div className={`h-36 bg-gradient-to-br ${gradient} flex items-center justify-center relative overflow-hidden`}>
                                            {/* Decorative shimmer */}
                                            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 group-hover:via-white/20 transition-all" />
                                            {p.imageUrl ? (
                                                <img src={p.imageUrl} alt={p.name} className="w-full h-full object-contain p-3 bg-white/95 relative z-10"
                                                    onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.nextElementSibling?.classList.remove("hidden"); }} />
                                            ) : null}
                                            <div className={`flex flex-col items-center justify-center relative z-10 ${p.imageUrl ? "hidden" : ""}`}>
                                                <span className="text-5xl drop-shadow-lg group-hover:scale-110 transition-transform duration-300">{CATEGORY_EMOJI[p.category] || "📦"}</span>
                                            </div>
                                            {/* Stock badge */}
                                            <div className={`absolute top-2 right-2 px-2 py-1 rounded-lg text-[10px] font-bold text-white z-20 ${lowStock ? "bg-red-500" : "bg-black/40 backdrop-blur-sm"}`}>
                                                {stockQty.toFixed(0)} {p.unit}
                                            </div>
                                            {/* Cart selected indicator */}
                                            {inCart && (
                                                <div className="absolute top-2 left-2 w-7 h-7 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg z-20">
                                                    <Check className="h-4 w-4 text-white" />
                                                </div>
                                            )}
                                            {/* Category pill */}
                                            <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-white/25 backdrop-blur-sm text-[10px] font-semibold text-white z-20">
                                                {p.category ? p.category.charAt(0).toUpperCase() + p.category.slice(1) : "Outro"}
                                            </div>
                                        </div>
                                        {/* Product info */}
                                        <div className="p-3">
                                            <p className="font-bold text-sm leading-snug line-clamp-2 text-gray-800 group-hover:text-emerald-700 transition-colors min-h-[2.5rem]" title={p.name}>
                                                {p.name}
                                            </p>
                                            <div className="flex items-center justify-between mt-2">
                                                {p.dosePerHa ? (
                                                    <div className="flex items-center gap-1">
                                                        <Droplets className="h-3.5 w-3.5 text-blue-500" />
                                                        <span className="text-xs text-blue-500 font-semibold">{parseFloat(p.dosePerHa).toFixed(1)} {p.unit}/ha</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-gray-300">{p.unit || "—"}</span>
                                                )}
                                                {/* Mini stock bar */}
                                                <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${lowStock ? "bg-red-100 text-red-600" : "bg-emerald-50 text-emerald-600"}`}>
                                                    {lowStock ? "Sem estoque" : `${stockQty.toFixed(0)} disp.`}
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                        {filtered.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-20 text-gray-300">
                                <Search className="h-12 w-12 mb-4" />
                                <p className="text-base font-medium text-gray-400">Nenhum produto encontrado</p>
                                <p className="text-sm text-gray-300">Tente outro termo ou filtro</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT: Cart panel — wider & improved */}
                <div className="w-[480px] lg:w-[560px] bg-white border-l border-gray-100 flex flex-col shrink-0 hidden md:flex shadow-lg">
                    {/* Cart header with gradient */}
                    <div className="px-5 py-4 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <ShoppingCart className="h-5 w-5" />
                            <h3 className="font-bold text-base">Carrinho</h3>
                        </div>
                        {cart.length > 0 && (
                            <div className="flex items-center gap-2">
                                <span className="bg-white/25 backdrop-blur-sm text-white text-xs font-bold px-2.5 py-1 rounded-full">
                                    {cart.length} {cart.length === 1 ? "item" : "itens"}
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {cart.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full px-6">
                                <div className="w-20 h-20 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
                                    <ShoppingCart className="h-10 w-10 text-gray-200" />
                                </div>
                                <p className="text-gray-500 font-medium text-sm">Carrinho vazio</p>
                                <p className="text-gray-300 text-xs text-center mt-1.5 leading-relaxed">
                                    Clique nos produtos ao lado para adicioná-los ao carrinho de saída
                                </p>
                            </div>
                        ) : (
                            <div className="p-3 space-y-2">
                                {cart.map((item) => {
                                    const stk = getStockForProduct(item.product.id);
                                    const overStock = item.quantity > stk;
                                    return (
                                        <div key={item.product.id} className={`rounded-xl border p-3 transition-all ${overStock ? "border-red-200 bg-red-50/50" : "border-gray-100 bg-gray-50/50 hover:bg-gray-50"}`}>
                                            <div className="flex items-start gap-2.5 mb-2.5">
                                                {item.product.imageUrl ? (
                                                    <img src={item.product.imageUrl} className="w-11 h-11 rounded-lg object-contain bg-white border border-gray-100 shrink-0" alt="" />
                                                ) : (
                                                    <div className={`w-11 h-11 rounded-lg bg-gradient-to-br ${CATEGORY_COLORS[item.product.category] || CATEGORY_COLORS.outro} flex items-center justify-center shrink-0`}>
                                                        <span className="text-lg">{CATEGORY_EMOJI[item.product.category] || "📦"}</span>
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-sm leading-tight truncate text-gray-800">{item.product.name}</p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-[10px] text-gray-400">{item.product.category || "—"}</span>
                                                        <span className="text-[10px] text-gray-300">•</span>
                                                        <span className={`text-[10px] font-medium ${stk <= 0 ? "text-red-500" : "text-emerald-500"}`}>
                                                            Estoque: {stk.toFixed(0)} {item.product.unit}
                                                        </span>
                                                    </div>
                                                </div>
                                                <button onClick={() => removeFromCart(item.product.id)} className="text-gray-300 hover:text-red-500 shrink-0 p-0.5 transition-colors">
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                            {/* Quantity controls */}
                                            <div className="flex items-center gap-1.5">
                                                <button className="w-9 h-9 rounded-lg bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center shadow-sm transition-colors active:scale-95"
                                                    onClick={() => updateQuantity(item.product.id, item.quantity - 1)}>
                                                    <Minus className="h-3.5 w-3.5 text-white" />
                                                </button>
                                                <Input type="number" step="1" value={item.quantity}
                                                    onChange={(e) => updateQuantity(item.product.id, parseFloat(e.target.value) || 0)}
                                                    className="text-center text-base font-bold flex-1 h-9 bg-white border-gray-200 text-gray-800 rounded-lg" />
                                                <button className="w-9 h-9 rounded-lg bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center shadow-sm transition-colors active:scale-95"
                                                    onClick={() => updateQuantity(item.product.id, item.quantity + 1)}>
                                                    <Plus className="h-3.5 w-3.5 text-white" />
                                                </button>
                                                <span className="text-xs text-gray-400 w-10 text-center font-medium">{item.product.unit}</span>
                                            </div>
                                            {overStock && (
                                                <p className="text-[10px] text-red-500 font-medium mt-1.5 flex items-center gap-1">
                                                    ⚠️ Excede estoque disponível
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Cart footer */}
                    <div className="p-4 border-t border-gray-100 bg-gray-50/80 space-y-3">
                        {cart.length > 0 && (
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">{cart.length} produto(s)</span>
                                <span className="text-emerald-600 font-bold">{totalCartQty} unidades total</span>
                            </div>
                        )}
                        <Button
                            className="w-full py-5 text-base bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 font-bold rounded-xl shadow-md shadow-emerald-200 transition-all active:scale-[0.98]"
                            onClick={handleGoToPlot}
                            disabled={cart.length === 0}
                        >
                            <ArrowRight className="mr-2 h-5 w-5" />
                            Selecionar Talhões
                        </Button>
                    </div>
                </div>
            </div>


            {/* MOBILE bottom bar */}
            {cart.length > 0 && (
                <div className="md:hidden fixed bottom-0 left-0 right-0 p-3 bg-white/90 backdrop-blur-sm border-t border-gray-200 shadow-lg z-50">
                    <Sheet>
                        <SheetTrigger asChild>
                            <Button className="w-full py-5 text-base bg-gradient-to-r from-emerald-600 to-emerald-500 font-bold rounded-xl shadow-md">
                                <ShoppingCart className="mr-2 h-5 w-5" />
                                Ver Carrinho ({cart.length})
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="bottom" className="h-[80vh] rounded-t-3xl p-0 flex flex-col">
                            <SheetHeader className="p-5 border-b border-gray-100">
                                <SheetTitle className="flex items-center gap-2 text-emerald-800">
                                    <ShoppingCart className="h-5 w-5" />
                                    Seu Carrinho
                                </SheetTitle>
                            </SheetHeader>

                            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                {cart.map((item) => {
                                    const stk = getStockForProduct(item.product.id);
                                    const overStock = item.quantity > stk;
                                    return (
                                        <div key={item.product.id} className={`rounded-xl border p-3 ${overStock ? "border-red-200 bg-red-50/50" : "border-gray-100 bg-gray-50/50"}`}>
                                            <div className="flex items-start gap-3 mb-3">
                                                {item.product.imageUrl ? (
                                                    <img src={item.product.imageUrl} className="w-12 h-12 rounded-lg object-contain bg-white border border-gray-100 shrink-0" alt="" />
                                                ) : (
                                                    <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${CATEGORY_COLORS[item.product.category] || CATEGORY_COLORS.outro} flex items-center justify-center shrink-0`}>
                                                        <span className="text-xl">{CATEGORY_EMOJI[item.product.category] || "📦"}</span>
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-sm leading-tight text-gray-800 mb-1">{item.product.name}</p>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-[10px] font-medium ${stk <= 0 ? "text-red-500" : "text-emerald-500"}`}>
                                                            Estoque: {stk.toFixed(0)} {item.product.unit}
                                                        </span>
                                                    </div>
                                                </div>
                                                <button onClick={() => removeFromCart(item.product.id)} className="text-gray-300 hover:text-red-500 p-1">
                                                    <Trash2 className="h-5 w-5" />
                                                </button>
                                            </div>

                                            {/* Quantity controls */}
                                            <div className="flex items-center gap-2">
                                                <button className="w-10 h-10 rounded-xl bg-white border border-gray-200 text-emerald-600 flex items-center justify-center shadow-sm active:scale-95 touch-manipulation"
                                                    onClick={() => updateQuantity(item.product.id, item.quantity - 1)}>
                                                    <Minus className="h-5 w-5" />
                                                </button>
                                                <Input type="number" step="1" inputMode="numeric" value={item.quantity}
                                                    onChange={(e) => updateQuantity(item.product.id, parseFloat(e.target.value) || 0)}
                                                    className="text-center text-lg font-bold flex-1 h-10 bg-white border-gray-200 text-gray-800 rounded-xl" />
                                                <button className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm shadow-emerald-200 active:scale-95 touch-manipulation"
                                                    onClick={() => updateQuantity(item.product.id, item.quantity + 1)}>
                                                    <Plus className="h-5 w-5" />
                                                </button>
                                                <span className="text-xs text-gray-400 font-medium w-8 text-center">{item.product.unit}</span>
                                            </div>
                                            {overStock && <p className="text-xs text-red-500 mt-2 font-medium">⚠️ Quantidade excede estoque!</p>}
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="p-4 border-t border-gray-100 bg-gray-50/80 pb-8">
                                <div className="flex justify-between text-sm mb-3 px-1">
                                    <span className="text-gray-500">{cart.length} produto(s)</span>
                                    <span className="text-emerald-700 font-bold">{totalCartQty} unidades total</span>
                                </div>
                                <Button
                                    className="w-full py-6 text-base bg-gradient-to-r from-emerald-600 to-emerald-500 font-bold rounded-xl shadow-lg shadow-emerald-200"
                                    onClick={handleGoToPlot}
                                >
                                    Ir para Talhões
                                    <ArrowRight className="ml-2 h-5 w-5" />
                                </Button>
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            )}
        </div>
    );
}
