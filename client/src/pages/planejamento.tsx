import Header from "@/components/layout/header";
import Navbar from "@/components/layout/navbar";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Save, Calculator, DollarSign, AlertCircle, ArrowRight, ArrowLeft, History, CheckCircle2, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Client, PlanningProduct, SalesPlanning, SalesPlanningItem } from "@shared/schema";

// --- Types & Interfaces ---
type ViewMode = "SETUP" | "PLANNING";
type Segment = "Fungicidas" | "Inseticidas" | "TS" | "Dessecação" | "Outros";

interface GlobalSetupProps {
    products: PlanningProduct[];
    selectedIds: Set<string>;
    onToggle: (id: string) => void;
    onFinish: () => void;
    isSaving?: boolean;
}

interface SharePlanningProps {
    client: Client;
    activeSeason: { id: string; name: string };
    globalSelectedIds: Set<string>;
    products: PlanningProduct[];
    purchaseHistory?: { purchasedProductNames: string[] };
    onBack: () => void;
}

// --- Main Page Component ---
export default function PlanejamentoPage() {
    const { toast } = useToast();
    const [viewMode, setViewMode] = useState<ViewMode>("SETUP");
    const [selectedClientId, setSelectedClientId] = useState<string>("");
    const [isConfigLoaded, setIsConfigLoaded] = useState(false);

    // Global Selection State (The "Manejo" List)
    const [globalSelectedIds, setGlobalSelectedIds] = useState<Set<string>>(new Set());

    // Queries
    const { data: activeSeason } = useQuery<{ id: string; name: string }>({
        queryKey: ["/api/seasons/active"],
    });

    const { data: clients } = useQuery<Client[]>({
        queryKey: ["/api/clients"],
    });

    const { data: products } = useQuery<PlanningProduct[]>({
        queryKey: ["/api/planning/products", activeSeason?.id],
        queryFn: async () => {
            const res = await apiRequest("GET", `/api/planning/products?seasonId=${activeSeason?.id}`);
            return res.json();
        },
        enabled: !!activeSeason?.id,
    });

    // Fetch Persisted Global Config
    const { data: globalConfig, isLoading: isLoadingConfig } = useQuery<{ productIds: string[] }>({
        queryKey: ["/api/planning/global", activeSeason?.id],
        queryFn: async () => {
            const res = await apiRequest("GET", `/api/planning/global?seasonId=${activeSeason?.id}`);
            return res.json();
        },
        enabled: !!activeSeason?.id,
    });

    // Initialize State from Config
    useEffect(() => {
        if (globalConfig?.productIds && !isConfigLoaded) {
            setGlobalSelectedIds(new Set(globalConfig.productIds));
            if (globalConfig.productIds.length > 0) {
                setViewMode("PLANNING");
            }
            setIsConfigLoaded(true);
        } else if (globalConfig === null && !isConfigLoaded && !isLoadingConfig) {
            // No config found, stay in SETUP
            setIsConfigLoaded(true);
        }
    }, [globalConfig, isConfigLoaded, isLoadingConfig]);

    // Save Mutation
    const saveGlobalConfigMutation = useMutation({
        mutationFn: async (ids: string[]) => {
            await apiRequest("POST", "/api/planning/global", {
                seasonId: activeSeason?.id,
                productIds: ids
            });
        },
        onSuccess: () => {
            toast({ title: "Manejo Global Salvo", description: "Configuração atualizada com sucesso." });
            queryClient.invalidateQueries({ queryKey: ["/api/planning/global"] });
            setViewMode("PLANNING");
        },
        onError: () => toast({ title: "Erro ao salvar", variant: "destructive" })
    });

    // Client Specific History
    const { data: purchaseHistory } = useQuery<{ purchasedProductNames: string[] }>({
        queryKey: ["/api/planning/client-history", selectedClientId],
        enabled: !!selectedClientId,
    });

    const selectedClient = clients?.find(c => c.id === selectedClientId);

    if (isLoadingConfig || !activeSeason) {
        return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8" /></div>;
    }

    return (
        <div className="h-screen flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-900">
            <Header
                title="Planejamento de Vendas 2026"
                subtitle={viewMode === "SETUP" ? "Definição Global de Manejo" : `Planejamento: ${selectedClient?.name || "Selecione um Cliente"}`}
            />
            <Navbar />

            <main className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="max-w-7xl mx-auto space-y-6">

                    {/* Navigation / Context Switcher */}
                    {viewMode === "PLANNING" && (
                        <Card className="shadow-sm border-l-4 border-l-primary mb-6">
                            <CardContent className="pt-6 flex flex-col md:flex-row gap-4 items-end justify-between">
                                <div className="space-y-2 w-full md:w-1/2">
                                    <Label>Cliente em Planejamento</Label>
                                    <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                                        <SelectTrigger className="bg-white">
                                            <SelectValue placeholder="Selecione um cliente..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {clients?.map((client) => (
                                                <SelectItem key={client.id} value={client.id}>
                                                    {client.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Button variant="outline" onClick={() => setViewMode("SETUP")} className="mb-[2px]">
                                    <Settings className="w-4 h-4 mr-2" />
                                    Editar Manejo Global
                                </Button>
                            </CardContent>
                        </Card>
                    )}

                    <div className={viewMode === "SETUP" ? "block" : "hidden"}>
                        <GlobalSetup
                            products={products || []}
                            selectedIds={globalSelectedIds}
                            onToggle={(id) => {
                                const newSet = new Set(globalSelectedIds);
                                if (newSet.has(id)) newSet.delete(id);
                                else newSet.add(id);
                                setGlobalSelectedIds(newSet);
                            }}
                            onFinish={() => saveGlobalConfigMutation.mutate(Array.from(globalSelectedIds))}
                            isSaving={saveGlobalConfigMutation.isPending}
                        />
                    </div>

                    <div className={viewMode === "PLANNING" ? "block" : "hidden"}>
                        {selectedClientId && selectedClient && activeSeason ? (
                            <SharePlanning
                                client={selectedClient}
                                activeSeason={activeSeason}
                                globalSelectedIds={globalSelectedIds}
                                products={products || []}
                                purchaseHistory={purchaseHistory}
                                onBack={() => setSelectedClientId("")}
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground bg-white rounded-lg border border-dashed">
                                <div className="bg-slate-100 p-4 rounded-full mb-4">
                                    <AlertCircle className="w-12 h-12 text-slate-400" />
                                </div>
                                <h3 className="text-xl font-medium mb-2">Selecione um Cliente</h3>
                                <p>Escolha um cliente acima para iniciar a definição de share e quantidades.</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}

// --- Sub-Components (Defined outside to prevent re-renders) ---

function GlobalSetup({ products, selectedIds, onToggle, onFinish, isSaving }: GlobalSetupProps) {
    const categories: Segment[] = ["Fungicidas", "Inseticidas", "TS", "Dessecação"];

    // Group products specifically for the tabs
    const groupedProducts = useMemo(() => {
        const groups: Record<Segment, PlanningProduct[]> = {
            "Fungicidas": [], "Inseticidas": [], "TS": [], "Dessecação": [], "Outros": []
        };
        products.forEach(p => {
            const seg = p.segment?.toLowerCase() || "";
            if (seg.includes("fungicida")) groups["Fungicidas"].push(p);
            else if (seg.includes("inseticida")) groups["Inseticidas"].push(p);
            else if (seg.includes("ts") || seg.includes("tratamento")) groups["TS"].push(p);
            else if (seg.includes("herbicida") || seg.includes("desseca")) groups["Dessecação"].push(p);
            else groups["Outros"].push(p);
        });
        return groups;
    }, [products]);

    return (
        <Card className="shadow-sm border-t-4 border-t-blue-500">
            <CardHeader>
                <CardTitle>Passo 0: Montar Manejo Global</CardTitle>
                <CardDescription>
                    Selecione os produtos que farão parte da sua estratégia principal para esta safra.
                    Esta lista servirá de base para todos os clientes.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="Fungicidas" className="w-full">
                    <TabsList className="grid w-full grid-cols-4 mb-4">
                        {categories.map(cat => (
                            <TabsTrigger key={cat} value={cat}>{cat}</TabsTrigger>
                        ))}
                    </TabsList>

                    {categories.map(cat => (
                        <TabsContent key={cat} value={cat} className="mt-0">
                            <div className="rounded-md border h-[500px] overflow-y-auto">
                                <Table>
                                    <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                                        <TableRow>
                                            <TableHead className="w-[50px]">Select</TableHead>
                                            <TableHead>Produto</TableHead>
                                            <TableHead>Preço Ref ($)</TableHead>
                                            <TableHead>Dose Padrão</TableHead>
                                            <TableHead>Embalagem</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {groupedProducts[cat].map(product => {
                                            const isSelected = selectedIds.has(product.id);
                                            return (
                                                <TableRow key={product.id} className={isSelected ? "bg-blue-50" : ""}>
                                                    <TableCell>
                                                        <Checkbox
                                                            checked={isSelected}
                                                            onCheckedChange={() => onToggle(product.id)}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="font-medium">{product.name}</TableCell>
                                                    <TableCell>${parseFloat(product.price || "0").toFixed(2)}</TableCell>
                                                    <TableCell>{product.dosePerHa || "-"} {product.unit}</TableCell>
                                                    <TableCell>{product.packageSize ? `${product.packageSize} ${product.unit}` : "-"}</TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </TabsContent>
                    ))}
                </Tabs>

                <div className="mt-6 flex justify-end">
                    <Button onClick={onFinish} className="w-[200px]" size="lg" disabled={isSaving}>
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                        Salvar Manejo
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

function SharePlanning({ client, activeSeason, globalSelectedIds, products, purchaseHistory, onBack }: SharePlanningProps) {
    const { toast } = useToast();

    // State for areas
    const [areas, setAreas] = useState({
        fungicides: "0",
        insecticides: "0",
        ts: "0",
        herbicides: "0",
        total: client.plantingArea?.toString() || "0"
    });

    // Per-product customizations (Dose adjustments)
    const [customDoses, setCustomDoses] = useState<Record<string, string>>({});

    // EFFECT: Initialize areas from client or existing planning (if we fetch it later)
    useEffect(() => {
        setAreas(prev => ({ ...prev, total: client.plantingArea?.toString() || "0" }));
    }, [client]);

    // Derived: Active Product List (Global + History)
    const activeProducts = useMemo(() => {
        // Start with global selection
        const selected = products.filter(p => globalSelectedIds.has(p.id));

        // Add History Items (Fuzzy Match / Injection)
        if (purchaseHistory?.purchasedProductNames) {
            products.forEach(p => {
                if (globalSelectedIds.has(p.id)) return; // Already included

                const pName = p.name.toLowerCase();
                const foundInHistory = purchaseHistory.purchasedProductNames.some(hName => {
                    const histName = hName.toLowerCase();
                    return histName.includes(pName) || pName.includes(histName);
                });

                if (foundInHistory) {
                    // Mark as history-added? We just push to array for now.
                    // Ideally we want to tag it for UI highlight
                    selected.push(p);
                }
            });
        }
        return selected;
    }, [globalSelectedIds, products, purchaseHistory]);

    // Grouping for Display
    const layoutGroups = useMemo(() => {
        const groups: Record<string, PlanningProduct[]> = {
            "Fungicidas": [], "Inseticidas": [], "TS": [], "Dessecação": []
        };
        activeProducts.forEach(p => {
            const seg = p.segment?.toLowerCase() || "";
            if (seg.includes("fungicida")) groups["Fungicidas"].push(p);
            else if (seg.includes("inseticida")) groups["Inseticidas"].push(p);
            else if (seg.includes("ts") || seg.includes("tratamento")) groups["TS"].push(p);
            else if (seg.includes("herbicida") || seg.includes("desseca")) groups["Dessecação"].push(p);
        });
        return groups;
    }, [activeProducts]);

    // Calculation Helper
    const calculateRow = (product: PlanningProduct, segmentArea: number) => {
        const price = parseFloat(product.price || "0");
        const dose = parseFloat(customDoses[product.id] ?? product.dosePerHa ?? "0");
        const packageSize = parseFloat(product.packageSize?.toString() || "0");

        const rawQuantity = segmentArea * dose;

        // Rounding Logic: Round up to nearest package
        let quantity = rawQuantity;
        if (packageSize > 0) {
            quantity = Math.ceil(rawQuantity / packageSize) * packageSize;
        }

        const totalValue = quantity * price;
        return { quantity, totalValue, dose };
    };

    // Calculate Totals
    const totals = useMemo(() => {
        let totalVal = 0;
        Object.values(layoutGroups).flat().forEach(p => {
            const seg = p.segment?.toLowerCase() || "";
            let area = 0;
            if (seg.includes("fungicida")) area = parseFloat(areas.fungicides);
            else if (seg.includes("inseticida")) area = parseFloat(areas.insecticides);
            else if (seg.includes("ts")) area = parseFloat(areas.ts);
            else if (seg.includes("desseca")) area = parseFloat(areas.herbicides);

            totalVal += calculateRow(p, area).totalValue;
        });
        return totalVal;
    }, [layoutGroups, areas, customDoses]);

    const saveMutation = useMutation({
        mutationFn: async () => {
            const itemsToSave = activeProducts.map(p => {
                const seg = p.segment?.toLowerCase() || "";
                let area = 0;
                if (seg.includes("fungicida")) area = parseFloat(areas.fungicides);
                else if (seg.includes("inseticida")) area = parseFloat(areas.insecticides);
                else if (seg.includes("ts")) area = parseFloat(areas.ts);
                else if (seg.includes("desseca") || seg.includes("herbicida")) area = parseFloat(areas.herbicides);

                if (area <= 0) return null; // Don't save items for 0 area segments? Or save 0?

                const { quantity, totalValue } = calculateRow(p, area);
                if (quantity <= 0) return null;

                return {
                    productId: p.id,
                    quantity: quantity.toString(),
                    totalAmount: totalValue.toString()
                };
            }).filter(Boolean);

            const payload = {
                planning: {
                    clientId: client.id,
                    seasonId: activeSeason.id,
                    totalPlantingArea: areas.total,
                    fungicidesArea: areas.fungicides,
                    insecticidesArea: areas.insecticides,
                    herbicidesArea: areas.herbicides,
                    seedTreatmentArea: areas.ts
                },
                items: itemsToSave
            };

            return apiRequest("POST", "/api/planning", payload);
        },
        onSuccess: () => {
            toast({ title: "Planejamento Salvo", description: "Dados gravados com sucesso." });
            queryClient.invalidateQueries({ queryKey: ["/api/planning", client.id] });
        },
        onError: () => toast({ title: "Erro", variant: "destructive" })
    });

    return (
        <div className="space-y-6">
            {/* Header / Totals */}
            <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm border">
                <div className="flex gap-4">
                    <div>
                        <Label className="text-xs uppercase text-muted-foreground">Área Total (ha)</Label>
                        <div className="text-2xl font-bold">{areas.total}</div>
                    </div>
                </div>
                <div className="text-right">
                    <Label className="text-xs uppercase text-muted-foreground">Potencial Total</Label>
                    <div className="text-3xl font-bold text-green-600">
                        ${totals.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Area Inputs */}
                <Card className="h-fit">
                    <CardHeader>
                        <CardTitle className="text-lg">Definição de Áreas</CardTitle>
                        <CardDescription>Distribua a área de plantio</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-green-600 font-bold">Fungicidas (ha)</Label>
                            <Input type="number" value={areas.fungicides} onChange={e => setAreas(p => ({ ...p, fungicides: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-yellow-600 font-bold">Inseticidas (ha)</Label>
                            <Input type="number" value={areas.insecticides} onChange={e => setAreas(p => ({ ...p, insecticides: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-orange-600 font-bold">Trat. Sementes (ha)</Label>
                            <Input type="number" value={areas.ts} onChange={e => setAreas(p => ({ ...p, ts: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-red-600 font-bold">Dessecação (ha)</Label>
                            <Input type="number" value={areas.herbicides} onChange={e => setAreas(p => ({ ...p, herbicides: e.target.value }))} />
                        </div>
                    </CardContent>
                </Card>

                {/* Right Column: Calculator Table */}
                <Card className="lg:col-span-2 border-t-4 border-t-green-500">
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <CardTitle>Produtos & Cálculo</CardTitle>
                            <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="bg-green-600 hover:bg-green-700">
                                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                Salvar Planejamento
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Tabs defaultValue="Fungicidas">
                            <TabsList className="grid w-full grid-cols-4 mb-4">
                                <TabsTrigger value="Fungicidas">Fungi</TabsTrigger>
                                <TabsTrigger value="Inseticidas">Inseti</TabsTrigger>
                                <TabsTrigger value="TS">TS</TabsTrigger>
                                <TabsTrigger value="Dessecação">Desseca</TabsTrigger>
                            </TabsList>

                            {Object.entries(layoutGroups).map(([segment, groupProducts]) => {
                                // Determine active area for this segment to pass to calculation
                                let currentArea = 0;
                                if (segment === "Fungicidas") currentArea = parseFloat(areas.fungicides);
                                else if (segment === "Inseticidas") currentArea = parseFloat(areas.insecticides);
                                else if (segment === "TS") currentArea = parseFloat(areas.ts);
                                else if (segment === "Dessecação") currentArea = parseFloat(areas.herbicides);

                                return (
                                    <TabsContent key={segment} value={segment}>
                                        <div className="rounded-md border max-h-[600px] overflow-y-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="w-[40%]">Produto</TableHead>
                                                        <TableHead className="text-right w-[15%]">Dose/ha</TableHead>
                                                        <TableHead className="text-right w-[15%]">Preço</TableHead>
                                                        <TableHead className="text-right w-[15%]">Qtd (Emb)</TableHead>
                                                        <TableHead className="text-right w-[15%]">Total</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {groupProducts.map(p => {
                                                        const { quantity, totalValue } = calculateRow(p, currentArea);
                                                        const isHistory = purchaseHistory?.purchasedProductNames.some(h => h.toLowerCase().includes(p.name.toLowerCase()));

                                                        return (
                                                            <TableRow key={p.id} className={isHistory && !globalSelectedIds.has(p.id) ? "bg-amber-50" : ""}>
                                                                <TableCell>
                                                                    <div className="font-medium">{p.name}</div>
                                                                    <div className="text-xs text-muted-foreground">
                                                                        Emb: {p.packageSize || "?"} {p.unit}
                                                                        {isHistory && <span className="ml-2 text-amber-600 font-bold">(Histórico)</span>}
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Input
                                                                        type="number"
                                                                        className="h-8 text-right"
                                                                        placeholder={p.dosePerHa}
                                                                        value={customDoses[p.id] ?? p.dosePerHa ?? ""}
                                                                        onChange={(e) => setCustomDoses(prev => ({ ...prev, [p.id]: e.target.value }))}
                                                                    />
                                                                </TableCell>
                                                                <TableCell className="text-right">${p.price}</TableCell>
                                                                <TableCell className="text-right font-mono text-blue-600">
                                                                    {quantity.toFixed(1)}
                                                                </TableCell>
                                                                <TableCell className="text-right font-bold text-green-700">
                                                                    ${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                    {groupProducts.length === 0 && (
                                                        <TableRow>
                                                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                                                Nenhum produto selecionado para este segmento.
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </TabsContent>
                                );
                            })}
                        </Tabs>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
