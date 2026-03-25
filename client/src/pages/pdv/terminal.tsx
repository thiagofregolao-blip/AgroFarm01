import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { Search, Check, ArrowLeft, ArrowRight, Minus, Plus, Loader2, LogOut, Wifi, WifiOff, ShoppingCart, Trash2, Droplets, MapPin, FileText, Share2, X, Tractor, Gauge, Eraser, PenTool, Camera } from "lucide-react";
import { generateReceituarioPDF, shareViaWhatsApp, downloadPDF, openPDF, type ReceituarioData } from "@/lib/pdf-receituario";
import { loadFaceModels, generateFaceEmbedding, findBestMatch } from "@/lib/face-recognition";

// ── Mini-mapa SVG gerado a partir das coordenadas do polígono do talhão ──────
function PlotMiniMap({ coordinates, selected }: { coordinates: string | null; selected: boolean }) {
    if (!coordinates) return (
        <div className={`w-full h-full flex items-center justify-center ${selected ? "bg-green-600/20" : "bg-gray-100"}`}>
            <MapPin className={`h-6 w-6 ${selected ? "text-green-600" : "text-gray-300"}`} />
        </div>
    );

    try {
        const pts: Array<{ lat: number; lng: number }> = JSON.parse(coordinates);
        if (!pts.length) throw new Error("empty");

        const lats = pts.map(p => p.lat);
        const lngs = pts.map(p => p.lng);
        const minLat = Math.min(...lats), maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
        const ranLat = maxLat - minLat || 0.0001;
        const ranLng = maxLng - minLng || 0.0001;

        const pad = 4;
        const W = 100, H = 100;
        const toX = (lng: number) => pad + ((lng - minLng) / ranLng) * (W - pad * 2);
        const toY = (lat: number) => pad + ((maxLat - lat) / ranLat) * (H - pad * 2);

        const points = pts.map(p => `${toX(p.lng).toFixed(1)},${toY(p.lat).toFixed(1)}`).join(" ");

        return (
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
                <polygon
                    points={points}
                    fill={selected ? "rgba(22,163,74,0.35)" : "rgba(156,163,175,0.25)"}
                    stroke={selected ? "#16a34a" : "#9ca3af"}
                    strokeWidth="3"
                    strokeLinejoin="round"
                />
            </svg>
        );
    } catch {
        return (
            <div className={`w-full h-full flex items-center justify-center ${selected ? "bg-green-600/20" : "bg-gray-100"}`}>
                <MapPin className={`h-6 w-6 ${selected ? "text-green-600" : "text-gray-300"}`} />
            </div>
        );
    }
}

