import { useState, useRef } from "react";
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
import { Plus, Search, Pencil, Upload, Loader2, Phone, Mail, Building2 } from "lucide-react";

const api = (method: string, path: string, body?: any) =>
    fetch(path, { method, headers: body ? { "Content-Type": "application/json" } : {}, credentials: "include", body: body ? JSON.stringify(body) : undefined }).then(r => r.json());

const emptyForm = { name: "", ruc: "", cedula: "", clientType: "person", address: "", city: "", department: "", phone: "", email: "", creditLimit: "", notes: "" };

export default function EmpresaClientes() {
    const { user } = useAuth();
    const { toast } = useToast();
    const qc = useQueryClient();
    const [search, setSearch] = useState("");
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<any>(null);
    const [form, setForm] = useState({ ...emptyForm });
    const fileRef = useRef<HTMLInputElement>(null);

    const { data: clients = [], isLoading } = useQuery<any[]>({
        queryKey: ["/api/company/clients"],
        queryFn: () => api("GET", "/api/company/clients"),
        enabled: !!user,
    });

    const save = useMutation({
        mutationFn: (data: any) => editing
            ? api("PUT", `/api/company/clients/${editing.id}`, data)
            : api("POST", "/api/company/clients", data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["/api/company/clients"] });
            setShowForm(false); setEditing(null); setForm({ ...emptyForm });
            toast({ title: editing ? "Cliente atualizado" : "Cliente criado" });
        },
        onError: () => toast({ title: "Erro ao salvar", variant: "destructive" }),
    });

    const importExcel = useMutation({
        mutationFn: async (file: File) => {
            const fd = new FormData(); fd.append("file", file);
            const r = await fetch("/api/company/clients/import-excel", { method: "POST", credentials: "include", body: fd });
            return r.json();
        },
        onSuccess: (data) => {
            qc.invalidateQueries({ queryKey: ["/api/company/clients"] });
            toast({ title: `Importados: ${data.created} clientes (${data.skipped} ignorados)` });
        },
        onError: () => toast({ title: "Erro na importação", variant: "destructive" }),
    });

    const openEdit = (client: any) => {
        setEditing(client);
        setForm({ name: client.name ?? "", ruc: client.ruc ?? "", cedula: client.cedula ?? "", clientType: client.clientType ?? "person", address: client.address ?? "", city: client.city ?? "", department: client.department ?? "", phone: client.phone ?? "", email: client.email ?? "", creditLimit: client.creditLimit ?? "", notes: client.notes ?? "" });
        setShowForm(true);
    };

    const filtered = clients.filter((c: any) =>
        !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.ruc ?? "").includes(search) || (c.phone ?? "").includes(search)
    );

    return (
        <EmpresaLayout>
            <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-slate-800">Carteira de Clientes</h1>
                    <div className="flex gap-2">
                        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
                            onChange={e => { if (e.target.files?.[0]) importExcel.mutate(e.target.files[0]); }} />
                        <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importExcel.isPending}>
                            {importExcel.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                            Importar Excel
                        </Button>
                        <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => { setEditing(null); setForm({ ...emptyForm }); setShowForm(true); }}>
                            <Plus className="h-4 w-4 mr-2" /> Novo Cliente
                        </Button>
                    </div>
                </div>

                <div className="relative max-w-xs">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input placeholder="Buscar por nome, RUC ou telefone..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
                </div>

                <div className="text-sm text-slate-500">{filtered.length} cliente{filtered.length !== 1 ? "s" : ""}</div>

                {isLoading ? (
                    <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">Nenhum cliente encontrado</div>
                ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {filtered.map((c: any) => (
                            <Card key={c.id} className="hover:shadow-md transition-shadow">
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <Building2 className="h-4 w-4 text-slate-400 flex-shrink-0" />
                                                <p className="font-semibold text-sm truncate">{c.name}</p>
                                            </div>
                                            {c.ruc && <p className="text-slate-500 text-xs mt-0.5">RUC: {c.ruc}</p>}
                                            {c.city && <p className="text-slate-500 text-xs">{c.city}{c.department ? `, ${c.department}` : ""}</p>}
                                            <div className="flex gap-3 mt-2">
                                                {c.phone && (
                                                    <span className="flex items-center gap-1 text-xs text-slate-500">
                                                        <Phone className="h-3 w-3" />{c.phone}
                                                    </span>
                                                )}
                                                {c.email && (
                                                    <span className="flex items-center gap-1 text-xs text-slate-500 truncate">
                                                        <Mail className="h-3 w-3" />{c.email}
                                                    </span>
                                                )}
                                            </div>
                                            {parseFloat(c.creditLimit ?? "0") > 0 && (
                                                <div className="mt-2 text-xs">
                                                    <span className="text-slate-500">Límite: </span>
                                                    <span className="font-medium">$ {parseFloat(c.creditLimit).toLocaleString("es-PY", { minimumFractionDigits: 2 })}</span>
                                                    {parseFloat(c.creditUsed ?? "0") > 0 && (
                                                        <span className="text-slate-400"> / usado: $ {parseFloat(c.creditUsed).toLocaleString("es-PY", { minimumFractionDigits: 2 })}</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <Button size="sm" variant="ghost" onClick={() => openEdit(c)}>
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
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editing ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                                <Label>Nome / Razão Social *</Label>
                                <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                            </div>
                            <div>
                                <Label>RUC</Label>
                                <Input value={form.ruc} onChange={e => setForm(p => ({ ...p, ruc: e.target.value }))} />
                            </div>
                            <div>
                                <Label>Tipo</Label>
                                <Select value={form.clientType} onValueChange={v => setForm(p => ({ ...p, clientType: v }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="person">Pessoa Física</SelectItem>
                                        <SelectItem value="company">Pessoa Jurídica</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Telefone</Label>
                                <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
                            </div>
                            <div>
                                <Label>Email</Label>
                                <Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
                            </div>
                            <div>
                                <Label>Cidade</Label>
                                <Input value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} />
                            </div>
                            <div>
                                <Label>Departamento</Label>
                                <Input value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} />
                            </div>
                            <div className="col-span-2">
                                <Label>Endereço</Label>
                                <Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
                            </div>
                            <div>
                                <Label>Límite de Crédito (U$)</Label>
                                <Input type="number" value={form.creditLimit} onChange={e => setForm(p => ({ ...p, creditLimit: e.target.value }))} />
                            </div>
                            <div className="col-span-2">
                                <Label>Observações</Label>
                                <Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
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
