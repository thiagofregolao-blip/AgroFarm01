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
import { Tag, TrendingDown, TrendingUp, Trash2, Plus, Pencil, Check, X } from "lucide-react";

const SAIDA_CATEGORIES = [
    { value: "insumos",         label: "Insumos Agrícolas" },
    { value: "pecas",           label: "Peças e Manutenção" },
    { value: "diesel",          label: "Combustível / Diesel" },
    { value: "mao_de_obra",     label: "Mão de Obra" },
    { value: "frete",           label: "Frete / Transporte" },
    { value: "energia",         label: "Energia / Água" },
    { value: "arrendamento",    label: "Arrendamento" },
    { value: "financiamento",   label: "Parcela Financiamento" },
    { value: "impostos",        label: "Impostos e Taxas" },
    { value: "pro_labore",      label: "Retirada (Pró-labore)" },
    { value: "outro_saida",     label: "Outras Saídas" },
];

const ENTRADA_CATEGORIES = [
    { value: "venda_producao",  label: "Venda de Produção" },
    { value: "recebimento",     label: "Recebimento de Clientes" },
    { value: "emprestimo",      label: "Empréstimo / Financiamento" },
    { value: "reembolso",       label: "Reembolso / Devolução" },
    { value: "aporte",          label: "Aporte do Proprietário" },
    { value: "outro_entrada",   label: "Outras Entradas" },
];

export default function CategoriesPage() {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const { data: customCategories = [] } = useQuery<any[]>({
        queryKey: ["/api/farm/expense-categories"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/expense-categories"); return r.json(); },
        enabled: !!user,
    });

    const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/farm/expense-categories"] });

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

                <CategoriesManager categories={customCategories} onRefresh={refresh} />
            </div>
        </FarmLayout>
    );
}

