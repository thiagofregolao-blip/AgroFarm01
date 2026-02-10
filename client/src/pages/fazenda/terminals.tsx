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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Monitor, Loader2, Wifi, WifiOff } from "lucide-react";

export default function FarmTerminals() {
    const [, setLocation] = useLocation();
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [openDialog, setOpenDialog] = useState(false);

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

    return (
        <FarmLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-emerald-800">Terminais PDV</h1>
                        <p className="text-emerald-600 text-sm">Gerencie os terminais do depósito</p>
                    </div>
                    <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                        <DialogTrigger asChild>
                            <Button className="bg-emerald-600 hover:bg-emerald-700"><Plus className="mr-2 h-4 w-4" /> Novo Terminal</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader><DialogTitle>Novo Terminal PDV</DialogTitle></DialogHeader>
                            <TerminalForm
                                properties={properties}
                                onSave={() => { setOpenDialog(false); queryClient.invalidateQueries({ queryKey: ["/api/farm/pdv-terminals"] }); }}
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
                                        <div>
                                            <p className="font-semibold text-emerald-800">{t.name}</p>
                                            <p className="text-xs text-gray-500">@{t.username}</p>
                                        </div>
                                    </div>
                                    <div className="text-sm text-gray-500 space-y-1">
                                        <p>Status: <span className={`font-medium ${t.isOnline ? "text-green-600" : "text-gray-400"}`}>{t.isOnline ? "Online" : "Offline"}</span></p>
                                        {t.lastHeartbeat && <p>Último sinal: {new Date(t.lastHeartbeat).toLocaleString("pt-BR")}</p>}
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
        </FarmLayout>
    );
}

function TerminalForm({ properties, onSave }: { properties: any[]; onSave: () => void }) {
    const [name, setName] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [propertyId, setPropertyId] = useState("");
    const { toast } = useToast();

    const save = useMutation({
        mutationFn: () => apiRequest("POST", "/api/farm/pdv-terminals", { name, username, password, propertyId: propertyId || null }),
        onSuccess: () => { toast({ title: "Terminal criado" }); onSave(); },
        onError: () => toast({ title: "Erro ao criar terminal", variant: "destructive" }),
    });

    return (
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
            <div><Label>Nome do Terminal *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Depósito Principal" required /></div>
            <div><Label>Usuário PDV *</Label><Input value={username} onChange={e => setUsername(e.target.value)} placeholder="Ex: deposito1" required /></div>
            <div><Label>Senha PDV *</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} required /></div>
            <div>
                <Label>Propriedade Vinculada</Label>
                <Select value={propertyId} onValueChange={setPropertyId}>
                    <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                    <SelectContent>{properties.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
            </div>
            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={save.isPending}>
                {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Criar Terminal
            </Button>
        </form>
    );
}
