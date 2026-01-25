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
import { Loader2, Save, Calculator, DollarSign, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Client, PlanningProduct, SalesPlanning, SalesPlanningItem } from "@shared/schema";

export default function PlanejamentoPage() {
    const { toast } = useToast();
    const [selectedClientId, setSelectedClientId] = useState<string>("");
    const [areas, setAreas] = useState({
        totalPlantingArea: "0",
        fungicidesArea: "0",
        insecticidesArea: "0",
        herbicidesArea: "0",
        seedTreatmentArea: "0"
    });
    const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());

    // Queries
    const { data: activeSeason } = useQuery<{ id: string; name: string }>({
        queryKey: ["/api/seasons/active"],
    });

    const { data: clients } = useQuery<Client[]>({
        queryKey: ["/api/clients"],
    });

    const { data: products, isLoading: productsLoading } = useQuery<PlanningProduct[]>({
        queryKey: ["/api/planning/products", { seasonId: activeSeason?.id }],
        enabled: !!activeSeason?.id,
    });

    const { data: planning, isLoading: planningLoading } = useQuery<{ planning: SalesPlanning, items: SalesPlanningItem[] } | null>({
        queryKey: ["/api/planning", selectedClientId, { seasonId: activeSeason?.id }],
        enabled: !!selectedClientId && !!activeSeason?.id,
    });

    // Effect to load existing planning data
    useEffect(() => {
        if (planning?.planning) {
            setAreas({
                totalPlantingArea: planning.planning.totalPlantingArea?.toString() || "0",
                fungicidesArea: planning.planning.fungicidesArea?.toString() || "0",
                insecticidesArea: planning.planning.insecticidesArea?.toString() || "0",
                herbicidesArea: planning.planning.herbicidesArea?.toString() || "0",
                seedTreatmentArea: planning.planning.seedTreatmentArea?.toString() || "0"
            });
        } else {
            // Reset defaults if no planning exists for this client
            setAreas({
                totalPlantingArea: "0",
                fungicidesArea: "0",
                insecticidesArea: "0",
                herbicidesArea: "0",
                seedTreatmentArea: "0"
            });
        }

        if (planning?.items) {
            const ids = new Set(planning.items.map(i => i.productId));
            setSelectedProductIds(ids);
        } else {
            setSelectedProductIds(new Set());
        }
    }, [planning, selectedClientId]);

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
                description: "Os dados foram atualizados com sucesso.",
            });
            queryClient.invalidateQueries({ queryKey: ["/api/planning", selectedClientId] });
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
        if (newSet.has(productId)) {
            newSet.delete(productId);
        } else {
            newSet.add(productId);
        }
        setSelectedProductIds(newSet);
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

    // Group products by segment
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

    const ProductTable = ({ items, segmentArea }: { items: PlanningProduct[], segmentArea: string }) => (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[50px]"></TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">Dose/ha</TableHead>
                        <TableHead className="text-right">Preço (USD)</TableHead>
                        <TableHead className="text-right">Área (ha)</TableHead>
                        <TableHead className="text-right">Qtd Planejada</TableHead>
                        <TableHead className="text-right">Total (USD)</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {items.map(product => {
                        const isSelected = selectedProductIds.has(product.id);
                        const area = parseFloat(segmentArea);
                        const dose = parseFloat(product.dosePerHa || "0");
                        const price = parseFloat(product.price || "0");
                        const quantity = area * dose;
                        const total = quantity * price;

                        return (
                            <TableRow key={product.id} className={isSelected ? "bg-green-50 dark:bg-green-900/10" : ""}>
                                <TableCell>
                                    <Checkbox
                                        checked={isSelected}
                                        onCheckedChange={() => toggleProduct(product.id)}
                                    />
                                </TableCell>
                                <TableCell className="font-medium">{product.name}</TableCell>
                                <TableCell className="text-right">{dose.toFixed(2)} {product.unit}</TableCell>
                                <TableCell className="text-right">${price.toFixed(2)}</TableCell>
                                <TableCell className="text-right">{area} ha</TableCell>
                                <TableCell className="text-right font-mono text-blue-600">
                                    {isSelected ? quantity.toFixed(1) : "-"}
                                </TableCell>
                                <TableCell className="text-right font-mono font-bold text-green-600">
                                    {isSelected ? `$${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-"}
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );

    return (
        <div className="h-screen flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-900">
            <Header
                title="Planejamento de Vendas 2026"
                subtitle="Simulação e Meta de Vendas"
            />
            <Navbar />

            <main className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="max-w-7xl mx-auto space-y-6">

                    {/* Header Card: Client Selection & Totals */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card className="md:col-span-1 shadow-sm border-l-4 border-l-primary">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg">Cliente e Safra</CardTitle>
                                <CardDescription>{activeSeason?.name || "Carregando..."}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="space-y-2">
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
                                    {selectedClientId && (
                                        <Button
                                            className="w-full"
                                            onClick={() => saveMutation.mutate()}
                                            disabled={saveMutation.isPending}
                                        >
                                            {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                            Salvar Planejamento
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="md:col-span-2 shadow-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg flex items-center justify-between">
                                    <span>Resumo do Planejamento</span>
                                    <Badge variant="outline" className="text-base px-4 py-1">
                                        <DollarSign className="w-4 h-4 mr-1 text-green-600" />
                                        {totals.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </Badge>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                                    <div className="bg-muted/30 p-3 rounded-lg">
                                        <p className="text-xs text-muted-foreground uppercase">Produtos</p>
                                        <p className="text-2xl font-bold">{totals.totalItems}</p>
                                    </div>
                                    <div className="bg-muted/30 p-3 rounded-lg">
                                        <p className="text-xs text-muted-foreground uppercase">Área Total</p>
                                        <p className="text-2xl font-bold">{areas.totalPlantingArea} ha</p>
                                    </div>
                                    {/* Future: Meta Comparision */}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {selectedClientId ? (
                        <>
                            {/* Areas Definition */}
                            <Card className="shadow-sm">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Calculator className="w-5 h-5 text-blue-500" />
                                        Definição de Áreas (Share)
                                    </CardTitle>
                                    <CardDescription>Informe a área de atuação (ha) para cada segmento nesta safra.</CardDescription>
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

                            {/* Products Tabs */}
                            <Card className="shadow-sm border-t-4 border-t-green-500">
                                <CardHeader>
                                    <CardTitle>Calculadora de Produtos</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {productsLoading ? (
                                        <div className="flex justify-center py-12"><Loader2 className="animate-spin w-8 h-8" /></div>
                                    ) : (
                                        <Tabs defaultValue="fungicidas" className="w-full">
                                            <TabsList className="grid w-full grid-cols-4 mb-8">
                                                <TabsTrigger value="fungicidas">Fungicidas ({productsBySegment["Fungicidas"].length})</TabsTrigger>
                                                <TabsTrigger value="inseticidas">Inseticidas ({productsBySegment["Inseticidas"].length})</TabsTrigger>
                                                <TabsTrigger value="ts">Trat. Sementes ({productsBySegment["TS"].length})</TabsTrigger>
                                                <TabsTrigger value="dessecacao">Dessecação ({productsBySegment["Dessecação"].length})</TabsTrigger>
                                            </TabsList>

                                            <TabsContent value="fungicidas">
                                                <ProductTable items={productsBySegment["Fungicidas"]} segmentArea={areas.fungicidesArea} />
                                            </TabsContent>
                                            <TabsContent value="inseticidas">
                                                <ProductTable items={productsBySegment["Inseticidas"]} segmentArea={areas.insecticidesArea} />
                                            </TabsContent>
                                            <TabsContent value="ts">
                                                <ProductTable items={productsBySegment["TS"]} segmentArea={areas.seedTreatmentArea} />
                                            </TabsContent>
                                            <TabsContent value="dessecacao">
                                                <ProductTable items={productsBySegment["Dessecação"]} segmentArea={areas.herbicidesArea} />
                                            </TabsContent>
                                        </Tabs>
                                    )}
                                </CardContent>
                            </Card>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground bg-white rounded-lg border border-dashed">
                            <div className="bg-slate-100 p-4 rounded-full mb-4">
                                <AlertCircle className="w-12 h-12 text-slate-400" />
                            </div>
                            <h3 className="text-xl font-medium mb-2">Nenhum cliente selecionado</h3>
                            <p>Selecione um cliente acima para iniciar o planejamento da safra.</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
