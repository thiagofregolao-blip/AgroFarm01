import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit2, Trash2, MapPin, Loader2 } from "lucide-react";

export function GlobalSilosManagement() {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingSilo, setEditingSilo] = useState<any>(null);

    // Form State
    const [companyName, setCompanyName] = useState("");
    const [branchName, setBranchName] = useState("");
    const [latitude, setLatitude] = useState("");
    const [longitude, setLongitude] = useState("");
    const [active, setActive] = useState(true);

    const { data: silos = [], isLoading } = useQuery<any[]>({
        queryKey: ["/api/admin/global-silos"],
    });

    const saveMutation = useMutation({
        mutationFn: async (data: any) => {
            if (editingSilo) {
                return apiRequest("PATCH", `/api/admin/global-silos/${editingSilo.id}`, data);
            }
            return apiRequest("POST", "/api/admin/global-silos", data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/admin/global-silos"] });
            toast({ title: editingSilo ? "Silo atualizado" : "Silo cadastrado" });
            setIsDialogOpen(false);
            resetForm();
        },
        onError: (error: any) => {
            toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            return apiRequest("DELETE", `/api/admin/global-silos/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/admin/global-silos"] });
            toast({ title: "Silo excluído com sucesso" });
        },
        onError: (error: any) => {
            toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
        }
    });

    const resetForm = () => {
        setEditingSilo(null);
        setCompanyName("");
        setBranchName("");
        setLatitude("");
        setLongitude("");
        setActive(true);
    };

    const handleEdit = (silo: any) => {
        setEditingSilo(silo);
        setCompanyName(silo.companyName);
        setBranchName(silo.branchName || "");
        setLatitude(silo.latitude || "");
        setLongitude(silo.longitude || "");
        setActive(silo.active);
        setIsDialogOpen(true);
    };

    const handleDelete = (silo: any) => {
        if (confirm(`Tem certeza que deseja excluir o silo ${silo.companyName}? Isso falhará se houver romaneios vinculados.`)) {
            deleteMutation.mutate(silo.id);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        saveMutation.mutate({
            companyName,
            branchName: branchName || null,
            latitude: latitude || null,
            longitude: longitude || null,
            active,
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold">Gestão de Silos Globais</h2>
                    <p className="text-muted-foreground">
                        Cadastre as coordenadas dos silos/cerealistas para cálculo automático de distância e frete nos romaneios.
                    </p>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={(open) => {
                    setIsDialogOpen(open);
                    if (!open) resetForm();
                }}>
                    <DialogTrigger asChild>
                        <Button className="bg-emerald-600 hover:bg-emerald-700">
                            <Plus className="mr-2 h-4 w-4" /> Novo Silo
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editingSilo ? "Editar Silo" : "Cadastrar Novo Silo"}</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <Label>Empresa / Recebedor *</Label>
                                <Input value={companyName} onChange={e => setCompanyName(e.target.value)} required placeholder="Ex: C.Vale, Coamo, Bunge..." />
                            </div>
                            <div className="space-y-2">
                                <Label>Filial / Unidade (Opcional)</Label>
                                <Input value={branchName} onChange={e => setBranchName(e.target.value)} placeholder="Ex: Unidade Palotina" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Latitude</Label>
                                    <Input value={latitude} onChange={e => setLatitude(e.target.value)} placeholder="Ex: -24.3215" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Longitude</Label>
                                    <Input value={longitude} onChange={e => setLongitude(e.target.value)} placeholder="Ex: -53.8441" />
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                Abra o Google Maps, clique com botão direito no local do silo e copie as coordenadas.
                            </p>

                            <div className="flex items-center space-x-2 pt-2">
                                <Switch checked={active} onCheckedChange={setActive} id="active-silo" />
                                <Label htmlFor="active-silo">Silo Ativo (Disponível para seleção)</Label>
                            </div>

                            <div className="pt-4 flex justify-end gap-2">
                                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                                <Button type="submit" disabled={saveMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700">
                                    {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Salvar
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Silos Cadastrados</CardTitle>
                    <CardDescription>Lista de todos os silos disponíveis no sistema global.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                    ) : silos.length === 0 ? (
                        <div className="text-center p-8 text-muted-foreground border border-dashed rounded-lg">
                            Nenhum silo cadastrado. Adicione o primeiro para habilitar os cálculos de inteligência estrutural.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Empresa</TableHead>
                                    <TableHead>Unidade</TableHead>
                                    <TableHead>Coordenadas</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {silos.map((silo: any) => (
                                    <TableRow key={silo.id}>
                                        <TableCell className="font-semibold">{silo.companyName}</TableCell>
                                        <TableCell>{silo.branchName || "-"}</TableCell>
                                        <TableCell>
                                            {silo.latitude && silo.longitude ? (
                                                <a
                                                    href={`https://www.google.com/maps/search/?api=1&query=${silo.latitude},${silo.longitude}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-blue-600 hover:underline flex items-center gap-1 text-sm"
                                                >
                                                    <MapPin className="h-3 w-3" />
                                                    {silo.latitude}, {silo.longitude}
                                                </a>
                                            ) : (
                                                <span className="text-gray-400 text-sm">Não informadas</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${silo.active ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-800"}`}>
                                                {silo.active ? "Ativo" : "Inativo"}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" onClick={() => handleEdit(silo)}>
                                                <Edit2 className="h-4 w-4 text-blue-600" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleDelete(silo)} disabled={deleteMutation.isPending}>
                                                <Trash2 className="h-4 w-4 text-red-600" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
