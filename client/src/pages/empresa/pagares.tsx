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
import { Plus, Search, Pencil, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

const api = (method: string, path: string, body?: any) =>
    fetch(path, { method, headers: body ? { "Content-Type": "application/json" } : {}, credentials: "include", body: body ? JSON.stringify(body) : undefined }).then(r => r.json());

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
    pendente: { label: "Pendente", color: "bg-yellow-100 text-yellow-800" },
    pago: { label: "Pago", color: "bg-green-100 text-green-800" },
    protestado: { label: "Protestado", color: "bg-red-100 text-red-800" },
    cancelado: { label: "Cancelado", color: "bg-slate-100 text-slate-600" },
};

const emptyForm = { clientId: "", pagareNumber: "", amountUsd: "", currency: "USD", issueDate: "", dueDate: "", notes: "" };

export default function EmpresaPagares() {
    const { user } = useAuth();
    const { toast } = useToast();
    const qc = useQueryClient();
    const [search, setSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState("pendente");
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<any>(null);
    const [form, setForm] = useState({ ...emptyForm });

    const { data: pagares = [], isLoading } = useQuery<any[]>({
        queryKey: ["/api/company/pagares"],
        queryFn: () => api("GET", "/api/company/pagares"),
        enabled: !!user,
    });

    const { data: clients = [] } = useQuery<any[]>({
        queryKey: ["/api/company/clients"],
        queryFn: () => api("GET", "/api/company/clients"),
        enabled: !!user,
    });

    const save = useMutation({
        mutationFn: (data: any) => editing
            ? api("PUT", `/api/company/pagares/${editing.id}`, data)
            : api("POST", "/api/company/pagares", data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["/api/company/pagares"] });
            setShowForm(false); setEditing(null); setForm({ ...emptyForm });
            toast({ title: editing ? "Pagaré atualizado" : "Pagaré registrado" });
        },
        onError: () => toast({ title: "Erro ao salvar", variant: "destructive" }),
    });

    const markPaid = useMutation({
        mutationFn: (id: string) => api("PUT", `/api/company/pagares/${id}`, { status: "pago", paidDate: new Date().toISOString() }),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/company/pagares"] }); toast({ title: "Pagaré marcado como pago" }); },
    });

    const openEdit = (p: any) => {
        setEditing(p);
        setForm({ clientId: p.clientId, pagareNumber: p.pagareNumber ?? "", amountUsd: p.amountUsd ?? "", currency: p.currency ?? "USD", issueDate: p.issueDate ? p.issueDate.slice(0, 10) : "", dueDate: p.dueDate ? p.dueDate.slice(0, 10) : "", notes: p.notes ?? "" });
        setShowForm(true);
    };

    const filtered = pagares.filter((p: any) => {
        const matchSearch = !search || (p.clientName ?? "").toLowerCase().includes(search.toLowerCase()) || (p.pagareNumber ?? "").includes(search);
        const matchStatus = filterStatus === "all" || p.status === filterStatus;
        return matchSearch && matchStatus;
    });

    // Summary totals
    const pendingTotal = pagares.filter((p: any) => p.status === "pendente").reduce((acc, p: any) => acc + parseFloat(p.amountUsd ?? 0), 0);

    // Sort by due date
    const sorted = [...filtered].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    return (
        <EmpresaLayout>
            <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Controle de Pagarés</h1>
                        {pendingTotal > 0 && (
                            <p className="text-sm text-slate-500 mt-0.5">Total pendente: <span className="font-semibold text-slate-800">$ {pendingTotal.toLocaleString("es-PY", { minimumFractionDigits: 2 })}</span></p>
                        )}
                    </div>
                    <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => { setEditing(null); setForm({ ...emptyForm }); setShowForm(true); }}>
                        <Plus className="h-4 w-4 mr-2" /> Registrar Pagaré
                    </Button>
                </div>

                <div className="flex gap-3 items-center">
                    <div className="relative max-w-xs flex-1">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <Input placeholder="Buscar cliente ou nº pagaré..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                            <SelectItem value="pendente">Pendente</SelectItem>
                            <SelectItem value="pago">Pago</SelectItem>
                            <SelectItem value="protestado">Protestado</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
                ) : sorted.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">Nenhum pagaré encontrado</div>
                ) : (
                    <div className="space-y-2">
                        {sorted.map((p: any) => {
                            const st = STATUS_LABEL[p.status] ?? STATUS_LABEL.pendente;
                            const dueDate = new Date(p.dueDate);
                            const isOverdue = p.status === "pendente" && dueDate < new Date();
                            return (
                                <Card key={p.id} className={isOverdue ? "border-red-200" : ""}>
                                    <CardContent className="p-4">
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-semibold text-sm">{p.pagareNumber ?? "Sem nº"}</span>
                                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.color}`}>{st.label}</span>
                                                    {isOverdue && <span className="flex items-center gap-1 text-xs text-red-600"><AlertCircle className="h-3 w-3" />Vencido</span>}
                                                </div>
                                                <p className="text-slate-600 text-sm mt-0.5">{p.clientName}</p>
                                                <p className="text-slate-400 text-xs">
                                                    Venc.: {dueDate.toLocaleDateString("es-PY")}
                                                    {p.issueDate && ` — Emissão: ${new Date(p.issueDate).toLocaleDateString("es-PY")}`}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-semibold text-sm">$ {parseFloat(p.amountUsd ?? 0).toLocaleString("es-PY", { minimumFractionDigits: 2 })}</p>
                                            </div>
                                            <div className="flex gap-1">
                                                <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                {p.status === "pendente" && (
                                                    <Button size="sm" variant="ghost" className="text-green-600" onClick={() => markPaid.mutate(p.id)}>
                                                        <CheckCircle2 className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>

            <Dialog open={showForm} onOpenChange={open => { if (!open) { setShowForm(false); setEditing(null); } }}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>{editing ? "Editar Pagaré" : "Registrar Pagaré"}</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                        {!editing && (
                            <div>
                                <Label>Cliente *</Label>
                                <Select value={form.clientId} onValueChange={v => setForm(p => ({ ...p, clientId: v }))}>
                                    <SelectTrigger><SelectValue placeholder="Selecionar cliente..." /></SelectTrigger>
                                    <SelectContent>{clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Nº do Pagaré</Label>
                                <Input value={form.pagareNumber} onChange={e => setForm(p => ({ ...p, pagareNumber: e.target.value }))} />
                            </div>
                            <div>
                                <Label>Valor U$</Label>
                                <Input type="number" value={form.amountUsd} onChange={e => setForm(p => ({ ...p, amountUsd: e.target.value }))} />
                            </div>
                            <div>
                                <Label>Data de Emissão</Label>
                                <Input type="date" value={form.issueDate} onChange={e => setForm(p => ({ ...p, issueDate: e.target.value }))} />
                            </div>
                            <div>
                                <Label>Vencimento *</Label>
                                <Input type="date" value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} />
                            </div>
                        </div>
                        {editing && (
                            <div>
                                <Label>Status</Label>
                                <Select value={(form as any).status ?? editing.status} onValueChange={v => setForm(p => ({ ...p, status: v } as any))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="pendente">Pendente</SelectItem>
                                        <SelectItem value="pago">Pago</SelectItem>
                                        <SelectItem value="protestado">Protestado</SelectItem>
                                        <SelectItem value="cancelado">Cancelado</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        <div>
                            <Label>Observações</Label>
                            <Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
                        </div>
                        <div className="flex gap-2 justify-end">
                            <Button variant="outline" onClick={() => { setShowForm(false); setEditing(null); }}>Cancelar</Button>
                            <Button className="bg-blue-600 hover:bg-blue-700"
                                disabled={(!editing && !form.clientId) || !form.dueDate || save.isPending}
                                onClick={() => save.mutate(form)}>
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