// ─── Inline edit row for a custom category ───────────────────────────────────
function EditableRow({ cat, onRefresh }: { cat: any; onRefresh: () => void }) {
    const { toast } = useToast();
    const [editing, setEditing] = useState(false);
    const [editName, setEditName] = useState(cat.name);
    const [editType, setEditType] = useState(cat.type);

    const update = useMutation({
        mutationFn: () => apiRequest("PUT", `/api/farm/expense-categories/${cat.id}`, { name: editName, type: editType }),
        onSuccess: () => { toast({ title: "Categoria atualizada!" }); setEditing(false); onRefresh(); },
        onError: () => toast({ title: "Erro ao atualizar", variant: "destructive" }),
    });

    const remove = useMutation({
        mutationFn: () => apiRequest("DELETE", `/api/farm/expense-categories/${cat.id}`),
        onSuccess: () => { toast({ title: "Categoria removida" }); onRefresh(); },
        onError: () => toast({ title: "Erro ao remover", variant: "destructive" }),
    });

    const isLoading = update.isPending || remove.isPending;

    if (editing) {
        return (
            <div className="flex items-center gap-2 p-2 rounded-lg border border-emerald-300 bg-emerald-50">
                <Input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="h-7 text-sm flex-1"
                    autoFocus
                    onKeyDown={e => {
                        if (e.key === "Enter" && editName) update.mutate();
                        if (e.key === "Escape") { setEditing(false); setEditName(cat.name); }
                    }}
                />
                <Select value={editType} onValueChange={setEditType}>
                    <SelectTrigger className="h-7 text-xs w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="saida">Saída</SelectItem>
                        <SelectItem value="entrada">Entrada</SelectItem>
                    </SelectContent>
                </Select>
                <Button size="sm" className="h-7 w-7 p-0 bg-emerald-600 hover:bg-emerald-700"
                    disabled={!editName || isLoading} onClick={() => update.mutate()}>
                    <Check className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="outline" className="h-7 w-7 p-0"
                    onClick={() => { setEditing(false); setEditName(cat.name); setEditType(cat.type); }}>
                    <X className="h-3.5 w-3.5" />
                </Button>
            </div>
        );
    }

    return (
        <div className={`flex items-center justify-between p-2 rounded-lg text-sm border ${
            cat.type === "entrada"
                ? "bg-emerald-50 border-emerald-100"
                : "bg-red-50 border-red-100"
        }`}>
            <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    cat.type === "entrada"
                        ? "bg-emerald-100 text-emerald-600"
                        : "bg-red-100 text-red-600"
                }`}>
                    custom
                </span>
                <span className="font-medium">{cat.name}</span>
            </div>
            <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-emerald-600 hover:bg-emerald-100"
                    title="Editar" onClick={() => setEditing(true)}>
                    <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:bg-red-100"
                    title="Excluir" disabled={isLoading}
                    onClick={() => { if (confirm(`Excluir a categoria "${cat.name}"?`)) remove.mutate(); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            </div>
        </div>
    );
}

// ─── Main manager ─────────────────────────────────────────────────────────────
function CategoriesManager({ categories, onRefresh }: { categories: any[]; onRefresh: () => void }) {
    const { toast } = useToast();
    const [name, setName] = useState("");
    const [type, setType] = useState("saida");

    const create = useMutation({
        mutationFn: () => apiRequest("POST", "/api/farm/expense-categories", { name, type }),
        onSuccess: () => { toast({ title: "Categoria criada!" }); setName(""); onRefresh(); },
        onError: () => toast({ title: "Erro ao criar", variant: "destructive" }),
    });

    const customSaida   = categories.filter(c => c.type === "saida");
    const customEntrada = categories.filter(c => c.type === "entrada");

    return (
        <div className="space-y-6">
            {/* ── Add form ── */}
            <Card className="border-emerald-100">
                <CardHeader className="pb-3">
                    <CardTitle className="text-emerald-800 flex items-center gap-2 text-base">
                        <Plus className="h-4 w-4" /> Nova Categoria
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-3 items-end">
                        <div className="flex-1">
                            <Label>Nome</Label>
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
                </CardContent>
            </Card>

            {/* ── Lists ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Saída */}
                <Card className="border-red-100">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-red-700 flex items-center gap-2 text-sm">
                            <TrendingDown className="h-4 w-4" /> Categorias de Saída
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {/* Padrão (read-only) */}
                        {SAIDA_CATEGORIES.map(c => (
                            <div key={c.value} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 text-sm">
                                <span className="px-2 py-0.5 rounded-full bg-gray-200 text-gray-500 text-xs">padrão</span>
                                <span className="text-gray-600">{c.label}</span>
                            </div>
                        ))}
                        {/* Custom (editable) */}
                        {customSaida.length > 0 && (
                            <div className="pt-1 space-y-2">
                                {customSaida.map((c: any) => (
                                    <EditableRow key={c.id} cat={c} onRefresh={onRefresh} />
                                ))}
                            </div>
                        )}
                        {customSaida.length === 0 && (
                            <p className="text-xs text-gray-400 pt-1">Nenhuma categoria personalizada de saída.</p>
                        )}
                    </CardContent>
                </Card>

                {/* Entrada */}
                <Card className="border-emerald-100">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-emerald-700 flex items-center gap-2 text-sm">
                            <TrendingUp className="h-4 w-4" /> Categorias de Entrada
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {/* Padrão (read-only) */}
                        {ENTRADA_CATEGORIES.map(c => (
                            <div key={c.value} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 text-sm">
                                <span className="px-2 py-0.5 rounded-full bg-gray-200 text-gray-500 text-xs">padrão</span>
                                <span className="text-gray-600">{c.label}</span>
                            </div>
                        ))}
                        {/* Custom (editable) */}
                        {customEntrada.length > 0 && (
                            <div className="pt-1 space-y-2">
                                {customEntrada.map((c: any) => (
                                    <EditableRow key={c.id} cat={c} onRefresh={onRefresh} />
                                ))}
                            </div>
                        )}
                        {customEntrada.length === 0 && (
                            <p className="text-xs text-gray-400 pt-1">Nenhuma categoria personalizada de entrada.</p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
