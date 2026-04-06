import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import FarmLayout from "@/components/fazenda/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search, Building2, Phone, Mail, MapPin, EyeOff, Eye } from "lucide-react";

interface SimilarSupplier { id: string; name: string; ruc: string | null; similarity: number; matchedBy: "ruc" | "name"; }

interface Supplier {
    id: string;
    name: string;
    ruc: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    notes: string | null;
    person_type: string | null;
    entity_type: string | null;
    is_active: boolean;
}

export default function FornecedoresPage() {
    const { toast } = useToast();
    const qc = useQueryClient();
    const [search, setSearch] = useState("");
    const [showInactive, setShowInactive] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Supplier | null>(null);
    const [form, setForm] = useState({ name: "", ruc: "", phone: "", email: "", address: "", notes: "", personType: "", entityType: "" });
    const [similarWarning, setSimilarWarning] = useState<{ similar: SimilarSupplier[]; pendingData: any } | null>(null);

    const { data: suppliers = [], isLoading } = useQuery<Supplier[]>({
        queryKey: ["/api/farm/suppliers"],
    });

    const saveMutation = useMutation({
        mutationFn: async (data: any) => {
            const url = editing ? `/api/farm/suppliers/${editing.id}` : "/api/farm/suppliers";
            const method = editing ? "PUT" : "POST";
            const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(data) });
            const body = await res.json().catch(() => null);
            if (res.ok && body?.warning) {
                return { __warning: true, similar: body.similar as SimilarSupplier[], pendingData: data };
            }
            if (!res.ok) throw new Error(body?.error || "Erro ao salvar");
            return body;
        },
        onSuccess: (result: any) => {
            if (result?.__warning) {
                setSimilarWarning({ similar: result.similar, pendingData: result.pendingData });
                return;
            }
            qc.invalidateQueries({ queryKey: ["/api/farm/suppliers"] });
            setModalOpen(false);
            setSimilarWarning(null);
            toast({ title: editing ? "Fornecedor atualizado" : "Fornecedor cadastrado" });
        },
        onError: (err: Error) => {
            toast({ title: err.message, variant: "destructive" });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/farm/suppliers/${id}`, { method: "DELETE", credentials: "include" });
            if (!res.ok) throw new Error("Erro ao excluir");
            return res.json();
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["/api/farm/suppliers"] });
            toast({ title: "Fornecedor removido" });
        },
    });

    const inactivateMutation = useMutation({
        mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
            const res = await fetch(`/api/farm/suppliers/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ is_active }),
            });
            if (!res.ok) throw new Error("Erro ao atualizar");
            return res.json();
        },
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({ queryKey: ["/api/farm/suppliers"] });
            toast({ title: vars.is_active ? "Fornecedor reativado" : "Fornecedor inativado" });
        },
    });

    const openNew = () => {
        setEditing(null);
        setForm({ name: "", ruc: "", phone: "", email: "", address: "", notes: "", personType: "__none__", entityType: "__none__" });
        setModalOpen(true);
    };

    const openEdit = (s: Supplier) => {
        setEditing(s);
        setForm({ name: s.name, ruc: s.ruc || "", phone: s.phone || "", email: s.email || "", address: s.address || "", notes: s.notes || "", personType: s.person_type || "__none__", entityType: s.entity_type || "__none__" });
        setModalOpen(true);
    };

    const filtered = suppliers.filter((s) => {
        const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
            (s.ruc && s.ruc.includes(search));
        const matchesActive = showInactive ? true : (s.is_active !== false);
        return matchesSearch && matchesActive;
    });

    return (
        <FarmLayout>
            <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <h1 className="text-xl font-bold text-slate-900">Fornecedores</h1>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setShowInactive(!showInactive)}>
                            {showInactive ? <Eye className="w-4 h-4 mr-1" /> : <EyeOff className="w-4 h-4 mr-1" />}
                            {showInactive ? "Ocultar Inativos" : "Ver Inativos"}
                        </Button>
                        <Button onClick={openNew} size="sm">
                            <Plus className="w-4 h-4 mr-1" /> Novo Fornecedor
                        </Button>
                    </div>
                </div>

                <div className="relative max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input placeholder="Buscar por nome ou RUC..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
                </div>

                {isLoading ? (
                    <p className="text-sm text-slate-500">Carregando...</p>
                ) : filtered.length === 0 ? (
                    <Card><CardContent className="py-12 text-center text-slate-500">Nenhum fornecedor cadastrado</CardContent></Card>
                ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {filtered.map((s) => (
                            <Card key={s.id} className="hover:shadow-md transition-shadow">
                                <CardHeader className="pb-2">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                                                <Building2 className="w-4 h-4 text-blue-600" />
                                            </div>
                                            <div>
                                                <CardTitle className="text-sm font-semibold">{s.name}</CardTitle>
                                                {s.ruc && <p className="text-xs text-slate-500">RUC: {s.ruc}</p>}
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)}>
                                                <Pencil className="w-3.5 h-3.5" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className={`h-7 w-7 ${s.is_active !== false ? "text-amber-500 hover:text-amber-700" : "text-emerald-500 hover:text-emerald-700"}`}
                                                title={s.is_active !== false ? "Inativar fornecedor" : "Reativar fornecedor"}
                                                onClick={() => inactivateMutation.mutate({ id: s.id, is_active: s.is_active === false })}>
                                                {s.is_active !== false ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700"
                                                onClick={() => { if (confirm("Remover fornecedor?")) deleteMutation.mutate(s.id); }}>
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-0 space-y-1">
                                    {(s.person_type || s.entity_type) && (
                                        <div className="flex gap-1.5 mb-1.5">
                                            {s.person_type && (
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${s.person_type === "provedor" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>
                                                    {s.person_type === "provedor" ? "Provedor" : "Cliente"}
                                                </span>
                                            )}
                                            {s.entity_type && (
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${s.entity_type === "fisica" ? "bg-purple-100 text-purple-700" : "bg-amber-100 text-amber-700"}`}>
                                                    {s.entity_type === "fisica" ? "P. Fisica" : "P. Juridica"}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                    {s.phone && <p className="text-xs text-slate-600 flex items-center gap-1.5"><Phone className="w-3 h-3" /> {s.phone}</p>}
                                    {s.email && <p className="text-xs text-slate-600 flex items-center gap-1.5"><Mail className="w-3 h-3" /> {s.email}</p>}
                                    {s.address && <p className="text-xs text-slate-600 flex items-center gap-1.5"><MapPin className="w-3 h-3" /> {s.address}</p>}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editing ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div>
                            <Label>Nome *</Label>
                            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Tipo</Label>
                                <Select value={form.personType} onValueChange={(v) => setForm({ ...form, personType: v })}>
                                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__none__">Selecione...</SelectItem>
                                        <SelectItem value="provedor">Provedor</SelectItem>
                                        <SelectItem value="cliente">Cliente</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Natureza</Label>
                                <Select value={form.entityType} onValueChange={(v) => setForm({ ...form, entityType: v })}>
                                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__none__">Selecione...</SelectItem>
                                        <SelectItem value="fisica">Pessoa Fisica</SelectItem>
                                        <SelectItem value="juridica">Pessoa Juridica</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>RUC</Label>
                                <Input value={form.ruc} onChange={(e) => setForm({ ...form, ruc: e.target.value })} />
                            </div>
                            <div>
                                <Label>Telefone</Label>
                                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                            </div>
                        </div>
                        <div>
                            <Label>Email</Label>
                            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                        </div>
                        <div>
                            <Label>Endereco</Label>
                            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                        </div>
                        <div>
                            <Label>Observacoes</Label>
                            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                        </div>
                    </div>
                    {!form.name && (
                        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                            Nome do fornecedor é obrigatório
                        </p>
                    )}
                    {saveMutation.isError && (
                        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                            {(saveMutation.error as Error)?.message || "Erro ao salvar"}
                        </p>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
                        <Button onClick={() => saveMutation.mutate({
                            ...form,
                            personType: form.personType === "__none__" ? null : form.personType,
                            entityType: form.entityType === "__none__" ? null : form.entityType,
                        })} disabled={!form.name || saveMutation.isPending}>
                            {saveMutation.isPending ? "Salvando..." : "Salvar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog open={!!similarWarning} onOpenChange={(open) => { if (!open) setSimilarWarning(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-amber-700">
                            <AlertTriangle className="w-5 h-5" />
                            Fornecedor semelhante encontrado
                        </DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-slate-600">
                        Encontramos fornecedores com nome parecido. Verifique se não é o mesmo antes de criar:
                    </p>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {similarWarning?.similar.map((s) => (
                            <div key={s.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                <div>
                                    <p className="text-sm font-medium text-slate-800">{s.name}</p>
                                    <p className="text-xs text-slate-500">
                                        {s.ruc ? `RUC: ${s.ruc}` : "Sem RUC"} · {s.matchedBy === "ruc" ? "RUC idêntico" : `${Math.round(s.similarity * 100)}% similar`}
                                    </p>
                                </div>
                                <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-800 text-xs"
                                    onClick={() => {
                                        setSimilarWarning(null);
                                        setModalOpen(false);
                                        setSearch(s.name.split(" ")[0]);
                                    }}>
                                    Ver cadastro
                                </Button>
                            </div>
                        ))}
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setSimilarWarning(null)}>Cancelar</Button>
                        <Button variant="destructive" onClick={() => {
                            if (similarWarning) {
                                saveMutation.mutate({ ...similarWarning.pendingData, forceCreate: true });
                                setSimilarWarning(null);
                            }
                        }}>
                            Criar mesmo assim
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </FarmLayout>
    );
}
