import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import EmpresaLayout from "@/components/empresa/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Plus, Search, Pencil, Loader2, Package } from "lucide-react";

const api = (method: string, path: string, body?: any) =>
    fetch(path, { method, headers: body ? { "Content-Type": "application/json" } : {}, credentials: "include", body: body ? JSON.stringify(body) : undefined }).then(r => r.json());

const emptyForm = { code: "", name: "", unit: "SC", category: "" };

export default function EmpresaProdutos() {
    const { user } = useAuth();
    const { toast } = useToast();
    const qc = useQueryClient();
    const [search, setSearch] = useState("");
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<any>(null);
    const [form, setForm] = useState({ ...emptyForm });

    const { data: products = [], isLoading } = useQuery<any[]>({
        queryKey: ["/api/company/products"],
        queryFn: () => api("GET", "/api/company/products"),
        enabled: !!user,
    });

    const save = useMutation({
        mutationFn: (data: any) => editing
            ? api("PUT", `/api/company/products/${editing.id}`, data)
            : api("POST", "/api/company/products", data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["/api/company/products"] });
            setShowForm(false); setEditing(null); setForm({ ...emptyForm });
            toast({ title: editing ? "Produto atualizado" : "Produto criado" });
        },
        onError: () => toast({ title: "Erro ao salvar", variant: "destructive" }),
    });

    const openEdit = (p: any) => {
        setEditing(p);
        setForm({ code: p.code ?? "", name: p.name, unit: p.unit, category: p.category ?? "" });
        setShowForm(true);
    };

    const filtered = products.filter((p: any) =>
        !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.code ?? "").toLowerCase().includes(search.toLowerCase())
    );

    return (
        <EmpresaLayout>
            <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-slate-800">Catálogo de Produtos</h1>
                    <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => { setEditing(null); setForm({ ...emptyForm }); setShowForm(true); }}>
                        <Plus className="h-4 w-4 mr-2" /> Novo Produto
                    </Button>
                </div>

                <div className="relative max-w-xs">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input placeholder="Buscar produto ou código..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
                </div>

                <p className="text-sm text-slate-500">{filtered.length} produto{filtered.length !== 1 ? "s" : ""}</p>

                {isLoading ? (
                    <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">Nenhum produto encontrado</div>
                ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {filtered.map((p: any) => (
                            <Card key={p.id} className="hover:shadow-md transition-shadow">
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between">
                                        <div className="flex gap-2 items-start flex-1 min-w-0">
                                            <Package className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                                            <div className="min-w-0">
                                                <p className="font-semibold text-sm">{p.name}</p>
                                                {p.code && <p className="text-slate-500 text-xs">Cód: {p.code}</p>}
                                                <div className="flex gap-2 mt-1">
                                                    <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{p.unit}</span>
                                                    {p.category && <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{p.category}</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>
                                            <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            <Dialog open={showForm} onOpenChange={open => { if (!open) { setShowForm(false); setEditing(null); } }}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>{editing ? "Editar Produto" : "Novo Produto"}</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                        <div>
                            <Label>Nome *</Label>
                            <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Código</Label>
                                <Input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} />
                            </div>
                            <div>
                                <Label>Unidade</Label>
                                <Select value={form.unit} onValueChange={v => setForm(p => ({ ...p, unit: v }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {["SC", "KG", "LT", "UNI", "TON", "CX"].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="col-span-2">
                                <Label>Categoria</Label>
                                <Input value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} placeholder="Herbicida, Fungicida, Fertilizante..." />
                            </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                            <Button variant="outline" onClick={() => { setShowForm(false); setEditing(null); }}>Cancelar</Button>
                            <Button className="bg-blue-600 hover:bg-blue-700" disabled={!form.name || save.isPending} onClick={() => save.mutate(form)}>
                                {save.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                Salvar
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </EmpresaLayout>
    );
}
