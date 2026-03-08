import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import EmpresaLayout from "@/components/empresa/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Plus, Loader2, Building2 } from "lucide-react";

const api = (method: string, path: string, body?: any) =>
    fetch(path, { method, headers: body ? { "Content-Type": "application/json" } : {}, credentials: "include", body: body ? JSON.stringify(body) : undefined }).then(r => r.json());

export default function EmpresaDepositos() {
    const { user } = useAuth();
    const { toast } = useToast();
    const qc = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ name: "", address: "", city: "" });

    const { data: warehouses = [], isLoading } = useQuery<any[]>({
        queryKey: ["/api/company/warehouses"],
        queryFn: () => api("GET", "/api/company/warehouses"),
        enabled: !!user,
    });

    const create = useMutation({
        mutationFn: (data: any) => api("POST", "/api/company/warehouses", data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["/api/company/warehouses"] });
            setShowForm(false); setForm({ name: "", address: "", city: "" });
            toast({ title: "Depósito criado" });
        },
        onError: () => toast({ title: "Erro ao criar depósito", variant: "destructive" }),
    });

    return (
        <EmpresaLayout>
            <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-slate-800">Depósitos</h1>
                    <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setShowForm(true)}>
                        <Plus className="h-4 w-4 mr-2" /> Novo Depósito
                    </Button>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
                ) : warehouses.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">Nenhum depósito cadastrado</div>
                ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {warehouses.map((w: any) => (
                            <Card key={w.id}>
                                <CardContent className="p-4 flex items-start gap-3">
                                    <Building2 className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p className="font-semibold">{w.name}</p>
                                        {w.city && <p className="text-slate-500 text-sm">{w.city}</p>}
                                        {w.address && <p className="text-slate-400 text-xs">{w.address}</p>}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            <Dialog open={showForm} onOpenChange={setShowForm}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Novo Depósito</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                        <div><Label>Nome *</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Santa Rita, Katueté..." /></div>
                        <div><Label>Cidade</Label><Input value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} /></div>
                        <div><Label>Endereço</Label><Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} /></div>
                        <div className="flex gap-2 justify-end">
                            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                            <Button className="bg-blue-600 hover:bg-blue-700" disabled={!form.name || create.isPending} onClick={() => create.mutate(form)}>
                                {create.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Criar
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </EmpresaLayout>
    );
}
