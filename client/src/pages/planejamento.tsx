import Header from "@/components/layout/header";
import Navbar from "@/components/layout/navbar";
import { useState, useEffect, useMemo } from "react";
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
import { Loader2, Save, Calculator, DollarSign, AlertCircle, ArrowRight, ArrowLeft, History, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Client, PlanningProduct, SalesPlanning, SalesPlanningItem } from "@shared/schema";

export default function PlanejamentoPage() {
    const { toast } = useToast();
    const [step, setStep] = useState<1 | 2>(1); // 1: Seleção de Produtos, 2: Definição de Share
    const [selectedClientId, setSelectedClientId] = useState<string>("");

    // Areas (Step 2)
    const [areas, setAreas] = useState({
        totalPlantingArea: "0",
        fungicidesArea: "0",
        insecticidesArea: "0",
        herbicidesArea: "0",
        seedTreatmentArea: "0"
    });

    // Selected Products (Step 1)
    const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());

    // Queries
    const { data: activeSeason } = useQuery<{ id: string; name: string }>({
        queryKey: ["/api/seasons/active"],
    });

    const { data: clients } = useQuery<Client[]>({
        queryKey: ["/api/clients"],
    });

    const { data: products, isLoading: productsLoading } = useQuery<PlanningProduct[]>({
        queryKey: ["/api/planning/products", activeSeason?.id],
        queryFn: async () => {
            const res = await apiRequest("GET", `/api/planning/products?seasonId=${activeSeason?.id}`);
            return res.json();
        },
        enabled: !!activeSeason?.id,
    });

    // History Query (Which products did this client buy before?)
    const { data: purchaseHistory } = useQuery<{ purchasedProductNames: string[] }>({
        queryKey: ["/api/planning/client-history", selectedClientId],
        enabled: !!selectedClientId,
    });

    const { data: planning, isLoading: planningLoading } = useQuery<{ planning: SalesPlanning, items: SalesPlanningItem[] } | null>({
        queryKey: ["/api/planning", selectedClientId, { seasonId: activeSeason?.id }],
        enabled: !!selectedClientId && !!activeSeason?.id,
    });

    // Load existing planning or defaults
    useEffect(() => {
        if (!selectedClientId) {
            setStep(1);
            setSelectedProductIds(new Set());
            setAreas({
                totalPlantingArea: "0",
                fungicidesArea: "0",
                insecticidesArea: "0",
                herbicidesArea: "0",
                seedTreatmentArea: "0"
            });
            return;
        }

        if (planning?.planning) {
            // Existing Plan Found
            setAreas({
                totalPlantingArea: planning.planning.totalPlantingArea?.toString() || "0",
                fungicidesArea: planning.planning.fungicidesArea?.toString() || "0",
                insecticidesArea: planning.planning.insecticidesArea?.toString() || "0",
                herbicidesArea: planning.planning.herbicidesArea?.toString() || "0",
                seedTreatmentArea: planning.planning.seedTreatmentArea?.toString() || "0"
            });

            // If plan exists, go to step 2 by default (but allow back)
            setStep(2);
        } else {
            // New Plan
            const client = clients?.find(c => c.id === selectedClientId);
            setAreas(prev => ({
                ...prev,
                totalPlantingArea: client?.plantingArea?.toString() || "0"
            }));
            setStep(1); // Start at selection
        }

        if (planning?.items) {
            const ids = new Set(planning.items.map(i => i.productId));
            setSelectedProductIds(ids);
        } else {
            // Keep selection empty for new planning (user will select)
            setSelectedProductIds(new Set());
        }
    }, [planning, selectedClientId, clients]);

    // Mutation
    const saveMutation = useMutation({
        mutationFn: async () => {
            if (!selectedClientId || !activeSeason) return;

            const itemsToSave = Array.from(selectedProductIds).map(productId => {
                const product = products?.find(p => p.id === productId);
                if (!product) return null;

                const segmentArea = getAreaForSegment(product.segment);
                const quantity = parseFloat(segmentArea) * parseFloat(product.dosePerHa || "0");
                const totalAmount = quantity * parseFloat(product.price || "0");

                return {
                    productId,
                    quantity: quantity.toString(),
                    totalAmount: totalAmount.toString()
                };
            }).filter(Boolean);

            const payload = {
                planning: {
                    clientId: selectedClientId,
                    seasonId: activeSeason.id,
                    totalPlantingArea: areas.totalPlantingArea,
                    fungicidesArea: areas.fungicidesArea,
                    insecticidesArea: areas.insecticidesArea,
                    herbicidesArea: areas.herbicidesArea,
                    seedTreatmentArea: areas.seedTreatmentArea
                },
                items: itemsToSave
            };

            return apiRequest("POST", "/api/planning", payload);
        },
        onSuccess: () => {
            toast({
                title: "Planejamento Salvo",
                description: "Dados salvos com sucesso. Selecione o próximo cliente.",
            });
            queryClient.invalidateQueries({ queryKey: ["/api/planning", selectedClientId] });
            // Reset for next client
            setSelectedClientId("");
        },
        onError: () => {
            toast({
                title: "Erro ao salvar",
                description: "Ocorreu um erro ao salvar o planejamento.",
                variant: "destructive",
            });
        }
    });

    // Helpers
    const getAreaForSegment = (segment: string | null) => {
        if (!segment) return "0";
        const seg = segment.toLowerCase();
        if (seg.includes("fungicida")) return areas.fungicidesArea;
        if (seg.includes("inseticida")) return areas.insecticidesArea;
        if (seg.includes("desseca") || seg.includes("herbicida")) return areas.herbicidesArea;
        if (seg.includes("ts") || seg.includes("tratamento")) return areas.seedTreatmentArea;
        return "0";
    };

    const toggleProduct = (productId: string) => {
        const newSet = new Set(selectedProductIds);
        if (newSet.has(productId)) newSet.delete(productId);
        else newSet.add(productId);
        setSelectedProductIds(newSet);
    };

    // Auto-Select History Products
    const selectHistoryProducts = () => {
        if (!products || !purchaseHistory?.purchasedProductNames) return;

        const newSet = new Set(selectedProductIds);
        let addedCount = 0;

        products.forEach(p => {
            // Check if product name is in history list (fuzzy match)
            const pName = p.name.toLowerCase();
            const found = purchaseHistory.purchasedProductNames.some(hName => {
                const histName = hName.toLowerCase();
                return histName.includes(pName) || pName.includes(histName);
            });

            if (found) {
                newSet.add(p.id);
                addedCount++;
            }
        });

        setSelectedProductIds(newSet);
        toast({
            title: "Histórico Carregado",
            description: `${addedCount} produtos de safras passadas foram selecionados.`,
        });
    };

    const calculateTotals = () => {
        let totalValue = 0;
        let totalItems = 0;

        selectedProductIds.forEach(id => {
            const product = products?.find(p => p.id === id);
            if (product) {
                const area = parseFloat(getAreaForSegment(product.segment));
                const quantity = area * parseFloat(product.dosePerHa || "0");
                totalValue += quantity * parseFloat(product.price || "0");
                totalItems++;
            }
        });

        return { totalValue, totalItems };
    };

    const totals = calculateTotals();

    // Group products
    const productsBySegment = useMemo(() => {
        const grouped: Record<string, PlanningProduct[]> = {
            "Fungicidas": [],
            "Inseticidas": [],
            "Dessecação": [],
            "TS": [],
            "Outros": []
        };

        products?.forEach(p => {
            const seg = p.segment?.toLowerCase() || "";
            if (seg.includes("fungicida")) grouped["Fungicidas"].push(p);
            else if (seg.includes("inseticida")) grouped["Inseticidas"].push(p);
            else if (seg.includes("desseca") || seg.includes("herbicida")) grouped["Dessecação"].push(p);
            else if (seg.includes("ts") || seg.includes("tratamento")) grouped["TS"].push(p);
            else grouped["Outros"].push(p);
        });

        return grouped;
    }, [products]);

    // -- Sub-Components --

    const Step1ProductSelection = () => (
        <Card className="shadow-sm border-t-4 border-t-blue-500">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Passo 1: Seleção de Produtos</CardTitle>
                        <CardDescription>Selecione os produtos que pretende vender para este cliente.</CardDescription>
                    </div>
                    {purchaseHistory && (
                        <Button variant="outline" onClick={selectHistoryProducts} className="gap-2 text-blue-600 border-blue-200 hover:bg-blue-50">
                            <History className="w-4 h-4" />
                            Já Comprou? (Carregar Histórico)
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="fungicidas" className="w-full">
                    <TabsList className="grid w-full grid-cols-4 mb-4">
                        <TabsTrigger value="fungicidas">Fungicidas ({productsBySegment["Fungicidas"].length})</TabsTrigger>
                        <TabsTrigger value="inseticidas">Inseticidas ({productsBySegment["Inseticidas"].length})</TabsTrigger>
                        <TabsTrigger value="ts">Trat. Sementes ({productsBySegment["TS"].length})</TabsTrigger>
                        <TabsTrigger value="dessecacao">Dessecação ({productsBySegment["Dessecação"].length})</TabsTrigger>
                    </TabsList>

                    {Object.entries(productsBySegment).map(([segment, items]) => (
                        //@ts-ignore
                        <TabsContent key={segment} value={segment.toLowerCase().replace("ção", "cao").replace("trat. sementes", "ts")}>
                            {/* Note: Simplified tab mapping logic for brevity, ideally map correctly */}
                            <div className="rounded-md border max-h-[500px] overflow-y-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[50px]"></TableHead>
                                            <TableHead>Produto</TableHead>
                                            <TableHead>Preço Ref.</TableHead>
                                            <TableHead>Dose/ha</TableHead>
                                            <TableHead className="text-right">Histórico</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {items.map(product => {
                                            const isSelected = selectedProductIds.has(product.id);
                                            const boughtBefore = purchaseHistory?.purchasedProductNames.includes(product.name);
                                            return (
                                                <TableRow key={product.id} className={isSelected ? "bg-blue-50 dark:bg-blue-900/10" : ""}>
                                                    <TableCell>
                                                        <Checkbox
                                                            checked={isSelected}
                                                            onCheckedChange={() => toggleProduct(product.id)}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="font-medium">{product.name}</TableCell>
                                                    <TableCell>${parseFloat(product.price || "0").toFixed(2)}</TableCell>
                                                    <TableCell>{product.dosePerHa} {product.unit}</TableCell>
                                                    <TableCell className="text-right">
                                                        {boughtBefore && (
                                                            <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100">
                                                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                                                Já Comprou
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </TabsContent>
                    ))}
                    <TabsContent value="fungicidas">
                        <ProductList segment="Fungicidas" />
                    </TabsContent>
                    <TabsContent value="inseticidas">
                        <ProductList segment="Inseticidas" />
                    </TabsContent>
                    <TabsContent value="ts">
                        <ProductList segment="TS" />
                    </TabsContent>
                    <TabsContent value="dessecacao">
                        <ProductList segment="Dessecação" />
                    </TabsContent>
                </Tabs>

                <div className="mt-6 flex justify-end">
                    <Button onClick={() => setStep(2)} className="w-[200px]" disabled={selectedProductIds.size === 0}>
                        Próximo: Definir Share <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    );

    const ProductList = ({ segment }: { segment: string }) => (
        <div className="rounded-md border max-h-[500px] overflow-y-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[50px]"></TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead>Preço Ref.</TableHead>
                        <TableHead>Dose/ha</TableHead>
                        <TableHead className="text-right">Histórico</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {productsBySegment[segment].map(product => {
                        const isSelected = selectedProductIds.has(product.id);
                        const boughtBefore = purchaseHistory?.purchasedProductNames.includes(product.name);
                        return (
                            <TableRow key={product.id} className={isSelected ? "bg-blue-50 dark:bg-blue-900/10" : ""}>
                                <TableCell>
                                    <Checkbox
                                        checked={isSelected}
                                        onCheckedChange={() => toggleProduct(product.id)}
                                    />
                                </TableCell>
                                <TableCell className="font-medium">{product.name}</TableCell>
                                <TableCell>${parseFloat(product.price || "0").toFixed(2)}</TableCell>
                                <TableCell>{product.dosePerHa} {product.unit}</TableCell>
                                <TableCell className="text-right">
                                    {boughtBefore && (
                                        <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100">
                                            <CheckCircle2 className="w-3 h-3 mr-1" />
                                            Já Comprou
                                        </Badge>
                                    )}
                                </TableCell>
                            </TableRow>
                        )
                    })}
                </TableBody>
            </Table>
        </div>
    );

    const Step2AreaDefinition = () => (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <Button variant="ghost" onClick={() => setStep(1)} className="text-muted-foreground">
                    <ArrowLeft className="mr-2 w-4 h-4" /> Voltar: Editar Produtos
                </Button>
                <div className="text-right">
                    <p className="text-sm text-muted-foreground uppercase">Potencial Estimado</p>
                    <p className="text-2xl font-bold text-green-600">${totals.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
            </div>

            {/* Areas Definition */}
            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calculator className="w-5 h-5 text-blue-500" />
                        Definição de Áreas (Share) - {activeSeason?.name}
                    </CardTitle>
                    <CardDescription>Informe a área de atuação (ha) para cada segmento.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="space-y-2">
                            <Label className="text-xs uppercase text-muted-foreground">Área Total Plantio</Label>
                            <Input
                                type="number"
                                value={areas.totalPlantingArea}
                                onChange={(e) => setAreas(prev => ({ ...prev, totalPlantingArea: e.target.value }))}
                                className="font-bold bg-slate-50 border-blue-200"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs uppercase text-green-600 font-bold">Fungicidas</Label>
                            <Input
                                type="number"
                                value={areas.fungicidesArea}
                                onChange={(e) => setAreas(prev => ({ ...prev, fungicidesArea: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs uppercase text-yellow-600 font-bold">Inseticidas</Label>
                            <Input
                                type="number"
                                value={areas.insecticidesArea}
                                onChange={(e) => setAreas(prev => ({ ...prev, insecticidesArea: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs uppercase text-orange-600 font-bold">TS</Label>
                            <Input
                                type="number"
                                value={areas.seedTreatmentArea}
                                onChange={(e) => setAreas(prev => ({ ...prev, seedTreatmentArea: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs uppercase text-red-600 font-bold">Dessecação</Label>
                            <Input
                                type="number"
                                value={areas.herbicidesArea}
                                onChange={(e) => setAreas(prev => ({ ...prev, herbicidesArea: e.target.value }))}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Final Calculation Table */}
            <Card className="shadow-sm border-t-4 border-t-green-500">
                <CardHeader>
                    <CardTitle>Planejamento Final</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Produto</TableHead>
                                <TableHead className="text-right">Dose</TableHead>
                                <TableHead className="text-right">Preço</TableHead>
                                <TableHead className="text-right">Área Calc. (ha)</TableHead>
                                <TableHead className="text-right">Qtd. Total</TableHead>
                                <TableHead className="text-right">Total (USD)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {Array.from(selectedProductIds).map(id => {
                                const p = products?.find(prod => prod.id === id);
                                if (!p) return null;
                                const area = parseFloat(getAreaForSegment(p.segment));
                                const quantity = area * parseFloat(p.dosePerHa || "0");
                                const total = quantity * parseFloat(p.price || "0");

                                return (
                                    <TableRow key={p.id}>
                                        <TableCell className="font-medium">{p.name}</TableCell>
                                        <TableCell className="text-right">{p.dosePerHa}</TableCell>
                                        <TableCell className="text-right">${p.price}</TableCell>
                                        <TableCell className="text-right">{area} ha</TableCell>
                                        <TableCell className="text-right font-mono text-blue-600 font-bold">{quantity.toFixed(1)}</TableCell>
                                        <TableCell className="text-right font-mono text-green-600 font-bold">
                                            ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>

                    <div className="mt-8 flex justify-end">
                        <Button
                            size="lg"
                            className="w-[250px] bg-green-600 hover:bg-green-700"
                            onClick={() => saveMutation.mutate()}
                            disabled={saveMutation.isPending}
                        >
                            {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Salvar e Próximo Cliente
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );

    return (
        <div className="h-screen flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-900">
            <Header
                title="Planejamento de Vendas 2026"
                subtitle={selectedClientId ? "Definindo Metas do Cliente" : "Selecione um cliente para começar"}
            />
            <Navbar />

            <main className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="max-w-7xl mx-auto space-y-6">
                    {/* Customer Selection */}
                    <Card className="shadow-sm border-l-4 border-l-primary">
                        <CardContent className="pt-6">
                            <div className="flex gap-4 items-end">
                                <div className="flex-1 space-y-2">
                                    <Label>Selecione o Cliente</Label>
                                    <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Buscar cliente..." />
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
                                <div className="pb-2">
                                    <Badge variant={step === 1 ? "default" : "outline"} className="mr-2">1. Seleção</Badge>
                                    <Badge variant={step === 2 ? "default" : "outline"}>2. Share</Badge>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {selectedClientId ? (
                        step === 1 ? <Step1ProductSelection /> : <Step2AreaDefinition />
                    ) : (
                        <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground bg-white rounded-lg border border-dashed">
                            <div className="bg-slate-100 p-4 rounded-full mb-4">
                                <AlertCircle className="w-12 h-12 text-slate-400" />
                            </div>
                            <h3 className="text-xl font-medium mb-2">Comece Selecionando um Cliente</h3>
                            <p>O fluxo de planejamento guiará você pela seleção de produtos e definição de share.</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
