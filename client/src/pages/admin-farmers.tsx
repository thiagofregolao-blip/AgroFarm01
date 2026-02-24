import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Loader2, Plus, Edit, Trash2, Search, Sprout, LogOut, BarChart3, Users, TrendingUp, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ProductsManagement } from "./admin-products";

export default function AdminFarmersPage() {
    const { user, logoutMutation } = useAuth();
    const [activeTab, setActiveTab] = useState("dashboard");

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
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                    <TabsList className="grid w-full grid-cols-3 max-w-2xl">
                        <TabsTrigger value="dashboard" className="flex items-center gap-2">
                            <BarChart3 className="h-4 w-4" />
                            Dashboard
                        </TabsTrigger>
                        <TabsTrigger value="farmers" className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Agricultores
                        </TabsTrigger>
                        <TabsTrigger value="products" className="flex items-center gap-2">
                            <Sprout className="h-4 w-4" />
                            Catálogo Global
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="dashboard" className="space-y-6">
                        <FarmersDashboard />
                    </TabsContent>

                    <TabsContent value="farmers" className="space-y-6">
                        <FarmersManagement />
                    </TabsContent>

                    <TabsContent value="products" className="space-y-6">
                        <ProductsManagement />
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    );
}

function FarmersDashboard() {
    const { data: stats, isLoading } = useQuery<any>({
        queryKey: ['/api/admin/farmers/dashboard/stats'],
    });

    if (isLoading) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-green-600" />
            </div>
        );
    }

    const formatNumber = (num: number) => {
        return new Intl.NumberFormat('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(num);
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Dashboard de Agricultores</h2>
                <p className="text-muted-foreground">Visão geral das métricas e estatísticas dos agricultores</p>
            </div>

            {/* Cards de Métricas */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Área Total</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatNumber(stats?.totalArea || 0)} ha</div>
                        <p className="text-xs text-muted-foreground">Soma de todas as propriedades</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total de Agricultores</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats?.totalFarmers || 0}</div>
                        <p className="text-xs text-muted-foreground">Agricultores cadastrados</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total de Propriedades</CardTitle>
                        <Sprout className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats?.totalProperties || 0}</div>
                        <p className="text-xs text-muted-foreground">Propriedades registradas</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Produtos Únicos</CardTitle>
                        <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats?.productPrices?.length || 0}</div>
                        <p className="text-xs text-muted-foreground">Produtos com preços registrados</p>
                    </CardContent>
                </Card>
            </div>

            {/* Produtos Mais Usados */}
            <Card>
                <CardHeader>
                    <CardTitle>Produtos Mais Utilizados</CardTitle>
                    <CardDescription>Top 10 produtos mais aplicados pelos agricultores</CardDescription>
                </CardHeader>
                <CardContent>
                    {stats?.mostUsedProducts && stats.mostUsedProducts.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Produto</TableHead>
                                    <TableHead className="text-right">Aplicações</TableHead>
                                    <TableHead className="text-right">Quantidade Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {stats.mostUsedProducts.map((product: any, index: number) => (
                                    <TableRow key={product.productId || index}>
                                        <TableCell className="font-medium">{product.productName || "N/A"}</TableCell>
                                        <TableCell className="text-right">{product.applicationCount}</TableCell>
                                        <TableCell className="text-right">{formatNumber(product.totalQuantity)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            Nenhum produto utilizado ainda.
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Preços dos Produtos das Faturas */}
            <Card>
                <CardHeader>
                    <CardTitle>Preços dos Produtos (Faturas)</CardTitle>
                    <CardDescription>Últimos preços importados das faturas dos agricultores</CardDescription>
                </CardHeader>
                <CardContent>
                    {stats?.productPrices && stats.productPrices.length > 0 ? (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Produto</TableHead>
                                        <TableHead>Fornecedor</TableHead>
                                        <TableHead className="text-right">Preço Unitário</TableHead>
                                        <TableHead>Unidade</TableHead>
                                        <TableHead>Última Atualização</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {stats.productPrices.map((price: any, index: number) => (
                                        <TableRow key={price.productId || index}>
                                            <TableCell className="font-medium">{price.productName || "N/A"}</TableCell>
                                            <TableCell>{price.supplier || "N/A"}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <DollarSign className="h-3 w-3 text-muted-foreground" />
                                                    {formatNumber(price.unitPrice)}
                                                </div>
                                            </TableCell>
                                            <TableCell>{price.unit || "N/A"}</TableCell>
                                            <TableCell>
                                                {price.lastInvoiceDate
                                                    ? new Date(price.lastInvoiceDate).toLocaleDateString('pt-BR')
                                                    : "N/A"}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            Nenhum preço de produto registrado ainda.
                        </div>
                    )}
                </CardContent>
            </Card>
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
        setName(farmer.name || "");
        setUsername(farmer.username || "");
        setWhatsappNumber(farmer.phone || "");
        setPropertySize(farmer.propertySize?.toString() || "");
        setMainCulture(farmer.mainCulture || "");
        setRegion(farmer.region || "");
        setPassword(""); // Don't fill password
    };

    const handleUpdate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingFarmer) return;

        const data: any = {
            name,
            username,
            phone: whatsappNumber,
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
        f.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.username?.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Gestão de Agricultores</h2>
                <p className="text-muted-foreground">Cadastre, edite e gerencie os agricultores do sistema</p>
            </div>

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
                                    <span>{farmer.name}</span>
                                    <div className="flex gap-1">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(farmer)}>
                                            <Edit className="h-4 w-4 text-blue-500" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeletingFarmer(farmer)}>
                                            <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                    </div>
                                </CardTitle>
                                <CardDescription>@{farmer.username}</CardDescription>
                            </CardHeader>
                            <CardContent className="text-sm space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <p className="text-muted-foreground text-xs">Região</p>
                                        <p className="font-medium">{farmer.region || "N/A"}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground text-xs">Tamanho</p>
                                        <p className="font-medium">{farmer.propertySize ? `${farmer.propertySize} ha` : "N/A"}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground text-xs">Cultura Principal</p>
                                        <p className="font-medium">{farmer.mainCulture || "N/A"}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground text-xs">WhatsApp</p>
                                        <p className="font-medium">{farmer.whatsapp_number || "N/A"}</p>
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
                            Tem certeza que deseja remover o agricultor <b>{deletingFarmer?.name}</b>?
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
