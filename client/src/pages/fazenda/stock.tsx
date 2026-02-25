import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import FarmLayout from "@/components/fazenda/layout";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Search, Warehouse, ArrowUpRight, ArrowDownRight, Plus, Camera, Package, Trash2, Pencil, RefreshCw } from "lucide-react";
import { useState, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export default function FarmStock() {
    const [, setLocation] = useLocation();
    const queryClient = useQueryClient();
    const [search, setSearch] = useState("");
    const { toast } = useToast();

    const { user } = useAuth();

    const { data: stock = [], isLoading } = useQuery({
        queryKey: ["/api/farm/stock"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/stock"); return r.json(); },
        enabled: !!user,
    });

    const { data: movements = [] } = useQuery({
        queryKey: ["/api/farm/stock/movements"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/stock/movements?limit=100"); return r.json(); },
        enabled: !!user,
    });

    const deleteStock = useMutation({
        mutationFn: async (id: string) => {
            await apiRequest("DELETE", `/api/farm/stock/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/stock"] });
            toast({ title: "Produto excluído", description: "O item foi removido do estoque." });
        },
        onError: (err: any) => {
            toast({ title: "Erro", description: err.message, variant: "destructive" });
        }
    });

    const handleDelete = (id: string, name: string) => {
        if (confirm(`Tem certeza que deseja excluir '${name}' do estoque?`)) {
            deleteStock.mutate(id);
        }
    };

    const filtered = stock.filter((s: any) =>
        s.productName.toLowerCase().includes(search.toLowerCase()) ||
        (s.productCategory || "").toLowerCase().includes(search.toLowerCase())
    );

    const totalValue = stock.reduce((s: number, i: any) =>
        s + (parseFloat(i.quantity) * parseFloat(i.averageCost)), 0
    );

    return (
        <FarmLayout>
            <div className="space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-emerald-800">Depósito / Estoque</h1>
                        <p className="text-emerald-600 text-sm">
                            {stock.length} itens — Valor total: <strong>${totalValue.toLocaleString("en", { minimumFractionDigits: 2 })}</strong>
                        </p>
                    </div>
                    <ManualStockEntryDialog onSuccess={() => queryClient.invalidateQueries({ queryKey: ["/api/farm/stock"] })} />
                </div>

                <Tabs defaultValue="stock">
                    <TabsList>
                        <TabsTrigger value="stock">Estoque Atual</TabsTrigger>
                        <TabsTrigger value="movements">Movimentações</TabsTrigger>
                    </TabsList>

                    <TabsContent value="stock" className="mt-4">
                        <div className="relative mb-4">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input className="pl-10" placeholder="Buscar produto..." value={search} onChange={e => setSearch(e.target.value)} />
                        </div>

                        {isLoading ? (
                            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
                        ) : filtered.length === 0 ? (
                            <Card className="border-emerald-100"><CardContent className="py-12 text-center">
                                <Warehouse className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                                <p className="text-gray-500">Estoque vazio</p>
                            </CardContent></Card>
                        ) : (
                            <div className="bg-white rounded-xl border border-emerald-100 overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-emerald-50">
                                        <tr>
                                            <th className="text-left p-3 font-semibold text-emerald-800">Produto</th>
                                            <th className="text-left p-3 font-semibold text-emerald-800">Categoria</th>
                                            <th className="text-right p-3 font-semibold text-emerald-800">Quantidade</th>
                                            <th className="text-right p-3 font-semibold text-emerald-800">Custo Médio</th>
                                            <th className="text-right p-3 font-semibold text-emerald-800">Valor Total</th>
                                            <th className="text-right p-3 font-semibold text-emerald-800">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map((s: any) => {
                                            const qty = parseFloat(s.quantity);
                                            const cost = parseFloat(s.averageCost);
                                            return (
                                                <tr key={s.id} className="border-t border-gray-100 hover:bg-emerald-50/30">
                                                    <td className="p-3 font-medium">{s.productName}</td>
                                                    <td className="p-3">
                                                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                                                            {s.productCategory || "—"}
                                                        </span>
                                                    </td>
                                                    <td className="text-right p-3 font-mono">
                                                        <span className={qty <= 0 ? "text-red-600 font-bold" : ""}>
                                                            {qty.toFixed(2)} {s.productUnit}
                                                        </span>
                                                    </td>
                                                    <td className="text-right p-3 font-mono">${cost.toFixed(2)}</td>
                                                    <td className="text-right p-3 font-mono font-semibold">${(qty * cost).toFixed(2)}</td>
                                                    <td className="text-right p-3">
                                                        <div className="flex justify-end gap-2">
                                                            <EditStockDialog stockItem={s} onSuccess={() => queryClient.invalidateQueries({ queryKey: ["/api/farm/stock"] })} />
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(s.id, s.productName)} disabled={deleteStock.isPending}>
                                                                {deleteStock.isPending && deleteStock.variables === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="movements" className="mt-4">
                        {movements.length === 0 ? (
                            <Card className="border-emerald-100"><CardContent className="py-12 text-center">
                                <p className="text-gray-500">Nenhuma movimentação registrada</p>
                            </CardContent></Card>
                        ) : (
                            <div className="space-y-2">
                                {movements.map((m: any) => (
                                    <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg bg-white border border-gray-100">
                                        {m.type === "entry" ? (
                                            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                                                <ArrowUpRight className="h-4 w-4 text-green-600" />
                                            </div>
                                        ) : (
                                            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                                                <ArrowDownRight className="h-4 w-4 text-red-600" />
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-sm">{m.productName}</p>
                                            <p className="text-xs text-gray-500">{m.notes} • {m.referenceType}</p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className={`font-semibold text-sm font-mono ${m.type === "entry" ? "text-green-600" : "text-red-600"}`}>
                                                {m.type === "entry" ? "+" : ""}{parseFloat(m.quantity).toFixed(2)}
                                            </p>
                                            <p className="text-xs text-gray-400">{new Date(m.createdAt).toLocaleDateString("pt-BR")}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </div>
        </FarmLayout>
    );
}

const CATEGORIES = [
    { value: "Herbicida", label: "Herbicida" },
    { value: "Fungicida", label: "Fungicida" },
    { value: "Inseticida", label: "Inseticida" },
    { value: "Fertilizante", label: "Fertilizante" },
    { value: "Semente", label: "Semente" },
    { value: "Adjuvante", label: "Adjuvante" },
    { value: "Outro", label: "Outro" },
];

const UNITS = ["LT", "KG", "UNI", "SC"];

function ManualStockEntryDialog({ onSuccess }: { onSuccess: () => void }) {
    const [open, setOpen] = useState(false);
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [name, setName] = useState("");
    const [category, setCategory] = useState("");
    const [unit, setUnit] = useState("");
    const [activeIngredient, setActiveIngredient] = useState("");
    const [quantity, setQuantity] = useState("");
    const [unitCost, setUnitCost] = useState("");
    const [previewUrl, setPreviewUrl] = useState("");

    const extractPhoto = useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData();
            formData.append("file", file);
            const res = await fetch("/api/farm/stock/extract-photo", {
                method: "POST",
                body: formData
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Falha ao analisar a foto");
            }
            return res.json();
        },
        onSuccess: (data: any) => {
            setName(data.name || "");
            setCategory(data.category || "");
            setUnit(data.unit || "LT");
            setActiveIngredient(data.activeIngredient || "");
            toast({ title: "Dados extraídos com sucesso!", description: "Revise e insira as quantidades." });
        },
        onError: (e) => {
            toast({ title: "Erro na IA", description: e.message, variant: "destructive" });
        }
    });

    const saveStock = useMutation({
        mutationFn: async () => {
            return apiRequest("POST", "/api/farm/stock", {
                name,
                category,
                unit,
                activeIngredient,
                quantity: parseFloat(quantity),
                unitCost: parseFloat(unitCost)
            });
        },
        onSuccess: () => {
            toast({ title: "Produto adicionado ao estoque!" });
            setOpen(false);
            onSuccess();
        },
        onError: (e: any) => {
            toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
        }
    });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setPreviewUrl(URL.createObjectURL(file));
            extractPhoto.mutate(file);
        }
    };

    const resetForm = () => {
        setName("");
        setCategory("");
        setUnit("");
        setActiveIngredient("");
        setQuantity("");
        setUnitCost("");
        setPreviewUrl("");
    };

    return (
        <Dialog open={open} onOpenChange={(o) => {
            setOpen(o);
            if (!o) resetForm();
        }}>
            <DialogTrigger asChild>
                <Button className="bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="mr-2 h-4 w-4" /> Adicionar Produto
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Entrada Avulsa no Estoque</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Botão de Câmera e IA */}
                    <div className="flex flex-col gap-2">
                        <Label>1. Tire uma foto do rótulo/embalagem</Label>
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*"
                            capture="environment"
                            onChange={handleFileChange}
                        />
                        <Button
                            type="button"
                            variant="outline"
                            className="w-full relative h-[60px]"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={extractPhoto.isPending}
                        >
                            {extractPhoto.isPending ? (
                                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Analisando Rótulo...</>
                            ) : previewUrl ? (
                                <div className="flex items-center absolute inset-0 rounded-md overflow-hidden opacity-30">
                                    <img src={previewUrl} className="w-full h-full object-cover" />
                                </div>
                            ) : null}
                            <span className="relative z-10 flex items-center">
                                <Camera className="mr-2 h-5 w-5 text-emerald-600" />
                                {previewUrl ? "Trocar Foto" : "Tirar Foto (IA)"}
                            </span>
                        </Button>
                        <p className="text-xs text-muted-foreground">A inteligência artificial preencherá os dados automaticamente.</p>
                    </div>

                    <hr className="my-2 border-emerald-100" />

                    {/* Formulário de Produto */}
                    <div className="space-y-3">
                        <Label className="text-emerald-800 font-semibold">2. Revise e Inseria Quantidades</Label>

                        <div>
                            <Label>Nome do Produto *</Label>
                            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: SPHERE MAX" disabled={saveStock.isPending} />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Categoria</Label>
                                <Select value={category} onValueChange={setCategory}>
                                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                    <SelectContent>
                                        {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Unidade</Label>
                                <Select value={unit} onValueChange={setUnit}>
                                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                    <SelectContent>
                                        {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div>
                            <Label>Ingrediente Ativo <span className="text-gray-400 font-normal">(Opcional)</span></Label>
                            <Input value={activeIngredient} onChange={e => setActiveIngredient(e.target.value)} placeholder="Ex: Ciproconazol" disabled={saveStock.isPending} />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Quantidade Adicionada *</Label>
                                <Input type="number" step="0.01" min="0" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="Ex: 50" disabled={saveStock.isPending} />
                            </div>
                            <div>
                                <Label>Custo Unitário (R$) *</Label>
                                <Input type="number" step="0.01" min="0" value={unitCost} onChange={e => setUnitCost(e.target.value)} placeholder="Ex: 15.50" disabled={saveStock.isPending} />
                            </div>
                        </div>
                    </div>

                    <Button
                        className="w-full bg-emerald-600 hover:bg-emerald-700 mt-4"
                        onClick={() => saveStock.mutate()}
                        disabled={saveStock.isPending || extractPhoto.isPending || !name || !quantity || !unitCost}
                    >
                        {saveStock.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Package className="mr-2 h-4 w-4" />}
                        Confirmar Entrada no Estoque
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function EditStockDialog({ stockItem, onSuccess }: { stockItem: any; onSuccess: () => void }) {
    const [open, setOpen] = useState(false);
    const { toast } = useToast();

    // Default values fetched from current stockItem
    const [quantity, setQuantity] = useState(stockItem.quantity.toString());
    const [averageCost, setAverageCost] = useState(stockItem.averageCost.toString());
    const [reason, setReason] = useState("");

    const updateStock = useMutation({
        mutationFn: async () => {
            return apiRequest("PUT", `/api/farm/stock/${stockItem.id}`, {
                quantity: parseFloat(quantity),
                averageCost: parseFloat(averageCost),
                reason,
            });
        },
        onSuccess: () => {
            toast({ title: "Estoque atualizado", description: "O ajuste foi registrado com sucesso." });
            setOpen(false);
            onSuccess();
        },
        onError: (e: any) => {
            toast({ title: "Erro na edição", description: e.message, variant: "destructive" });
        }
    });

    const resetForm = () => {
        setQuantity(stockItem.quantity.toString());
        setAverageCost(stockItem.averageCost.toString());
        setReason("");
    };

    return (
        <Dialog open={open} onOpenChange={(o) => {
            setOpen(o);
            if (!o) resetForm();
        }}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-500 hover:text-amber-700 hover:bg-amber-50">
                    <Pencil className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Editar {stockItem.productName}</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Quantidade Hoje</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={quantity}
                                onChange={e => setQuantity(e.target.value)}
                                disabled={updateStock.isPending}
                            />
                        </div>
                        <div>
                            <Label>Custo Médio (R$)</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={averageCost}
                                onChange={e => setAverageCost(e.target.value)}
                                disabled={updateStock.isPending}
                            />
                        </div>
                    </div>

                    <div>
                        <Label>Motivo da Correção *</Label>
                        <Input
                            placeholder="Ex: Quebra, erro de recontagem..."
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            disabled={updateStock.isPending}
                        />
                    </div>

                    <Button
                        className="w-full bg-amber-600 hover:bg-amber-700 mt-4"
                        onClick={() => updateStock.mutate()}
                        disabled={updateStock.isPending || !quantity || !averageCost || !reason.trim()}
                    >
                        {updateStock.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        Aplicar Correção
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
