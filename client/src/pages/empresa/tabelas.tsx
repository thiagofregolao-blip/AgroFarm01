import { useState } from "react";
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
import { Plus, Pencil, Loader2, Tag, ChevronRight, Trash2 } from "lucide-react";

const api = (method: string, path: string, body?: any) =>
    fetch(path, { method, headers: body ? { "Content-Type": "application/json" } : {}, credentials: "include", body: body ? JSON.stringify(body) : undefined }).then(r => r.json());

export default function EmpresaTabelas() {
    const { user } = useAuth();
    const { toast } = useToast();
    const qc = useQueryClient();
    const [selectedList, setSelectedList] = useState<any>(null);
    const [showNewList, setShowNewList] = useState(false);
    const [showNewItem, setShowNewItem] = useState(false);
    const [listForm, setListForm] = useState({ name: "", description: "", validFrom: "", validUntil: "" });
    const [itemForm, setItemForm] = useState({ productId: "", productName: "", productCode: "", unit: "SC", priceUsd: "" });

    const { data: lists = [], isLoading } = useQuery<any[]>({
        queryKey: ["/api/company/price-lists"],
        queryFn: () => api("GET", "/api/company/price-lists"),
        enabled: !!user,
    });

    const { data: listDetail } = useQuery<any>({
        queryKey: ["/api/company/price-lists", selectedList?.id],
        queryFn: () => api("GET", `/api/company/price-lists/${selectedList?.id}`),
        enabled: !!selectedList,
    });

    const { data: products = [] } = useQuery<any[]>({
        queryKey: ["/api/company/products"],
        queryFn: () => api("GET", "/api/company/products"),
        enabled: !!user,
    });

    const createList = useMutation({
        mutationFn: (data: any) => api("POST", "/api/company/price-lists", data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/company/price-lists"] }); setShowNewList(false); setListForm({ name: "", description: "", validFrom: "", validUntil: "" }); toast({ title: "Tabela criada" }); },
    });

    const toggleActive = useMutation({
        mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api("PUT", `/api/company/price-lists/${id}`, { isActive }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/company/price-lists"] }),
    });

    const addItem = useMutation({
        mutationFn: (data: any) => api("POST", `/api/company/price-lists/${selectedList.id}/items`, data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/company/price-lists", selectedList.id] }); setShowNewItem(false); setItemForm({ productId: "", productName: "", productCode: "", unit: "SC", priceUsd: "" }); toast({ title: "Produto adicionado" }); },
    });

    const deleteItem = useMutation({
        mutationFn: (itemId: string) => api("DELETE", `/api/company/price-lists/${selectedList.id}/items/${itemId}`),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/company/price-lists", selectedList.id] }); toast({ title: "Item removido" }); },
    });

    const handleProductSelect = (productId: string) => {
        const p = products.find((p: any) => p.id === productId);
        if (!p) return;
        setItemForm(prev => ({ ...prev, productId, productName: p.name, productCode: p.code ?? "", unit: p.unit }));
    };

    return (
        <EmpresaLayout>
            <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-slate-800">Tabelas de Preços</h1>
                    <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setShowNewList(true)}>
                        <Plus className="h-4 w-4 mr-2" /> Nova Tabela
                    </Button>
                </div>

                <div className="flex gap-4">
                    {/* List column */}
                    <div className="w-72 flex-shrink-0 space-y-2">
                        {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-slate-400 mx-auto mt-8" /> : lists.length === 0 ? (
                            <p className="text-center text-slate-400 text-sm py-8">Nenhuma tabela</p>
                        ) : lists.map((list: any) => (
                            <Card
                                key={list.id}
                                className={`cursor-pointer transition-all ${selectedList?.id === list.id ? "border-blue-500 shadow-md" : "hover:shadow-sm"}`}
                                onClick={() => setSelectedList(list)}
                            >
                                <CardContent className="p-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Tag className="h-4 w-4 text-slate-400" />
                                            <div>
                                                <p className="font-medium text-sm">{list.name}</p>
                                                {list.description && <p className="text-slate-500 text-xs">{list.description}</p>}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${list.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                                                {list.isActive ? "Ativa" : "Inativa"}
                                            </span>
                                            <ChevronRight className="h-4 w-4 text-slate-400" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Detail column */}
                    {selectedList ? (
                        <Card className="flex-1">
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base">{selectedList.name}</CardTitle>
                                    <div className="flex gap-2">
                                        <Button size="sm" variant="outline"
                                            onClick={() => toggleActive.mutate({ id: selectedList.id, isActive: !selectedList.isActive })}>
                                            {selectedList.isActive ? "Desativar" : "Ativar"}
                                        </Button>
                                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => setShowNewItem(true)}>
                                            <Plus className="h-3.5 w-3.5 mr-1" /> Produto
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                {!listDetail?.items ? (
                                    <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
                                ) : listDetail.items.length === 0 ? (
                                    <p className="text-center text-slate-400 text-sm py-8">Nenhum produto na tabela</p>
                                ) : (
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-slate-500 text-xs border-b bg-slate-50">
                                                <th className="text-left px-4 py-2">Produto</th>
                                                <th className="text-left px-4 py-2">Código</th>
                                                <th className="text-right px-4 py-2">Un.</th>
                                                <th className="text-right px-4 py-2">Preço U$</th>
                                                <th className="px-4 py-2"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {listDetail.items.map((item: any) => (
                                                <tr key={item.id} className="hover:bg-slate-50">
                                                    <td className="px-4 py-2 font-medium">{item.productName}</td>
                                                    <td className="px-4 py-2 text-slate-500">{item.productCode ?? "—"}</td>
                                                    <td className="px-4 py-2 text-right text-slate-500">{item.unit}</td>
                                                    <td className="px-4 py-2 text-right font-semibold">
                                                        {parseFloat(item.priceUsd ?? 0).toLocaleString("es-PY", { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="px-4 py-2 text-right">
                                                        <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-600 h-6 w-6 p-0"
                                                            onClick={() => deleteItem.mutate(item.id)}>
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-slate-400">
                            <p>Selecione uma tabela para ver os itens</p>
                        </div>
                    )}
                </div>
            </div>

            {/* New list dialog */}
            <Dialog open={showNewList} onOpenChange={setShowNewList}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Nova Tabela de Preços</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                        <div><Label>Nome *</Label><Input value={listForm.name} onChange={e => setListForm(p => ({ ...p, name: e.target.value }))} /></div>
                        <div><Label>Descrição</Label><Input value={listForm.description} onChange={e => setListForm(p => ({ ...p, description: e.target.value }))} /></div>
                        <div className="grid grid-cols-2 gap-3">
                            <div><Label>Válida a partir de</Label><Input type="date" value={listForm.validFrom} onChange={e => setListForm(p => ({ ...p, validFrom: e.target.value }))} /></div>
                            <div><Label>Válida até</Label><Input type="date" value={listForm.validUntil} onChange={e => setListForm(p => ({ ...p, validUntil: e.target.value }))} /></div>
                        </div>
                        <div className="flex gap-2 justify-end">
                            <Button variant="outline" onClick={() => setShowNewList(false)}>Cancelar</Button>
                            <Button className="bg-blue-600 hover:bg-blue-700" disabled={!listForm.name || createList.isPending} onClick={() => createList.mutate(listForm)}>
                                {createList.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Criar
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* New item dialog */}
            <Dialog open={showNewItem} onOpenChange={setShowNewItem}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Adicionar Produto à Tabela</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                        <div>
                            <Label>Produto</Label>
                            <Select value={itemForm.productId} onValueChange={handleProductSelect}>
                                <SelectTrigger><SelectValue placeholder="Selecionar do catálogo..." /></SelectTrigger>
                                <SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div><Label>Nome (manual)</Label><Input value={itemForm.productName} onChange={e => setItemForm(p => ({ ...p, productName: e.target.value }))} /></div>
                            <div><Label>Código</Label><Input value={itemForm.productCode} onChange={e => setItemForm(p => ({ ...p, productCode: e.target.value }))} /></div>
                            <div>
                                <Label>Unidade</Label>
                                <Select value={itemForm.unit} onValueChange={v => setItemForm(p => ({ ...p, unit: v }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>{["SC", "KG", "LT", "UNI", "TON", "CX"].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div><Label>Preço U$ *</Label><Input type="number" value={itemForm.priceUsd} onChange={e => setItemForm(p => ({ ...p, priceUsd: e.target.value }))} /></div>
                        </div>
                        <div className="flex gap-2 justify-end">
                            <Button variant="outline" onClick={() => setShowNewItem(false)}>Cancelar</Button>
                            <Button className="bg-blue-600 hover:bg-blue-700" disabled={!itemForm.productName || !itemForm.priceUsd || addItem.isPending} onClick={() => addItem.mutate(itemForm)}>
                                {addItem.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Adicionar
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </EmpresaLayout>
    );
}
