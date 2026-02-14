import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Edit, Trash2, Search, Sprout, LogOut } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function AdminFarmersPage() {
    const { user, logoutMutation } = useAuth();

    return (
        <div className="flex flex-col h-screen bg-gray-50">
            {/* Header / Navbar specially for Farmer Admin */}
            <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="bg-green-100 p-2 rounded-lg">
                        <Sprout className="h-6 w-6 text-green-700" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">Gestão de Agricultores</h1>
                        <p className="text-xs text-gray-500">Painel Administrativo Exclusivo</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right hidden md:block">
                        <p className="text-sm font-medium">{user?.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{user?.role?.replace('_', ' ')}</p>
                    </div>
                    <Button variant="outline" size="icon" onClick={() => logoutMutation.mutate()}>
                        <LogOut className="h-4 w-4" />
                    </Button>
                </div>
            </header>

            <main className="flex-1 overflow-auto p-6 max-w-7xl mx-auto w-full">
                <FarmersManagement />
            </main>
        </div>
    );
}

function FarmersManagement() {
    const [editingFarmer, setEditingFarmer] = useState<any>(null);
    const [deletingFarmer, setDeletingFarmer] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    // Form states
    const [name, setName] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [whatsappNumber, setWhatsappNumber] = useState("");
    const [propertySize, setPropertySize] = useState("");
    const [mainCulture, setMainCulture] = useState("");
    const [region, setRegion] = useState("");

    const { toast } = useToast();

    // Fetch farmers
    const { data: farmers, isLoading } = useQuery<any[]>({
        queryKey: ['/api/admin/farmers'],
    });

    const createFarmerMutation = useMutation({
        mutationFn: async (data: any) => {
            return apiRequest("POST", "/api/admin/farmers", data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/admin/farmers'] });
            toast({ title: "Agricultor cadastrado com sucesso" });
            setIsCreateOpen(false);
            resetForm();
        },
        onError: (error: any) => {
            toast({
                title: "Erro ao cadastrar",
                description: error.message,
                variant: "destructive"
            });
        }
    });

    const updateFarmerMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: any }) => {
            return apiRequest("PATCH", `/api/admin/farmers/${id}`, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/admin/farmers'] });
            toast({ title: "Agricultor atualizado" });
            setEditingFarmer(null);
            resetForm();
        },
        onError: (error: any) => {
            toast({
                title: "Erro ao atualizar",
                description: error.message,
                variant: "destructive"
            });
        }
    });

    const deleteFarmerMutation = useMutation({
        mutationFn: async (id: string) => {
            return apiRequest("DELETE", `/api/admin/farmers/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/admin/farmers'] });
            toast({ title: "Agricultor removido" });
            setDeletingFarmer(null);
        },
        onError: (error: any) => {
            toast({
                title: "Erro ao remover",
                description: error.message,
                variant: "destructive"
            });
        }
    });

    const resetForm = () => {
        setName("");
        setUsername("");
        setPassword("");
        setWhatsappNumber("");
        setPropertySize("");
        setMainCulture("");
        setRegion("");
    };

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        createFarmerMutation.mutate({
            name,
            username,
            password,
            whatsapp_number: whatsappNumber,
            property_size: propertySize ? parseFloat(propertySize) : 0,
            main_culture: mainCulture,
            region
        });
    };

    const startEdit = (farmer: any) => {
        setEditingFarmer(farmer);
        setName(farmer.users?.name || "");
        setUsername(farmer.users?.username || "");
        setWhatsappNumber(farmer.users?.whatsapp_number || "");
        setPropertySize(farmer.property_size?.toString() || "");
        setMainCulture(farmer.main_culture || "");
        setRegion(farmer.region || "");
        setPassword(""); // Don't fill password
    };

    const handleUpdate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingFarmer) return;

        const data: any = {
            name,
            username,
            whatsapp_number: whatsappNumber,
            property_size: propertySize ? parseFloat(propertySize) : 0,
            main_culture: mainCulture,
            region
        };

        if (password) {
            data.password = password;
        }

        updateFarmerMutation.mutate({ id: editingFarmer.id, data });
    };

    const filteredFarmers = farmers?.filter(f =>
        f.users?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.users?.username?.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between gap-4 items-center">
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar agricultor..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Button onClick={() => { resetForm(); setIsCreateOpen(true); }} className="w-full sm:w-auto bg-green-600 hover:bg-green-700">
                    <Plus className="mr-2 h-4 w-4" /> Novo Agricultor
                </Button>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-green-600" />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredFarmers.map((farmer) => (
                        <Card key={farmer.id} className="hover:shadow-lg transition-shadow border-l-4 border-l-green-500">
                            <CardHeader className="pb-2">
                                <CardTitle className="flex justify-between items-start">
                                    <span>{farmer.users?.name}</span>
                                    <div className="flex gap-1">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(farmer)}>
                                            <Edit className="h-4 w-4 text-blue-500" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeletingFarmer(farmer)}>
                                            <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                    </div>
                                </CardTitle>
                                <CardDescription>@{farmer.users?.username}</CardDescription>
                            </CardHeader>
                            <CardContent className="text-sm space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <p className="text-muted-foreground text-xs">Região</p>
                                        <p className="font-medium">{farmer.region || "N/A"}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground text-xs">Tamanho</p>
                                        <p className="font-medium">{farmer.property_size} ha</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground text-xs">Cultura Principal</p>
                                        <p className="font-medium">{farmer.main_culture || "N/A"}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground text-xs">WhatsApp</p>
                                        <p className="font-medium">{farmer.users?.whatsapp_number || "N/A"}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                    {filteredFarmers.length === 0 && (
                        <div className="col-span-full text-center py-12 text-muted-foreground">
                            Nenhum agricultor encontrado.
                        </div>
                    )}
                </div>
            )}

            {/* Create Dialog */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Cadastrar Novo Agricultor</DialogTitle>
                        <DialogDescription>Preencha os dados abaixo para criar um novo acesso de agricultor.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreate} className="space-y-4 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Nome Completo</Label>
                                <Input value={name} onChange={e => setName(e.target.value)} required />
                            </div>
                            <div className="space-y-2">
                                <Label>Usuário de Acesso</Label>
                                <Input value={username} onChange={e => setUsername(e.target.value)} required />
                            </div>
                            <div className="space-y-2">
                                <Label>Senha</Label>
                                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                            </div>
                            <div className="space-y-2">
                                <Label>WhatsApp (595...)</Label>
                                <Input value={whatsappNumber} onChange={e => setWhatsappNumber(e.target.value)} placeholder="5959..." />
                            </div>
                            <div className="space-y-2">
                                <Label>Tamanho da Propriedade (ha)</Label>
                                <Input type="number" value={propertySize} onChange={e => setPropertySize(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Cultura Principal</Label>
                                <Input value={mainCulture} onChange={e => setMainCulture(e.target.value)} placeholder="Soja, Milho..." />
                            </div>
                            <div className="space-y-2">
                                <Label>Região</Label>
                                <Input value={region} onChange={e => setRegion(e.target.value)} placeholder="Cidade/Estado" />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                            <Button type="submit" className="bg-green-600 hover:bg-green-700" disabled={createFarmerMutation.isPending}>
                                {createFarmerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Cadastrar
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog open={!!editingFarmer} onOpenChange={(open) => !open && setEditingFarmer(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Editar Agricultor</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleUpdate} className="space-y-4 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Nome</Label>
                                <Input value={name} onChange={e => setName(e.target.value)} required />
                            </div>
                            <div className="space-y-2">
                                <Label>Usuário</Label>
                                <Input value={username} onChange={e => setUsername(e.target.value)} required />
                            </div>
                            <div className="space-y-2">
                                <Label>Nova Senha (opcional)</Label>
                                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Deixe em branco para manter" />
                            </div>
                            <div className="space-y-2">
                                <Label>WhatsApp</Label>
                                <Input value={whatsappNumber} onChange={e => setWhatsappNumber(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Tamanho (ha)</Label>
                                <Input type="number" value={propertySize} onChange={e => setPropertySize(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Cultura</Label>
                                <Input value={mainCulture} onChange={e => setMainCulture(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Região</Label>
                                <Input value={region} onChange={e => setRegion(e.target.value)} />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setEditingFarmer(null)}>Cancelar</Button>
                            <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={updateFarmerMutation.isPending}>
                                {updateFarmerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Salvar Alterações
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <Dialog open={!!deletingFarmer} onOpenChange={(open) => !open && setDeletingFarmer(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirmar Exclusão</DialogTitle>
                        <DialogDescription>
                            Tem certeza que deseja remover o agricultor <b>{deletingFarmer?.users?.name}</b>?
                            Esta ação removerá também o acesso do usuário e não pode ser desfeita.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeletingFarmer(null)}>Cancelar</Button>
                        <Button variant="destructive" onClick={() => deleteFarmerMutation.mutate(deletingFarmer.id)} disabled={deleteFarmerMutation.isPending}>
                            {deleteFarmerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Excluir Definitivamente
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
