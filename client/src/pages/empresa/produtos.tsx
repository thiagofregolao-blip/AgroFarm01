import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import EmpresaLayout from "@/components/empresa/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Plus, Search, Pencil, Loader2, Package, Sparkles, Upload, Check, X, Trash2, EyeOff, Eye } from "lucide-react";

const api = (method: string, path: string, body?: any) =>
    fetch(path, { method, headers: body ? { "Content-Type": "application/json" } : {}, credentials: "include", body: body ? JSON.stringify(body) : undefined })
        .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "Erro"); return d; });

const emptyForm = { code: "", name: "", unit: "SC", category: "", activeIngredient: "", dose: "", description: "" };

const CATEGORIES = ["inseticida", "fungicida", "herbicida", "ts", "curasementes", "fertilizante", "adjuvante", "outro"];
const UNITS = ["SC", "KG", "LT", "UNI", "TON", "CX"];

const CATEGORY_COLORS: Record<string, string> = {
    inseticida: "bg-orange-50 text-orange-700",
    fungicida:  "bg-purple-50 text-purple-700",
    herbicida:  "bg-green-50 text-green-700",
    ts:         "bg-blue-50 text-blue-700",
    curasementes: "bg-blue-50 text-blue-700",
    fertilizante: "bg-yellow-50 text-yellow-700",
    adjuvante:  "bg-slate-100 text-slate-600",
    outro:      "bg-slate-100 text-slate-600",
};

interface AiProduct {
    nome: string;
    principioAtivo: string;
    dose: string;
    descricao: string;
    categoria: string;
    unidade: string;
    selected: boolean;
}

