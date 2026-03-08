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
import { Plus, Eye, CheckCircle, XCircle, Loader2, ArrowRight, Trash2 } from "lucide-react";

const api = (method: string, path: string, body?: any) =>
    fetch(path, { method, headers: body ? { "Content-Type": "application/json" } : {}, credentials: "include", body: body ? JSON.stringify(body) : undefined }).then(r => r.json());

const ST: Record<string, { label: string; color: string }> = {
    draft: { label: "Rascunho", color: "bg-slate-100 text-slate-700" },
    in_transit: { label: "Em Trânsito", color: "bg-yellow-100 text-yellow-800" },
    completed: { label: "Concluída", color: "bg-green-100 text-green-800" },
    cancelled: { label: "Cancelada", color: "bg-red-100 text-red-800" },
};

export default function EmpresaRemissoes() {
    const { user } = useAuth();
    const { toast } = useToast();
    const qc = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [detail, setDetail] = useState<any>(null);
    const [form, setForm] = useState({ fromWarehouseId: "", toWarehouseId: "", notes: "" });
    const [items, setItems] = useState<any[]>([]);
    const [newItem, setNewItem] = useState({ productId: "", quantity: "", notes: "" });

    const { data: remissions = [], isLoading } = useQuery<any[]>({
        queryKey: ["/api/company/remissions"],
        queryFn: () => api("GET", "/api/company/remissions"),
        enabled: !!user,
    });

    const { data: warehouses = [] } = useQuery<any[]>({
        queryKey: ["/api/company/warehouses"],
        queryFn: () => api("GET", "/api/company/warehouses"),
        enabled: !!user,
    });

    const { data: products = [] } = useQuery<any[]>({
        queryKey: ["/api/company/products"],
        queryFn: () => api("GET", "/api/company/products"),
        enabled: !!user,
    });

    const create = useMutation({
        mutationFn: (data: any) => api("POST", "/api/company/remissions", data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["/api/company/remissions"] });
            setShowForm(false); setItems([]); setForm({ fromWarehouseId: "", toWarehouseId: "", notes: "" });
            toast({ title: "Remissão criada" });
        },
        onError: () => toast({ title: "Erro ao criar remissão", variant: "destructive" }),
    });

    const complete = useMutation({
        mutationFn: (id: string) => api("POST", `/api/company/remissions/${id}/complete`),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/company/remissions"] }); toast({ title: "Remissão concluída — estoque transferido" }); },
        onError: () => toast({ title: "Erro ao concluir remissão", variant: "destructive" }),
    });

    const cancel = useMutation({
        mutationFn: (id: string) => api("POST", `/api/company/remissions/${id}/cancel`),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/company/remissions"] }); toast({ title: "Remissão cancelada" }); },
    });

    const addItem = () => {
        if (!newItem.productId || !newItem.quantity) return;
        const prod = products.find((p: any) => p.id === newItem.productId);
        setItems(prev => [...prev, { ...newItem, productName: prod?.name ?? "", unit: prod?.unit ?? "UNI", quantity: parseFloat(newItem.quantity) }]);
        setNewItem({ productId: "", quantity: "", notes: "" });
    };

    const whName = (id: string) => warehouses.find((w: any) => w.id === id)?.name ?? id;

    return (
        <EmpresaLayout>
            <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-slate-800">Remissões de Estoque</h1>
                    <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setShowForm(true)}>
                        <Plus className="h-4 w-4 mr-2" /> Nova Remissão
                    </Button>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
                ) : remissions.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">Nenhuma remissão encontrada</div>
                ) : (
                    <div className="space-y-2">
                        {remissions.map((r: any) => {
                            const st = ST[r.status] ?? ST.draft;
                            return (
                                <Card key={r.id}>
                                    <CardContent className="p-4">
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-sm">{r.remissionNumber}</span>
                                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.color}`}>{st.label}</span>
                                                </div>
                                                <div className="flex items-center gap-1 text-slate-600 text-sm mt-0.5">
                                                    <span>{whName(r.fromWarehouseId)}</span>
                                                    <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                                                    <span>{whName(r.toWarehouseId)}</span>
                                                </div>
                                                <p className="text-slate-400 text-xs">{new Date(r.createdAt).toLocaleDateString("es-PY")}</p>
                                            </div>
                                            <div className="flex gap-1">
                                                <Button size="sm" variant="ghost" onClick={() => setDetail(r)}>
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                                {["draft", "in_transit"].includes(r.status) && (
                                                    <Button size="sm" variant="ghost" className="text-green-600" onClick={() => complete.mutate(r.id)}>
                                                        <CheckCircle className="h-4 w-4" />
                                                    </Button>
                                                )}
                                                {r.status === "draft" && (
                                                    <Button size="sm" variant="ghost" className="text-red-500" onClick={() => cancel.mutate(r.id)}>
                                                        <XCircle className="h-4 w-4" />
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

            {/* Detail Dialog */}
            <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
                <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>Remissão {detail?.remissionNumber}</DialogTitle></DialogHeader>
                    {detail && <RemissionDetail remissionId={detail.id} warehouses={warehouses} />}
                </DialogContent>
            </Dialog>

            {/* Create Dialog */}
            <Dialog open={showForm} onOpenChange={setShowForm}>
                <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>Nova Remissão</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Origem *</Label>
                                <Select value={form.fromWarehouseId} onValueChange={v => setForm(p => ({ ...p, fromWarehouseId: v }))}>
                                    <SelectTrigger><SelectValue placeholder="Depósito origem..." /></SelectTrigger>
                                    <SelectContent>{warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Destino *</Label>
                                <Select value={form.toWarehouseId} onValueChange={v => setForm(p => ({ ...p, toWarehouseId: v }))}>
                                    <SelectTrigger><SelectValue placeholder="Depósito destino..." /></SelectTrigger>
                                    <SelectContent>{warehouses.filter((w: any) => w.id !== form.fromWarehouseId).map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="col-span-2">
                                <Label>Observações</Label>
                                <Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
                            </div>
                        </div>

                        {/* Items */}
                        <div className="border rounded-lg p-3 space-y-2">
                            <p className="font-medium text-sm">Produtos</p>
                            {items.map((item, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-sm bg-slate-50 rounded px-2 py-1">
                                    <span className="flex-1">{item.productName}</span>
                                    <span>{item.quantity} {item.unit}</span>
                                    <button onClick={() => setItems(p => p.filter((_, i) => i !== idx))}><Trash2 className="h-3.5 w-3.5 text-red-400" /></button>
                                </div>
                            ))}
                            <div className="flex gap-2 items-end">
                                <div className="flex-1">
                                    <Select value={newItem.productId} onValueChange={v => setNewItem(p => ({ ...p, productId: v }))}>
                                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Produto..." /></SelectTrigger>
                                        <SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="w-24">
                                    <Input className="h-8 text-xs" placeholder="Qtd" value={newItem.quantity} onChange={e => setNewItem(p => ({ ...p, quantity: e.target.value }))} />
                                </div>
                                <Button size="sm" variant="outline" className="h-8" onClick={addItem}><Plus className="h-3 w-3" /></Button>
                            </div>
                        </div>

                        <div className="flex gap-2 justify-end">
                            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                            <Button className="bg-blue-600 hover:bg-blue-700"
                                disabled={!form.fromWarehouseId || !form.toWarehouseId || items.length === 0 || create.isPending}
                                onClick={() => create.mutate({ ...form, items })}>
                                {create.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                Criar Remissão
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </EmpresaLayout>
    );
}

function RemissionDetail({ remissionId, warehouses }: { remissionId: string; warehouses: any[] }) {
    const { data, isLoading } = useQuery<any>({
        queryKey: ["/api/company/remissions", remissionId],
        queryFn: () => fetch(`/api/company/remissions/${remissionId}`, { credentials: "include" }).then(r => r.json()),
    });
    if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;
    if (!data) return null;
    const whName = (id: string) => warehouses.find((w: any) => w.id === id)?.name ?? id;
    return (
        <div className="space-y-4 text-sm">
            <div className="flex items-center gap-2 text-slate-700">
                <span className="font-medium">{whName(data.fromWarehouseId)}</span>
                <ArrowRight className="h-4 w-4 text-slate-400" />
                <span className="font-medium">{whName(data.toWarehouseId)}</span>
            </div>
            {data.notes && <p className="text-slate-500 text-xs">{data.notes}</p>}
            {data.items?.length > 0 && (
                <table className="w-full text-xs">
                    <thead>
                        <tr className="text-slate-500 border-b">
                            <th className="text-left py-1">Produto</th>
                            <th className="text-right py-1">Qtd</th>
                            <th className="text-right py-1">Un.</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {data.items.map((i: any) => (
                            <tr key={i.id}>
                                <td className="py-1">{i.productName}</td>
                                <td className="text-right">{parseFloat(i.quantity).toLocaleString("es-PY")}</td>
                                <td className="text-right">{i.unit}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}
