import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import EmpresaLayout from "@/components/empresa/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, Search, PackagePlus, Upload } from "lucide-react";

const api = (method: string, path: string, body?: any) =>
    fetch(path, { method, headers: body ? { "Content-Type": "application/json" } : {}, credentials: "include", body: body ? JSON.stringify(body) : undefined }).then(r => r.json());

export default function EmpresaEstoque() {
    const { user } = useAuth();
    const { toast } = useToast();
    const qc = useQueryClient();
    const fileRef = useRef<HTMLInputElement>(null);
    const [search, setSearch] = useState("");
    const [filterWh, setFilterWh] = useState("all");
    const [showAdjust, setShowAdjust] = useState(false);
    const [adjForm, setAdjForm] = useState({ warehouseId: "", productId: "", quantity: "", notes: "" });

    const { data: stock = [], isLoading } = useQuery<any[]>({
        queryKey: ["/api/company/stock"],
        queryFn: () => api("GET", "/api/company/stock"),
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

    const adjust = useMutation({
        mutationFn: (data: any) => api("POST", "/api/company/stock/adjust", data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["/api/company/stock"] });
            setShowAdjust(false);
            setAdjForm({ warehouseId: "", productId: "", quantity: "", notes: "" });
            toast({ title: "Estoque ajustado" });
        },
        onError: () => toast({ title: "Erro ao ajustar estoque", variant: "destructive" }),
    });

    const importExcel = useMutation({
        mutationFn: async (file: File) => {
            const fd = new FormData();
            fd.append("file", file);
            const r = await fetch("/api/company/stock/import-excel", { method: "POST", credentials: "include", body: fd });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Erro ao importar");
            return data;
        },
        onSuccess: (data) => {
            qc.invalidateQueries({ queryKey: ["/api/company/stock"] });
            const desc = data.errors?.length > 0 ? data.errors.join("; ") : undefined;
            toast({
                title: `${data.imported} item(ns) importado(s)${data.skipped > 0 ? `, ${data.skipped} ignorado(s)` : ""}`,
                description: desc,
                variant: data.errors?.length > 0 ? "destructive" : "default",
            });
        },
        onError: (e: any) => toast({ title: "Erro na importação", description: e.message, variant: "destructive" }),
    });

    const filtered = stock.filter((s: any) => {
        const matchSearch = !search || s.productName.toLowerCase().includes(search.toLowerCase()) || (s.productCode ?? "").toLowerCase().includes(search.toLowerCase());
        const matchWh = filterWh === "all" || s.warehouseId === filterWh;
        return matchSearch && matchWh;
    });

    const byWarehouse: Record<string, any[]> = {};
    for (const s of filtered) {
        if (!byWarehouse[s.warehouseId]) byWarehouse[s.warehouseId] = [];
        byWarehouse[s.warehouseId].push(s);
    }

    return (
        <EmpresaLayout>
            <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-slate-800">Estoque por Depósito</h1>
                    <div className="flex gap-2">
                        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
                            onChange={e => { if (e.target.files?.[0]) { importExcel.mutate(e.target.files[0]); e.target.value = ""; } }} />
                        <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importExcel.isPending}>
                            {importExcel.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                            Importar Planilha
                        </Button>
                        <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setShowAdjust(true)}>
                            <PackagePlus className="h-4 w-4 mr-2" /> Ajuste Manual
                        </Button>
                    </div>
                </div>

                <p className="text-xs text-slate-400">
                    Colunas esperadas na planilha de estoque: <strong>Deposito</strong>, <strong>Produto</strong> (ou <strong>Codigo</strong>), <strong>Quantidade</strong>
                </p>

                <div className="flex gap-3 items-center">
                    <div className="relative max-w-xs flex-1">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <Input placeholder="Buscar produto..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <Select value={filterWh} onValueChange={setFilterWh}>
                        <SelectTrigger className="w-48"><SelectValue placeholder="Todos depósitos" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos depósitos</SelectItem>
                            {warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">Nenhum produto em estoque</div>
                ) : (
                    <div className="space-y-4">
                        {Object.entries(byWarehouse).map(([whId, items]) => {
                            const wh = warehouses.find((w: any) => w.id === whId);
                            return (
                                <Card key={whId}>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-base">{wh?.name ?? "Depósito"}</CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="text-slate-500 text-xs border-b bg-slate-50">
                                                    <th className="text-left px-4 py-2">Produto</th>
                                                    <th className="text-left px-4 py-2">Código</th>
                                                    <th className="text-right px-4 py-2">Quantidade</th>
                                                    <th className="text-right px-4 py-2">Unidade</th>
                                                    <th className="text-right px-4 py-2">Atualizado</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {items.map((s: any) => (
                                                    <tr key={s.stockId} className={parseFloat(s.quantity) < 0 ? "bg-red-50" : ""}>
                                                        <td className="px-4 py-2 font-medium">{s.productName}</td>
                                                        <td className="px-4 py-2 text-slate-500">{s.productCode ?? "—"}</td>
                                                        <td className={`px-4 py-2 text-right font-semibold ${parseFloat(s.quantity) < 0 ? "text-red-600" : ""}`}>
                                                            {parseFloat(s.quantity).toLocaleString("es-PY", { minimumFractionDigits: 2 })}
                                                        </td>
                                                        <td className="px-4 py-2 text-right text-slate-500">{s.unit}</td>
                                                        <td className="px-4 py-2 text-right text-slate-400 text-xs">
                                                            {new Date(s.updatedAt).toLocaleDateString("es-PY")}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>

            <Dialog open={showAdjust} onOpenChange={setShowAdjust}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Ajuste Manual de Estoque</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                        <div>
                            <Label>Depósito *</Label>
                            <Select value={adjForm.warehouseId} onValueChange={v => setAdjForm(p => ({ ...p, warehouseId: v }))}>
                                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                                <SelectContent>{warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Produto *</Label>
                            <Select value={adjForm.productId} onValueChange={v => setAdjForm(p => ({ ...p, productId: v }))}>
                                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                                <SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Quantidade (positivo = entrada, negativo = saída)</Label>
                            <Input type="number" value={adjForm.quantity} onChange={e => setAdjForm(p => ({ ...p, quantity: e.target.value }))} />
                        </div>
                        <div>
                            <Label>Observações</Label>
                            <Input value={adjForm.notes} onChange={e => setAdjForm(p => ({ ...p, notes: e.target.value }))} />
                        </div>
                        <div className="flex gap-2 justify-end">
                            <Button variant="outline" onClick={() => setShowAdjust(false)}>Cancelar</Button>
                            <Button className="bg-blue-600 hover:bg-blue-700"
                                disabled={!adjForm.warehouseId || !adjForm.productId || !adjForm.quantity || adjust.isPending}
                                onClick={() => adjust.mutate({ ...adjForm, quantity: parseFloat(adjForm.quantity) })}>
                                {adjust.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                Salvar
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </EmpresaLayout>
    );
}
