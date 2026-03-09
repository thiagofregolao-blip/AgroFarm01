import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import EmpresaLayout from "@/components/empresa/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Plus, Search, Pencil, Loader2, Phone, Mail, Building2, Trash2, EyeOff, Eye, Sparkles, ChevronDown, ChevronRight, Users } from "lucide-react";

const api = (method: string, path: string, body?: any) =>
    fetch(path, { method, headers: body ? { "Content-Type": "application/json" } : {}, credentials: "include", body: body ? JSON.stringify(body) : undefined })
        .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "Erro"); return d; });

const emptyForm = { name: "", ruc: "", cedula: "", clientType: "person", address: "", city: "", department: "", phone: "", email: "", creditLimit: "", notes: "", assignedConsultantId: "" };

const ROLE_LABELS: Record<string, string> = {
    rtv: "RTV", director: "Diretor", faturista: "Faturista",
    financeiro: "Financeiro", admin_empresa: "Admin",
};

export default function EmpresaClientes() {
    const { user } = useAuth();
    const { toast } = useToast();
    const qc = useQueryClient();
    const [search, setSearch] = useState("");
    const [showInactive, setShowInactive] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<any>(null);
    const [form, setForm] = useState({ ...emptyForm });
    const fileRef = useRef<HTMLInputElement>(null);
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

    // Import RTV selection modal
    const [showImportModal, setShowImportModal] = useState(false);
    const [selectedRtvId, setSelectedRtvId] = useState<string>("none");

    const { data: company } = useQuery<any>({
        queryKey: ["/api/company/me"],
        queryFn: () => api("GET", "/api/company/me"),
        enabled: !!user,
    });
    const companyRole: string = company?.role ?? "";
    const isRtv = companyRole === "rtv";

    const { data: allClients = [], isLoading } = useQuery<any[]>({
        queryKey: ["/api/company/clients"],
        queryFn: () => api("GET", "/api/company/clients"),
        enabled: !!user,
    });

    const { data: team = [] } = useQuery<any[]>({
        queryKey: ["/api/company/team"],
        queryFn: () => api("GET", "/api/company/team"),
        enabled: !!user,
    });

    const clients = allClients.filter((c: any) => showInactive ? true : c.isActive !== false);

    const save = useMutation({
        mutationFn: (data: any) => editing
            ? api("PUT", `/api/company/clients/${editing.id}`, data)
            : api("POST", "/api/company/clients", data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["/api/company/clients"] });
            setShowForm(false); setEditing(null); setForm({ ...emptyForm });
            toast({ title: editing ? "Cliente atualizado" : "Cliente criado" });
        },
        onError: (e: any) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
    });

    const toggleActive = useMutation({
        mutationFn: (c: any) => api("PUT", `/api/company/clients/${c.id}`, { ...c, isActive: !c.isActive }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/company/clients"] }),
        onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
    });

    const remove = useMutation({
        mutationFn: (id: string) => api("DELETE", `/api/company/clients/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["/api/company/clients"] });
            toast({ title: "Cliente excluído" });
        },
        onError: (e: any) => toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" }),
    });

    const purgeAll = useMutation({
        mutationFn: () => api("DELETE", "/api/company/clients/purge-all"),
        onSuccess: (data: any) => {
            qc.invalidateQueries({ queryKey: ["/api/company/clients"] });
            toast({ title: `${data.deleted} cliente(s) removido(s)` });
        },
        onError: (e: any) => toast({ title: "Erro ao limpar", description: e.message, variant: "destructive" }),
    });

    const importExcel = useMutation({
        mutationFn: async (file: File) => {
            const fd = new FormData();
            fd.append("file", file);
            if (selectedRtvId && selectedRtvId !== "none") fd.append("assignedConsultantId", selectedRtvId);
            const r = await fetch("/api/company/clients/import-excel", { method: "POST", credentials: "include", body: fd });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Erro ao importar");
            return data;
        },
        onSuccess: (data) => {
            qc.invalidateQueries({ queryKey: ["/api/company/clients"] });
            setShowImportModal(false);
            const desc = data.created === 0 && data.skipped > 0
                ? `${data.skipped} cliente(s) já existem no sistema e foram ignorados`
                : data.skipped > 0 ? `${data.skipped} linha(s) ignorada(s) (já existem)` : undefined;
            toast({
                title: data.created > 0 ? `${data.created} cliente(s) importado(s)` : "Nenhum cliente novo importado",
                description: desc,
                variant: data.created === 0 ? "destructive" : "default",
            });
        },
        onError: (e: any) => toast({ title: "Erro na importação", description: e.message, variant: "destructive" }),
    });

    const openEdit = (client: any) => {
        setEditing(client);
        setForm({ name: client.name ?? "", ruc: client.ruc ?? "", cedula: client.cedula ?? "", clientType: client.clientType ?? "person", address: client.address ?? "", city: client.city ?? "", department: client.department ?? "", phone: client.phone ?? "", email: client.email ?? "", creditLimit: client.creditLimit ?? "", notes: client.notes ?? "", assignedConsultantId: client.assignedConsultantId ?? "" });
        setShowForm(true);
    };

    const filtered = clients.filter((c: any) =>
        !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.ruc ?? "").includes(search) || (c.phone ?? "").includes(search)
    );

    const { refreshing } = usePullToRefresh(() => qc.invalidateQueries({ queryKey: ["/api/company/clients"] }));

    return (
        <EmpresaLayout>
            {refreshing && (
                <div className="fixed top-0 inset-x-0 z-50 flex justify-center pt-2 pointer-events-none">
                    <div className="bg-blue-600 text-white text-xs px-3 py-1 rounded-full flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" /> Atualizando...
                    </div>
                </div>
            )}
            <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-slate-800">Carteira de Clientes</h1>
                    {!isRtv && (
                        <div className="flex gap-2">
                            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                                onChange={e => { if (e.target.files?.[0]) { importExcel.mutate(e.target.files[0]); e.target.value = ""; } }} />
                            <Button variant="outline" className="border-red-300 text-red-600 hover:bg-red-50" disabled={purgeAll.isPending}
                                onClick={() => { if (confirm("Tem certeza? Isso vai EXCLUIR TODOS os clientes permanentemente.")) purgeAll.mutate(); }}>
                                {purgeAll.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                                Limpar Todos
                            </Button>
                            <Button variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50" onClick={() => { setSelectedRtvId("none"); setShowImportModal(true); }} disabled={importExcel.isPending}>
                                {importExcel.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                                {importExcel.isPending ? "Analisando com IA..." : "Importar com IA"}
                            </Button>
                            <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => { setEditing(null); setForm({ ...emptyForm }); setShowForm(true); }}>
                                <Plus className="h-4 w-4 mr-2" /> Novo Cliente
                            </Button>
                        </div>
                    )}
                </div>

                <p className="text-xs text-slate-400">
                    Colunas esperadas na planilha: <strong>Nome</strong>, RUC, Telefone, Email, Cidade, Departamento, Endereço, Límite de Crédito
                </p>

                <div className="relative max-w-xs">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input placeholder="Buscar por nome, RUC ou telefone..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
                </div>

                <div className="flex items-center gap-3">
                    <div className="text-sm text-slate-500">{filtered.length} cliente{filtered.length !== 1 ? "s" : ""}</div>
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
                    <div className="text-center py-12 text-slate-400">Nenhum cliente encontrado</div>
                ) : (() => {
                    // Group by RTV
                    const groups: { id: string; label: string; items: any[] }[] = [];
                    const groupMap: Record<string, number> = {};
                    for (const c of filtered) {
                        const rtvId = c.assignedConsultantId ?? "__none__";
                        if (groupMap[rtvId] === undefined) {
                            const member = team.find((m: any) => m.userId === rtvId);
                            const label = member ? `${member.name || member.username} (${ROLE_LABELS[member.role] ?? member.role})` : "Sem RTV";
                            groupMap[rtvId] = groups.length;
                            groups.push({ id: rtvId, label, items: [] });
                        }
                        groups[groupMap[rtvId]].items.push(c);
                    }

                    const toggleGroup = (id: string) => setCollapsedGroups(prev => {
                        const next = new Set(prev);
                        next.has(id) ? next.delete(id) : next.add(id);
                        return next;
                    });

                    return (
                        <div className="space-y-3">
                            {groups.map(group => {
                                const isOpen = !collapsedGroups.has(group.id);
                                return (
                                    <Card key={group.id}>
                                        <button
                                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
                                            onClick={() => toggleGroup(group.id)}
                                        >
                                            <div className="flex items-center gap-2">
                                                <Users className="h-4 w-4 text-slate-400" />
                                                <span className="font-semibold text-sm text-slate-800">{group.label}</span>
                                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{group.items.length}</span>
                                            </div>
                                            {isOpen ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                                        </button>
                                        {isOpen && (
                                            <div className="border-t">
                                                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
                                                    {group.items.map((c: any) => (
                                                        <Card key={c.id} className={`hover:shadow-md transition-shadow ${c.isActive === false ? "opacity-50" : ""}`}>
                                                            <CardContent className="p-4">
                                                                <div className="flex items-start justify-between">
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex items-center gap-2">
                                                                            <Building2 className="h-4 w-4 text-slate-400 flex-shrink-0" />
                                                                            <p className="font-semibold text-sm truncate">{c.name}</p>
                                                                            {c.isActive === false && <span className="text-xs bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded shrink-0">Inativo</span>}
                                                                        </div>
                                                                        {c.ruc && <p className="text-slate-500 text-xs mt-0.5">RUC: {c.ruc}</p>}
                                                                        {c.city && <p className="text-slate-500 text-xs">{c.city}{c.department ? `, ${c.department}` : ""}</p>}
                                                                        <div className="flex gap-3 mt-2 flex-wrap">
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
                                                                    {!isRtv && (
                                                                        <div className="flex gap-0.5 shrink-0">
                                                                            <Button size="sm" variant="ghost" title="Editar" onClick={() => openEdit(c)}>
                                                                                <Pencil className="h-3.5 w-3.5" />
                                                                            </Button>
                                                                            <Button
                                                                                size="sm" variant="ghost"
                                                                                title={c.isActive !== false ? "Inativar cliente" : "Reativar cliente"}
                                                                                className={c.isActive !== false ? "text-slate-400 hover:text-amber-600" : "text-amber-500 hover:text-green-600"}
                                                                                disabled={toggleActive.isPending}
                                                                                onClick={() => toggleActive.mutate(c)}
                                                                            >
                                                                                {c.isActive !== false ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                                                            </Button>
                                                                            <Button
                                                                                size="sm" variant="ghost"
                                                                                title="Excluir cliente"
                                                                                className="text-slate-400 hover:text-red-600"
                                                                                disabled={remove.isPending}
                                                                                onClick={() => { if (confirm(`Excluir "${c.name}"?`)) remove.mutate(c.id); }}
                                                                            >
                                                                                <Trash2 className="h-3.5 w-3.5" />
                                                                            </Button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </CardContent>
                                                        </Card>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </Card>
                                );
                            })}
                        </div>
                    );
                })()}
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
                            <div className="col-span-2">
                                <Label>RTV Responsável</Label>
                                <Select value={form.assignedConsultantId || "none"} onValueChange={v => setForm(p => ({ ...p, assignedConsultantId: v === "none" ? "" : v }))}>
                                    <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Sem RTV</SelectItem>
                                        {team
                                            .filter((m: any) => ["rtv", "director", "admin_empresa"].includes(m.role))
                                            .map((m: any) => (
                                                <SelectItem key={m.userId} value={m.userId}>
                                                    {m.name || m.username} — {ROLE_LABELS[m.role] ?? m.role}
                                                </SelectItem>
                                            ))
                                        }
                                    </SelectContent>
                                </Select>
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

            {/* Import RTV selection modal */}
            <Dialog open={showImportModal} onOpenChange={open => { if (!open && !importExcel.isPending) setShowImportModal(false); }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-blue-600" /> Importar Clientes com IA
                        </DialogTitle>
                    </DialogHeader>
                    {importExcel.isPending ? (
                        <div className="flex flex-col items-center gap-3 py-6">
                            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                            <p className="text-sm text-slate-600 font-medium">Analisando com IA...</p>
                            <p className="text-xs text-slate-400 text-center">A planilha está sendo processada pela IA. Aguarde um momento.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div>
                                <Label>Vincular ao RTV *</Label>
                                <p className="text-xs text-slate-400 mb-2">Todos os clientes importados serão atribuídos ao RTV selecionado.</p>
                                <Select value={selectedRtvId} onValueChange={setSelectedRtvId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecionar RTV..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Sem RTV (importar sem vínculo)</SelectItem>
                                        {team
                                            .filter((m: any) => ["rtv", "director", "admin_empresa"].includes(m.role))
                                            .map((m: any) => (
                                                <SelectItem key={m.userId} value={m.userId}>
                                                    {m.name || m.username} — {ROLE_LABELS[m.role] ?? m.role}
                                                </SelectItem>
                                            ))
                                        }
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex gap-2 justify-end">
                                <Button variant="outline" onClick={() => setShowImportModal(false)}>Cancelar</Button>
                                <Button
                                    className="bg-blue-600 hover:bg-blue-700"
                                    onClick={() => fileRef.current?.click()}
                                >
                                    <Sparkles className="h-4 w-4 mr-2" /> Escolher Arquivo
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </EmpresaLayout>
    );
}
