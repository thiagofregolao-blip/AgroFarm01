import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import FarmLayout from "@/components/fazenda/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Monitor, Loader2, Wifi, WifiOff, Tractor, Wheat, Pencil, Trash2 } from "lucide-react";

export default function FarmTerminals() {
    const [, setLocation] = useLocation();
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [openDialog, setOpenDialog] = useState(false);
    const [editTerminal, setEditTerminal] = useState<any>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    const { user } = useAuth();

    const { data: terminals = [], isLoading } = useQuery({
        queryKey: ["/api/farm/pdv-terminals"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/pdv-terminals"); return r.json(); },
        enabled: !!user,
    });

    const { data: properties = [] } = useQuery({
        queryKey: ["/api/farm/properties"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/properties"); return r.json(); },
        enabled: !!user,
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => apiRequest("DELETE", `/api/farm/pdv-terminals/${id}`),
        onSuccess: () => {
            toast({ title: "Terminal excluído" });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/pdv-terminals"] });
            setDeleteConfirm(null);
        },
        onError: () => toast({ title: "Erro ao excluir terminal", variant: "destructive" }),
    });

    return (
        <FarmLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-emerald-800">Terminais PDV</h1>
                        <p className="text-emerald-600 text-sm">Gerencie os terminais do depósito</p>
                    </div>
                    <Dialog open={openDialog} onOpenChange={(open) => { setOpenDialog(open); if (!open) setEditTerminal(null); }}>
                        <DialogTrigger asChild>
                            <Button className="bg-emerald-600 hover:bg-emerald-700"><Plus className="mr-2 h-4 w-4" /> Novo Terminal</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>{editTerminal ? "Editar Terminal" : "Novo Terminal PDV"}</DialogTitle>
                                <DialogDescription>
                                    {editTerminal ? "Atualize as informações do terminal." : "Preencha os dados para criar um novo terminal."}
                                </DialogDescription>
                            </DialogHeader>
                            <TerminalForm
                                properties={properties}
                                initial={editTerminal}
                                onSave={() => { setOpenDialog(false); setEditTerminal(null); queryClient.invalidateQueries({ queryKey: ["/api/farm/pdv-terminals"] }); }}
                            />
                        </DialogContent>
                    </Dialog>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
                ) : terminals.length === 0 ? (
                    <Card className="border-emerald-100"><CardContent className="py-12 text-center">
                        <Monitor className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">Nenhum terminal PDV cadastrado</p>
                        <p className="text-gray-400 text-sm mt-1">Cadastre um terminal para usar no tablet do depósito</p>
                    </CardContent></Card>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {terminals.map((t: any) => (
                            <Card key={t.id} className="border-emerald-100">
                                <CardContent className="p-5">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${t.isOnline ? "bg-green-100" : "bg-gray-100"}`}>
                                            {t.isOnline ? <Wifi className="h-5 w-5 text-green-600" /> : <WifiOff className="h-5 w-5 text-gray-400" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="font-semibold text-emerald-800 truncate">{t.name}</p>
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-medium shrink-0 ${t.type === 'diesel' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                    {t.type === 'diesel' ? (
                                                        <span className="flex items-center gap-1"><Tractor className="h-3 w-3" /> Diesel/Frota</span>
                                                    ) : (
                                                        <span className="flex items-center gap-1"><Wheat className="h-3 w-3" /> Insumos/Roça</span>
                                                    )}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-500">@{t.username}</p>
                                        </div>
                                    </div>
                                    <div className="text-sm text-gray-500 space-y-1 mb-3">
                                        <p>Status: <span className={`font-medium ${t.isOnline ? "text-green-600" : "text-gray-400"}`}>{t.isOnline ? "Online" : "Offline"}</span></p>
                                        {t.lastHeartbeat && <p>Último sinal: {new Date(t.lastHeartbeat).toLocaleString("pt-BR")}</p>}
                                    </div>
                                    <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex-1 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                                            onClick={() => { setEditTerminal(t); setOpenDialog(true); }}
                                        >
                                            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar
                                        </Button>
                                        {deleteConfirm === t.id ? (
                                            <div className="flex gap-1">
                                                <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(t.id)} disabled={deleteMutation.isPending}>
                                                    {deleteMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Sim"}
                                                </Button>
                                                <Button size="sm" variant="outline" onClick={() => setDeleteConfirm(null)}>Não</Button>
                                            </div>
                                        ) : (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="text-red-600 border-red-200 hover:bg-red-50"
                                                onClick={() => setDeleteConfirm(t.id)}
                                            >
                                                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Excluir
                                            </Button>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                <Card className="border-blue-100 bg-blue-50/50">
                    <CardContent className="p-4">
                        <p className="text-sm text-blue-800">
                            💡 Para acessar o PDV no tablet, abra <strong>{window.location.origin}/pdv/login</strong> e use as credenciais do terminal.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </FarmLayout >
    );
}

function TerminalForm({ properties, initial, onSave }: { properties: any[]; initial?: any; onSave: () => void }) {
    const [name, setName] = useState(initial?.name || "");
    const [username, setUsername] = useState(initial?.username || "");
    const [password, setPassword] = useState("");
    const [propertyId, setPropertyId] = useState(initial?.propertyId || "");
    const [type, setType] = useState(initial?.type || "estoque");
    const { toast } = useToast();

    const isEdit = !!initial;

    const save = useMutation({
        mutationFn: () => {
            if (isEdit) {
                const body: any = { name, username, type, propertyId: propertyId || null };
                if (password) body.password = password;
                return apiRequest("PUT", `/api/farm/pdv-terminals/${initial.id}`, body);
            }
            return apiRequest("POST", "/api/farm/pdv-terminals", { name, username, password, propertyId: propertyId || null, type });
        },
        onSuccess: () => { toast({ title: isEdit ? "Terminal atualizado" : "Terminal criado" }); onSave(); },
        onError: () => toast({ title: isEdit ? "Erro ao atualizar" : "Erro ao criar terminal", variant: "destructive" }),
    });

    return (
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
            <div><Label>Nome do Terminal *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Depósito Principal" required /></div>
            <div><Label>Usuário PDV *</Label><Input value={username} onChange={e => setUsername(e.target.value)} placeholder="Ex: deposito1" required /></div>
            <div>
                <Label>{isEdit ? "Nova Senha (deixe em branco para manter)" : "Senha PDV *"}</Label>
                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={isEdit ? "••••••••" : ""} required={!isEdit} />
            </div>
            <div>
                <Label>Propriedade Vinculada</Label>
                <Select value={propertyId} onValueChange={setPropertyId}>
                    <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                    <SelectContent>{properties.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
            </div>
            <div>
                <Label>Modalidade do PDV *</Label>
                <Select value={type} onValueChange={setType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="estoque">Terminal Agrícola (Roça/Insumos)</SelectItem>
                        <SelectItem value="diesel">Bomba de Abastecimento (Diesel/Frota)</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={save.isPending}>
                {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} {isEdit ? "Salvar Alterações" : "Criar Terminal"}
            </Button>
        </form>
    );
}
