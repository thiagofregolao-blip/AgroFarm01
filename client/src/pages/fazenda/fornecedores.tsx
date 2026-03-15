import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import FarmLayout from "@/components/fazenda/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search, Building2, Phone, Mail, MapPin } from "lucide-react";

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
}

export default function FornecedoresPage() {
    const { toast } = useToast();
    const qc = useQueryClient();
    const [search, setSearch] = useState("");
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Supplier | null>(null);
    const [form, setForm] = useState({ name: "", ruc: "", phone: "", email: "", address: "", notes: "", personType: "", entityType: "" });

    const { data: suppliers = [], isLoading } = useQuery<Supplier[]>({
        queryKey: ["/api/farm/suppliers"],
    });

    const saveMutation = useMutation({
        mutationFn: async (data: any) => {
            const url = editing ? `/api/farm/suppliers/${editing.id}` : "/api/farm/suppliers";
            const method = editing ? "PUT" : "POST";
            const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(data) });
            if (!res.ok) {
                const body = await res.json().catch(() => null);
                throw new Error(body?.error || "Erro ao salvar");
            }
            return res.json();
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["/api/farm/suppliers"] });
            setModalOpen(false);
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

    const openNew = () => {
        setEditing(null);
        setForm({ name: "", ruc: "", phone: "", email: "", address: "", notes: "", personType: "", entityType: "" });
        setModalOpen(true);
    };

    const openEdit = (s: Supplier) => {
        setEditing(s);
        setForm({ name: s.name, ruc: s.ruc || "", phone: s.phone || "", email: s.email || "", address: s.address || "", notes: s.notes || "", personType: s.person_type || "", entityType: s.entity_type || "" });
        setModalOpen(true);
    };

    const filtered = suppliers.filter((s) =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        (s.ruc && s.ruc.includes(search))
    );

    return (
        <FarmLayout>
            <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <h1 className="text-xl font-bold text-slate-900">Fornecedores</h1>
                    <Button onClick={openNew} size="sm">
                        <Plus className="w-4 h-4 mr-1" /> Novo Fornecedor
                    </Button>
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
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
                        <Button onClick={() => saveMutation.mutate(form)} disabled={!form.name || saveMutation.isPending}>
                            {saveMutation.isPending ? "Salvando..." : "Salvar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </FarmLayout>
    );
}
