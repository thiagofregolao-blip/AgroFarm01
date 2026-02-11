import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import FarmLayout from "@/components/fazenda/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit2, Trash2, Search, Loader2, Package } from "lucide-react";

const CATEGORIES = [
    { value: "herbicida", label: "Herbicida" },
    { value: "fungicida", label: "Fungicida" },
    { value: "inseticida", label: "Inseticida" },
    { value: "fertilizante", label: "Fertilizante" },
    { value: "semente", label: "Semente" },
    { value: "adjuvante", label: "Adjuvante" },
    { value: "outro", label: "Outro" },
];

const UNITS = ["LT", "KG", "UNI", "SC"];

export default function FarmProducts() {
    const [, setLocation] = useLocation();
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [openDialog, setOpenDialog] = useState(false);
    const [editProduct, setEditProduct] = useState<any>(null);
    const [search, setSearch] = useState("");

    const { user } = useAuth();

    const { data: products = [], isLoading } = useQuery({
        queryKey: ["/api/farm/products"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/products"); return r.json(); },
        enabled: !!user,
    });

    const deleteProduct = useMutation({
        mutationFn: (id: string) => apiRequest("DELETE", `/api/farm/products/${id}`),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/farm/products"] }); toast({ title: "Produto excluído" }); },
    });

    const filtered = products.filter((p: any) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.category || "").toLowerCase().includes(search.toLowerCase())
    );

    return (
        <FarmLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-emerald-800">Catálogo de Produtos</h1>
                        <p className="text-emerald-600 text-sm">Cadastro global com dose por hectare</p>
                    </div>
                    <Dialog open={openDialog} onOpenChange={(o) => { setOpenDialog(o); if (!o) setEditProduct(null); }}>
                        <DialogTrigger asChild>
                            <Button className="bg-emerald-600 hover:bg-emerald-700"><Plus className="mr-2 h-4 w-4" /> Novo Produto</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>{editProduct ? "Editar" : "Novo"} Produto</DialogTitle>
                            </DialogHeader>
                            <ProductForm
                                initial={editProduct}
                                onSave={() => { setOpenDialog(false); setEditProduct(null); queryClient.invalidateQueries({ queryKey: ["/api/farm/products"] }); }}
                            />
                        </DialogContent>
                    </Dialog>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                        className="pl-10"
                        placeholder="Buscar por nome ou categoria..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
                ) : filtered.length === 0 ? (
                    <Card className="border-emerald-100"><CardContent className="py-12 text-center">
                        <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">{search ? "Nenhum produto encontrado" : "Nenhum produto cadastrado"}</p>
                    </CardContent></Card>
                ) : (
                    <div className="bg-white rounded-xl border border-emerald-100 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-emerald-50">
                                <tr>
                                    <th className="text-left p-3 font-semibold text-emerald-800">Produto</th>
                                    <th className="text-left p-3 font-semibold text-emerald-800">Categoria</th>
                                    <th className="text-center p-3 font-semibold text-emerald-800">Unidade</th>
                                    <th className="text-right p-3 font-semibold text-emerald-800">Dose/ha</th>
                                    <th className="text-right p-3 font-semibold text-emerald-800">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((p: any) => (
                                    <tr key={p.id} className="border-t border-gray-100 hover:bg-emerald-50/30">
                                        <td className="p-3">
                                            <p className="font-medium">{p.name}</p>
                                            {p.activeIngredient && <p className="text-xs text-gray-500">{p.activeIngredient}</p>}
                                        </td>
                                        <td className="p-3">
                                            <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                                                {p.category || "—"}
                                            </span>
                                        </td>
                                        <td className="text-center p-3">{p.unit}</td>
                                        <td className="text-right p-3 font-mono">{p.dosePerHa ? `${p.dosePerHa} ${p.unit}/ha` : "—"}</td>
                                        <td className="text-right p-3">
                                            <div className="flex justify-end gap-1">
                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditProduct(p); setOpenDialog(true); }}><Edit2 className="h-3.5 w-3.5" /></Button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => deleteProduct.mutate(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <p className="text-xs text-gray-400 text-center">{filtered.length} produto(s)</p>
            </div>
        </FarmLayout>
    );
}

function ProductForm({ initial, onSave }: { initial?: any; onSave: () => void }) {
    const [name, setName] = useState(initial?.name || "");
    const [unit, setUnit] = useState(initial?.unit || "LT");
    const [dosePerHa, setDosePerHa] = useState(initial?.dosePerHa || "");
    const [category, setCategory] = useState(initial?.category || "");
    const [activeIngredient, setActiveIngredient] = useState(initial?.activeIngredient || "");
    const [imageUrl, setImageUrl] = useState(initial?.imageUrl || "");
    const { toast } = useToast();

    const save = useMutation({
        mutationFn: async () => {
            const payload = { name, unit, dosePerHa: dosePerHa || null, category, activeIngredient, imageUrl: imageUrl || null };
            if (initial?.id) {
                return apiRequest("PUT", `/api/farm/products/${initial.id}`, payload);
            }
            return apiRequest("POST", "/api/farm/products", payload);
        },
        onSuccess: () => { toast({ title: initial ? "Produto atualizado" : "Produto criado" }); onSave(); },
    });

    return (
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
            <div><Label>Nome *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: CONTACT 72 - 20LTS" required /></div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <Label>Unidade *</Label>
                    <Select value={unit} onValueChange={setUnit}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <div><Label>Dose/ha</Label><Input type="number" step="0.0001" value={dosePerHa} onChange={e => setDosePerHa(e.target.value)} /></div>
            </div>
            <div>
                <Label>Categoria</Label>
                <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
            </div>
            <div><Label>Ingrediente Ativo</Label><Input value={activeIngredient} onChange={e => setActiveIngredient(e.target.value)} /></div>
            <div>
                <Label>URL da Imagem</Label>
                <Input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://exemplo.com/imagem-produto.jpg" />
                {imageUrl && (
                    <div className="mt-2 w-20 h-20 rounded-lg border border-emerald-200 overflow-hidden bg-white">
                        <img src={imageUrl} alt="Preview" className="w-full h-full object-contain" onError={(e) => (e.currentTarget.style.display = "none")} />
                    </div>
                )}
            </div>
            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={save.isPending}>
                {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Salvar
            </Button>
        </form>
    );
}
