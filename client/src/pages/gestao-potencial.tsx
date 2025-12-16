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
import Header from "@/components/layout/header";
import Navbar from "@/components/layout/navbar";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp, Settings } from "lucide-react";

const AGROQUIMICOS_SUBCATEGORIAS = ["FUNGICIDAS", "INSETICIDAS", "DESSECAÇÃO", "TS"];

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

export default function GestaoPotencialPage() {
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

    const { data: seasons } = useQuery<Season[]>({
        queryKey: ["/api/seasons"],
    });

    const { data: categories } = useQuery<Category[]>({
        queryKey: ["/api/categories"],
    });

    // Auto-select active season
    useEffect(() => {
        if (seasons && !selectedSeasonId) {
            const activeSeason = seasons.find(s => s.isActive);
            if (activeSeason) {
                setSelectedSeasonId(activeSeason.id);
            }
        }
    }, [seasons, selectedSeasonId]);

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
            queryClient.invalidateQueries({ queryKey: ["/api/market-analysis"] });
            queryClient.invalidateQueries({ queryKey: ["/api/clients/manager-team/market-rates"] });

            toast({
                title: "✅ Potencial configurado!",
                description: data.message || `Aplicado a ${data.count || 0} clientes`,
            });

            setShowConfirmDialog(false);
            setShowPotencialDialog(false);
            setRateValues({});
            setSubcategoryValues({});
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
        // Validações
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

        // Mostrar modal de confirmação
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

    return (
        <div className="h-screen flex flex-col overflow-hidden">
            <Header
                title="Gestão de Potencial"
                subtitle="Configure potencial de mercado e manejo para toda a equipe"
                showNewSaleButton={false}
            />
            <Navbar />

            <main className="flex-1 overflow-y-auto">
                <div className="p-6 space-y-6">
                    <div className="max-w-4xl mx-auto space-y-6">
                        <h1 className="text-2xl font-bold">Gestão de Potencial de Mercado</h1>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Card: Potencial Geral */}
                            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={handleOpenPotencial}>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <TrendingUp className="h-5 w-5 text-primary" />
                                        Potencial Geral
                                    </CardTitle>
                                    <CardDescription>
                                        Configure o investimento esperado por hectare para cada categoria
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Button className="w-full" onClick={handleOpenPotencial}>
                                        Configurar Potencial
                                    </Button>
                                </CardContent>
                            </Card>

                            {/* Card: Configurar Manejo */}
                            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setShowManejoDialog(true)}>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Settings className="h-5 w-5 text-primary" />
                                        Configurar Manejo
                                    </CardTitle>
                                    <CardDescription>
                                        Defina as aplicações de fungicidas e inseticidas para a equipe
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Button className="w-full" variant="outline" onClick={() => setShowManejoDialog(true)}>
                                        Configurar Manejo
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </main>

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

            {/* Dialog: Configurar Manejo (Placeholder) */}
            <Dialog open={showManejoDialog} onOpenChange={setShowManejoDialog}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>Configurar Manejo Global</DialogTitle>
                        <DialogDescription>
                            Configure as aplicações de fungicidas e inseticidas para todos os clientes da equipe.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="p-4">
                        <p className="text-muted-foreground">
                            Funcionalidade de configuração de manejo em desenvolvimento.
                            Por enquanto, use a aba "Metas" no painel do gerente.
                        </p>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
