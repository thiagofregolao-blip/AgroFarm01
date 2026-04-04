import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import FarmLayout from "@/components/fazenda/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Tag, TrendingDown, TrendingUp, Trash2, Plus } from "lucide-react";

const SAIDA_CATEGORIES = [
    { value: "insumos", label: "Insumos Agrícolas" },
    { value: "pecas", label: "Peças e Manutenção" },
    { value: "diesel", label: "Combustível / Diesel" },
    { value: "mao_de_obra", label: "Mão de Obra" },
    { value: "frete", label: "Frete / Transporte" },
    { value: "energia", label: "Energia / Água" },
    { value: "arrendamento", label: "Arrendamento" },
    { value: "financiamento", label: "Parcela Financiamento" },
    { value: "impostos", label: "Impostos e Taxas" },
    { value: "pro_labore", label: "Retirada (Pró-labore)" },
    { value: "outro_saida", label: "Outras Saídas" },
];

const ENTRADA_CATEGORIES = [
    { value: "venda_producao", label: "Venda de Produção" },
    { value: "recebimento", label: "Recebimento de Clientes" },
    { value: "emprestimo", label: "Empréstimo / Financiamento" },
    { value: "reembolso", label: "Reembolso / Devolução" },
    { value: "aporte", label: "Aporte do Proprietário" },
    { value: "outro_entrada", label: "Outras Entradas" },
];

export default function CategoriesPage() {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const { data: customCategories = [] } = useQuery<any[]>({
        queryKey: ["/api/farm/expense-categories"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/expense-categories"); return r.json(); },
        enabled: !!user,
    });

    return (
        <FarmLayout>
            <div className="space-y-4">
                <div>
                    <h1 className="text-2xl font-bold text-emerald-800 flex items-center gap-2">
                        <Tag className="h-6 w-6" />
                        Categorias de Entradas e Saídas
                    </h1>
                    <p className="text-emerald-600 text-sm mt-1">
                        Gerencie as categorias usadas para classificar transações no Fluxo de Caixa.
                    </p>
                </div>

                <CategoriesManager
                    categories={customCategories}
                    onRefresh={() => queryClient.invalidateQueries({ queryKey: ["/api/farm/expense-categories"] })}
                />
            </div>
        </FarmLayout>
    );
}

function CategoriesManager({ categories, onRefresh }: { categories: any[]; onRefresh: () => void }) {
    const { toast } = useToast();
    const [name, setName] = useState("");
    const [type, setType] = useState("saida");

    const create = useMutation({
        mutationFn: () => apiRequest("POST", "/api/farm/expense-categories", { name, type }),
        onSuccess: () => { toast({ title: "Categoria criada!" }); setName(""); onRefresh(); },
        onError: () => toast({ title: "Erro ao criar", variant: "destructive" }),
    });

    const remove = useMutation({
        mutationFn: (id: string) => apiRequest("DELETE", `/api/farm/expense-categories/${id}`),
        onSuccess: () => { onRefresh(); toast({ title: "Categoria removida" }); },
    });

    const customSaida = categories.filter(c => c.type === "saida");
    const customEntrada = categories.filter(c => c.type === "entrada");

    return (
        <div className="space-y-6">
            <Card className="border-emerald-100">
                <CardHeader>
                    <CardTitle className="text-emerald-800 flex items-center gap-2">
                        <Tag className="h-5 w-5" /> Gerenciar Categorias
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Form */}
                    <div className="flex gap-3 items-end">
                        <div className="flex-1">
                            <Label>Nome da Categoria</Label>
                            <Input
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="Ex: Aluguel de máquinas..."
                                onKeyDown={e => { if (e.key === "Enter" && name) create.mutate(); }}
                            />
                        </div>
                        <div className="w-36">
                            <Label>Tipo</Label>
                            <Select value={type} onValueChange={setType}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="saida">Saída</SelectItem>
                                    <SelectItem value="entrada">Entrada</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Button
                            className="bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => create.mutate()}
                            disabled={create.isPending || !name}
                        >
                            <Plus className="mr-1 h-4 w-4" /> Adicionar
                        </Button>
                    </div>

                    {/* Lists */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Saída */}
                        <div>
                            <h3 className="font-semibold text-red-700 mb-3 flex items-center gap-2">
                                <TrendingDown className="h-4 w-4" /> Categorias de Saída
                            </h3>
                            <div className="space-y-2">
                                {SAIDA_CATEGORIES.map(c => (
                                    <div key={c.value} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 text-sm">
                                        <span className="px-2 py-0.5 rounded-full bg-gray-200 text-gray-500 text-xs">padrão</span>
                                        <span>{c.label}</span>
                                    </div>
                                ))}
                                {customSaida.map((c: any) => (
                                    <div key={c.id} className="flex items-center justify-between p-2 rounded-lg bg-red-50 border border-red-100 text-sm group">
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-xs">custom</span>
                                            <span className="font-medium">{c.name}</span>
                                        </div>
                                        <Button
                                            size="sm" variant="ghost"
                                            className="opacity-0 group-hover:opacity-100 text-red-500 h-6 w-6 p-0"
                                            onClick={() => remove.mutate(c.id)}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Entrada */}
                        <div>
                            <h3 className="font-semibold text-emerald-700 mb-3 flex items-center gap-2">
                                <TrendingUp className="h-4 w-4" /> Categorias de Entrada
                            </h3>
                            <div className="space-y-2">
                                {ENTRADA_CATEGORIES.map(c => (
                                    <div key={c.value} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 text-sm">
                                        <span className="px-2 py-0.5 rounded-full bg-gray-200 text-gray-500 text-xs">padrão</span>
                                        <span>{c.label}</span>
                                    </div>
                                ))}
                                {customEntrada.map((c: any) => (
                                    <div key={c.id} className="flex items-center justify-between p-2 rounded-lg bg-emerald-50 border border-emerald-100 text-sm group">
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-600 text-xs">custom</span>
                                            <span className="font-medium">{c.name}</span>
                                        </div>
                                        <Button
                                            size="sm" variant="ghost"
                                            className="opacity-0 group-hover:opacity-100 text-red-500 h-6 w-6 p-0"
                                            onClick={() => remove.mutate(c.id)}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
