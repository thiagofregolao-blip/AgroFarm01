import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp, Settings } from "lucide-react";
import { ManejoGlobalDialog } from "@/components/manejo-global-dialog";

interface Season {
    id: string;
    name: string;
    isActive: boolean;
}

interface Category {
    id: string;
    name: string;
    type: string;
}

const LOCAL_STORAGE_KEY = "gestaoPotencialRates";

// Component for Gestão de Potencial Tab
function GestaoPotencialTabContent() {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Estados para "Potencial Geral"
    const [showPotencialDialog, setShowPotencialDialog] = useState(false);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [selectedSeasonId, setSelectedSeasonId] = useState("");
    const [rateValues, setRateValues] = useState<Record<string, string>>({});
    const [subcategoryValues, setSubcategoryValues] = useState<Record<string, Record<string, string>>>({});

    // Estados para "Configurar Manejo"
    const [showManejoDialog, setShowManejoDialog] = useState(false);
    const [manejoSeasonId, setManejoSeasonId] = useState<string>("");

    const { data: seasons } = useQuery<Season[]>({
        queryKey: ["/api/seasons"],
    });

    const { data: categories } = useQuery<any[]>({
        queryKey: ["/api/categories"],
    });

    const AGROQUIMICOS_SUBCATEGORIAS = ["FUNGICIDAS", "INSETICIDAS", "DESSECAÇÃO", "TS"];

    // Dados para resumo de manejo na tela
    const { data: manejoApplications } = useQuery<any[]>({
        queryKey: ["/api/global-management", manejoSeasonId],
        queryFn: manejoSeasonId
            ? async () => {
                const res = await fetch(`/api/global-management?seasonId=${manejoSeasonId}`);
                if (!res.ok) throw new Error("Failed to fetch global management");
                return res.json();
            }
            : undefined,
        enabled: !!manejoSeasonId,
    });


    // Buscar potenciais existentes para a safra selecionada
    const { data: existingMarketRates, error: marketRatesError, isLoading: isLoadingMarketRates } = useQuery<any[]>({
        queryKey: ["/api/clients/manager-team/market-rates", selectedSeasonId],
        queryFn: selectedSeasonId
            ? async () => {
                const res = await fetch(`/api/clients/manager-team/market-rates/${selectedSeasonId}`);
                if (!res.ok) {
                    const errorText = await res.text();
                    console.error("Failed to fetch market rates:", res.status, errorText);
                    throw new Error(`Failed to fetch market rates: ${res.status}`);
                }
                return res.json();
            }
            : undefined,
        enabled: !!selectedSeasonId,
        retry: 2,
        staleTime: 30000, // Cache por 30 segundos
    });

    // Auto-select active season (Potencial)
    useEffect(() => {
        if (seasons && !selectedSeasonId) {
            const activeSeason = seasons.find(s => s.isActive);
            if (activeSeason) {
                setSelectedSeasonId(activeSeason.id);
            }
        }
    }, [seasons, selectedSeasonId]);

    // Quando a safra mudar, tentar carregar valores do localStorage (fallback se o backend não tiver nada)
    useEffect(() => {
        if (selectedSeasonId) {
            try {
                const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
                if (raw) {
                    const parsed = JSON.parse(raw) as Record<string, { rateValues: Record<string, string>; subcategoryValues: Record<string, Record<string, string>> }>;
                    const seasonData = parsed[selectedSeasonId];
                    if (seasonData) {
                        setRateValues(seasonData.rateValues || {});
                        setSubcategoryValues(seasonData.subcategoryValues || {});
                    }
                }
            } catch (e) {
                console.error("Erro ao ler potenciais do localStorage:", e);
            }
        }
    }, [selectedSeasonId]);

    // Quando a safra mudar, refazer a query para buscar os dados atualizados
    useEffect(() => {
        if (selectedSeasonId) {
            queryClient.invalidateQueries({ queryKey: ["/api/clients/manager-team/market-rates", selectedSeasonId] });
        }
    }, [selectedSeasonId, queryClient]);

    // Auto-select active season (Manejo) quando abrir a aba / componente
    useEffect(() => {
        if (seasons && !manejoSeasonId) {
            const activeSeason = seasons.find(s => s.isActive);
            if (activeSeason) {
                setManejoSeasonId(activeSeason.id);
            }
        }
    }, [seasons, manejoSeasonId]);

    // Carregar valores já salvos quando existingMarketRates mudar
    useEffect(() => {
        if (existingMarketRates && Array.isArray(existingMarketRates)) {
            if (existingMarketRates.length > 0) {
                const rateVals: Record<string, string> = {};
                const subVals: Record<string, Record<string, string>> = {};

                existingMarketRates.forEach((rate: any) => {
                    const investmentValue = rate.investmentPerHa ? String(rate.investmentPerHa) : "";
                    rateVals[rate.categoryId] = investmentValue;

                    if (rate.subcategories) {
                        subVals[rate.categoryId] = rate.subcategories;
                    }
                });

                setRateValues(rateVals);
                setSubcategoryValues(subVals);
            }
            // Se existingMarketRates.length === 0, não fazer nada (manter valores locais)
        } else if (marketRatesError) {
            // Se houver erro, manter os valores locais se existirem
            console.error("Erro ao buscar market rates:", marketRatesError);
        }
    }, [existingMarketRates, marketRatesError]);

    // Mutation para salvar potencial geral
    const savePotencialMutation = useMutation({
        mutationFn: async () => {
            const rates: Array<{
                categoryId: string;
                seasonId: string;
                investmentPerHa: string;
                subcategories?: any;
            }> = [];

            if (categories) {
                categories.forEach((category) => {
                    const value = rateValues[category.id];
                    if (value && parseFloat(value) > 0) {
                        const isAgroquimicos = category.name.toLowerCase().includes("agroqu");
                        const subcats = isAgroquimicos && subcategoryValues[category.id]
                            ? subcategoryValues[category.id]
                            : undefined;

                        rates.push({
                            categoryId: category.id,
                            seasonId: selectedSeasonId,
                            investmentPerHa: value,
                            subcategories: subcats,
                        });
                    }
                });
            }

            const response = await fetch("/api/clients/manager-team/market-rates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ allRates: rates }),
            });

            if (!response.ok) throw new Error("Failed to save");
            return response.json();
        },
        onSuccess: (data) => {
            // Guardar também no localStorage para persistir na interface mesmo se o backend não devolver depois
            try {
                const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
                const parsed = raw ? JSON.parse(raw) : {};
                parsed[selectedSeasonId] = {
                    rateValues,
                    subcategoryValues,
                };
                window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(parsed));
            } catch (e) {
                console.error("Erro ao salvar potenciais no localStorage:", e);
            }

            queryClient.invalidateQueries({ queryKey: ["/api/market-analysis"] });
            queryClient.invalidateQueries({ queryKey: ["/api/clients/manager-team/market-rates", selectedSeasonId] });
            queryClient.invalidateQueries({ queryKey: ["/api/clients/manager-team/market-rates"] });

            toast({
                title: "✅ Potencial configurado!",
                description: data.message || `Aplicado a ${data.count || 0} clientes`,
            });

            setShowConfirmDialog(false);
            setShowPotencialDialog(false);
        },
        onError: () => {
            toast({
                title: "Erro ao salvar",
                description: "Não foi possível salvar as configurações. Tente novamente.",
                variant: "destructive",
            });
        },
    });

    const handleOpenPotencial = () => {
        setShowPotencialDialog(true);
    };

    const handleSavePotencial = () => {
        if (!selectedSeasonId) {
            toast({
                title: "Safra não selecionada",
                description: "Selecione uma safra antes de salvar.",
                variant: "destructive",
            });
            return;
        }

        const hasValues = Object.values(rateValues).some(v => v && parseFloat(v) > 0);
        if (!hasValues) {
            toast({
                title: "Nenhum valor configurado",
                description: "Configure pelo menos uma categoria antes de salvar.",
                variant: "destructive",
            });
            return;
        }

        setShowConfirmDialog(true);
    };

    const handleConfirmSave = () => {
        savePotencialMutation.mutate();
    };

    const getSelectedSeasonName = () => {
        return seasons?.find(s => s.id === selectedSeasonId)?.name || "";
    };

    const getTotalConfigured = () => {
        return Object.values(rateValues)
            .reduce((sum, val) => sum + (parseFloat(val) || 0), 0)
            .toFixed(2);
    };

    const getConfiguredCategories = () => {
        if (!categories) return [];

        return categories
            .filter(cat => rateValues[cat.id] && parseFloat(rateValues[cat.id]) > 0)
            .map(cat => ({
                name: cat.name,
                value: parseFloat(rateValues[cat.id]),
                subcategories: subcategoryValues[cat.id],
            }));
    };

    const hasLocalPotentials = Object.values(rateValues).some((v) => v && parseFloat(v) > 0);
    
    // Verificar se há dados salvos no banco OU valores locais
    const hasAnyPotentials = (existingMarketRates?.length || 0) > 0 || hasLocalPotentials;

    // Componente interno simples para mostrar o resumo de uma categoria de manejo
    function ResumoManejoCategoria({
        titulo,
        categoria,
        applications,
    }: {
        titulo: string;
        categoria: string;
        applications: any[];
    }) {
        const apps = applications?.filter((a) => a.categoria === categoria) || [];
        if (apps.length === 0) return null;

        // Agrupa por número de aplicação
        const grouped = apps.reduce((acc: Record<string, any[]>, app: any) => {
            const key = String(app.applicationNumber);
            if (!acc[key]) acc[key] = [];
            acc[key].push(app);
            return acc;
        }, {});

        const appNumbers = Object.keys(grouped).sort((a, b) => Number(a) - Number(b));

        return (
            <div className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{titulo}</span>
                    <span className="text-xs text-muted-foreground">
                        {apps.length} produto(s) em {appNumbers.length} aplicação(ões)
                    </span>
                </div>
                {appNumbers.map((num) => {
                    const list = grouped[num];
                    const total = list.reduce((sum, app: any) => sum + Number(app.pricePerHa || 0), 0);
                    return (
                        <div key={num} className="flex items-start justify-between text-xs border-t pt-1 mt-1">
                            <span className="font-medium">Aplicação {num}</span>
                            <span className="font-mono font-semibold">${total.toFixed(2)}/ha</span>
                        </div>
                    );
                })}
            </div>
        );
    }

    return (
        <>
            <Tabs defaultValue="potencial" className="space-y-4">
                <TabsList className="inline-flex h-9 w-fit items-center justify-start rounded-md bg-muted p-1 gap-1">
                    <TabsTrigger
                        value="potencial"
                        className="px-3 py-1 text-sm rounded data-[state=active]:bg-background data-[state=active]:shadow"
                    >
                        Potencial Geral
                    </TabsTrigger>
                    <TabsTrigger
                        value="manejo"
                        className="px-3 py-1 text-sm rounded data-[state=active]:bg-background data-[state=active]:shadow"
                    >
                        Configurar Manejo
                    </TabsTrigger>
                </TabsList>

                {/* ABA: POTENCIAL GERAL */}
                <TabsContent value="potencial">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <TrendingUp className="h-5 w-5 text-primary" />
                                    Potencial Geral
                                </CardTitle>
                                <CardDescription>
                                    Investimento esperado por hectare (USD/ha) por categoria para a equipe.
                                </CardDescription>
                            </div>
                            <Button onClick={handleOpenPotencial}>
                                Incluir / Editar Potencial
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {/* Seletor de Safra Visível */}
                            <div className="mb-4">
                                <Label>Safra</Label>
                                <Select value={selectedSeasonId} onValueChange={setSelectedSeasonId}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Selecione a safra" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {seasons?.map((season) => (
                                            <SelectItem key={season.id} value={season.id}>
                                                {season.name} {season.isActive && "(Ativa)"}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {isLoadingMarketRates && selectedSeasonId ? (
                                <p className="text-sm text-muted-foreground">Carregando potenciais...</p>
                            ) : marketRatesError ? (
                                <div className="space-y-2">
                                    <p className="text-sm text-destructive">
                                        Erro ao carregar potenciais salvos. Exibindo valores locais:
                                    </p>
                                    {hasLocalPotentials ? (
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Categoria</TableHead>
                                                    <TableHead className="text-right">Potencial (USD/ha)</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {categories?.map((category) => {
                                                    const value = rateValues[category.id];
                                                    if (!value || parseFloat(value) === 0) return null;
                                                    return (
                                                        <TableRow key={category.id}>
                                                            <TableCell>{category.name}</TableCell>
                                                            <TableCell className="text-right font-mono">
                                                                ${parseFloat(value).toFixed(2)}/ha
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">
                                            Nenhum potencial configurado para esta safra ainda. Clique em{" "}
                                            <span className="font-medium">"Incluir / Editar Potencial"</span> para cadastrar.
                                        </p>
                                    )}
                                </div>
                            ) : selectedSeasonId && hasAnyPotentials ? (
                                <div className="space-y-2">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Categoria</TableHead>
                                                <TableHead className="text-right">Potencial (USD/ha)</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {categories?.map((category) => {
                                                // Priorizar dados do banco, depois valores locais
                                                const rate = existingMarketRates?.find(
                                                    (r: any) => r.categoryId === category.id
                                                );
                                                const value = (rate?.investmentPerHa ?? rateValues[category.id]) || 0;
                                                if (!value || parseFloat(String(value)) === 0) return null;
                                                return (
                                                    <TableRow key={category.id}>
                                                        <TableCell>{category.name}</TableCell>
                                                        <TableCell className="text-right font-mono">
                                                            ${parseFloat(String(value || "0")).toFixed(2)}/ha
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    Nenhum potencial configurado para esta safra ainda. Clique em{" "}
                                    <span className="font-medium">"Incluir / Editar Potencial"</span> para cadastrar.
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ABA: CONFIGURAR MANEJO */}
                <TabsContent value="manejo">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <Settings className="h-5 w-5 text-primary" />
                                    Configurar Manejo
                                </CardTitle>
                                <CardDescription>
                                    Defina as aplicações de manejo global (fungicidas, inseticidas, etc.) para a equipe.
                                </CardDescription>
                            </div>
                            <Button variant="outline" onClick={() => setShowManejoDialog(true)}>
                                Incluir / Editar Manejo
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground mb-3">
                                Visualize e edite o manejo global por categoria para todos os clientes da equipe.
                            </p>

                            {/* Seletor de Safra para Manejo */}
                            <div className="mb-4">
                                <Label>Safra</Label>
                                <Select value={manejoSeasonId} onValueChange={setManejoSeasonId}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Selecione a safra" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {seasons?.map((season) => (
                                            <SelectItem key={season.id} value={season.id}>
                                                {season.name} {season.isActive && "(Ativa)"}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Resumo simples do manejo já configurado */}
                            {manejoSeasonId && manejoApplications && manejoApplications.length > 0 ? (
                                <div className="space-y-3">
                                    <ResumoManejoCategoria
                                        titulo="Fertilizantes"
                                        categoria="FERTILIZANTES"
                                        applications={manejoApplications}
                                    />
                                    <ResumoManejoCategoria
                                        titulo="Sementes"
                                        categoria="SEMENTES"
                                        applications={manejoApplications}
                                    />
                                    <ResumoManejoCategoria
                                        titulo="Especialidades"
                                        categoria="ESPECIALIDADES"
                                        applications={manejoApplications}
                                    />
                                    <ResumoManejoCategoria
                                        titulo="Corretivos"
                                        categoria="CORRETIVOS"
                                        applications={manejoApplications}
                                    />
                                    <ResumoManejoCategoria
                                        titulo="Agroquímicos - Fungicidas"
                                        categoria="FUNGICIDAS"
                                        applications={manejoApplications}
                                    />
                                    <ResumoManejoCategoria
                                        titulo="Agroquímicos - Inseticidas"
                                        categoria="INSETICIDAS"
                                        applications={manejoApplications}
                                    />
                                    <ResumoManejoCategoria
                                        titulo="Agroquímicos - Dessecação"
                                        categoria="DESSECAÇÃO"
                                        applications={manejoApplications}
                                    />
                                    <ResumoManejoCategoria
                                        titulo="Agroquímicos - Tratamento de Semente"
                                        categoria="TRATAMENTO DE SEMENTE"
                                        applications={manejoApplications}
                                    />
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    Nenhum manejo configurado para esta safra ainda. Use o botão{" "}
                                    <span className="font-medium">"Incluir / Editar Manejo"</span> para cadastrar.
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Dialog: Potencial Geral */}
            <Dialog open={showPotencialDialog} onOpenChange={setShowPotencialDialog}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Configurar Potencial Geral</DialogTitle>
                        <DialogDescription>
                            Configure o investimento esperado (USD/ha) para cada categoria.
                            Será aplicado a todos os clientes com badge amarelo da equipe.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 mt-4">
                        {/* Seletor de Safra */}
                        <div>
                            <Label>Safra *</Label>
                            <Select value={selectedSeasonId} onValueChange={setSelectedSeasonId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione a safra" />
                                </SelectTrigger>
                                <SelectContent>
                                    {seasons?.map((season) => (
                                        <SelectItem key={season.id} value={season.id}>
                                            {season.name} {season.isActive && "(Ativa)"}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Categorias */}
                        {categories?.map((category) => {
                            const isAgroquimicos = category.name.toLowerCase().includes("agroqu");
                            const hasSubValues = isAgroquimicos && subcategoryValues[category.id] &&
                                Object.values(subcategoryValues[category.id]).some(v => v?.trim() !== "");

                            return (
                                <div key={category.id} className="border rounded-lg p-4 space-y-3">
                                    <Label className="text-base font-semibold">{category.name}</Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        placeholder="Ex: 150.00"
                                        value={rateValues[category.id] || ""}
                                        onChange={(e) => setRateValues({ ...rateValues, [category.id]: e.target.value })}
                                        readOnly={hasSubValues}
                                        className={hasSubValues ? "bg-muted cursor-not-allowed" : ""}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        {hasSubValues
                                            ? "✓ Calculado automaticamente pela soma das subcategorias"
                                            : "USD por hectare"}
                                    </p>

                                    {/* Subcategorias para Agroquímicos */}
                                    {isAgroquimicos && (
                                        <div className="pl-4 border-l-2 border-primary/20 space-y-2">
                                            <p className="text-sm font-medium text-muted-foreground">
                                                Detalhamento por subcategoria (opcional):
                                            </p>
                                            {AGROQUIMICOS_SUBCATEGORIAS.map((subcat) => (
                                                <div key={subcat} className="flex items-center gap-2">
                                                    <Label className="text-sm w-28">{subcat}:</Label>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        placeholder="0.00"
                                                        value={subcategoryValues[category.id]?.[subcat] || ""}
                                                        onChange={(e) => {
                                                            const newSubValues = {
                                                                ...subcategoryValues,
                                                                [category.id]: {
                                                                    ...(subcategoryValues[category.id] || {}),
                                                                    [subcat]: e.target.value,
                                                                },
                                                            };
                                                            setSubcategoryValues(newSubValues);

                                                            // Auto-calcular total
                                                            const total = AGROQUIMICOS_SUBCATEGORIAS.reduce(
                                                                (sum, sc) => sum + (parseFloat(newSubValues[category.id]?.[sc]) || 0),
                                                                0
                                                            );
                                                            if (total > 0) {
                                                                setRateValues({ ...rateValues, [category.id]: total.toFixed(2) });
                                                            }
                                                        }}
                                                        className="flex-1"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        <div className="flex justify-end gap-2 pt-4">
                            <Button variant="outline" onClick={() => setShowPotencialDialog(false)}>
                                Cancelar
                            </Button>
                            <Button onClick={handleSavePotencial}>
                                Salvar Configuração
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Dialog: Confirmação */}
            <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar Configuração de Potencial</AlertDialogTitle>
                        <AlertDialogDescription>
                            Revise os valores antes de aplicar para toda a equipe:
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="space-y-3 my-4">
                        <div>
                            <strong>Safra:</strong> {getSelectedSeasonName()}
                        </div>

                        <div>
                            <strong>Categorias Configuradas:</strong>
                            <ul className="list-disc pl-6 mt-2 space-y-1">
                                {getConfiguredCategories().map((cat, idx) => (
                                    <li key={idx}>
                                        <span className="font-medium">{cat.name}:</span> ${cat.value.toFixed(2)}/ha
                                        {cat.subcategories && Object.keys(cat.subcategories).length > 0 && (
                                            <ul className="list-circle pl-6 text-sm text-muted-foreground">
                                                {Object.entries(cat.subcategories)
                                                    .filter(([, val]) => val && parseFloat(val as string) > 0)
                                                    .map(([subcat, val]) => (
                                                        <li key={subcat}>
                                                            {subcat}: ${parseFloat(val as string).toFixed(2)}/ha
                                                        </li>
                                                    ))}
                                            </ul>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="pt-2 border-t">
                            <strong>Total Configurado:</strong> ${getTotalConfigured()}/ha
                        </div>
                    </div>

                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmSave} disabled={savePotencialMutation.isPending}>
                            {savePotencialMutation.isPending ? "Salvando..." : "Confirmar e Salvar"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <ManejoGlobalDialog open={showManejoDialog} onOpenChange={setShowManejoDialog} />
        </>
    );
}

export { GestaoPotencialTabContent };