// ── Header branco unificado (estilo landing page) ──────────────────────────────
function PDVTopBar({
    step, title, onBack, rightBadge,
    isOnline, withdrawalsHistory, handleRegenerateReceituario, handleLogout, toast,
}: {
    step: string; title: string; onBack?: () => void; rightBadge?: React.ReactNode;
    isOnline: boolean; withdrawalsHistory: any;
    handleRegenerateReceituario: (batch: any) => void;
    handleLogout: () => void;
    toast: (opts: any) => void;
}) {
    const STEPS = ["season", "plot", "product_select", "dose", "cart_review", "equipment", "confirm"];
    const LABELS = ["Safra", "Talhões", "Produtos", "Doses", "Carrinho", "Pulverizador", "Confirmar"];
    const ICONS = ["🌱", "📍", "📦", "💧", "🛒", "🚜", "✅"];
    const idx = STEPS.indexOf(step);

    return (
        <header className="shrink-0" style={{ paddingTop: "max(env(safe-area-inset-top), 0px)" }}>
            {/* ── White navbar (igual landing page) ── */}
            <div className="bg-white/95 backdrop-blur-md shadow-[0_2px_20px_rgba(0,0,0,0.07)]">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-[64px] md:h-[76px]">
                    {/* Left: back + logo */}
                    <div className="flex items-center gap-3">
                        {onBack && (
                            <button onClick={onBack}
                                className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center hover:bg-gray-100 active:scale-95 shrink-0">
                                <ArrowLeft className="h-4 w-4 text-gray-600" />
                            </button>
                        )}
                        <div className="flex items-center gap-2.5">
                            <img src="/icon-datagrow.png" alt="" className="h-10 md:h-12 w-auto object-contain" />
                            <div className="flex flex-col leading-none">
                                <span className="font-black tracking-tight text-xl md:text-2xl" style={{ lineHeight: 1.05 }}>
                                    <span style={{ color: "#024177" }}>Data</span><span style={{ color: "#215F30" }}>Grow</span>
                                </span>
                                <span className="font-semibold tracking-widest uppercase hidden sm:block" style={{ fontSize: "0.5rem", color: "#555", letterSpacing: "0.14em" }}>
                                    Seus dados. Seu crescimento.
                                </span>
                            </div>
                        </div>
                    </div>
                    {/* Right: online status + receituários + logout */}
                    <div className="flex items-center gap-2">
                        {!isOnline && (
                            <span className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full border border-red-200 font-medium">Offline</span>
                        )}
                        {rightBadge}
                        <Sheet>
                            <SheetTrigger asChild>
                                <button className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center hover:bg-gray-100 relative" aria-label="Ver receituários">
                                    <FileText className="h-4 w-4 text-gray-500" />
                                    {withdrawalsHistory?.length > 0 && (
                                        <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-green-700 rounded-full text-[8px] font-bold text-white flex items-center justify-center">
                                            {Math.min(withdrawalsHistory.length, 9)}
                                        </span>
                                    )}
                                </button>
                            </SheetTrigger>
                            <SheetContent side="right" className="w-[340px] sm:w-[400px] p-0 flex flex-col">
                                <SheetHeader className="p-5 border-b border-gray-100 bg-green-800 text-white">
                                    <SheetTitle className="flex items-center gap-2 text-white">
                                        <FileText className="h-5 w-5" /> Receituários
                                    </SheetTitle>
                                    <SheetDescription className="text-green-200 text-xs">
                                        Clique para abrir ou compartilhar
                                    </SheetDescription>
                                </SheetHeader>
                                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                                    {withdrawalsHistory?.length > 0 ? (
                                        withdrawalsHistory.slice(0, 20).map((batch: any) => (
                                            <div key={batch.batchId} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                                                <div className="mb-2">
                                                    <span className="text-[10px] text-gray-400 font-medium">
                                                        {new Date(batch.appliedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                                                    </span>
                                                    <p className="text-sm font-bold text-gray-800 mt-0.5 line-clamp-1">{batch.propertyName || "Propriedade"}</p>
                                                    <p className="text-xs text-emerald-600 font-medium">{batch.applications.length} produto(s) aplicado(s)</p>
                                                    {batch.applications[0]?.seasonName && (
                                                        <p className="text-[10px] text-gray-400 mt-0.5">🌱 {batch.applications[0].seasonName}</p>
                                                    )}
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button size="sm" variant="outline"
                                                        className="flex-1 text-xs h-8 border-gray-200 hover:border-green-400 hover:text-green-700 hover:bg-green-50"
                                                        onClick={() => handleRegenerateReceituario(batch)}>
                                                        <FileText className="h-3 w-3 mr-1.5" /> Abrir PDF
                                                    </Button>
                                                    <Button size="sm" variant="outline"
                                                        className="h-8 px-3 border-gray-200 hover:border-blue-400 hover:text-blue-700 hover:bg-blue-50"
                                                        onClick={async () => {
                                                            try {
                                                                const productsByProduct = new Map<string, any>();
                                                                batch.applications.forEach((app: any) => {
                                                                    if (!productsByProduct.has(app.productName)) productsByProduct.set(app.productName, { productName: app.productName, unit: app.unit || "L", plots: [] });
                                                                    productsByProduct.get(app.productName)!.plots.push({ plotName: app.plotName, quantity: parseFloat(app.quantity) });
                                                                });
                                                                const pdfBlob = generateReceituarioPDF({ propertyName: batch.propertyName || "Propriedade", appliedAt: new Date(batch.appliedAt), products: Array.from(productsByProduct.values()) });
                                                                shareViaWhatsApp(pdfBlob, `receituario_${new Date(batch.appliedAt).toLocaleDateString("pt-BR").replace(/\//g, "-")}.pdf`);
                                                            } catch { toast({ title: "Erro ao compartilhar", variant: "destructive" }); }
                                                        }}>
                                                        <Share2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-16 text-gray-400">
                                            <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
                                            <p className="text-sm font-medium">Nenhum receituário</p>
                                            <p className="text-xs mt-1">As saídas aparecerão aqui</p>
                                        </div>
                                    )}
                                </div>
                            </SheetContent>
                        </Sheet>
                        <button onClick={handleLogout}
                            className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center hover:bg-gray-100 active:scale-95"
                            aria-label="Sair">
                            <LogOut className="h-4 w-4 text-gray-500" />
                        </button>
                    </div>
                </div>
            </div>
            {/* ── Horizontal step bar (blue background, labels below numbers) ── */}
            <div className="bg-[#3B82F6] border-b border-blue-600">
                <div className="max-w-6xl mx-auto px-3 sm:px-6 py-3">
                    <div className="flex items-start justify-between">
                        {STEPS.map((s, i) => {
                            const isPast = i < idx;
                            const isCurrent = i === idx;
                            return (
                                <div key={s} className="flex items-center flex-1 min-w-0">
                                    <div className="flex flex-col items-center w-full">
                                        <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0 text-[10px] sm:text-xs font-bold transition-all ${
                                            isCurrent ? "bg-white text-blue-600 ring-2 ring-white/40 ring-offset-2 ring-offset-blue-500" : isPast ? "bg-emerald-400 text-white" : "bg-blue-400/50 text-blue-200"
                                        }`}>
                                            {isPast ? <Check className="h-3.5 w-3.5" /> : i + 1}
                                        </div>
                                        <span className={`text-[9px] sm:text-[10px] font-medium mt-1 truncate text-center leading-tight ${
                                            isCurrent ? "text-white font-semibold" : isPast ? "text-blue-100" : "text-blue-300"
                                        }`}>
                                            {LABELS[i]}
                                        </span>
                                    </div>
                                    {i < STEPS.length - 1 && (
                                        <div className={`h-px flex-shrink-0 w-full max-w-[40px] mx-0 mt-3.5 sm:mt-4 ${isPast ? "bg-emerald-400" : "bg-blue-400/40"}`} />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </header>
    );
}

interface CartItem {
    product: any;
    quantity: number | string;
    dosePerHa?: number | string;
    packageSize?: number;
}

// ==================== SIGNATURE CANVAS COMPONENT ====================
function SignatureCanvas({ onSignatureChange }: { onSignatureChange: (dataUrl: string | null) => void }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawingRef = useRef(false);
    const lastPointRef = useRef<{ x: number; y: number } | null>(null);
    const [hasSigned, setHasSigned] = useState(false);

    const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY,
            pressure: e.pressure || 0.5,
        };
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.setPointerCapture(e.pointerId);
        isDrawingRef.current = true;
        const pt = getPoint(e);
        lastPointRef.current = { x: pt.x, y: pt.y };
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!isDrawingRef.current || !canvasRef.current) return;
        e.preventDefault();
        const ctx = canvasRef.current.getContext("2d")!;
        const pt = getPoint(e);
        const last = lastPointRef.current;
        if (!last) return;

        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(pt.x, pt.y);
        ctx.strokeStyle = "#1a1a2e";
        ctx.lineWidth = Math.max(1.2, pt.pressure * 3.5);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();

        lastPointRef.current = { x: pt.x, y: pt.y };
        if (!hasSigned) setHasSigned(true);
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
        isDrawingRef.current = false;
        lastPointRef.current = null;
        if (canvasRef.current && hasSigned) {
            onSignatureChange(canvasRef.current.toDataURL("image/png"));
        }
    };

    useEffect(() => {
        if (hasSigned && canvasRef.current) {
            onSignatureChange(canvasRef.current.toDataURL("image/png"));
        }
    }, [hasSigned]);

    const clearSignature = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d")!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasSigned(false);
        onSignatureChange(null);
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-gray-400 text-xs">
                    <PenTool className="h-3.5 w-3.5" />
                    <span>Assine com a caneta no campo abaixo</span>
                </div>
                {hasSigned && (
                    <button onClick={clearSignature} className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors">
                        <Eraser className="h-3.5 w-3.5" /> Limpar
                    </button>
                )}
            </div>
            <div className="relative rounded-xl border-2 border-dashed border-gray-600 bg-white overflow-hidden" style={{ touchAction: "none" }}>
                <canvas
                    ref={canvasRef}
                    width={600}
                    height={200}
                    className="w-full"
                    style={{ height: 150, cursor: "crosshair" }}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                />
                {!hasSigned && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <span className="text-gray-300 text-lg italic select-none">Assinatura</span>
                    </div>
                )}
            </div>
        </div>
    );
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

    const [step, setStep] = useState<"season" | "plot" | "product_select" | "dose" | "cart_review" | "equipment" | "confirm">("season");
    const [search, setSearch] = useState("");
    const [cart, setCart] = useState<CartItem[]>([]);
    const [selectedPlots, setSelectedPlots] = useState<any[]>([]);
    const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [categoryFilter, setCategoryFilter] = useState<string>("");
    const [distOverrides, setDistOverrides] = useState<Record<string, number>>({});

    const [instructions, setInstructions] = useState<string>("");
    const [offlineQueue, setOfflineQueue] = useState<any[]>([]);

    const [selectedEquipment, setSelectedEquipment] = useState<any>(null);
    const [horimeter, setHorimeter] = useState<string>("");
    const [odometer, setOdometer] = useState<string>("");
    const [flowRateLha, setFlowRateLha] = useState<string>("");
    const [depositFilter, setDepositFilter] = useState<string>("");

    // Novo fluxo PDV: seleção múltipla + dose por produto
    const [pendingProducts, setPendingProducts] = useState<any[]>([]); // produtos selecionados aguardando dose
    const [doseIndex, setDoseIndex] = useState<number>(0);
    const [currentDose, setCurrentDose] = useState<string>("");

    // Load offline queue on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem("pdv_offline_queue");
            if (saved) setOfflineQueue(JSON.parse(saved));
        } catch { }
    }, []);

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
        refetchInterval: 10000,
        // Try to initialize from localStorage as fallback
        initialData: () => {
            try {
                const cached = localStorage.getItem("pdvData");
                if (cached) return JSON.parse(cached);
            } catch { }
            return undefined;
        },
    });

    // Cache pdvData to localStorage on success
    useEffect(() => {
        if (pdvData) {
            localStorage.setItem("pdvData", JSON.stringify(pdvData));
        }
    }, [pdvData]);

    // Redirect to login if totally unauthenticated (unless offline and cached)
    useEffect(() => {
        if (pdvError && !localStorage.getItem("pdvData")) {
            setLocation("/pdv/login");
        }
    }, [pdvError, setLocation]);

    const handleLogout = async () => {
        localStorage.removeItem("pdvData");
        localStorage.removeItem("pdvToken");
        localStorage.removeItem("pdvTerminalId");
        await apiRequest("POST", "/api/logout"); // End global session just in case
        setLocation("/pdv/login");
    };

    // Query para histórico de saídas (Moved to top level to avoid Hook rules violation)
    const { data: withdrawalsHistory } = useQuery({
        queryKey: ["/api/pdv/withdrawals"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/pdv/withdrawals");
            if (!res.ok) throw new Error("Failed to fetch withdrawals");
            return res.json();
        },
        enabled: step === "season" || step === "product_select",
        refetchInterval: 30000,
    });

    // Employee face embeddings for client-side recognition
    const { data: employeeEmbeddings } = useQuery({
        queryKey: ["/api/pdv/employee-embeddings"],
        queryFn: async () => {
            console.log("[PDV] Fetching employee embeddings...");
            const res = await apiRequest("GET", "/api/pdv/employee-embeddings");
            if (!res.ok) throw new Error("Failed to fetch embeddings");
            const data = await res.json();
            console.log("[PDV] Employee embeddings loaded:", data?.length || 0, "employees");
            if (data?.length > 0) {
                try { localStorage.setItem("pdv_employee_embeddings", JSON.stringify(data)); } catch {}
            }
            return data;
        },
        staleTime: 60 * 1000,
        refetchOnMount: "always",
        placeholderData: () => {
            try {
                const cached = JSON.parse(localStorage.getItem("pdv_employee_embeddings") || "[]");
                return cached.length > 0 ? cached : undefined;
            } catch { return undefined; }
        },
    });

    const allStock = pdvData?.stock || [];
    const deposits = pdvData?.deposits || [];
    const plots = pdvData?.plots || [];
    const hasDeposits = deposits.length > 0;

    // Filter stock by selected deposit (or show all if no deposits exist)
    const stock = useMemo(() => {
        if (!hasDeposits || !depositFilter) return allStock;
        if (depositFilter === "__no_deposit__") return allStock.filter((s: any) => !s.depositId);
        return allStock.filter((s: any) => s.depositId === depositFilter);
    }, [allStock, depositFilter, hasDeposits]);

    // Derive products from filtered stock
    const products = useMemo(() => {
        const seen = new Set<string>();
        return stock.filter((s: any) => {
            if (seen.has(s.productId)) return false;
            seen.add(s.productId);
            return true;
        }).map((s: any) => ({
            id: s.productId,
            name: s.productName,
            category: s.productCategory,
            unit: s.productUnit,
            imageUrl: s.productImageUrl || null,
            dosePerHa: s.productDosePerHa || null,
        }));
    }, [stock]);

    const getStockForProduct = (productId: string) => {
        // Sum stock across all matching entries (product may exist in multiple deposits)
        return stock
            .filter((s: any) => s.productId === productId)
            .reduce((sum: number, s: any) => sum + (parseFloat(s.quantity) || 0), 0);
    };

    const categories = Array.from(new Set(products.map((p: any) => p.category).filter(Boolean))) as string[];

    const isDiesel = pdvData?.terminal?.type === "diesel";

    const filtered = products.filter((p: any) => {
        const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
        const matchesCategory = !categoryFilter || p.category === categoryFilter;
        // Terminal diesel: só mostra combustível. Terminal insumos: esconde combustível
        if (isDiesel) {
            const isFuel = p.category === "Combustível" || p.name.toLowerCase().includes("diesel");
            if (!isFuel) return false;
        } else {
            const isFuel = p.category === "Combustível" || p.name.toLowerCase().includes("diesel");
            if (isFuel) return false;
        }
        return matchesSearch && matchesCategory;
    });

    const isInCart = (productId: string) => cart.some(c => c.product.id === productId);

    const addToCart = (product: any) => {
        if (isInCart(product.id)) {
            // Toggle: remove from cart if already there
            setCart(cart.filter(c => c.product.id !== product.id));
            return;
        }
        const stockQty = getStockForProduct(product.id);
        if (stockQty <= 0) return; // Block adding products with no stock
        setCart([...cart, {
            product,
            quantity: 1,
            dosePerHa: product.dosePerHa ? parseFloat(product.dosePerHa) : undefined
        }]);
    };

    const updateQuantity = (productId: string, qty: number | string) => {
        let numericQty = typeof qty === 'string' ? parseFloat(qty.replace(',', '.')) : qty;
        if (isNaN(numericQty) || numericQty < 0) numericQty = 0;
        const stockQty = getStockForProduct(productId);
        if (numericQty > stockQty) qty = stockQty.toString(); // Cap at available stock but allow string holding
        setCart(cart.map(c => c.product.id === productId ? { ...c, quantity: qty } : c));
    };

    const updateDose = (productId: string, dose: number | string) => {
        const normalized = typeof dose === 'string' ? dose.replace(',', '.') : dose;
        setCart(cart.map(c => c.product.id === productId ? { ...c, dosePerHa: normalized } : c));
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

    const parseBR = (v: any) => {
        if (v === undefined || v === null || v === '') return NaN;
        const s = String(v).replace(',', '.');
        return parseFloat(s);
    };

    const getDistribution = (item: CartItem) => {
        const dose = item.dosePerHa !== undefined && item.dosePerHa !== '' ? parseBR(item.dosePerHa) : parseBR(item.product.dosePerHa);
        const totalQty = parseBR(item.quantity) || 0;

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
            const dist = getDistribution(item);
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
        const invalid = cart.filter(c => Number(c.quantity) <= 0);
        if (invalid.length > 0) {
            toast({ title: "Informe a quantidade para todos os produtos", variant: "destructive" });
            return;
        }
        setStep("plot");
    };

    const handleGoToConfirm = () => {
        if (isDiesel) {
            if (!selectedEquipment) {
                toast({ title: "Selecione a máquina/veículo", variant: "destructive" });
                return;
            }
            setDistOverrides({});
            // Diesel also needs season selection
            const seasons = pdvData?.seasons || [];
            if (seasons.length > 0) {
                setStep("season");
            } else {
                setStep("confirm");
            }
        } else {
            if (selectedPlots.length === 0) {
                toast({ title: "Selecione pelo menos um talhão", variant: "destructive" });
                return;
            }
            setDistOverrides({});
            // Go to season selection before equipment
            const seasons = pdvData?.seasons || [];
            if (seasons.length > 0) {
                setStep("season");
            } else {
                setStep("equipment");
            }
        }
    };

    const handleGoFromEquipment = () => {
        setDistOverrides({});
        setStep("confirm");
    };

    // ── Novo fluxo: produto_select → dose → cart_review ──
    const handleGoFromSeason = () => setStep("plot");

    const handleGoFromPlot = () => {
        if (selectedPlots.length === 0) {
            toast({ title: "Selecione pelo menos um talhão", variant: "destructive" });
            return;
        }
        setStep("product_select");
    };

    const handleStartDoseEntry = () => {
        if (pendingProducts.length === 0) {
            toast({ title: "Selecione pelo menos um produto", variant: "destructive" });
            return;
        }
        setDoseIndex(0);
        const first = pendingProducts[0];
        const defaultDose = first.dosePerHa ? String(parseBR(first.dosePerHa)) : "";
        setCurrentDose(defaultDose);
        setStep("dose");
    };

    const handleConfirmDose = () => {
        const product = pendingProducts[doseIndex];
        const dose = parseBR(currentDose);
        if (isNaN(dose) || dose <= 0) {
            toast({ title: "Informe uma dose válida", variant: "destructive" });
            return;
        }
        const qty = Math.round(dose * totalAreaSelected * 10000) / 10000;
        setCart(prev => {
            const exists = prev.findIndex(c => c.product.id === product.id);
            const cartItem: CartItem = {
                product,
                quantity: qty,
                dosePerHa: dose,
                packageSize: product.packageSize || null,
            };
            if (exists >= 0) return prev.map((c, i) => i === exists ? cartItem : c);
            return [...prev, cartItem];
        });
        const nextIdx = doseIndex + 1;
        if (nextIdx < pendingProducts.length) {
            setDoseIndex(nextIdx);
            const next = pendingProducts[nextIdx];
            setCurrentDose(next.dosePerHa ? String(parseBR(next.dosePerHa)) : "");
        } else {
            setPendingProducts([]);
            setStep("cart_review");
        }
    };

    const handleGoFromCartReview = () => {
        if (cart.length === 0) {
            toast({ title: "Adicione pelo menos um produto", variant: "destructive" });
            return;
        }
        const sprayers = (pdvData?.equipment || []).filter((e: any) => e.type === "Pulverizador" && (e.status === "Ativo" || !e.status));
        setStep(sprayers.length > 0 ? "equipment" : "confirm");
    };

    const isProductInCart = (productId: string) => cart.some(c => c.product.id === productId);
    const isProductPending = (productId: string) => pendingProducts.some(p => p.id === productId);

    const togglePendingProduct = (product: any) => {
        if (isProductInCart(product.id)) {
            // Remove from cart when tapped again
            setCart(prev => prev.filter(c => c.product.id !== product.id));
            return;
        }
        setPendingProducts(prev => {
            const exists = prev.findIndex(p => p.id === product.id);
            if (exists >= 0) return prev.filter(p => p.id !== product.id);
            return [...prev, product];
        });
    };

    // Helper to generate PDF from application list (shared between online/offline)
    const generatePDFOutput = (applications: any[], openInNewTab: boolean) => {
        const properties = pdvData?.properties || [];
        const firstProperty = properties.find((p: any) =>
            applications.some((app: any) => app.propertyId === p.id)
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
            plots: selectedPlots.map((p: any) => ({
                plotName: p.name,
                areaHa: parseFloat(p.areaHa) || 0,
                crop: p.crop || undefined,
                coordinates: p.coordinates || undefined,
            })),
            equipment: selectedEquipment ? {
                name: selectedEquipment.name,
                tankCapacityL: selectedEquipment.tankCapacityL ? parseFloat(selectedEquipment.tankCapacityL) : undefined,
            } : undefined,
            flowRateLha: flowRateLha ? parseFloat(flowRateLha) : undefined,
        };

        // Gerar PDF
        const pdfBlob = generateReceituarioPDF(pdfData);

        if (openInNewTab) {
            // Abrir PDF diretamente em nova aba
            openPDF(pdfBlob);
            toast({
                title: "Receituário gerado",
                description: "O arquivo foi aberto em uma nova aba."
            });
        } else {
            // Detectar mobile/PWA - abrir em vez de download silencioso
            const isMobile = window.innerWidth < 768 ||
                window.matchMedia('(display-mode: standalone)').matches ||
                (navigator as any).standalone === true;

            if (isMobile) {
                // No mobile/PWA, abrir o PDF para o agricultor ver imediatamente
                openPDF(pdfBlob);
                toast({
                    title: "Receituário gerado",
                    description: "O arquivo foi aberto para visualização."
                });
            } else {
                // Desktop: download silencioso
                downloadPDF(pdfBlob);
                toast({
                    title: "Receituário gerado automaticamente",
                    description: "O PDF foi baixado automaticamente. Você pode consultá-lo no histórico de saídas."
                });
            }
        }
    };

    const processOfflineQueue = async () => {
        if (!isOnline || offlineQueue.length === 0) return;

        const queue = [...offlineQueue];
        const failed: any[] = [];
        let successCount = 0;

        setSubmitting(true);
        try {
            for (const item of queue) {
                try {
                    await apiRequest("POST", "/api/pdv/withdraw", item.payload);
                    successCount++;
                } catch (e) {
                    console.error("Failed to sync item", item, e);
                    failed.push(item);
                }
            }

            setOfflineQueue(failed);
            localStorage.setItem("pdv_offline_queue", JSON.stringify(failed));

            if (successCount > 0) {
                toast({ title: `♻️ ${successCount} saídas sincronizadas!` });
                queryClient.invalidateQueries({ queryKey: ["/api/pdv/withdrawals"] });
                queryClient.invalidateQueries({ queryKey: ["/api/pdv/data"] });
            }
            if (failed.length > 0) {
                toast({ title: `⚠️ ${failed.length} falharam ao sincronizar. Tente novamente.`, variant: "destructive" });
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleSubmit = async (generatePDF = false) => {
        setSubmitting(true);
        try {
            let count = 0;
            const applications: Array<{ productId: string; plotId: string; quantity: number; propertyId?: string; plotName: string; productName: string; dosePerHa?: number; unit: string }> = [];

            // Prepare payloads first
            const payloads: any[] = [];

            for (const item of confirmationData) {
                const cartItem = cart.find(c => c.product.id === item.product.id);
                const appliedDose = cartItem?.dosePerHa !== undefined && cartItem?.dosePerHa !== ''
                    ? parseBR(cartItem.dosePerHa) : parseBR(item.product.dosePerHa);
                const validDose = !isNaN(appliedDose) && appliedDose > 0 ? appliedDose : undefined;

                for (const d of item.distribution) {
                    if (d.allocatedQty <= 0) continue;
                    const plot = selectedPlots.find(p => p.id === d.plotId);

                    const payload = isDiesel ? {
                        productId: item.product.id,
                        quantity: d.allocatedQty,
                        equipmentId: selectedEquipment?.id || null,
                        horimeter: horimeter || null,
                        odometer: odometer || null,
                        notes: count === 0 ? instructions : undefined,
                        dosePerHa: validDose,
                        seasonId: selectedSeasonId || null,
                    } : {
                        productId: item.product.id,
                        quantity: d.allocatedQty,
                        plotId: d.plotId,
                        propertyId: plot?.propertyId,
                        notes: count === 0 ? instructions : undefined,
                        dosePerHa: validDose,
                        equipmentId: selectedEquipment?.id || null,
                        flowRateLha: flowRateLha ? parseFloat(flowRateLha) : null,
                        seasonId: selectedSeasonId || null,
                    };
                    payloads.push(payload);

                    if (isOnline) {
                        await apiRequest("POST", "/api/pdv/withdraw", payload);
                    }

                    applications.push({
                        productId: item.product.id,
                        plotId: d.plotId,
                        quantity: d.allocatedQty,
                        propertyId: plot?.propertyId,
                        plotName: d.plotName,
                        productName: item.product.name,
                        dosePerHa: validDose,
                        unit: item.product.unit,
                    });
                    count++;
                }
            }

            if (!isOnline) {
                // Queue all payloads
                const queueItems = payloads.map(p => ({ payload: p, timestamp: Date.now() }));
                const newQueue = [...offlineQueue, ...queueItems];
                setOfflineQueue(newQueue);
                localStorage.setItem("pdv_offline_queue", JSON.stringify(newQueue));
                toast({ title: "📡 Sem internet: Salvo para envio posterior", description: "Sincronize quando retomar conexão." });
            } else {
                toast({ title: `✅ ${count} saída(s) registrada(s) com sucesso!` });
                queryClient.invalidateQueries({ queryKey: ["/api/pdv/data"] });
                queryClient.invalidateQueries({ queryKey: ["/api/pdv/withdrawals"] });
            }

            // Gerar PDF se solicitado ou automaticamente após confirmar (opção b)
            if (applications.length > 0) {
                generatePDFOutput(applications, generatePDF);
            }

            reset();
        } catch (err) {
            toast({ title: "Erro ao registrar saída", variant: "destructive" });
        } finally {
            setSubmitting(false);
        }
    };

    const reset = () => {
        setStep("season");
        setCart([]);
        setPendingProducts([]);
        setDoseIndex(0);
        setCurrentDose("");
        setSelectedPlots([]);
        setSelectedSeasonId(null);
        setSearch("");
        setCategoryFilter("");
        setDistOverrides({});
        setSelectedEquipment(null);
        setHorimeter("");
        setOdometer("");
        setFlowRateLha("");
    };

    const handleRegenerateReceituario = async (batch: any) => {
        try {
            const properties = pdvData?.properties || [];
            const firstProperty = properties.find((p: any) =>
                batch.applications.some((app: any) => app.propertyId === p.id)
            ) || properties[0];

            const productsByProduct = new Map<string, { productName: string; dosePerHa?: number; unit: string; plots: Array<{ plotName: string; quantity: number }> }>();
            const pdvProducts = pdvData?.products || [];

            // Collect unique plots and equipment info from applications
            const plotsMap = new Map<string, { plotName: string; areaHa: number; crop?: string; coordinates?: string }>();
            let batchFlowRate: number | undefined;
            let batchEquipment: { name: string; tankCapacityL?: number } | undefined;

            batch.applications.forEach((app: any) => {
                const productInfo = pdvProducts.find((p: any) => p.id === app.productId || p.name === app.productName);
                const storedDose = app.dosePerHa ? parseFloat(app.dosePerHa) : undefined;
                const fallbackDose = productInfo?.dosePerHa ? parseFloat(productInfo.dosePerHa) : undefined;
                const dosePerHa = storedDose || fallbackDose;

                if (!productsByProduct.has(app.productName)) {
                    productsByProduct.set(app.productName, {
                        productName: app.productName,
                        dosePerHa,
                        unit: productInfo?.unit || "L",
                        plots: [],
                    });
                }
                const product = productsByProduct.get(app.productName)!;
                if (!product.dosePerHa && dosePerHa) product.dosePerHa = dosePerHa;
                const existingPlot = product.plots.find(p => p.plotName === app.plotName);
                if (existingPlot) {
                    existingPlot.quantity += parseFloat(app.quantity);
                } else {
                    product.plots.push({
                        plotName: app.plotName,
                        quantity: parseFloat(app.quantity),
                    });
                }

                // Collect plot info
                if (app.plotName && app.plotAreaHa && !plotsMap.has(app.plotName)) {
                    plotsMap.set(app.plotName, {
                        plotName: app.plotName,
                        areaHa: parseFloat(app.plotAreaHa) || 0,
                        crop: app.plotCrop || undefined,
                        coordinates: app.plotCoordinates || undefined,
                    });
                }

                // Collect equipment & flow rate (same for all apps in batch)
                if (!batchFlowRate && app.flowRateLha) batchFlowRate = parseFloat(app.flowRateLha);
                if (!batchEquipment && app.equipmentName) {
                    batchEquipment = {
                        name: app.equipmentName,
                        tankCapacityL: app.equipmentTankCapacityL ? parseFloat(app.equipmentTankCapacityL) : undefined,
                    };
                }
            });

            const productsWithDetails = Array.from(productsByProduct.values());

            const pdfData: ReceituarioData = {
                propertyName: firstProperty?.name || batch.propertyName || "Propriedade",
                appliedAt: new Date(batch.appliedAt),
                instructions: batch.notes || undefined,
                products: productsWithDetails,
                plots: plotsMap.size > 0 ? Array.from(plotsMap.values()) : undefined,
                equipment: batchEquipment,
                flowRateLha: batchFlowRate,
            };

            const pdfBlob = generateReceituarioPDF(pdfData);
            openPDF(pdfBlob);
            toast({ title: "Receituário aberto em nova aba" });
        } catch (error) {
            toast({ title: "Erro ao gerar receituário", variant: "destructive" });
        }
    };

    const totalCartQty = cart.reduce((sum, c) => sum + (Number(c.quantity) || 0), 0);

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

    // ==================== DIESEL PDV: DEDICATED FUEL PUMP INTERFACE ====================
    if (isDiesel) {
        const equipment = pdvData?.equipment || [];
        // Find diesel stock: look for products with category "Combustível" or name containing "diesel"
        const dieselProduct = products.find((p: any) =>
            p.category?.toLowerCase() === "combustível" ||
            p.name?.toLowerCase().includes("diesel") ||
            p.name?.toLowerCase().includes("óleo diesel")
        );
        const dieselStock = dieselProduct ? getStockForProduct(dieselProduct.id) : 0;
        const dieselUnit = dieselProduct?.unit || "LT";

        const [dieselQty, setDieselQty] = useState<string>("");
        const [dieselEquip, setDieselEquip] = useState<any>(null);
        const [dieselKm, setDieselKm] = useState<string>("");
        const [dieselHours, setDieselHours] = useState<string>("");
        const [dieselNotes, setDieselNotes] = useState<string>("");
        const [dieselSubmitting, setDieselSubmitting] = useState(false);
        const [showReceiptModal, setShowReceiptModal] = useState(false);
        const [signatureData, setSignatureData] = useState<string | null>(null);
        const [viewReceipt, setViewReceipt] = useState<any>(null);
        const [loadingReceipt, setLoadingReceipt] = useState<string | null>(null);
        const [recognizedEmployee, setRecognizedEmployee] = useState<{ name: string; role?: string; signatureBase64?: string } | null>(null);
        const [recognizing, setRecognizing] = useState(false);
        const [showCamera, setShowCamera] = useState(false);
        const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
        const videoRef = useRef<HTMLVideoElement>(null);
        const streamRef = useRef<MediaStream | null>(null);

        const parsedQty = parseFloat(dieselQty) || 0;
        const stockAfter = dieselStock - parsedQty;
        const stockPercent = dieselProduct ? Math.max(0, Math.min(100, (dieselStock / Math.max(dieselStock, 1)) * 100)) : 0;

        // Open receipt modal for signature
        const handleOpenReceipt = () => {
            if (!dieselEquip) { toast({ title: "Selecione o veículo/máquina", variant: "destructive" }); return; }
            if (parsedQty <= 0) { toast({ title: "Informe a quantidade de diesel", variant: "destructive" }); return; }
            if (parsedQty > dieselStock) { toast({ title: "Quantidade excede o estoque disponível", variant: "destructive" }); return; }
            if (!dieselProduct) { toast({ title: "Nenhum produto diesel encontrado no estoque", variant: "destructive" }); return; }
            setSignatureData(null);
            setRecognizedEmployee(null);
            setCapturedPhoto(null);
            setShowReceiptModal(true);
        };

        // Start camera for face recognition
        const startCamera = async () => {
            setShowCamera(true);
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 640, height: 480 } });
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.play();
                }
            } catch (err) {
                toast({ title: "Erro ao acessar câmera", description: "Verifique as permissões do navegador", variant: "destructive" });
                setShowCamera(false);
            }
        };

        const stopCamera = () => {
            streamRef.current?.getTracks().forEach(t => t.stop());
            streamRef.current = null;
            setShowCamera(false);
        };

        const captureAndRecognize = async () => {
            if (!videoRef.current) return;
            const canvas = document.createElement("canvas");
            canvas.width = videoRef.current.videoWidth || 640;
            canvas.height = videoRef.current.videoHeight || 480;
            const ctx = canvas.getContext("2d")!;
            ctx.drawImage(videoRef.current, 0, 0);
            const photoData = canvas.toDataURL("image/jpeg", 0.8);
            setCapturedPhoto(photoData);
            stopCamera();

            // Client-side face recognition with face-api.js
            setRecognizing(true);
            try {
                await loadFaceModels();
                const descriptor = await generateFaceEmbedding(photoData);
                if (!descriptor) {
                    toast({ title: "Nenhum rosto detectado", description: "Tente novamente com boa iluminação", variant: "destructive" });
                    return;
                }
                if (!employeeEmbeddings?.length) {
                    toast({ title: "Nenhum funcionário com face cadastrada", description: "Cadastre funcionários com foto primeiro", variant: "destructive" });
                    return;
                }
                const match = findBestMatch(descriptor, employeeEmbeddings, 0.6);
                if (match) {
                    const emp = employeeEmbeddings.find((e: any) => e.id === match.matchedId);
                    setRecognizedEmployee({ name: match.matchedName, role: emp?.role, signatureBase64: emp?.signatureBase64 });
                    // Use employee's signature if available, otherwise use "face-recognized" marker
                    setSignatureData(emp?.signatureBase64 || "face-recognized");
                    toast({ title: `Funcionário identificado: ${match.matchedName}` });
                } else {
                    toast({ title: "Funcionário não reconhecido", description: "Use a assinatura manual abaixo", variant: "destructive" });
                }
            } catch (err) {
                console.error("[FACE_RECOGNITION]", err);
                toast({ title: "Erro no reconhecimento facial", variant: "destructive" });
            } finally {
                setRecognizing(false);
            }
        };

        // Actually submit after signing
        const handleDieselSubmit = async () => {
            if (!signatureData) { toast({ title: "Assinatura obrigatória", variant: "destructive" }); return; }

            setDieselSubmitting(true);
            try {
                const payload = {
                    productId: dieselProduct!.id,
                    quantity: parsedQty,
                    equipmentId: dieselEquip.id,
                    horimeter: dieselHours || null,
                    odometer: dieselKm || null,
                    notes: recognizedEmployee
                        ? `Abastecimento ${dieselEquip.name} - ${parsedQty}L | Funcionário: ${recognizedEmployee.name}`
                        : (dieselNotes || `Abastecimento ${dieselEquip.name} - ${parsedQty}L`),
                    seasonId: selectedSeasonId || null,
                    signatureBase64: signatureData === "face-recognized" ? null : signatureData,
                    employeeName: recognizedEmployee?.name || null,
                    photoBase64: capturedPhoto || null,
                };

                if (isOnline) {
                    await apiRequest("POST", "/api/pdv/withdraw", payload);
                    toast({ title: `⛽ ${parsedQty}L abastecido em ${dieselEquip.name}!` });
                } else {
                    const queue = [...offlineQueue, { id: Date.now(), payload, timestamp: new Date().toISOString() }];
                    setOfflineQueue(queue);
                    localStorage.setItem("pdv_offline_queue", JSON.stringify(queue));
                    toast({ title: `📴 Abastecimento salvo offline (${parsedQty}L)` });
                }

                // Reset form
                setShowReceiptModal(false);
                setSignatureData(null);
                setDieselQty("");
                setDieselEquip(null);
                setDieselKm("");
                setDieselHours("");
                setDieselNotes("");
                queryClient.invalidateQueries({ queryKey: ["/api/pdv/data"] });
                queryClient.invalidateQueries({ queryKey: ["/api/pdv/withdrawals"] });
            } catch (error) {
                toast({ title: "Erro ao registrar abastecimento", variant: "destructive" });
            } finally {
                setDieselSubmitting(false);
            }
        };

        return (
            <div className="h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-amber-900/30 text-white flex flex-col">
                {/* Header */}
                <header className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-emerald-800 via-emerald-900 to-emerald-700 shrink-0 shadow-md">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                            <Droplets className="h-5 w-5 text-amber-400" />
                        </div>
                        <div>
                            <span className="font-bold text-base leading-tight block text-amber-50">⛽ Bomba de Diesel</span>
                            <span className="text-[10px] text-amber-300/60">{pdvData?.terminal?.name} • AgroFarm Digital</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {!isOnline && <span className="text-[10px] text-red-400 bg-red-900/30 px-2 py-1 rounded-full">📴 Offline</span>}
                        {offlineQueue.length > 0 && (
                            <button onClick={processOfflineQueue} className="text-[10px] text-amber-300 bg-amber-900/30 px-2 py-1 rounded-full">
                                ♻️ {offlineQueue.length} pendentes
                            </button>
                        )}
                        <button onClick={handleLogout} className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20">
                            <LogOut className="h-4 w-4 text-gray-400" />
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-4 md:p-8">
                    <div className="max-w-2xl mx-auto space-y-6">

                        {/* === DIESEL GAUGE === */}
                        <div className="bg-gray-800/60 backdrop-blur-sm rounded-3xl border border-amber-500/20 p-6 text-center">
                            <p className="text-xs uppercase font-bold tracking-widest text-amber-400/80 mb-2">Estoque Diesel Disponível</p>
                            <div className="flex items-baseline justify-center gap-2 mb-4">
                                <span className="text-6xl md:text-8xl font-black text-amber-400 tabular-nums leading-none">
                                    {dieselStock.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                                </span>
                                <span className="text-2xl font-semibold text-amber-400/60">{dieselUnit}</span>
                            </div>
                            {/* Gauge bar */}
                            <div className="w-full h-3 bg-gray-700/50 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${stockPercent > 30 ? "bg-gradient-to-r from-amber-500 to-amber-400" : stockPercent > 10 ? "bg-gradient-to-r from-orange-500 to-orange-400" : "bg-gradient-to-r from-red-500 to-red-400"}`}
                                    style={{ width: `${stockPercent}%` }}
                                />
                            </div>
                            {!dieselProduct && (
                                <p className="text-red-400 text-xs mt-3">⚠️ Nenhum produto "diesel" ou "combustível" encontrado no estoque. Lance uma fatura com diesel primeiro.</p>
                            )}
                        </div>

                        {/* === VEHICLE SELECTOR === */}
                        <div className="bg-gray-800/60 backdrop-blur-sm rounded-2xl border border-gray-700/50 p-5">
                            <p className="text-xs uppercase font-bold tracking-widest text-gray-400 mb-3 flex items-center gap-2">
                                <Tractor className="h-4 w-4 text-amber-400" /> Selecionar Veículo / Máquina
                            </p>
                            {equipment.length === 0 ? (
                                <p className="text-gray-500 text-sm text-center py-4">Nenhum equipamento cadastrado. Adicione no painel da fazenda.</p>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                    {equipment.map((eq: any) => (
                                        <button
                                            key={eq.id}
                                            onClick={() => setDieselEquip(dieselEquip?.id === eq.id ? null : eq)}
                                            className={`p-3 rounded-xl text-left transition-all ${dieselEquip?.id === eq.id
                                                ? "bg-amber-500/20 border-2 border-amber-400 ring-2 ring-amber-400/20"
                                                : "bg-gray-700/50 border border-gray-600/50 hover:border-gray-500"}`}
                                        >
                                            <p className="font-bold text-sm truncate">{eq.name}</p>
                                            <p className="text-[10px] text-gray-400 truncate">{eq.type || eq.licensePlate || "—"}</p>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* === FUEL INPUT === */}
                        <div className="bg-gray-800/60 backdrop-blur-sm rounded-2xl border border-gray-700/50 p-5">
                            <p className="text-xs uppercase font-bold tracking-widest text-gray-400 mb-3 flex items-center gap-2">
                                <Droplets className="h-4 w-4 text-amber-400" /> Quantidade Abastecida
                            </p>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setDieselQty(String(Math.max(0, parsedQty - 10)))}
                                    className="w-12 h-12 rounded-xl bg-gray-700/50 border border-gray-600/50 text-amber-400 flex items-center justify-center text-xl font-bold active:scale-95"
                                >
                                    −
                                </button>
                                <div className="flex-1 relative">
                                    <Input
                                        type="number"
                                        step="1"
                                        value={dieselQty}
                                        onChange={(e) => setDieselQty(e.target.value)}
                                        onFocus={(e) => e.target.select()}
                                        placeholder="0"
                                        className="text-center text-3xl font-black h-16 bg-gray-700/50 border-gray-600/50 text-amber-400 rounded-xl focus:border-amber-400 focus:ring-amber-400/30 placeholder:text-gray-600"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-500">litros</span>
                                </div>
                                <button
                                    onClick={() => setDieselQty(String(parsedQty + 10))}
                                    className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center text-xl font-bold active:scale-95"
                                >
                                    +
                                </button>
                            </div>
                            {parsedQty > 0 && (
                                <p className={`text-xs mt-2 text-center ${stockAfter < 0 ? "text-red-400" : "text-gray-500"}`}>
                                    Estoque após: {stockAfter.toLocaleString("pt-BR")} {dieselUnit}
                                    {stockAfter < 0 && " ⚠️ Excede o disponível!"}
                                </p>
                            )}
                        </div>

                        {/* === TELEMETRY (KM / Hours) === */}
                        <div className="bg-gray-800/60 backdrop-blur-sm rounded-2xl border border-gray-700/50 p-5">
                            <p className="text-xs uppercase font-bold tracking-widest text-gray-400 mb-3 flex items-center gap-2">
                                <Gauge className="h-4 w-4 text-amber-400" /> Telemetria
                            </p>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-gray-400 text-xs mb-1 block">Hodômetro (Km)</Label>
                                    <Input
                                        type="number"
                                        value={dieselKm}
                                        onChange={(e) => setDieselKm(e.target.value)}
                                        placeholder="Ex: 125000"
                                        className="h-12 bg-gray-700/50 border-gray-600/50 text-white rounded-xl focus:border-amber-400 placeholder:text-gray-600"
                                    />
                                </div>
                                <div>
                                    <Label className="text-gray-400 text-xs mb-1 block">Horímetro (Horas)</Label>
                                    <Input
                                        type="number"
                                        value={dieselHours}
                                        onChange={(e) => setDieselHours(e.target.value)}
                                        placeholder="Ex: 4500"
                                        className="h-12 bg-gray-700/50 border-gray-600/50 text-white rounded-xl focus:border-amber-400 placeholder:text-gray-600"
                                    />
                                </div>
                            </div>
                            <div className="mt-3">
                                <Label className="text-gray-400 text-xs mb-1 block">Observação (opcional)</Label>
                                <Input
                                    value={dieselNotes}
                                    onChange={(e) => setDieselNotes(e.target.value)}
                                    placeholder="Ex: Motor quente, verificar filtro..."
                                    className="h-10 bg-gray-700/50 border-gray-600/50 text-white rounded-xl focus:border-amber-400 placeholder:text-gray-600"
                                />
                            </div>
                        </div>

                        {/* === SUBMIT BUTTON (opens receipt modal) === */}
                        <Button
                            onClick={handleOpenReceipt}
                            disabled={dieselSubmitting || parsedQty <= 0 || !dieselEquip || !dieselProduct}
                            className="w-full py-7 text-lg font-black rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-gray-900 shadow-lg shadow-amber-500/20 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <>⛽ Confirmar Abastecimento — {parsedQty > 0 ? `${parsedQty}L` : "..."}</>
                        </Button>

                        {/* === RECEIPT / SIGNATURE MODAL === */}
                        {showReceiptModal && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setShowReceiptModal(false)}>
                                <div className="w-full max-w-md bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                                    {/* Header */}
                                    <div className="bg-gradient-to-r from-amber-600 to-amber-700 px-5 py-4 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <FileText className="h-5 w-5 text-amber-100" />
                                            <h2 className="font-bold text-lg text-white">Comprovante de Abastecimento</h2>
                                        </div>
                                        <button onClick={() => setShowReceiptModal(false)} className="text-amber-200 hover:text-white transition-colors">
                                            <X className="h-5 w-5" />
                                        </button>
                                    </div>

                                    {/* Receipt details */}
                                    <div className="p-5 space-y-4">
                                        <div className="bg-gray-800/60 rounded-xl p-4 space-y-3">
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs text-gray-400 uppercase tracking-wider">Data</span>
                                                <span className="text-sm font-medium text-white">{new Date().toLocaleString("pt-BR")}</span>
                                            </div>
                                            <div className="border-t border-gray-700/50" />
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs text-gray-400 uppercase tracking-wider">Veículo / Equipamento</span>
                                                <span className="text-sm font-medium text-white">{dieselEquip?.name}</span>
                                            </div>
                                            <div className="border-t border-gray-700/50" />
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs text-gray-400 uppercase tracking-wider">Quantidade</span>
                                                <span className="text-lg font-bold text-amber-400">{parsedQty}L</span>
                                            </div>
                                            {dieselKm && (
                                                <>
                                                    <div className="border-t border-gray-700/50" />
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-xs text-gray-400 uppercase tracking-wider">Quilometragem</span>
                                                        <span className="text-sm font-medium text-white">{dieselKm} km</span>
                                                    </div>
                                                </>
                                            )}
                                            {dieselHours && (
                                                <>
                                                    <div className="border-t border-gray-700/50" />
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-xs text-gray-400 uppercase tracking-wider">Horímetro</span>
                                                        <span className="text-sm font-medium text-white">{dieselHours}h</span>
                                                    </div>
                                                </>
                                            )}
                                            {dieselNotes && (
                                                <>
                                                    <div className="border-t border-gray-700/50" />
                                                    <div className="flex justify-between items-start">
                                                        <span className="text-xs text-gray-400 uppercase tracking-wider">Obs</span>
                                                        <span className="text-sm text-gray-300 text-right max-w-[200px]">{dieselNotes}</span>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        {/* Face Recognition */}
                                        <div>
                                            <p className="text-xs text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                <Camera className="h-3.5 w-3.5" /> Identificação do Funcionário
                                            </p>

                                            {showCamera ? (
                                                <div className="relative rounded-xl overflow-hidden border border-gray-600 bg-black">
                                                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-48 object-cover" />
                                                    <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-3">
                                                        <Button onClick={captureAndRecognize} className="bg-emerald-600 hover:bg-emerald-700 rounded-full px-6">
                                                            <Camera className="h-4 w-4 mr-2" /> Capturar
                                                        </Button>
                                                        <Button onClick={stopCamera} variant="outline" className="rounded-full border-gray-500 text-gray-300 hover:bg-gray-700">
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : recognizing ? (
                                                <div className="flex flex-col items-center py-6 bg-gray-800/60 rounded-xl">
                                                    <Loader2 className="h-8 w-8 animate-spin text-amber-400 mb-2" />
                                                    <p className="text-sm text-gray-300">Reconhecendo rosto...</p>
                                                </div>
                                            ) : recognizedEmployee ? (
                                                <div className="bg-emerald-900/30 border border-emerald-700/50 rounded-xl p-4">
                                                    <div className="flex items-center gap-3">
                                                        {capturedPhoto && <img src={capturedPhoto} alt="Foto" className="w-14 h-14 rounded-full object-cover border-2 border-emerald-400" />}
                                                        <div>
                                                            <p className="text-emerald-300 font-bold text-sm">{recognizedEmployee.name}</p>
                                                            {recognizedEmployee.role && <p className="text-emerald-400/60 text-xs">{recognizedEmployee.role}</p>}
                                                            <p className="text-emerald-500 text-[10px] mt-0.5">Identificado com sucesso</p>
                                                        </div>
                                                    </div>
                                                    {recognizedEmployee.signatureBase64 && (
                                                        <div className="mt-3 bg-white rounded-lg p-2">
                                                            <p className="text-[10px] text-gray-400 mb-1">Assinatura cadastrada</p>
                                                            <img src={recognizedEmployee.signatureBase64} alt="Assinatura" className="h-12 object-contain" />
                                                        </div>
                                                    )}
                                                    <button onClick={() => { setRecognizedEmployee(null); setCapturedPhoto(null); setSignatureData(null); }} className="text-xs text-gray-500 hover:text-gray-300 mt-2">
                                                        Tentar novamente
                                                    </button>
                                                </div>
                                            ) : (
                                                <Button onClick={startCamera} variant="outline" className="w-full border-gray-600 text-gray-300 hover:bg-gray-700 py-5">
                                                    <Camera className="h-5 w-5 mr-2" /> Abrir Câmera para Identificação
                                                </Button>
                                            )}
                                        </div>

                                        {/* Manual Signature fallback (only if not recognized) */}
                                        {!recognizedEmployee && (
                                            <div>
                                                <p className="text-xs text-gray-500 text-center mb-2">— ou assine manualmente —</p>
                                                <SignatureCanvas onSignatureChange={setSignatureData} />
                                            </div>
                                        )}

                                        {/* Confirm button */}
                                        <Button
                                            onClick={handleDieselSubmit}
                                            disabled={dieselSubmitting || !signatureData}
                                            className="w-full py-6 text-base font-bold rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            {dieselSubmitting ? (
                                                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Registrando...</>
                                            ) : (
                                                <>✅ {recognizedEmployee ? `Confirmar (${recognizedEmployee.name})` : "Assinar e Confirmar"}</>
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* === RECENT FUELING HISTORY === */}
                        {(() => {
                            // Filter history to only show diesel/combustível withdrawals
                            const dieselHistory = (withdrawalsHistory || []).filter((batch: any) =>
                                batch.applications?.some((a: any) => {
                                    const name = (a.productName || "").toLowerCase();
                                    return name.includes("diesel") || name.includes("combustível") || name.includes("combustivel") || (dieselProduct && a.productId === dieselProduct.id);
                                })
                            );
                            return dieselHistory.length > 0 ? (
                                <div className="bg-gray-800/40 backdrop-blur-sm rounded-2xl border border-gray-700/50 p-5">
                                    <p className="text-xs uppercase font-bold tracking-widest text-gray-400 mb-3">Últimos Abastecimentos</p>
                                    <div className="space-y-2 max-h-60 overflow-y-auto">
                                        {dieselHistory.slice(0, 10).map((batch: any, i: number) => (
                                            <div key={i} className="flex items-center justify-between py-2 border-b border-gray-700/30 last:border-0">
                                                <div>
                                                    <p className="text-sm font-medium text-gray-300">{batch.equipmentName || batch.applications?.[0]?.equipmentName || "Veículo"}</p>
                                                    <p className="text-[10px] text-gray-500">{new Date(batch.appliedAt).toLocaleString("pt-BR")}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-amber-400 font-bold text-sm">
                                                        {batch.applications?.reduce((s: number, a: any) => s + parseFloat(a.quantity || 0), 0).toFixed(0)}L
                                                    </span>
                                                    <button
                                                        onClick={async () => {
                                                            const appId = batch.batchId || batch.applications?.[0]?.id;
                                                            if (!appId) return;
                                                            setLoadingReceipt(appId);
                                                            try {
                                                                const r = await apiRequest("GET", `/api/pdv/receipt/${appId}`);
                                                                const data = await r.json();
                                                                setViewReceipt(data);
                                                            } catch { toast({ title: "Erro ao carregar comprovante", variant: "destructive" }); }
                                                            finally { setLoadingReceipt(null); }
                                                        }}
                                                        className="text-gray-500 hover:text-amber-400 transition-colors p-1"
                                                        title="Ver comprovante"
                                                    >
                                                        {loadingReceipt === (batch.batchId || batch.applications?.[0]?.id) ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <FileText className="h-4 w-4" />
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : null;
                        })()}

                        {/* === VIEW RECEIPT MODAL === */}
                        {viewReceipt && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setViewReceipt(null)}>
                                <div className="w-full max-w-md bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                                    <div className="bg-gradient-to-r from-amber-600 to-amber-700 px-5 py-4 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <FileText className="h-5 w-5 text-amber-100" />
                                            <h2 className="font-bold text-lg text-white">Comprovante</h2>
                                        </div>
                                        <button onClick={() => setViewReceipt(null)} className="text-amber-200 hover:text-white transition-colors">
                                            <X className="h-5 w-5" />
                                        </button>
                                    </div>
                                    <div className="p-5 space-y-4">
                                        <div className="bg-gray-800/60 rounded-xl p-4 space-y-3">
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs text-gray-400 uppercase tracking-wider">Data</span>
                                                <span className="text-sm font-medium text-white">{viewReceipt.appliedAt ? new Date(viewReceipt.appliedAt).toLocaleString("pt-BR") : "—"}</span>
                                            </div>
                                            <div className="border-t border-gray-700/50" />
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs text-gray-400 uppercase tracking-wider">Veículo</span>
                                                <span className="text-sm font-medium text-white">{viewReceipt.equipmentName || "—"}</span>
                                            </div>
                                            <div className="border-t border-gray-700/50" />
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs text-gray-400 uppercase tracking-wider">Quantidade</span>
                                                <span className="text-lg font-bold text-amber-400">{Math.abs(parseFloat(viewReceipt.quantity || 0)).toFixed(0)}L</span>
                                            </div>
                                            {viewReceipt.odometer && (
                                                <>
                                                    <div className="border-t border-gray-700/50" />
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-xs text-gray-400 uppercase tracking-wider">Km</span>
                                                        <span className="text-sm font-medium text-white">{viewReceipt.odometer} km</span>
                                                    </div>
                                                </>
                                            )}
                                            {viewReceipt.horimeter && (
                                                <>
                                                    <div className="border-t border-gray-700/50" />
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-xs text-gray-400 uppercase tracking-wider">Horímetro</span>
                                                        <span className="text-sm font-medium text-white">{viewReceipt.horimeter}h</span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                        {viewReceipt.signatureBase64 ? (
                                            <div>
                                                <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Assinatura</p>
                                                <div className="bg-white rounded-xl p-3">
                                                    <img src={viewReceipt.signatureBase64} alt="Assinatura" className="w-full h-auto" />
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-xs text-gray-500 text-center italic">Sem assinatura registrada</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // ==================== STEP: PLOT SELECTION (Passo 2) ====================
    if (step === "plot") {
        const properties = pdvData?.properties || [];
        const plotsByProp: Record<string, any[]> = {};
        plots.forEach((p: any) => {
            if (!plotsByProp[p.propertyId]) plotsByProp[p.propertyId] = [];
            plotsByProp[p.propertyId].push(p);
        });

        return (
            <div className="h-screen bg-gray-50 text-gray-800 flex flex-col">

                <PDVTopBar step={step} title="Selecionar Talhões" onBack={() => setStep("season")}
                    rightBadge={selectedPlots.length > 0 ? <span className="text-xs font-bold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">{selectedPlots.length} · {totalAreaSelected.toFixed(1)} ha</span> : undefined}
                    isOnline={isOnline} withdrawalsHistory={withdrawalsHistory} handleRegenerateReceituario={handleRegenerateReceituario} handleLogout={handleLogout} toast={toast} />

                <div className="flex-1 overflow-y-auto p-4">
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
                                const allSelected = propPlots.length > 0 && propPlots.every((p: any) => isPlotSelected(p.id));
                                return (
                                    <div key={prop.id} className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h3 className="font-bold text-gray-700 flex items-center gap-2">
                                                <span className="w-1 h-4 rounded-full bg-green-700 block" />
                                                {prop.name}
                                                <span className="text-xs font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{propPlots.length} talhões</span>
                                            </h3>
                                            {propPlots.length > 0 && (
                                                <button
                                                    onClick={() => {
                                                        const ids = propPlots.map((p: any) => p.id);
                                                        setSelectedPlots(allSelected
                                                            ? selectedPlots.filter(p => !ids.includes(p.id))
                                                            : [...selectedPlots.filter(p => !ids.includes(p.id)), ...propPlots]);
                                                    }}
                                                    className="text-xs font-medium text-green-700 hover:underline"
                                                >
                                                    {allSelected ? "Desmarcar todos" : "Selecionar todos"}
                                                </button>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {propPlots.length > 0 ? propPlots.map((plot: any) => {
                                                const sel = isPlotSelected(plot.id);
                                                return (
                                                    <button key={plot.id} onClick={() => togglePlot(plot)}
                                                        className={`group relative rounded-2xl border-2 text-left transition-all overflow-hidden ${sel ? "border-green-600 shadow-md shadow-green-100" : "border-gray-200 hover:border-green-300 shadow-sm bg-white"}`}>
                                                        {/* Mapa do talhão */}
                                                        <div className={`w-full h-28 ${sel ? "bg-green-50" : "bg-gray-50"}`}>
                                                            <PlotMiniMap coordinates={plot.coordinates || null} selected={sel} />
                                                        </div>
                                                        {/* Info */}
                                                        <div className={`p-3 ${sel ? "bg-green-50" : "bg-white"}`}>
                                                            <div className="flex items-center justify-between">
                                                                <h4 className={`font-bold text-sm leading-tight ${sel ? "text-green-800" : "text-gray-800"}`}>{plot.name}</h4>
                                                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${sel ? "bg-green-700 border-green-700" : "border-gray-300"}`}>
                                                                    {sel && <Check className="h-3 w-3 text-white" />}
                                                                </div>
                                                            </div>
                                                            <p className="text-xs text-gray-500 mt-0.5">{parseFloat(plot.areaHa).toFixed(1)} ha{plot.crop ? ` · ${plot.crop}` : ""}</p>
                                                        </div>
                                                    </button>
                                                );
                                            }) : (
                                                <div className="col-span-full py-4 text-center text-gray-400 text-sm italic bg-white rounded-xl border border-dashed border-gray-200">
                                                    Nenhum talhão cadastrado
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Bottom bar */}
                <div className="p-4 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                    <Button
                        className="w-full h-12 text-base bg-[#F7D601] hover:bg-yellow-400 text-green-800 font-bold rounded-xl shadow-md shadow-yellow-200 transition-all active:scale-[0.98]"
                        onClick={handleGoFromPlot}
                        disabled={selectedPlots.length === 0}
                    >
                        Selecionar Produtos <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                </div>
            </div>
        );
    }

    // ==================== STEP: SEASON (Passo 1 — Selecionar Safra) ====================
    if (step === "season") {
        const seasons = pdvData?.seasons || [];
        return (
            <div className="h-screen bg-gray-50 text-gray-800 flex flex-col">

                <PDVTopBar step={step} title="Selecionar Safra" isOnline={isOnline} withdrawalsHistory={withdrawalsHistory} handleRegenerateReceituario={handleRegenerateReceituario} handleLogout={handleLogout} toast={toast} />
                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Selecione a safra</p>
                    <div className="space-y-3">
                        {seasons.length === 0 ? (
                            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
                                <p className="text-gray-500 font-medium">Nenhuma safra cadastrada</p>
                                <p className="text-gray-400 text-sm mt-1">Cadastre em Produção → Safras</p>
                            </div>
                        ) : (
                            seasons.map((season: any) => (
                                <button
                                    key={season.id}
                                    onClick={() => setSelectedSeasonId(season.id)}
                                    className={`w-full p-4 rounded-2xl border-2 text-left transition-all flex items-center gap-4 ${
                                        selectedSeasonId === season.id
                                            ? "border-green-600 bg-blue-50 shadow-md shadow-green-100"
                                            : "border-gray-200 bg-white hover:border-green-300"
                                    }`}
                                >
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-xl ${selectedSeasonId === season.id ? "bg-green-700/10" : "bg-gray-50"}`}>🌱</div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-gray-800">{season.name}</p>
                                        {season.crop && <p className="text-xs text-gray-500 mt-0.5">Cultura: {season.crop}</p>}
                                        {season.startDate && (
                                            <p className="text-[10px] text-gray-400 mt-0.5">
                                                {new Date(season.startDate).toLocaleDateString("pt-BR")}
                                                {season.endDate ? ` — ${new Date(season.endDate).toLocaleDateString("pt-BR")}` : ""}
                                            </p>
                                        )}
                                    </div>
                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${selectedSeasonId === season.id ? "bg-green-700 border-green-700" : "border-gray-300"}`}>
                                        {selectedSeasonId === season.id && <Check className="h-3.5 w-3.5 text-white" />}
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Bottom bar */}
                <div className="p-4 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                    <div className="flex gap-3">
                        <Button variant="outline" className="px-6 h-12 rounded-xl border-gray-200" onClick={handleGoFromSeason}>
                            Pular
                        </Button>
                        <Button
                            className="flex-1 h-12 text-base bg-[#F7D601] hover:bg-yellow-400 text-green-800 font-bold rounded-xl shadow-md shadow-yellow-200 transition-all active:scale-[0.98]"
                            onClick={handleGoFromSeason}
                            disabled={!selectedSeasonId}
                        >
                            Continuar <ArrowRight className="ml-2 h-5 w-5" />
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // ==================== STEP: PRODUCT_SELECT (Passo 3 — Multi-seleção) ====================
    if (step === "product_select") {
        const alreadyInCart = cart.map(c => c.product.id);
        const totalSel = pendingProducts.length + alreadyInCart.length;
        return (
            <div className="h-screen bg-gray-50 text-gray-800 flex flex-col">

                <PDVTopBar step={step} title="Selecionar Produtos" onBack={() => setStep("plot")}
                    rightBadge={<span className="text-xs font-bold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">{totalAreaSelected.toFixed(1)} ha</span>}
                    isOnline={isOnline} withdrawalsHistory={withdrawalsHistory} handleRegenerateReceituario={handleRegenerateReceituario} handleLogout={handleLogout} toast={toast} />
                {/* Counter + Search bar (sub-header) */}
                <div className="bg-white border-b border-gray-100 px-4 py-2 space-y-2 shrink-0">
                    <div className={`px-4 py-2 rounded-xl flex items-center justify-between ${totalSel > 0 ? "bg-green-50" : "bg-gray-50"}`}>
                        <span className="text-sm font-bold text-gray-800">
                            {totalSel === 0 ? "Nenhum produto selecionado" : `${totalSel} produto${totalSel > 1 ? "s" : ""} selecionado${totalSel > 1 ? "s" : ""}`}
                        </span>
                        <span className="text-[10px] text-gray-400 font-medium">
                            {alreadyInCart.length > 0 ? `${alreadyInCart.length} já no carrinho` : "Toque para selecionar"}
                        </span>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input className="pl-10 h-10 bg-gray-50 border-gray-200 text-gray-800 placeholder:text-gray-400 text-sm rounded-xl focus:border-green-400 focus:ring-green-100"
                            placeholder="Buscar produto..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                </div>

                {/* ── Layout: mobile = coluna única | desktop = dois painéis ── */}
                <div className="flex-1 flex overflow-hidden">

                    {/* Painel esquerdo: lista de produtos */}
                    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 md:border-r md:border-gray-100">
                        {filtered.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                                <Search className="h-10 w-10 mb-3 opacity-30" />
                                <p className="font-medium">Nenhum produto encontrado</p>
                            </div>
                        )}
                        {filtered.map((p: any) => {
                            const stockQty = getStockForProduct(p.id);
                            const inCart = isProductInCart(p.id);
                            const isPending = isProductPending(p.id);
                            const isSelected = inCart || isPending;
                            const lowStock = stockQty <= 0;
                            return (
                                <button key={p.id} disabled={lowStock}
                                    onClick={() => togglePendingProduct(p)}
                                    className={`w-full flex items-center gap-3 p-3 rounded-2xl border-2 text-left transition-all ${lowStock ? "opacity-40 cursor-not-allowed bg-white border-gray-100" : isSelected ? "bg-green-50 border-green-600 shadow-sm shadow-green-100" : "bg-white border-gray-100 shadow-sm hover:border-green-200"}`}>
                                    {/* Checkbox */}
                                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${isSelected ? "bg-green-700 border-green-700" : "border-gray-300"}`}>
                                        {isSelected && <Check className="h-3.5 w-3.5 text-white" />}
                                    </div>
                                    {/* Thumb */}
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${inCart ? "bg-green-100" : "bg-gray-50"}`}>
                                        {p.imageUrl ? <img src={p.imageUrl} className="w-full h-full object-contain p-1 rounded-xl" alt="" /> : <span className="text-xl">{CATEGORY_EMOJI[p.category] || "📦"}</span>}
                                    </div>
                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-[14px] text-gray-900 line-clamp-1">{p.name}</p>
                                        <p className="text-[11px] text-gray-400 mt-0.5">
                                            {p.category ? p.category.charAt(0).toUpperCase() + p.category.slice(1) : "Geral"}
                                            {p.packageSize ? ` · Emb: ${p.packageSize} ${p.unit}` : ""}
                                            {inCart ? " · ✅ Já no carrinho" : ""}
                                        </p>
                                    </div>
                                    {/* Stock */}
                                    <div className="shrink-0 text-right">
                                        {lowStock ? (
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-red-50 text-red-500 border border-red-200">Sem estoque</span>
                                        ) : (
                                            <>
                                                <p className="text-lg font-extrabold text-emerald-600 leading-none">{stockQty.toFixed(0)}</p>
                                                <p className="text-[10px] text-gray-400">{p.unit}</p>
                                            </>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* Painel direito: SOMENTE DESKTOP — resumo da seleção + CTA */}
                    <div className="hidden md:flex md:w-[360px] lg:w-[420px] flex-col bg-white border-l border-gray-100 shrink-0">
                        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-base text-gray-900">Selecionados</h3>
                                <p className="text-xs text-gray-400 mt-0.5">{totalAreaSelected.toFixed(1)} ha · {cart.length > 0 ? `${cart.length} já no carrinho` : "nenhum no carrinho"}</p>
                            </div>
                            {(pendingProducts.length + cart.length) > 0 && (
                                <span className="bg-green-100 text-green-700 text-xs font-bold px-2.5 py-1 rounded-full">
                                    {pendingProducts.length + cart.length} produto{(pendingProducts.length + cart.length) !== 1 ? "s" : ""}
                                </span>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {pendingProducts.length === 0 && cart.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-gray-300 py-12">
                                    <ShoppingCart className="h-12 w-12 mb-3 opacity-40" />
                                    <p className="text-sm font-medium text-gray-400">Nenhum produto selecionado</p>
                                    <p className="text-xs text-gray-300 mt-1 text-center">Clique nos produtos ao lado para selecionar</p>
                                </div>
                            ) : (
                                <>
                                    {cart.length > 0 && (
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">Já no carrinho</p>
                                    )}
                                    {cart.map((item) => (
                                        <div key={item.product.id} className="flex items-center gap-3 p-3 bg-green-50 rounded-xl border border-green-100">
                                            <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                                                <span className="text-base">{CATEGORY_EMOJI[item.product.category] || "📦"}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-sm text-gray-900 truncate">{item.product.name}</p>
                                                <p className="text-[10px] text-green-600 font-medium">✅ Dose definida · {Number(item.dosePerHa).toFixed(1)} {item.product.unit}/ha</p>
                                            </div>
                                        </div>
                                    ))}
                                    {pendingProducts.length > 0 && (
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1 pt-2">Aguardando dose</p>
                                    )}
                                    {pendingProducts.map((p) => (
                                        <div key={p.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                                            <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                                                <span className="text-base">{CATEGORY_EMOJI[p.category] || "📦"}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-sm text-gray-900 truncate">{p.name}</p>
                                                <p className="text-[10px] text-gray-400">Informe a dose na próxima etapa</p>
                                            </div>
                                            <button onClick={() => togglePendingProduct(p)} className="w-6 h-6 rounded-full bg-gray-200 hover:bg-red-100 text-gray-400 hover:text-red-500 flex items-center justify-center transition-colors">
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>

                        <div className="p-4 border-t border-gray-100 space-y-2">
                            <Button
                                className="w-full h-12 text-base bg-[#F7D601] hover:bg-yellow-400 text-green-800 font-bold rounded-xl shadow-md shadow-yellow-200 disabled:opacity-50"
                                onClick={handleStartDoseEntry}
                                disabled={pendingProducts.length === 0}
                            >
                                Informar Doses ({pendingProducts.length}) <ArrowRight className="ml-2 h-5 w-5" />
                            </Button>
                            {cart.length > 0 && pendingProducts.length === 0 && (
                                <Button variant="outline" className="w-full h-10 text-sm border-gray-200 text-gray-600 rounded-xl" onClick={handleGoFromCartReview}>
                                    Continuar sem adicionar <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Botão CTA mobile (oculto no desktop) */}
                <div className="md:hidden p-4 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                    <Button
                        className="w-full h-12 text-base bg-[#F7D601] hover:bg-yellow-400 text-green-800 font-bold rounded-xl shadow-md shadow-yellow-200 disabled:opacity-50"
                        onClick={handleStartDoseEntry}
                        disabled={pendingProducts.length === 0}
                    >
                        Informar Doses ({pendingProducts.length}) <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                </div>
            </div>
        );
    }

    // ==================== STEP: DOSE (Passo 4 — Dose por produto) ====================
    if (step === "dose") {
        const product = pendingProducts[doseIndex];
        if (!product) { setStep("cart_review"); return null; }
        const dose = parseBR(currentDose);
        const qty = !isNaN(dose) && dose > 0 ? Math.round(dose * totalAreaSelected * 10000) / 10000 : 0;
        const pkgSize = product.packageSize || null;
        const embs = pkgSize && qty > 0 ? Math.ceil(qty / pkgSize) : null;
        const totalPkg = embs && pkgSize ? embs * pkgSize : null;
        const isLast = doseIndex === pendingProducts.length - 1;
        return (
            <div className="h-screen bg-gray-50 text-gray-800 flex flex-col">

                <PDVTopBar step={step} title="Informar Dose"
                    onBack={() => { if (doseIndex === 0) { setStep("product_select"); } else { setDoseIndex(doseIndex - 1); setCurrentDose(pendingProducts[doseIndex - 1].dosePerHa ? String(parseBR(pendingProducts[doseIndex - 1].dosePerHa)) : ""); } }}
                    rightBadge={pendingProducts.length > 1 ? <span className="text-xs font-bold text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full">{doseIndex + 1}/{pendingProducts.length}</span> : undefined}
                    isOnline={isOnline} withdrawalsHistory={withdrawalsHistory} handleRegenerateReceituario={handleRegenerateReceituario} handleLogout={handleLogout} toast={toast} />

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    <div className="max-w-xl mx-auto space-y-4">
                    {/* Produto em foco */}
                    <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 flex items-center gap-4">
                        <div className="w-14 h-14 rounded-xl bg-white flex items-center justify-center text-2xl shrink-0 shadow-sm">
                            {product.imageUrl ? <img src={product.imageUrl} className="w-full h-full object-contain p-1" alt="" /> : <span>{CATEGORY_EMOJI[product.category] || "📦"}</span>}
                        </div>
                        <div>
                            <p className="font-extrabold text-green-700 text-base leading-tight">{product.name}</p>
                            <p className="text-xs text-blue-500 mt-1">
                                {product.category?.charAt(0).toUpperCase() + product.category?.slice(1)}
                                {product.packageSize ? ` · Emb: ${product.packageSize} ${product.unit}` : ""}
                                {" · Área: "}{totalAreaSelected.toFixed(1)} ha
                            </p>
                        </div>
                    </div>

                    {/* Dose input */}
                    <div>
                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">Dose por hectare ({product.unit}/ha)</p>
                        <Input
                            type="number"
                            step="0.01"
                            inputMode="decimal"
                            value={currentDose}
                            onChange={e => setCurrentDose(e.target.value)}
                            onFocus={e => e.target.select()}
                            className="h-16 text-3xl font-extrabold text-center border-2 rounded-2xl focus:border-green-600 text-gray-800 bg-white"
                            placeholder="0.00"
                            autoFocus
                        />
                    </div>

                    {/* Resultado calculado */}
                    {qty > 0 && (
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase">Área</p>
                                <p className="text-xl font-extrabold text-gray-800 mt-1">{totalAreaSelected.toFixed(1)} <span className="text-sm text-gray-400">ha</span></p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase">Qtd calculada</p>
                                <p className="text-xl font-extrabold text-green-700 mt-1">{qty.toFixed(1)} <span className="text-sm text-green-300">{product.unit}</span></p>
                            </div>
                            {pkgSize && (
                                <>
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase">Embalagem</p>
                                        <p className="text-xl font-extrabold text-emerald-600 mt-1">{pkgSize} <span className="text-sm text-emerald-300">{product.unit}</span></p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase">Emb. a retirar</p>
                                        <p className="text-xl font-extrabold text-emerald-600 mt-1">{embs} <span className="text-sm text-emerald-300">emb.</span></p>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Banner arredondamento */}
                    {pkgSize && embs && totalPkg && (
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                            <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide mb-2">📦 Arredondamento de embalagem</p>
                            <div className="flex items-center justify-between">
                                <p className="text-xs text-amber-700">
                                    {qty.toFixed(1)} {product.unit} → ceil({qty.toFixed(1)} ÷ {pkgSize}) = {embs} emb.
                                </p>
                                <span className="font-extrabold text-amber-800 bg-amber-200 px-3 py-1 rounded-lg text-sm">{totalPkg} {product.unit}</span>
                            </div>
                        </div>
                    )}
                    </div>{/* end max-w-xl */}
                </div>

                <div className="p-4 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                    <div className="max-w-xl mx-auto">
                    <Button
                        className="w-full h-12 text-base bg-[#F7D601] hover:bg-yellow-400 text-green-800 font-bold rounded-xl shadow-md shadow-yellow-200"
                        onClick={handleConfirmDose}
                        disabled={isNaN(dose) || dose <= 0}
                    >
                        {isLast ? "Ver Carrinho" : `Próximo Produto →`}
                    </Button>
                    </div>
                </div>
            </div>
        );
    }

    // ==================== STEP: CART_REVIEW (Passo 5 — Carrinho) ====================
    if (step === "cart_review") {
        return (
            <div className="h-screen bg-gray-50 text-gray-800 flex flex-col">

                <PDVTopBar step={step} title={`Carrinho · ${cart.length} produto${cart.length !== 1 ? "s" : ""}`} onBack={() => setStep("product_select")}
                    rightBadge={<span className="text-xs font-bold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">{totalAreaSelected.toFixed(1)} ha</span>}
                    isOnline={isOnline} withdrawalsHistory={withdrawalsHistory} handleRegenerateReceituario={handleRegenerateReceituario} handleLogout={handleLogout} toast={toast} />

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    <div className="max-w-2xl mx-auto space-y-3">
                    {cart.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                            <ShoppingCart className="h-12 w-12 mb-3 opacity-20" />
                            <p className="font-medium">Carrinho vazio</p>
                        </div>
                    ) : (
                        cart.map(item => {
                            const dose = parseBR(item.dosePerHa);
                            const qty = Number(item.quantity);
                            const pkgSize = item.packageSize || item.product.packageSize || null;
                            const embs = pkgSize && qty > 0 ? Math.ceil(qty / pkgSize) : null;
                            const totalPkg = embs && pkgSize ? embs * pkgSize : null;
                            return (
                                <div key={item.product.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br ${CATEGORY_COLORS[item.product.category] || CATEGORY_COLORS.outro}`}>
                                            <span className="text-xl">{CATEGORY_EMOJI[item.product.category] || "📦"}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-sm text-gray-800 line-clamp-1">{item.product.name}</p>
                                            <p className="text-[11px] text-gray-400 mt-0.5">{item.product.category} · Dose: {!isNaN(dose) ? dose.toFixed(2) : "—"} {item.product.unit}/ha</p>
                                        </div>
                                        <button onClick={() => removeFromCart(item.product.id)}
                                            className="w-8 h-8 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors shrink-0">
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                    <div className="bg-gray-50 rounded-xl p-3 grid grid-cols-3 gap-2 text-center">
                                        <div>
                                            <p className="text-[9px] font-bold text-gray-400 uppercase">Qtd real</p>
                                            <p className="font-bold text-green-700 text-sm mt-0.5">{qty.toFixed(1)} {item.product.unit}</p>
                                        </div>
                                        {pkgSize ? (
                                            <>
                                                <div>
                                                    <p className="text-[9px] font-bold text-gray-400 uppercase">Emb.</p>
                                                    <p className="font-bold text-gray-700 text-sm mt-0.5">{pkgSize} {item.product.unit}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-bold text-amber-600 uppercase">Retirar</p>
                                                    <p className="font-extrabold text-amber-700 text-sm mt-0.5 bg-amber-100 rounded-lg px-1">{embs} emb. ({totalPkg})</p>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="col-span-2">
                                                <p className="text-[9px] font-bold text-gray-400 uppercase">Embalagem</p>
                                                <p className="font-medium text-gray-400 text-xs mt-0.5">Não informada</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}

                    {/* Adicionar mais produtos */}
                    <button onClick={() => { setPendingProducts([]); setStep("product_select"); }}
                        className="w-full border-2 border-dashed border-blue-200 rounded-2xl p-4 text-green-700 font-bold text-sm flex items-center justify-center gap-2 hover:bg-blue-50 transition-colors">
                        <span className="text-xl">＋</span> Adicionar mais produtos
                    </button>
                    </div>{/* end max-w-2xl */}
                </div>

                <div className="p-4 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                    <div className="max-w-2xl mx-auto">
                    <Button
                        className="w-full h-12 text-base bg-[#F7D601] hover:bg-yellow-400 text-green-800 font-bold rounded-xl shadow-md shadow-yellow-200"
                        onClick={handleGoFromCartReview}
                        disabled={cart.length === 0}
                    >
                        Continuar → Pulverizador <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                    </div>
                </div>
            </div>
        );
    }

    // ==================== STEP: EQUIPMENT (Pulverizador + Vazão) ====================
    if (step === "equipment" && !isDiesel) {
        const sprayers = (pdvData?.equipment || []).filter((e: any) => e.type === "Pulverizador" && (e.status === "Ativo" || !e.status));
        const totalArea = selectedPlots.reduce((sum: number, p: any) => sum + (parseFloat(p.areaHa) || 0), 0);

        return (
            <div className="h-screen bg-gray-50 text-gray-800 flex flex-col">

                <PDVTopBar step={step} title="Pulverizador & Vazão" onBack={() => setStep("cart_review")}
                    rightBadge={<span className="text-xs font-bold text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full">{cart.length} prod. · {totalArea.toFixed(1)} ha</span>}
                    isOnline={isOnline} withdrawalsHistory={withdrawalsHistory} handleRegenerateReceituario={handleRegenerateReceituario} handleLogout={handleLogout} toast={toast} />

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {sprayers.length > 0 ? (
                        <>
                            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Pulverizadores Disponíveis</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {sprayers.map((equip: any) => (
                                    <button
                                        key={equip.id}
                                        onClick={() => setSelectedEquipment(selectedEquipment?.id === equip.id ? null : equip)}
                                        className={`p-4 rounded-xl border-2 text-left transition-all ${selectedEquipment?.id === equip.id
                                            ? "border-green-600 bg-blue-50 shadow-md"
                                            : "border-gray-200 bg-white hover:border-green-300 hover:shadow-sm"
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${selectedEquipment?.id === equip.id ? "bg-green-700 text-white" : "bg-gray-100 text-gray-500"}`}>
                                                <Tractor className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <p className="font-semibold text-gray-900">{equip.name}</p>
                                                {equip.tankCapacityL && (
                                                    <p className="text-sm text-blue-600 font-medium">Tanque: {parseFloat(equip.tankCapacityL).toLocaleString("pt-BR")} L</p>
                                                )}
                                            </div>
                                            {selectedEquipment?.id === equip.id && (
                                                <Check className="h-5 w-5 text-green-700 ml-auto" />
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 text-sm">
                            <p className="font-semibold">Nenhum pulverizador cadastrado</p>
                            <p className="mt-1">Cadastre um equipamento do tipo "Pulverizador" em Frota & Maquinário para usar esta função.</p>
                        </div>
                    )}

                    {selectedEquipment && (
                        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Vazão da Aplicação</h3>
                            <div>
                                <Label className="text-sm font-medium">Vazão (L/ha) *</Label>
                                <Input
                                    type="number"
                                    step="any"
                                    value={flowRateLha}
                                    onChange={e => setFlowRateLha(e.target.value)}
                                    placeholder="Ex: 120"
                                    className="mt-1 text-lg h-12"
                                />
                            </div>
                            {flowRateLha && selectedEquipment.tankCapacityL && (
                                <div className="bg-blue-50 rounded-lg p-3 text-sm space-y-1">
                                    <p><span className="text-gray-500">Calda total:</span> <strong>{(parseFloat(flowRateLha) * totalArea).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} L</strong></p>
                                    <p><span className="text-gray-500">Tanques necessários:</span> <strong>{((parseFloat(flowRateLha) * totalArea) / parseFloat(selectedEquipment.tankCapacityL)).toFixed(2)}</strong></p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="shrink-0 p-4 bg-white border-t border-gray-200 flex gap-3">
                    <Button variant="outline" className="flex-1 h-12" onClick={handleGoFromEquipment}>
                        Pular
                    </Button>
                    <Button
                        className="flex-1 h-12 bg-[#F7D601] hover:bg-yellow-400 text-green-800 font-bold"
                        onClick={handleGoFromEquipment}
                        disabled={selectedEquipment && !flowRateLha}
                    >
                        Avançar <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                </div>
            </div>
        );
    }

    // ==================== STEP: CONFIRM (Distribution) ====================
    if (step === "confirm" && selectedPlots.length > 0 && cart.length > 0) {
        // Build receituário table data
        const tableRows = confirmationData.map((item) => {
            const p = item.product;
            const cartItem = cart.find(c => c.product.id === p.id);
            const rawDose = cartItem?.dosePerHa !== undefined && cartItem?.dosePerHa !== '' ? parseBR(cartItem.dosePerHa) : parseBR(p.dosePerHa);
            const hasDose = !isNaN(rawDose) && rawDose > 0;
            const dose = hasDose ? rawDose : 0;
            const totalQty = Number(Number(item.totalQty).toFixed(4));
            const pkgSize = cartItem?.packageSize || p.packageSize || null;
            const emb = pkgSize && totalQty > 0 ? Math.ceil(totalQty / pkgSize) : null;
            const retirar = emb && pkgSize ? emb * pkgSize : totalQty;
            return { p, dose, hasDose, totalQty, pkgSize, emb, retirar, item };
        });

        // Calda & equipment summary (only for non-diesel)
        const totalCalda = !isDiesel && selectedEquipment ? (() => {
            const vazao = parseBR(flowRateLha) || 0;
            return vazao > 0 ? vazao * totalAreaSelected : 0;
        })() : 0;
        const tanques = selectedEquipment?.tankCapacityL && totalCalda > 0
            ? (totalCalda / (parseBR(selectedEquipment.tankCapacityL) || 1)).toFixed(1)
            : null;

        const season = pdvData?.seasons?.find((s: any) => s.id === selectedSeasonId);
        const seasonName = season?.name || "";
        const plotNames = selectedPlots.map(p => p.name).join(", ");

        return (
            <div className="h-screen bg-gray-50 text-gray-800 flex flex-col">

                <PDVTopBar step={step} title="Receituário" onBack={() => setStep("equipment")}
                    isOnline={isOnline} withdrawalsHistory={withdrawalsHistory} handleRegenerateReceituario={handleRegenerateReceituario} handleLogout={handleLogout} toast={toast} />

                <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-64 md:pb-32">
                    <div className="max-w-4xl mx-auto space-y-4">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Receituário de Aplicação</p>

                        {/* Receituário card */}
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            {/* Header info */}
                            <div className="px-5 py-4 border-b border-gray-100">
                                <h3 className="font-bold text-gray-800 text-base">Saída de Produtos</h3>
                                <p className="text-sm text-gray-500 mt-0.5">
                                    {seasonName && <>{seasonName} · </>}
                                    {plotNames} · {totalAreaSelected.toFixed(1)} ha · {new Date().toLocaleDateString("pt-BR")}
                                </p>
                            </div>

                            {/* Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wider">
                                            <th className="text-left px-5 py-3 font-bold">Produto</th>
                                            <th className="text-center px-3 py-3 font-bold">Dose</th>
                                            <th className="text-center px-3 py-3 font-bold">Qtd Real</th>
                                            <th className="text-center px-3 py-3 font-bold">Emb.</th>
                                            <th className="text-center px-3 py-3 font-bold">Retirar</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tableRows.map(({ p, dose, hasDose, totalQty, pkgSize, emb, retirar }) => (
                                            <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                                                <td className="px-5 py-3">
                                                    <p className="font-bold text-gray-800 leading-tight">{p.name}</p>
                                                    <p className="text-xs text-gray-400 capitalize">{p.category || "Geral"}</p>
                                                </td>
                                                <td className="text-center px-3 py-3 text-gray-600">
                                                    {hasDose ? `${dose.toFixed(2)} ${p.unit}/ha` : "—"}
                                                </td>
                                                <td className="text-center px-3 py-3 font-semibold text-gray-800">
                                                    {totalQty.toFixed(1)} {p.unit}
                                                </td>
                                                <td className="text-center px-3 py-3">
                                                    {pkgSize ? (
                                                        <span className="inline-block px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-bold">
                                                            {pkgSize} {p.unit}
                                                        </span>
                                                    ) : "—"}
                                                </td>
                                                <td className="text-center px-3 py-3">
                                                    {emb ? (
                                                        <span className="inline-block px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-100">
                                                            {emb} emb.<br />{retirar} {p.unit}
                                                        </span>
                                                    ) : (
                                                        <span className="font-semibold text-gray-800">{totalQty.toFixed(1)} {p.unit}</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Equipment & calda info */}
                            {!isDiesel && selectedEquipment && (
                                <div className="px-5 py-3 border-t border-gray-100 bg-emerald-50/50 text-sm text-emerald-800">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Tractor className="h-4 w-4 shrink-0" />
                                        <span className="font-semibold">{selectedEquipment.name}</span>
                                        {selectedEquipment.tankCapacityL && (
                                            <span className="text-emerald-600">({parseBR(selectedEquipment.tankCapacityL)} L)</span>
                                        )}
                                        {totalCalda > 0 && (
                                            <>
                                                <span className="text-emerald-400">·</span>
                                                <span>Calda: <strong>{totalCalda.toFixed(0)} L</strong></span>
                                            </>
                                        )}
                                        {tanques && (
                                            <>
                                                <span className="text-emerald-400">·</span>
                                                <span>{tanques} tanques</span>
                                            </>
                                        )}
                                        {flowRateLha && (
                                            <>
                                                <span className="text-emerald-400">·</span>
                                                <span>Vazão: {flowRateLha} L/ha</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Warning */}
                            <div className="px-5 py-3 border-t border-amber-100 bg-amber-50 text-sm">
                                <p className="font-semibold text-amber-800">Saída do estoque = quantidade real calculada</p>
                                <p className="text-xs text-amber-600 mt-0.5">O receituário mostra embalagens arredondadas para facilitar a retirada física. O desconto no estoque usa o valor exato calculado (dose x área).</p>
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
                    </div>
                </div>

                {/* Bottom bar */}
                <div className="p-4 bg-white/90 backdrop-blur-sm border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
                    <div className="max-w-4xl mx-auto flex flex-row items-center gap-3 mb-safe">
                        <Button variant="outline" className="h-12 flex-1 text-sm border-gray-200 hover:bg-gray-50 text-gray-600 font-medium rounded-xl" onClick={() => handleSubmit(true)} disabled={submitting}>
                            <FileText className="mr-2 h-4 w-4" />
                            Gerar PDF
                        </Button>
                        <Button
                            className="flex-[2] h-12 text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 transition-all active:scale-[0.98]"
                            onClick={() => handleSubmit(false)}
                            disabled={submitting}
                        >
                            {submitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Check className="mr-2 h-5 w-5" />}
                            Confirmar Saída
                        </Button>
                    </div>
                </div>
            </div>
        );
    }



    return (
        <div className="h-screen bg-gray-50 text-gray-800 flex flex-col">
            {/* ===== GREEN HEADER ===== */}
            <header className="bg-gradient-to-r from-emerald-800 via-emerald-900 to-emerald-700 shrink-0 z-20 shadow-lg" style={{ paddingTop: "max(env(safe-area-inset-top), 0px)" }}>
                <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2.5">
                        <h1 className="font-extrabold text-xl text-white">{pdvData?.terminal?.name || "Depósito Central"}</h1>
                        <div className={`w-2.5 h-2.5 rounded-full ring-2 ring-white/20 ${isOnline ? "bg-green-300" : "bg-red-400"}`} />
                    </div>
                    <div className="flex items-center gap-2">
                        {offlineQueue.length > 0 && isOnline && (
                            <button onClick={processOfflineQueue} disabled={submitting}
                                className="px-3 py-1.5 rounded-lg bg-white/20 text-white text-xs font-bold animate-pulse backdrop-blur-sm">
                                Sync ({offlineQueue.length})
                            </button>
                        )}
                        <div className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white font-bold text-sm">
                            {(pdvData?.terminal?.name || "D")[0]}
                        </div>
                    </div>
                </div>

                {/* Deposit selector (only if farmer has deposits) */}
                {hasDeposits && (
                    <div className="px-4 pb-2 flex gap-1.5 overflow-x-auto scrollbar-hide">
                        <button
                            onClick={() => setDepositFilter("")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${!depositFilter ? "bg-white text-emerald-700 shadow-sm" : "bg-white/15 text-white/80 hover:bg-white/25 backdrop-blur-sm"}`}
                        >Todos</button>
                        {deposits.map((d: any) => (
                            <button
                                key={d.id}
                                onClick={() => setDepositFilter(depositFilter === d.id ? "" : d.id)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${depositFilter === d.id ? "bg-white text-emerald-700 shadow-sm" : "bg-white/15 text-white/80 hover:bg-white/25 backdrop-blur-sm"}`}
                            >{d.name}</button>
                        ))}
                        <button
                            onClick={() => setDepositFilter(depositFilter === "__no_deposit__" ? "" : "__no_deposit__")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${depositFilter === "__no_deposit__" ? "bg-white text-emerald-700 shadow-sm" : "bg-white/15 text-white/80 hover:bg-white/25 backdrop-blur-sm"}`}
                        >Sem deposito</button>
                    </div>
                )}

                {/* Search */}
                <div className="px-4 pb-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600" />
                        <Input
                            className="pl-10 h-11 bg-white border border-emerald-200 text-black placeholder:text-gray-500 text-sm rounded-xl focus:ring-emerald-200 focus:border-emerald-300"
                            placeholder="Pesquisar produtos..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            autoFocus
                        />
                    </div>
                </div>

                {/* Category pills */}
                <div className="px-4 pb-3 flex gap-2 overflow-x-auto scrollbar-hide">
                    <button
                        onClick={() => setCategoryFilter("")}
                        className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${!categoryFilter ? "bg-white text-emerald-700 shadow-sm" : "bg-white/15 text-white/80 hover:bg-white/25 backdrop-blur-sm"}`}
                    >Todos ({products.length})</button>
                    {categories.map(cat => {
                        const count = products.filter((p: any) => p.category === cat).length;
                        return (
                            <button
                                key={cat}
                                onClick={() => setCategoryFilter(categoryFilter === cat ? "" : cat)}
                                className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${categoryFilter === cat ? "bg-white text-emerald-700 shadow-sm" : "bg-white/15 text-white/80 hover:bg-white/25 backdrop-blur-sm"}`}
                            >
                                <span>{CATEGORY_EMOJI[cat] || "📦"}</span>
                                {cat.charAt(0).toUpperCase() + cat.slice(1)} ({count})
                            </button>
                        );
                    })}
                </div>
            </header>

            {/* ===== MAIN CONTENT ===== */}
            <div className="flex-1 flex overflow-hidden">
                {/* Product list */}
                <div className="flex-1 overflow-y-auto px-4 py-3" style={{ paddingBottom: 80 }}>
                    <div className="flex flex-col gap-2.5">
                        {filtered.map((p: any) => {
                            const stockQty = getStockForProduct(p.id);
                            const inCart = isInCart(p.id);
                            const lowStock = stockQty <= 0;
                            return (
                                <button
                                    key={p.id}
                                    onClick={() => addToCart(p)}
                                    disabled={lowStock}
                                    className={`group relative flex items-center gap-3.5 rounded-2xl transition-all duration-200 bg-white text-left p-3 ${lowStock ? "opacity-50 cursor-not-allowed" : "hover:shadow-md active:scale-[0.99]"} ${inCart ? "ring-2 ring-emerald-500 shadow-md shadow-emerald-100" : "border border-gray-100 shadow-sm"}`}
                                >
                                    {/* Product image */}
                                    <div className="w-16 h-16 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center relative overflow-hidden shrink-0">
                                        {p.imageUrl ? (
                                            <img src={p.imageUrl} alt={p.name} className="w-full h-full object-contain p-1.5"
                                                onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.nextElementSibling?.classList.remove("hidden"); }} />
                                        ) : null}
                                        <div className={`flex items-center justify-center ${p.imageUrl ? "hidden" : ""}`}>
                                            <span className="text-2xl">{CATEGORY_EMOJI[p.category] || "📦"}</span>
                                        </div>
                                        {inCart && (
                                            <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-emerald-500 rounded-md flex items-center justify-center shadow z-20">
                                                <Check className="h-3 w-3 text-white" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Product info */}
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-[15px] leading-snug text-gray-900 line-clamp-1">{p.name}</p>
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            {p.unit || "UN"} · {p.category ? p.category.charAt(0).toUpperCase() + p.category.slice(1) : "Geral"}
                                        </p>
                                        {p.dosePerHa && (
                                            <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 text-[11px] font-bold">
                                                <Droplets className="h-3 w-3" />
                                                {parseFloat(p.dosePerHa).toFixed(1)} {p.unit}/ha
                                            </span>
                                        )}
                                    </div>

                                    {/* Stock */}
                                    <div className="shrink-0 text-right">
                                        {lowStock ? (
                                            <span className="text-xs font-bold px-2.5 py-1 rounded-lg border border-red-200 text-red-500 bg-red-50">
                                                Sem estoque
                                            </span>
                                        ) : (
                                            <div>
                                                <p className="text-xl font-extrabold text-emerald-600 leading-none">{stockQty.toFixed(0)}</p>
                                                <p className="text-[10px] text-gray-400 font-medium">{p.unit || "litros"}</p>
                                            </div>
                                        )}
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

                {/* Desktop cart panel */}
                <div className="w-[480px] lg:w-[560px] bg-white border-l border-gray-100 flex flex-col shrink-0 hidden md:flex shadow-lg">
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <ShoppingCart className="h-5 w-5 text-emerald-600" />
                            <h3 className="font-bold text-base text-gray-900">Carrinho</h3>
                        </div>
                        {cart.length > 0 && (
                            <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full">
                                {cart.length} {cart.length === 1 ? "item" : "itens"}
                            </span>
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
                                    Clique nos produtos ao lado para adicioná-los
                                </p>
                            </div>
                        ) : (
                            <div className="p-3 space-y-2">
                                {cart.map((item) => {
                                    const stk = getStockForProduct(item.product.id);
                                    const overStock = Number(item.quantity) > stk;
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
                                                        <span className="text-[10px] text-gray-300">·</span>
                                                        <span className={`text-[10px] font-medium ${stk <= 0 ? "text-red-500" : "text-emerald-500"}`}>
                                                            Estoque: {stk.toFixed(0)} {item.product.unit}
                                                        </span>
                                                    </div>
                                                </div>
                                                <button onClick={() => removeFromCart(item.product.id)} className="text-gray-300 hover:text-red-500 shrink-0 p-0.5 transition-colors">
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <Label className="text-[10px] text-gray-400 uppercase font-bold tracking-wide mb-1 block pl-1">Quantidade</Label>
                                                    <div className="flex items-center gap-1.5">
                                                        <button className="w-9 h-9 rounded-lg bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center shadow-sm transition-colors active:scale-95 text-white"
                                                            onClick={() => updateQuantity(item.product.id, Number(item.quantity) - 1)}>
                                                            <Minus className="h-3.5 w-3.5" />
                                                        </button>
                                                        <Input type="text" inputMode="decimal"
                                                            value={item.quantity === 0 ? "" : item.quantity}
                                                            onChange={(e) => {
                                                                let val = e.target.value.replace(/[^0-9.,]/g, "");
                                                                if (val.startsWith(",") || val.startsWith(".")) val = "0" + val;
                                                                updateQuantity(item.product.id, val);
                                                            }}
                                                            onFocus={(e) => e.target.select()}
                                                            className="text-center text-base font-bold flex-1 h-9 bg-white border-gray-200 text-gray-800 rounded-lg" />
                                                        <button className="w-9 h-9 rounded-lg bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center shadow-sm transition-colors active:scale-95 text-white"
                                                            onClick={() => updateQuantity(item.product.id, Number(item.quantity) + 1)}>
                                                            <Plus className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div>
                                                    <Label className="text-[10px] text-gray-400 uppercase font-bold tracking-wide mb-1 block pl-1">Dose/ha ({item.product.unit})</Label>
                                                    <Input type="text" inputMode="decimal"
                                                        value={item.dosePerHa === 0 ? "" : (item.dosePerHa || "")} placeholder="N/A"
                                                        onChange={(e) => {
                                                            let val = e.target.value.replace(/[^0-9.,]/g, "");
                                                            if (val.startsWith(",") || val.startsWith(".")) val = "0" + val;
                                                            updateDose(item.product.id, val);
                                                        }}
                                                        className="text-center text-sm font-medium h-9 bg-blue-50/50 border-blue-100 text-blue-700 rounded-lg focus:ring-blue-500 focus:border-blue-500" />
                                                </div>
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

                    <div className="p-4 border-t border-gray-100 bg-gray-50/80 space-y-3">
                        {cart.length > 0 && (
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">{cart.length} produto(s)</span>
                                <span className="text-emerald-600 font-bold">{totalCartQty} unidades total</span>
                            </div>
                        )}
                        <Button
                            className="w-full py-5 text-base bg-emerald-600 hover:bg-emerald-700 font-bold rounded-xl shadow-md transition-all active:scale-[0.98]"
                            onClick={handleGoToPlot}
                            disabled={cart.length === 0}
                        >
                            <ArrowRight className="mr-2 h-5 w-5" />
                            {isDiesel ? "Selecionar Veículo" : "Selecionar Talhões"}
                        </Button>
                    </div>
                </div>
            </div>

            {/* ===== BOTTOM TAB NAVIGATION ===== */}
            <nav className="bg-white border-t border-gray-200 shrink-0 z-50 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]"
                style={{ paddingBottom: "max(env(safe-area-inset-bottom), 4px)" }}>
                <div className="flex items-center justify-around px-2 pt-1.5 pb-1">
                    {/* Produtos */}
                    <button onClick={() => setStep("product_select")}
                        className="flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl transition-all text-gray-400">
                        <div className="p-1.5 rounded-xl">
                            <ShoppingCart className="h-5 w-5" />
                        </div>
                        <span className="text-[10px] font-semibold">Produtos</span>
                    </button>

                    {/* Carrinho (Sheet) */}
                    <Sheet>
                        <SheetTrigger asChild>
                            <button className="flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl transition-all text-gray-400 relative">
                                <div className="p-1.5 rounded-xl relative">
                                    <ShoppingCart className="h-5 w-5" />
                                    {cart.length > 0 && (
                                        <span className="absolute -top-1 -right-1 w-4.5 h-4.5 min-w-[18px] bg-red-500 rounded-full text-[9px] font-bold flex items-center justify-center text-white shadow">{cart.length}</span>
                                    )}
                                </div>
                                <span className="text-[10px] font-semibold">Carrinho</span>
                            </button>
                        </SheetTrigger>
                        <SheetContent side="bottom" className="h-[80vh] rounded-t-3xl p-0 flex flex-col">
                            <SheetHeader className="p-5 border-b border-gray-100">
                                <SheetTitle className="flex items-center gap-2 text-gray-900">
                                    <ShoppingCart className="h-5 w-5 text-emerald-600" />
                                    Carrinho
                                </SheetTitle>
                                <SheetDescription>Revise os itens antes de prosseguir</SheetDescription>
                            </SheetHeader>
                            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                {cart.length > 0 ? cart.map(item => (
                                    <div key={item.product.id} className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
                                        <div className="flex items-center gap-3 mb-3">
                                            {item.product.imageUrl ? (
                                                <img src={item.product.imageUrl} className="w-12 h-12 rounded-lg object-contain bg-gray-50 border border-gray-100" alt="" />
                                            ) : (
                                                <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${CATEGORY_COLORS[item.product.category] || CATEGORY_COLORS.outro} flex items-center justify-center`}>
                                                    <span className="text-xl">{CATEGORY_EMOJI[item.product.category] || "📦"}</span>
                                                </div>
                                            )}
                                            <div className="flex-1">
                                                <h4 className="font-bold text-sm text-gray-800 line-clamp-1">{item.product.name}</h4>
                                                <p className="text-xs text-gray-500">{item.product.category || "Geral"}</p>
                                            </div>
                                            <button onClick={() => removeFromCart(item.product.id)}
                                                className="w-8 h-8 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors">
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <Label className="text-[10px] text-gray-400 uppercase font-bold tracking-wide mb-1 block pl-1">Quantidade</Label>
                                                <div className="flex items-center gap-1.5">
                                                    <button className="w-9 h-9 rounded-lg bg-white border border-gray-200 text-emerald-600 flex items-center justify-center shadow-sm active:scale-95 touch-manipulation"
                                                        onClick={() => updateQuantity(item.product.id, Number(item.quantity) - 1)}>
                                                        <Minus className="h-3.5 w-3.5" />
                                                    </button>
                                                    <Input type="text" inputMode="decimal"
                                                        value={item.quantity === 0 ? "" : item.quantity}
                                                        onChange={(e) => {
                                                            let val = e.target.value.replace(/[^0-9.,]/g, "");
                                                            if (val.startsWith(",") || val.startsWith(".")) val = "0" + val;
                                                            updateQuantity(item.product.id, val);
                                                        }}
                                                        onFocus={(e) => e.target.select()}
                                                        className="text-center text-base font-bold flex-1 h-9 bg-gray-50 border-transparent text-gray-800 rounded-lg focus:bg-white focus:border-emerald-500" />
                                                    <button className="w-9 h-9 rounded-lg bg-emerald-500 text-white flex items-center justify-center shadow-sm active:scale-95 touch-manipulation"
                                                        onClick={() => updateQuantity(item.product.id, Number(item.quantity) + 1)}>
                                                        <Plus className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                            <div>
                                                <Label className="text-[10px] text-gray-400 uppercase font-bold tracking-wide mb-1 block pl-1">Dose/ha ({item.product.unit})</Label>
                                                <Input type="text" inputMode="decimal" value={item.dosePerHa || ""} placeholder="N/A"
                                                    onChange={(e) => {
                                                        let val = e.target.value.replace(/[^0-9.,]/g, "");
                                                        if (val.startsWith(",") || val.startsWith(".")) val = "0" + val;
                                                        updateDose(item.product.id, val);
                                                    }}
                                                    className="text-center text-sm font-medium h-9 bg-blue-50/50 border-blue-100 text-blue-700 rounded-lg focus:ring-blue-500 focus:border-blue-500" />
                                            </div>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-400 py-16">
                                        <ShoppingCart className="h-12 w-12 opacity-20 mb-4" />
                                        <p className="text-sm font-medium">Carrinho vazio</p>
                                    </div>
                                )}
                            </div>
                            {cart.length > 0 && (
                                <div className="p-4 border-t border-gray-100 bg-gray-50/50">
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-sm font-medium text-gray-600">Total</span>
                                        <span className="text-emerald-600 font-bold">{totalCartQty} unidades</span>
                                    </div>
                                    <SheetTrigger asChild>
                                        <Button className="w-full py-6 text-base bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg"
                                            onClick={() => setStep("plot")}>
                                            {isDiesel ? "Avançar para Máquinas" : "Avançar para Talhões"}
                                            <ArrowRight className="ml-2 h-5 w-5" />
                                        </Button>
                                    </SheetTrigger>
                                </div>
                            )}
                        </SheetContent>
                    </Sheet>

                    {/* Talhões */}
                    <button onClick={() => { if (cart.length > 0) setStep("plot" as any); }}
                        className={`flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl transition-all ${(step as any) === "plot" ? "text-emerald-600" : "text-gray-400"}`}>
                        <div className={`p-1.5 rounded-xl transition-all ${(step as any) === "plot" ? "bg-emerald-100" : ""}`}>
                            <MapPin className="h-5 w-5" />
                        </div>
                        <span className="text-[10px] font-semibold">{isDiesel ? "Veículos" : "Talhões"}</span>
                    </button>

                    {/* Histórico (Sheet) */}
                    <Sheet>
                        <SheetTrigger asChild>
                            <button className="flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl transition-all text-gray-400">
                                <div className="p-1.5 rounded-xl">
                                    <FileText className="h-5 w-5" />
                                </div>
                                <span className="text-[10px] font-semibold">Histórico</span>
                            </button>
                        </SheetTrigger>
                        <SheetContent side="bottom" className="h-[70vh] rounded-t-3xl p-0 flex flex-col">
                            <SheetHeader className="p-4 border-b border-gray-200 bg-white">
                                <SheetTitle className="flex items-center gap-2 text-gray-900">
                                    <FileText className="h-5 w-5 text-emerald-600" />
                                    Saídas Recentes
                                </SheetTitle>
                                <SheetDescription className="text-xs text-gray-400">Últimas 10 saídas registradas</SheetDescription>
                            </SheetHeader>
                            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                {withdrawalsHistory && withdrawalsHistory.length > 0 ? (
                                    withdrawalsHistory.slice(0, 10).map((batch: any) => (
                                        <div key={batch.batchId} className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
                                            <div className="mb-3">
                                                <span className="text-[10px] text-gray-400 font-medium bg-gray-50 px-1.5 py-0.5 rounded">
                                                    {new Date(batch.appliedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                                                </span>
                                                <p className="text-xs font-bold text-gray-800 line-clamp-1 mt-1">{batch.propertyName || "Propriedade sem nome"}</p>
                                                <p className="text-[10px] text-emerald-600 font-medium mt-0.5">{batch.applications.length} itens aplicados</p>
                                            </div>
                                            <Button size="sm" variant="outline"
                                                className="w-full text-xs h-7 border-dashed border-gray-300 text-gray-500 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50"
                                                onClick={() => handleRegenerateReceituario(batch)}>
                                                <FileText className="h-3 w-3 mr-1" /> Ver Receituário
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

                    {/* Sair */}
                    <button onClick={handleLogout}
                        className="flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl transition-all text-gray-400 hover:text-red-500">
                        <div className="p-1.5 rounded-xl">
                            <LogOut className="h-5 w-5" />
                        </div>
                        <span className="text-[10px] font-semibold">Sair</span>
                    </button>
                </div>
            </nav>
        </div>
    );
}