export default function EmpresaProdutos() {
    const { user } = useAuth();
    const { toast } = useToast();
    const qc = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [search, setSearch] = useState("");
    const [showInactive, setShowInactive] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<any>(null);
    const [form, setForm] = useState({ ...emptyForm });

    // AI import state
    const [showAiDialog, setShowAiDialog] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiProducts, setAiProducts] = useState<AiProduct[]>([]);
    const [savingAi, setSavingAi] = useState(false);

    const { data: products = [], isLoading } = useQuery<any[]>({
        queryKey: ["/api/company/products", showInactive],
        queryFn: () => api("GET", `/api/company/products${showInactive ? "?all=true" : ""}`),
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
        onError: (e: any) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
    });

    const toggleActive = useMutation({
        mutationFn: (p: any) => api("PUT", `/api/company/products/${p.id}`, { ...p, isActive: !p.isActive }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/company/products"] }),
        onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
    });

    const remove = useMutation({
        mutationFn: (id: string) => api("DELETE", `/api/company/products/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["/api/company/products"] });
            toast({ title: "Produto excluído" });
        },
        onError: (e: any) => toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" }),
    });

    const openEdit = (p: any) => {
        setEditing(p);
        setForm({
            code: p.code ?? "",
            name: p.name,
            unit: p.unit,
            category: p.category ?? "",
            activeIngredient: p.activeIngredient ?? "",
            dose: p.dose ?? "",
            description: p.description ?? "",
        });
        setShowForm(true);
    };

    const filtered = products.filter((p: any) =>
        !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.code ?? "").toLowerCase().includes(search.toLowerCase())
    );

    // ── AI import handlers ──────────────────────────────────────────────────

    async function handleFileUpload(file: File) {
        setAiLoading(true);
        setAiProducts([]);
        try {
            const fd = new FormData();
            fd.append("file", file);
            const r = await fetch("/api/company/products/import-from-file", {
                method: "POST",
                credentials: "include",
                body: fd,
            });
            let data: any;
            try { data = await r.json(); } catch { throw new Error("Erro ao processar arquivo (resposta inválida)"); }
            if (!r.ok) throw new Error(data.error || "Erro ao processar arquivo");
            if (!data.produtos || data.produtos.length === 0) {
                toast({ title: "Nenhum produto encontrado na imagem/PDF", variant: "destructive" });
                return;
            }
            setAiProducts(data.produtos.map((p: any) => ({ ...p, selected: true })));
        } catch (e: any) {
            toast({ title: "Erro", description: e.message, variant: "destructive" });
        } finally {
            setAiLoading(false);
        }
    }

    async function saveAiProducts() {
        const toSave = aiProducts.filter(p => p.selected);
        if (toSave.length === 0) return;
        setSavingAi(true);
        let saved = 0;
        let failed = 0;
        for (const p of toSave) {
            try {
                await api("POST", "/api/company/products", {
                    name: p.nome,
                    unit: p.unidade || "UNI",
                    category: p.categoria || null,
                    activeIngredient: p.principioAtivo || null,
                    dose: p.dose || null,
                    description: p.descricao || null,
                });
                saved++;
            } catch {
                failed++;
            }
        }
        setSavingAi(false);
        qc.invalidateQueries({ queryKey: ["/api/company/products"] });
        setShowAiDialog(false);
        setAiProducts([]);
        toast({
            title: `${saved} produto(s) importado(s)`,
            description: failed > 0 ? `${failed} falhou` : undefined,
        });
    }

    return (
        <EmpresaLayout>
            <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-slate-800">Catálogo de Produtos</h1>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            className="border-blue-300 text-blue-700 hover:bg-blue-50"
                            onClick={() => { setShowAiDialog(true); setAiProducts([]); }}
                        >
                            <Sparkles className="h-4 w-4 mr-2" /> Importar por IA
                        </Button>
                        <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => { setEditing(null); setForm({ ...emptyForm }); setShowForm(true); }}>
                            <Plus className="h-4 w-4 mr-2" /> Novo Produto
                        </Button>
                    </div>
                </div>

                <div className="relative max-w-xs">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input placeholder="Buscar produto ou código..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
                </div>

                <div className="flex items-center gap-3">
                    <p className="text-sm text-slate-500">{filtered.length} produto{filtered.length !== 1 ? "s" : ""}</p>
                    <button
                        onClick={() => setShowInactive(v => !v)}
                        className={`text-xs flex items-center gap-1 px-2 py-1 rounded-full border transition-colors ${showInactive ? "bg-slate-200 border-slate-400 text-slate-700" : "border-slate-300 text-slate-400 hover:text-slate-600"}`}
                    >
                        {showInactive ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                        {showInactive ? "Mostrando inativos" : "Ver inativos"}
                    </button>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">Nenhum produto encontrado</div>
                ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {filtered.map((p: any) => (
                            <Card key={p.id} className={`hover:shadow-md transition-shadow ${!p.isActive ? "opacity-50" : ""}`}>
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between">
                                        <div className="flex gap-2 items-start flex-1 min-w-0">
                                            <Package className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1.5">
                                                    <p className="font-semibold text-sm">{p.name}</p>
                                                    {!p.isActive && <span className="text-xs bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded">Inativo</span>}
                                                </div>
                                                {p.code && <p className="text-slate-500 text-xs">Cód: {p.code}</p>}
                                                {p.activeIngredient && (
                                                    <p className="text-slate-500 text-xs mt-0.5">P.A.: {p.activeIngredient}</p>
                                                )}
                                                {p.dose && (
                                                    <p className="text-slate-500 text-xs">Dose: {p.dose}</p>
                                                )}
                                                <div className="flex gap-2 mt-1 flex-wrap">
                                                    <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{p.unit}</span>
                                                    {p.category && (
                                                        <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${CATEGORY_COLORS[p.category] ?? "bg-slate-100 text-slate-600"}`}>
                                                            {p.category}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-0.5 shrink-0">
                                            <Button size="sm" variant="ghost" title="Editar" onClick={() => openEdit(p)}>
                                                <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                                size="sm" variant="ghost"
                                                title={p.isActive ? "Inativar produto" : "Reativar produto"}
                                                className={p.isActive ? "text-slate-400 hover:text-amber-600" : "text-amber-500 hover:text-green-600"}
                                                disabled={toggleActive.isPending}
                                                onClick={() => toggleActive.mutate(p)}
                                            >
                                                {p.isActive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                            </Button>
                                            <Button
                                                size="sm" variant="ghost"
                                                title="Excluir produto"
                                                className="text-slate-400 hover:text-red-600"
                                                disabled={remove.isPending}
                                                onClick={() => { if (confirm(`Excluir "${p.name}"?`)) remove.mutate(p.id); }}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* Manual form dialog */}
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
                                        {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div>
                            <Label>Categoria</Label>
                            <Select value={form.category || "_none"} onValueChange={v => setForm(p => ({ ...p, category: v === "_none" ? "" : v }))}>
                                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="_none">Sem categoria</SelectItem>
                                    {CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Princípio Ativo</Label>
                            <Input value={form.activeIngredient} onChange={e => setForm(p => ({ ...p, activeIngredient: e.target.value }))} placeholder="Ex: Glyphosate 480 g/L" />
                        </div>
                        <div>
                            <Label>Dose</Label>
                            <Input value={form.dose} onChange={e => setForm(p => ({ ...p, dose: e.target.value }))} placeholder="Ex: 2-4 L/ha" />
                        </div>
                        <div>
                            <Label>Descrição</Label>
                            <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} placeholder="Descrição ou modo de uso" />
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

            {/* AI Import dialog */}
            <Dialog open={showAiDialog} onOpenChange={open => { if (!open) { setShowAiDialog(false); setAiProducts([]); } }}>
                <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-blue-600" /> Importar Produtos por IA
                        </DialogTitle>
                    </DialogHeader>

                    {aiProducts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 gap-4">
                            {aiLoading ? (
                                <>
                                    <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
                                    <p className="text-slate-500 text-sm">Analisando arquivo com IA...</p>
                                </>
                            ) : (
                                <>
                                    <div
                                        className="border-2 border-dashed border-slate-300 rounded-xl p-10 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors w-full"
                                        onClick={() => fileInputRef.current?.click()}
                                        onDragOver={e => e.preventDefault()}
                                        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileUpload(f); }}
                                    >
                                        <Upload className="h-10 w-10 text-slate-400 mx-auto mb-3" />
                                        <p className="font-semibold text-slate-700">Clique ou arraste o arquivo aqui</p>
                                        <p className="text-slate-400 text-sm mt-1">Suporta imagens (JPG, PNG) e PDF</p>
                                    </div>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*,application/pdf"
                                        className="hidden"
                                        onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); e.target.value = ""; }}
                                    />
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col flex-1 overflow-hidden gap-3">
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-slate-600">
                                    <strong>{aiProducts.filter(p => p.selected).length}</strong> de {aiProducts.length} produto(s) selecionado(s) para importar
                                </p>
                                <div className="flex gap-2">
                                    <Button size="sm" variant="outline" onClick={() => setAiProducts(ps => ps.map(p => ({ ...p, selected: true })))}>
                                        Selec. todos
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => setAiProducts(ps => ps.map(p => ({ ...p, selected: false })))}>
                                        Limpar
                                    </Button>
                                </div>
                            </div>

                            <div className="overflow-y-auto flex-1 space-y-2 pr-1">
                                {aiProducts.map((p, i) => (
                                    <div
                                        key={i}
                                        className={`border rounded-lg p-3 flex gap-3 cursor-pointer transition-colors ${p.selected ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white opacity-60"}`}
                                        onClick={() => setAiProducts(ps => ps.map((x, j) => j === i ? { ...x, selected: !x.selected } : x))}
                                    >
                                        <div className="mt-0.5">
                                            {p.selected
                                                ? <Check className="h-4 w-4 text-blue-600" />
                                                : <X className="h-4 w-4 text-slate-400" />
                                            }
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <p className="font-semibold text-sm">{p.nome}</p>
                                                <div className="flex gap-1 shrink-0">
                                                    <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{p.unidade}</span>
                                                    {p.categoria && (
                                                        <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${CATEGORY_COLORS[p.categoria] ?? "bg-slate-100 text-slate-600"}`}>
                                                            {p.categoria}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            {p.principioAtivo && <p className="text-xs text-slate-500 mt-0.5">P.A.: {p.principioAtivo}</p>}
                                            {p.dose && <p className="text-xs text-slate-500">Dose: {p.dose}</p>}
                                            {p.descricao && <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{p.descricao}</p>}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="flex gap-2 justify-between pt-2 border-t">
                                <Button variant="outline" onClick={() => { setAiProducts([]); }}>
                                    <Upload className="h-4 w-4 mr-2" /> Novo arquivo
                                </Button>
                                <div className="flex gap-2">
                                    <Button variant="outline" onClick={() => { setShowAiDialog(false); setAiProducts([]); }}>Cancelar</Button>
                                    <Button
                                        className="bg-blue-600 hover:bg-blue-700"
                                        disabled={aiProducts.filter(p => p.selected).length === 0 || savingAi}
                                        onClick={saveAiProducts}
                                    >
                                        {savingAi ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                                        Importar selecionados
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </EmpresaLayout>
    );
}
