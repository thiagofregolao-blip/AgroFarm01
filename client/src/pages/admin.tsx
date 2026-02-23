import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Users, Package, FolderTree, Percent, Settings as SettingsIcon, Menu, Bell, Plus, Upload, Edit, Save, X, Trash2, Repeat, ChevronDown, ChevronRight, RefreshCw, Calendar, Sprout, Target, TrendingUp, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import AdminNavbar from "@/components/layout/admin-navbar";
import Header from "@/components/layout/header";
import type { Category, User, Subcategory, Product, MasterClient, Region, BarterProduct, BarterSettings, InsertBarterProduct, Season, InsertSeason } from "@shared/schema";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format } from "date-fns";
import { Progress } from "@/components/ui/progress";

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("users");

  // Read hash from URL to determine active tab
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash && ['dashboard', 'users', 'master-clients', 'seasons', 'categories', 'subcategories', 'products', 'price-table', 'commissions', 'parameters', 'barter', 'timac', 'system'].includes(hash)) {
      setActiveTab(hash);
    } else {
      setActiveTab('dashboard');
    }

    const handleHashChange = () => {
      const newHash = window.location.hash.replace('#', '');
      if (newHash && ['dashboard', 'users', 'master-clients', 'seasons', 'categories', 'subcategories', 'products', 'price-table', 'commissions', 'parameters', 'barter', 'timac', 'system'].includes(newHash)) {
        setActiveTab(newHash);
      } else {
        setActiveTab('dashboard');
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Header />
      <AdminNavbar activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="flex-1 overflow-auto p-6">
        {activeTab === 'dashboard' && <DashboardManagement />}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Gestão da Equipe Interna</h2>
                <p className="text-muted-foreground">Gerencie consultores, gerentes e outros membros.</p>
              </div>
              <div className="bg-yellow-100 text-yellow-800 px-4 py-2 rounded-md text-sm border border-yellow-300">
                Administração de Agricultores mudou para o novo <strong>Painel de Agricultores</strong>.
              </div>
            </div>
            <TeamManagement />
          </div>
        )}
        {activeTab === 'master-clients' && <MasterClientsManagement />}
        {activeTab === 'seasons' && <SeasonsManagement />}
        {activeTab === 'categories' && <CategoriesManagement />}
        {activeTab === 'subcategories' && <SubcategoriesManagement />}
        {activeTab === 'products' && <ProductsManagement />}
        {activeTab === 'price-table' && <PriceTableManagement />}
        {activeTab === 'commissions' && <CommissionsManagement />}
        {activeTab === 'parameters' && <ParametersManagement />}
        {activeTab === 'barter' && <BarterManagement />}
        {activeTab === 'timac' && <TimacManagement />}
        {activeTab === 'planning-import' && <PlanningImportManagement />}
        {activeTab === 'system' && <SystemManagement />}
      </main>
    </div>
  );
}

function PlanningImportManagement() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const { data: activeSeason } = useQuery<{ id: string; name: string }>({
    queryKey: ["/api/seasons/active"],
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file || !activeSeason) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("seasonId", activeSeason.id);
    formData.append("file", file);

    try {
      await apiRequest("POST", "/api/admin/import-planning-final", formData);
      toast({
        title: "Importação Concluída",
        description: "Os dados do planejamento foram importados com sucesso.",
      });
      setFile(null);
    } catch (error) {
      toast({
        title: "Erro na Importação",
        description: "Ocorreu um erro ao importar o arquivo. Verifique o formato e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Importação de Planejamento da Safra</h2>
        <p className="text-muted-foreground">Carregue a planilha oficial de produtos e preços para a safra atual.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Importação de Planejamento</CardTitle>
          <CardDescription>
            Importe a planilha de planejamento final para a safra ativa: <strong>{activeSeason?.name}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="planning-import">Arquivo Excel (.xlsx)</Label>
            <Input id="planning-import" type="file" accept=".xlsx" onChange={handleFileChange} />
          </div>
        </CardContent>
        <div className="p-6 pt-0">
          <Button onClick={handleUpload} disabled={!file || isUploading}>
            {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Importar Planejamento
          </Button>
        </div>
      </Card>

      {activeSeason && <PlanningProductList seasonId={activeSeason.id} />}
    </div>
  );
}

function AccessManagement() {
  return (
    <Tabs defaultValue="team" className="space-y-4">
      <TabsList>
        <TabsTrigger value="team">Equipe Interna</TabsTrigger>
      </TabsList>
      <TabsContent value="team">
        <TeamManagement />
      </TabsContent>
    </Tabs>
  );
}

function PlanningProductList({ seasonId }: { seasonId: string }) {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ price: "", dose: "" });

  const { data: products, isLoading } = useQuery<any[]>({
    queryKey: ["/api/planning/products", seasonId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/planning/products?seasonId=${seasonId}`);
      return res.json();
    },
    enabled: !!seasonId,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("PATCH", `/api/planning/products/${data.id}`, {
        price: data.price,
        dosePerHa: data.dose
      });
    },
    onSuccess: () => {
      toast({ title: "Produto atualizado com sucesso" });
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/planning/products"] });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar", variant: "destructive" });
    }
  });

  const startEditing = (product: any) => {
    setEditingId(product.id);
    setEditForm({
      price: product.price || "",
      dose: product.dosePerHa || ""
    });
  };

  const saveEdit = (id: string) => {
    updateMutation.mutate({ id, ...editForm });
  };

  if (isLoading) {
    return <div className="py-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></div>;
  }

  if (!products || products.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>Produtos Importados</CardTitle></CardHeader>
        <CardContent><p className="text-muted-foreground">Nenhum produto importado para esta safra.</p></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Produtos Importados ({products.length})</CardTitle>
        <CardDescription>Gerencie os preços e doses de referência.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border max-h-[600px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Segmento</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead className="w-[150px]">Preço Ref. (USD)</TableHead>
                <TableHead className="w-[150px]">Dose (p/ ha)</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell><Badge variant="outline">{product.segment}</Badge></TableCell>
                  <TableCell>{product.unit}</TableCell>
                  <TableCell>
                    {editingId === product.id ? (
                      <Input
                        type="number"
                        value={editForm.price}
                        onChange={e => setEditForm(prev => ({ ...prev, price: e.target.value }))}
                        className="h-8"
                      />
                    ) : (
                      `$${product.price}`
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === product.id ? (
                      <Input
                        type="number"
                        value={editForm.dose}
                        onChange={e => setEditForm(prev => ({ ...prev, dose: e.target.value }))}
                        className="h-8"
                      />
                    ) : (
                      product.dosePerHa
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === product.id ? (
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => saveEdit(product.id)} disabled={updateMutation.isPending}>
                          <Save className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}>
                          <X className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    ) : (
                      <Button size="icon" variant="ghost" onClick={() => startEditing(product)}>
                        <Edit className="h-4 w-4 text-slate-500" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardManagement() {
  const { data: regionalData, isLoading } = useQuery<any[]>({

    queryKey: ['/api/admin/regional-sales'],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Filter regions with sales only
  const regionsWithSales = regionalData?.filter(region => region.totalSales > 0) || [];

  if (!regionsWithSales || regionsWithSales.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Dashboard Administrativo</CardTitle>
          <CardDescription>Análise Regional de Vendas</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Nenhum dado de vendas disponível.</p>
        </CardContent>
      </Card>
    );
  }

  // Calculate totals
  const totalSales = regionsWithSales.reduce((sum, region) => sum + region.totalSales, 0);
  const totalVolume = regionsWithSales.reduce((sum, region) => sum + region.totalVolume, 0);
  const totalSalesCount = regionsWithSales.reduce((sum, region) => sum + region.salesCount, 0);

  // Find top region by sales
  const topRegion = regionsWithSales.reduce((max, region) =>
    region.totalSales > max.totalSales ? region : max, regionsWithSales[0]);

  // Prepare data for charts
  const chartData = regionsWithSales.map(region => ({
    name: region.regionName,
    vendas: region.totalSales,
    volume: region.totalVolume,
  }));

  // Colors for pie chart
  const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Dashboard Administrativo</h2>
        <p className="text-muted-foreground">Análise Regional de Vendas e Performance</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Vendas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalSales.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Todas as regiões</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Volume Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalVolume.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Unidades vendidas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Transações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSalesCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Vendas realizadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Região Líder</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{topRegion.regionName}</div>
            <p className="text-xs text-muted-foreground mt-1">
              ${topRegion.totalSales.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Regional Details Table */}
      <Card>
        <CardHeader>
          <CardTitle>Top 5 Produtos por Região</CardTitle>
          <CardDescription>Produtos mais vendidos em cada região</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {regionsWithSales.map((region) => (
              <div key={region.regionId} className="border-b pb-4 last:border-b-0">
                <h3 className="font-semibold text-lg mb-3">{region.regionName}</h3>
                <div className="grid grid-cols-1 gap-2">
                  {region.topProducts.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto</TableHead>
                          <TableHead>Marca</TableHead>
                          <TableHead className="text-right">Volume</TableHead>
                          <TableHead className="text-right">Vendas</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {region.topProducts.slice(0, 5).map((product: any, idx: number) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{product.productName}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{product.brand}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {product.volume.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              ${product.sales.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhum produto vendido nesta região.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function TeamManagement() {
  const [editingUser, setEditingUser] = useState<any>(null);
  const [deletingUser, setDeletingUser] = useState<any>(null);
  const [userDataCheck, setUserDataCheck] = useState<any>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editName, setEditName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editManagerId, setEditManagerId] = useState<string>("");
  const { toast } = useToast();

  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ['/api/admin/users'],
  });

  // Get only managers for the dropdown
  const managers = users?.filter(u => u.role === 'gerente') || [];

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest("PATCH", `/api/admin/users/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({
        title: "Usuário atualizado",
        description: "As informações do usuário foram atualizadas com sucesso.",
      });
      setEditingUser(null);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao atualizar o usuário. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const checkUserDataMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("GET", `/api/admin/users/${id}/data-check`);
    },
    onSuccess: (data: any) => {
      setUserDataCheck(data);
      setShowDeleteConfirm(true);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao verificar dados do usuário. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/users/${id}?confirmed=true`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({
        title: "Usuário excluído",
        description: "O usuário e todos os seus dados foram excluídos com sucesso.",
      });
      setDeletingUser(null);
      setShowDeleteConfirm(false);
      setUserDataCheck(null);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao excluir o usuário. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const startEdit = (user: any) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditUsername(user.username);
    setEditPassword(""); // Password is optional, only update if filled
    setEditRole(user.role);
    setEditManagerId(user.managerId || "none");
  };

  const handleUpdate = () => {
    if (editingUser) {
      const updateData: any = {
        name: editName,
        username: editUsername,
        role: editRole,
        managerId: editRole === 'consultor' ? (editManagerId === 'none' ? null : editManagerId) : null
      };
      // Only include password if user entered a new one
      if (editPassword.trim()) {
        updateData.password = editPassword;
      }
      updateUserMutation.mutate({
        id: editingUser.id,
        data: updateData
      });
    }
  };

  const startDelete = (user: any) => {
    setDeletingUser(user);
    checkUserDataMutation.mutate(user.id);
  };

  const confirmDelete = () => {
    if (deletingUser) {
      deleteUserMutation.mutate(deletingUser.id);
    }
  };

  const cancelDelete = () => {
    setDeletingUser(null);
    setShowDeleteConfirm(false);
    setUserDataCheck(null);
  };

  if (isLoading) {
    return <div className="text-center py-8">Carregando usuários...</div>;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Gestão da Equipe</CardTitle>
          <CardDescription>Gerencie consultores, gerentes e demais membros da equipe.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {users && users.length > 0 ? (
              <div className="border rounded-lg divide-y">
                {users.filter((user: any) => user.role !== 'agricultor' && user.role !== 'admin_agricultor').map((user: any) => (
                  <div key={user.id} className="p-4 flex items-center justify-between hover:bg-accent/50 transition-colors">
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-sm text-muted-foreground">@{user.username}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${user.role === 'administrador'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200'
                        : user.role === 'gerente'
                          ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200'
                          : user.role === 'faturista'
                            ? 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                        }`}>
                        {user.role === 'administrador' ? 'Administrador' : user.role === 'gerente' ? 'Gerente' : user.role === 'faturista' ? 'Faturista' : user.role === 'agricultor' ? 'Agricultor' : user.role === 'admin_agricultor' ? 'Admin Agricultor' : 'Consultor'}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => startEdit(user)}
                        data-testid={`button-edit-user-${user.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => startDelete(user)}
                        data-testid={`button-delete-user-${user.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">Nenhum membro da equipe encontrado</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent data-testid="dialog-edit-user">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Altere as informações do usuário abaixo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nome</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                data-testid="input-edit-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-username">Nome de Usuário</Label>
              <Input
                id="edit-username"
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                data-testid="input-edit-username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password">Nova Senha (deixe em branco para manter a atual)</Label>
              <Input
                id="edit-password"
                type="password"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder="••••••••"
                data-testid="input-edit-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Função</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger data-testid="select-edit-role">
                  <SelectValue placeholder="Selecione a função" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="consultor">Consultor</SelectItem>
                  <SelectItem value="gerente">Gerente</SelectItem>
                  <SelectItem value="administrador">Administrador</SelectItem>
                  <SelectItem value="faturista">Faturista</SelectItem>
                  <SelectItem value="agricultor">Agricultor</SelectItem>
                  <SelectItem value="admin_agricultor">Admin Agricultor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {editRole === 'consultor' && (
              <div className="space-y-2">
                <Label htmlFor="edit-manager">Gerente Responsável</Label>
                <Select value={editManagerId} onValueChange={setEditManagerId}>
                  <SelectTrigger data-testid="select-edit-manager">
                    <SelectValue placeholder="Selecione o gerente (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {managers.map(manager => (
                      <SelectItem key={manager.id} value={manager.id}>
                        {manager.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingUser(null)}
              data-testid="button-cancel-edit-user"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={updateUserMutation.isPending}
              data-testid="button-save-user"
            >
              {updateUserMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={cancelDelete}>
        <AlertDialogContent data-testid="dialog-delete-user-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ Atenção: Este usuário possui dados no sistema</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                O usuário <strong>{deletingUser?.name}</strong> possui os seguintes dados vinculados:
              </p>

              {userDataCheck?.hasData && (
                <div className="bg-muted p-4 rounded-lg space-y-1 text-sm">
                  {userDataCheck.data.clients > 0 && (
                    <p>• <strong>{userDataCheck.data.clients}</strong> cliente(s)</p>
                  )}
                  {userDataCheck.data.sales > 0 && (
                    <p>• <strong>{userDataCheck.data.sales}</strong> venda(s)</p>
                  )}
                  {userDataCheck.data.goals > 0 && (
                    <p>• <strong>{userDataCheck.data.goals}</strong> meta(s) de safra</p>
                  )}
                  {userDataCheck.data.marketRates > 0 && (
                    <p>• <strong>{userDataCheck.data.marketRates}</strong> configuração(ões) de mercado</p>
                  )}
                  {userDataCheck.data.externalPurchases > 0 && (
                    <p>• <strong>{userDataCheck.data.externalPurchases}</strong> compra(s) externa(s)</p>
                  )}
                  {userDataCheck.data.purchaseHistory > 0 && (
                    <p>• <strong>{userDataCheck.data.purchaseHistory}</strong> histórico(s) de compra</p>
                  )}
                  {userDataCheck.data.marketBenchmarks > 0 && (
                    <p>• <strong>{userDataCheck.data.marketBenchmarks}</strong> benchmark(s) de mercado</p>
                  )}
                </div>
              )}

              <p className="font-semibold text-destructive">
                Ao confirmar, TODOS estes dados serão PERMANENTEMENTE excluídos.
                Esta ação não pode ser desfeita.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelDelete} data-testid="button-cancel-delete-user">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteUserMutation.isPending}
              data-testid="button-confirm-delete-user"
            >
              {deleteUserMutation.isPending ? "Excluindo..." : "Confirmar Exclusão"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}




function CategoriesManagement() {
  const { toast } = useToast();
  const [showNewCategoryModal, setShowNewCategoryModal] = useState(false);
  const [newCategory, setNewCategory] = useState({
    name: "",
    type: "fertilizantes",
    greenCommission: "0.30",
    greenMarginMin: "7.00",
    yellowCommission: "0.20",
    yellowMarginMin: "6.00",
    yellowMarginMax: "6.99",
    redCommission: "0.18",
    redMarginMin: "4.00",
    redMarginMax: "4.99",
    belowListCommission: "0.15",
    defaultIva: "10.00",
  });

  const { data: categories, isLoading } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (payload: any) => {
      return apiRequest("POST", "/api/admin/categories", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      toast({
        title: "Categoria criada",
        description: "A categoria foi criada com sucesso.",
      });
      setShowNewCategoryModal(false);
      setNewCategory((prev) => ({ ...prev, name: "" }));
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao criar categoria. Verifique os campos e tente novamente.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return <div className="text-center py-8">Carregando categorias...</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Gestão de Categorias</CardTitle>
          <CardDescription>Gerencie as categorias de produtos</CardDescription>
        </div>
        <Dialog open={showNewCategoryModal} onOpenChange={setShowNewCategoryModal}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2" data-testid="button-new-category">
              <Plus size={16} />
              Nova Categoria
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl" data-testid="new-category-modal">
            <DialogHeader>
              <DialogTitle>Nova Categoria</DialogTitle>
              <DialogDescription>
                Cadastre uma nova categoria com as regras de comissão.
              </DialogDescription>
            </DialogHeader>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newCategory.name.trim() || !newCategory.type) {
                  toast({
                    title: "Campos obrigatórios",
                    description: "Informe o nome e o tipo da categoria.",
                    variant: "destructive",
                  });
                  return;
                }
                createCategoryMutation.mutate({
                  ...newCategory,
                  name: newCategory.name.trim(),
                });
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input
                    value={newCategory.name}
                    onChange={(e) => setNewCategory((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Ex: Biológicos, Adjuvantes..."
                    data-testid="input-new-category-name"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Tipo *</Label>
                  <Select
                    value={newCategory.type}
                    onValueChange={(value) => setNewCategory((p) => ({ ...p, type: value }))}
                  >
                    <SelectTrigger data-testid="select-new-category-type">
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fertilizantes">Fertilizantes</SelectItem>
                      <SelectItem value="sementes">Sementes</SelectItem>
                      <SelectItem value="especialidades">Especialidades</SelectItem>
                      <SelectItem value="agroquimicos">Agroquímicos</SelectItem>
                      <SelectItem value="corretivos">Corretivos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Comissão Verde (%)</Label>
                  <Input
                    value={newCategory.greenCommission}
                    onChange={(e) => setNewCategory((p) => ({ ...p, greenCommission: e.target.value }))}
                    data-testid="input-green-commission"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Margem Verde mín (%)</Label>
                  <Input
                    value={newCategory.greenMarginMin}
                    onChange={(e) => setNewCategory((p) => ({ ...p, greenMarginMin: e.target.value }))}
                    data-testid="input-green-margin-min"
                  />
                </div>
                <div className="space-y-2">
                  <Label>IVA padrão (%)</Label>
                  <Input
                    value={newCategory.defaultIva}
                    onChange={(e) => setNewCategory((p) => ({ ...p, defaultIva: e.target.value }))}
                    data-testid="input-default-iva"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Comissão Amarela (%)</Label>
                  <Input
                    value={newCategory.yellowCommission}
                    onChange={(e) => setNewCategory((p) => ({ ...p, yellowCommission: e.target.value }))}
                    data-testid="input-yellow-commission"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Margem Amarela mín (%)</Label>
                  <Input
                    value={newCategory.yellowMarginMin}
                    onChange={(e) => setNewCategory((p) => ({ ...p, yellowMarginMin: e.target.value }))}
                    data-testid="input-yellow-margin-min"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Margem Amarela máx (%)</Label>
                  <Input
                    value={newCategory.yellowMarginMax}
                    onChange={(e) => setNewCategory((p) => ({ ...p, yellowMarginMax: e.target.value }))}
                    data-testid="input-yellow-margin-max"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Comissão Vermelha (%)</Label>
                  <Input
                    value={newCategory.redCommission}
                    onChange={(e) => setNewCategory((p) => ({ ...p, redCommission: e.target.value }))}
                    data-testid="input-red-commission"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Margem Vermelha mín (%)</Label>
                  <Input
                    value={newCategory.redMarginMin}
                    onChange={(e) => setNewCategory((p) => ({ ...p, redMarginMin: e.target.value }))}
                    data-testid="input-red-margin-min"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Margem Vermelha máx (%)</Label>
                  <Input
                    value={newCategory.redMarginMax}
                    onChange={(e) => setNewCategory((p) => ({ ...p, redMarginMax: e.target.value }))}
                    data-testid="input-red-margin-max"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Comissão Abaixo da Lista (%)</Label>
                  <Input
                    value={newCategory.belowListCommission}
                    onChange={(e) => setNewCategory((p) => ({ ...p, belowListCommission: e.target.value }))}
                    data-testid="input-below-list-commission"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowNewCategoryModal(false)}
                  data-testid="button-cancel-new-category"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createCategoryMutation.isPending}
                  data-testid="button-save-new-category"
                >
                  {createCategoryMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {categories && categories.length > 0 ? (
            <div className="border rounded-lg divide-y">
              {categories.map((category: any) => (
                <div key={category.id} className="p-4 flex items-center justify-between hover:bg-accent/50 transition-colors">
                  <div>
                    <p className="font-medium">{category.name}</p>
                    <p className="text-sm text-muted-foreground">{category.type}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">Nenhuma categoria encontrada</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SubcategoriesManagement() {
  const { toast } = useToast();
  const [showNewSubcategoryModal, setShowNewSubcategoryModal] = useState(false);
  const [newSubcategoryName, setNewSubcategoryName] = useState("");
  const [newSubcategoryCategoryId, setNewSubcategoryCategoryId] = useState<string>("");
  const [newSubcategoryDisplayOrder, setNewSubcategoryDisplayOrder] = useState<string>("0");

  const { data: subcategories, isLoading } = useQuery<Subcategory[]>({
    queryKey: ['/api/subcategories'],
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
  });

  const createSubcategoryMutation = useMutation({
    mutationFn: async (payload: { name: string; categoryId: string; displayOrder: number }) => {
      return apiRequest("POST", "/api/admin/subcategories", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subcategories'] });
      toast({
        title: "Subcategoria criada",
        description: "A subcategoria foi criada com sucesso.",
      });
      setShowNewSubcategoryModal(false);
      setNewSubcategoryName("");
      setNewSubcategoryCategoryId("");
      setNewSubcategoryDisplayOrder("0");
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao criar subcategoria. Verifique os campos e tente novamente.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return <div className="text-center py-8">Carregando subcategorias...</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Gestão de Subcategorias</CardTitle>
          <CardDescription>Gerencie as subcategorias de produtos</CardDescription>
        </div>
        <Dialog open={showNewSubcategoryModal} onOpenChange={setShowNewSubcategoryModal}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2" data-testid="button-new-subcategory">
              <Plus size={16} />
              Nova Subcategoria
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md" data-testid="new-subcategory-modal">
            <DialogHeader>
              <DialogTitle>Nova Subcategoria</DialogTitle>
              <DialogDescription>
                Crie uma subcategoria vinculada a uma categoria.
              </DialogDescription>
            </DialogHeader>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newSubcategoryName.trim() || !newSubcategoryCategoryId) {
                  toast({
                    title: "Campos obrigatórios",
                    description: "Informe o nome e a categoria da subcategoria.",
                    variant: "destructive",
                  });
                  return;
                }

                const displayOrderNum = Number(newSubcategoryDisplayOrder);
                createSubcategoryMutation.mutate({
                  name: newSubcategoryName.trim(),
                  categoryId: newSubcategoryCategoryId,
                  displayOrder: Number.isFinite(displayOrderNum) ? displayOrderNum : 0,
                });
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input
                  value={newSubcategoryName}
                  onChange={(e) => setNewSubcategoryName(e.target.value)}
                  placeholder="Ex: Fungicidas, Inseticidas, TS..."
                  data-testid="input-new-subcategory-name"
                />
              </div>

              <div className="space-y-2">
                <Label>Categoria *</Label>
                <Select value={newSubcategoryCategoryId} onValueChange={setNewSubcategoryCategoryId}>
                  <SelectTrigger data-testid="select-new-subcategory-category">
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Ordem de exibição</Label>
                <Input
                  type="number"
                  value={newSubcategoryDisplayOrder}
                  onChange={(e) => setNewSubcategoryDisplayOrder(e.target.value)}
                  placeholder="0"
                  data-testid="input-new-subcategory-display-order"
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowNewSubcategoryModal(false)}
                  data-testid="button-cancel-new-subcategory"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createSubcategoryMutation.isPending}
                  data-testid="button-save-new-subcategory"
                >
                  {createSubcategoryMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {subcategories && subcategories.length > 0 ? (
            <div className="border rounded-lg divide-y">
              {subcategories.map((sub: any) => (
                <div key={sub.id} className="p-4 flex items-center justify-between hover:bg-accent/50 transition-colors">
                  <p className="font-medium">{sub.name}</p>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">Nenhuma subcategoria encontrada</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ProductsManagement() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined);
  const [brandFilter, setBrandFilter] = useState<string | undefined>(undefined);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [showImportProductsModal, setShowImportProductsModal] = useState(false);
  const [importingProducts, setImportingProducts] = useState(false);

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ['/api/products'],
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
  });

  const { data: subcategories } = useQuery<Subcategory[]>({
    queryKey: ['/api/subcategories'],
  });

  const autoClassifyMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/products/auto-classify", {});
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      toast({
        title: "Classificação automática concluída",
        description: `${data.classified} de ${data.totalProducts} produtos foram classificados automaticamente.`,
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao classificar produtos. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest("PATCH", `/api/admin/products/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      toast({
        title: "Produto atualizado",
        description: "Produto atualizado com sucesso.",
      });
      setEditingProduct(null);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao atualizar produto. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const syncCategoriesMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/sales/sync-categories", {});
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/sales'] });
      toast({
        title: "Sincronização concluída",
        description: data.message || `${data.updated} vendas atualizadas`,
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao sincronizar categorias. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const handleAutoClassify = () => {
    if (confirm("Deseja classificar automaticamente todos os produtos agroquímicos sem subcategoria?")) {
      autoClassifyMutation.mutate();
    }
  };

  const handleProductsImportUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportingProducts(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      // Por padrão atualiza produtos existentes pelo par (name + category)
      formData.append("updateExisting", "true");

      const res = await fetch("/api/admin/products/import", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const result = await res.json().catch(() => ({}));

      if (!res.ok || !result?.success) {
        throw new Error(result?.error || "Falha ao importar produtos");
      }

      queryClient.invalidateQueries({ queryKey: ["/api/products"] });

      toast({
        title: "Importação concluída",
        description: `${result.created ?? 0} criado(s), ${result.updated ?? 0} atualizado(s)${result.errors?.length ? ` • ${result.errors.length} aviso(s)` : ""}`,
      });

      if (result.errors?.length) {
        console.warn("Erros/avisos na importação de produtos:", result.errors);
        toast({
          title: "Importação com avisos",
          description: "Algumas linhas foram ignoradas. Veja o console para detalhes.",
          variant: "destructive",
        });
      }

      setShowImportProductsModal(false);
    } catch (err: any) {
      toast({
        title: "Erro na importação",
        description: err?.message || "Erro ao importar arquivo",
        variant: "destructive",
      });
    } finally {
      setImportingProducts(false);
      event.target.value = "";
    }
  };

  if (isLoading) {
    return <div className="text-center py-8">Carregando produtos...</div>;
  }

  // Filtrar produtos
  const filteredProducts = products?.filter((product: any) => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !categoryFilter || product.categoryId === categoryFilter;
    const matchesBrand = !brandFilter || product.marca === brandFilter;
    return matchesSearch && matchesCategory && matchesBrand;
  }) || [];

  // Obter marcas únicas
  const uniqueBrands = Array.from(new Set(products?.map((p: any) => p.marca).filter(Boolean))) as string[];

  const agroquimicosWithoutSubcategory = products?.filter(
    (p: any) => p.categoryId === 'cat-agroquimicos' && !p.subcategoryId
  ).length || 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Gestão de Produtos</CardTitle>
          <CardDescription>
            Gerencie os produtos do sistema
            {agroquimicosWithoutSubcategory > 0 && (
              <span className="ml-2 text-amber-600 dark:text-amber-400">
                • {agroquimicosWithoutSubcategory} agroquímicos sem subcategoria
              </span>
            )}
          </CardDescription>
        </div>
        <div className="flex gap-2">
          {agroquimicosWithoutSubcategory > 0 && (
            <Button
              size="sm"
              variant="secondary"
              className="gap-2"
              onClick={handleAutoClassify}
              disabled={autoClassifyMutation.isPending}
              data-testid="button-auto-classify"
            >
              <Package size={16} />
              {autoClassifyMutation.isPending ? "Classificando..." : "Classificar Automaticamente"}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => {
              if (confirm("Deseja sincronizar as categorias das vendas com os produtos atuais? Isso atualizará todas as vendas para refletir a categoria atual de cada produto.")) {
                syncCategoriesMutation.mutate();
              }
            }}
            disabled={syncCategoriesMutation.isPending}
            data-testid="button-sync-categories"
          >
            <RefreshCw size={16} />
            {syncCategoriesMutation.isPending ? "Sincronizando..." : "Sincronizar Categorias"}
          </Button>
          <Dialog open={showImportProductsModal} onOpenChange={setShowImportProductsModal}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-2" data-testid="button-import-products">
                <Upload size={16} />
                Importar
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md" data-testid="import-products-modal">
              <DialogHeader>
                <DialogTitle>Importar Produtos (Excel)</DialogTitle>
                <DialogDescription>
                  Envie uma planilha (.xlsx/.xls/.csv). Linhas serão criadas ou atualizadas por <strong>Nome + Categoria</strong>.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="bg-muted p-4 rounded-lg text-sm">
                  <p className="font-medium mb-2">Colunas aceitas (flexível):</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li><strong>Nome</strong>: Nome / NOME / Produto</li>
                    <li><strong>Categoria</strong>: categoryId / Categoria / type</li>
                    <li><strong>Opcional</strong>: Marca, Descrição, Segmento, Subcategoria, isActive</li>
                  </ul>
                </div>

                <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center">
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleProductsImportUpload}
                    disabled={importingProducts}
                    className="hidden"
                    id="products-file-upload"
                    data-testid="input-file-upload-products"
                  />
                  <label
                    htmlFor="products-file-upload"
                    className={`cursor-pointer flex flex-col items-center gap-3 ${importingProducts ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                      <Upload className="text-primary" size={24} />
                    </div>
                    <div>
                      <p className="font-medium">
                        {importingProducts ? "Importando..." : "Clique para selecionar arquivo"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Excel/CSV (.xlsx, .xls, .csv)
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Button size="sm" className="gap-2">
            <Plus size={16} />
            Novo Produto
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Filtros */}
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <Label>Buscar produto</Label>
              <Input
                placeholder="Digite o nome do produto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="input-search-products"
              />
            </div>
            <div className="w-48">
              <Label>Categoria</Label>
              <Select value={categoryFilter || ''} onValueChange={(value) => setCategoryFilter(value || undefined)}>
                <SelectTrigger data-testid="select-filter-category">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  {categories?.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Label>Marca</Label>
              <Select value={brandFilter || ''} onValueChange={(value) => setBrandFilter(value || undefined)}>
                <SelectTrigger data-testid="select-filter-brand">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  {uniqueBrands.map((brand) => (
                    <SelectItem key={brand} value={brand}>
                      {brand}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(searchTerm || categoryFilter || brandFilter) && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm('');
                  setCategoryFilter(undefined);
                  setBrandFilter(undefined);
                }}
                data-testid="button-clear-filters"
              >
                Limpar
              </Button>
            )}
          </div>

          {/* Lista de produtos */}
          {products && products.length > 0 ? (
            <>
              <div className="text-sm text-muted-foreground mb-2">
                Exibindo {filteredProducts.length} de {products.length} produtos
              </div>
              <div className="border rounded-lg divide-y max-h-[600px] overflow-auto">
                {filteredProducts.length > 0 ? (
                  filteredProducts.map((product: any) => (
                    <div key={product.id} className="p-4 flex items-center justify-between hover:bg-accent/50 transition-colors">
                      <div className="flex-1">
                        <p className="font-medium">{product.name}</p>
                        <div className="flex gap-2 mt-1">
                          <p className="text-sm text-muted-foreground">{product.marca || 'Sem marca'}</p>
                          {product.subcategoryId && (
                            <Badge variant="outline" className="text-xs">
                              {product.subcategoryId.replace('sub-', '').replace(/-/g, ' ')}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingProduct(product)}
                          data-testid={`button-edit-product-${product.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-center py-8">Nenhum produto encontrado com os filtros aplicados</p>
                )}
              </div>
            </>
          ) : (
            <p className="text-muted-foreground text-center py-8">Nenhum produto encontrado</p>
          )}
        </div>
      </CardContent>

      {/* Modal de Edição */}
      {editingProduct && (
        <Dialog open={!!editingProduct} onOpenChange={() => setEditingProduct(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Produto</DialogTitle>
              <DialogDescription>
                Alterar categoria e marca de: {editingProduct.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select
                  value={editingProduct.categoryId}
                  onValueChange={(value) => setEditingProduct({ ...editingProduct, categoryId: value, subcategoryId: null })}
                >
                  <SelectTrigger data-testid="select-edit-category">
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {editingProduct.categoryId && (subcategories?.filter(s => s.categoryId === editingProduct.categoryId).length ?? 0) > 0 && (
                <div className="space-y-2">
                  <Label>Subcategoria (opcional)</Label>
                  <Select
                    value={editingProduct.subcategoryId || undefined}
                    onValueChange={(value) => setEditingProduct({ ...editingProduct, subcategoryId: value })}
                  >
                    <SelectTrigger data-testid="select-edit-subcategory">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {subcategories
                        ?.filter(s => s.categoryId === editingProduct.categoryId)
                        .map((sub) => (
                          <SelectItem key={sub.id} value={sub.id}>
                            {sub.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Marca</Label>
                <Input
                  value={editingProduct.marca || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, marca: e.target.value })}
                  placeholder="Digite a marca"
                  data-testid="input-edit-brand"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingProduct(null)}>
                Cancelar
              </Button>
              <Button
                onClick={() => updateProductMutation.mutate({
                  id: editingProduct.id,
                  data: {
                    categoryId: editingProduct.categoryId,
                    subcategoryId: editingProduct.subcategoryId || null,
                    marca: editingProduct.marca
                  }
                })}
                disabled={updateProductMutation.isPending}
                data-testid="button-save-product"
              >
                {updateProductMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}

function CommissionsManagement() {
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<any>({});
  const { toast } = useToast();

  const { data: categories, isLoading } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest("PATCH", `/api/categories/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({
        title: "Categoria atualizada",
        description: "As configurações de comissão foram atualizadas com sucesso.",
      });
      setEditingCategory(null);
      setEditValues({});
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao atualizar a categoria. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const startEditing = (category: Category) => {
    setEditingCategory(category.id);
    setEditValues({
      greenCommission: category.greenCommission,
      greenMarginMin: category.greenMarginMin,
      yellowCommission: category.yellowCommission,
      yellowMarginMin: category.yellowMarginMin,
      yellowMarginMax: category.yellowMarginMax,
      redCommission: category.redCommission,
      redMarginMin: category.redMarginMin,
      redMarginMax: category.redMarginMax,
      belowListCommission: category.belowListCommission,
    });
  };

  const cancelEditing = () => {
    setEditingCategory(null);
    setEditValues({});
  };

  const saveChanges = () => {
    if (editingCategory && editValues) {
      updateCategoryMutation.mutate({
        id: editingCategory,
        data: editValues
      });
    }
  };

  const updateEditValue = (field: string, value: string) => {
    setEditValues((prev: any) => ({
      ...prev,
      [field]: value
    }));
  };

  if (isLoading) {
    return <div className="text-center py-8">Carregando...</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Tabela de Comissões</CardTitle>
          <CardDescription>Gerencie as taxas de comissão por categoria</CardDescription>
        </div>
        <div className="flex gap-2">
          {editingCategory && (
            <>
              <Button
                onClick={saveChanges}
                size="sm"
                disabled={updateCategoryMutation.isPending}
                data-testid="button-save-changes"
              >
                <Save className="h-4 w-4 mr-2" />
                Salvar
              </Button>
              <Button
                onClick={cancelEditing}
                variant="outline"
                size="sm"
                data-testid="button-cancel-edit"
              >
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-center">Verde</TableHead>
                <TableHead className="text-center">Margem Verde</TableHead>
                <TableHead className="text-center">Amarela</TableHead>
                <TableHead className="text-center">Margem Amarela</TableHead>
                <TableHead className="text-center">Vermelha</TableHead>
                <TableHead className="text-center">Margem Vermelha</TableHead>
                <TableHead className="text-center">Abaixo Lista</TableHead>
                <TableHead className="text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories?.map((category) => (
                <TableRow key={category.id} data-testid={`commission-row-${category.id}`}>
                  <TableCell className="font-medium">{category.name}</TableCell>

                  <TableCell className="text-center">
                    {editingCategory === category.id ? (
                      <input
                        type="number"
                        step="0.01"
                        value={editValues.greenCommission}
                        onChange={(e) => updateEditValue('greenCommission', e.target.value)}
                        className="w-16 px-2 py-1 text-center border rounded"
                      />
                    ) : (
                      <span className="font-mono text-sm">{parseFloat(category.greenCommission).toFixed(2)}%</span>
                    )}
                  </TableCell>

                  <TableCell className="text-center text-xs text-muted-foreground">
                    {editingCategory === category.id ? (
                      <input
                        type="number"
                        step="0.01"
                        value={editValues.greenMarginMin}
                        onChange={(e) => updateEditValue('greenMarginMin', e.target.value)}
                        className="w-16 px-2 py-1 text-center border rounded text-xs"
                      />
                    ) : (
                      `≥${parseFloat(category.greenMarginMin).toFixed(0)}%`
                    )}
                  </TableCell>

                  <TableCell className="text-center">
                    {editingCategory === category.id ? (
                      <input
                        type="number"
                        step="0.01"
                        value={editValues.yellowCommission}
                        onChange={(e) => updateEditValue('yellowCommission', e.target.value)}
                        className="w-16 px-2 py-1 text-center border rounded"
                      />
                    ) : (
                      <span className="font-mono text-sm">{parseFloat(category.yellowCommission).toFixed(2)}%</span>
                    )}
                  </TableCell>

                  <TableCell className="text-center text-xs text-muted-foreground">
                    {editingCategory === category.id ? (
                      <div className="flex gap-1 justify-center">
                        <input
                          type="number"
                          step="0.01"
                          value={editValues.yellowMarginMin}
                          onChange={(e) => updateEditValue('yellowMarginMin', e.target.value)}
                          className="w-12 px-1 py-1 text-center border rounded text-xs"
                        />
                        <span>-</span>
                        <input
                          type="number"
                          step="0.01"
                          value={editValues.yellowMarginMax}
                          onChange={(e) => updateEditValue('yellowMarginMax', e.target.value)}
                          className="w-12 px-1 py-1 text-center border rounded text-xs"
                        />
                      </div>
                    ) : (
                      `${parseFloat(category.yellowMarginMin).toFixed(0)}-${parseFloat(category.yellowMarginMax).toFixed(0)}%`
                    )}
                  </TableCell>

                  <TableCell className="text-center">
                    {editingCategory === category.id ? (
                      <input
                        type="number"
                        step="0.01"
                        value={editValues.redCommission}
                        onChange={(e) => updateEditValue('redCommission', e.target.value)}
                        className="w-16 px-2 py-1 text-center border rounded"
                      />
                    ) : (
                      <span className="font-mono text-sm">{parseFloat(category.redCommission).toFixed(2)}%</span>
                    )}
                  </TableCell>

                  <TableCell className="text-center text-xs text-muted-foreground">
                    {editingCategory === category.id ? (
                      <div className="flex gap-1 justify-center">
                        <input
                          type="number"
                          step="0.01"
                          value={editValues.redMarginMin}
                          onChange={(e) => updateEditValue('redMarginMin', e.target.value)}
                          className="w-12 px-1 py-1 text-center border rounded text-xs"
                        />
                        <span>-</span>
                        <input
                          type="number"
                          step="0.01"
                          value={editValues.redMarginMax}
                          onChange={(e) => updateEditValue('redMarginMax', e.target.value)}
                          className="w-12 px-1 py-1 text-center border rounded text-xs"
                        />
                      </div>
                    ) : (
                      `${parseFloat(category.redMarginMin).toFixed(0)}-${parseFloat(category.redMarginMax).toFixed(0)}%`
                    )}
                  </TableCell>

                  <TableCell className="text-center">
                    {editingCategory === category.id ? (
                      <input
                        type="number"
                        step="0.01"
                        value={editValues.belowListCommission}
                        onChange={(e) => updateEditValue('belowListCommission', e.target.value)}
                        className="w-16 px-2 py-1 text-center border rounded"
                      />
                    ) : (
                      <Badge className="bg-verde/10 text-verde border-verde/20 font-mono" variant="outline">
                        {parseFloat(category.belowListCommission).toFixed(2)}%
                      </Badge>
                    )}
                  </TableCell>

                  <TableCell className="text-center">
                    {editingCategory === category.id ? (
                      <span className="text-muted-foreground text-xs">Editando...</span>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEditing(category)}
                        data-testid={`button-edit-${category.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function MasterClientsManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingClient, setEditingClient] = useState<any>(null);
  const [mergingClient, setMergingClient] = useState<any>(null);
  const [mergeTarget, setMergeTarget] = useState<string>("");
  const [showImportModal, setShowImportModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedVendedorId, setSelectedVendedorId] = useState<string>("");
  const [expandedConsultant, setExpandedConsultant] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: masterClients, isLoading } = useQuery<MasterClient[]>({
    queryKey: ['/api/admin/master-clients'],
  });

  const { data: regions } = useQuery<Region[]>({
    queryKey: ['/api/regions'],
  });

  const { data: vendedores } = useQuery<User[]>({
    queryKey: ['/api/admin/vendedores'],
  });

  const { data: allUserClientLinks, isLoading: loadingLinks, isError: errorLinks } = useQuery<any[]>({
    queryKey: ['/api/admin/user-client-links'],
  });

  const updateClientMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest("PATCH", `/api/admin/master-clients/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/master-clients'] });
      toast({
        title: "Cliente atualizado",
        description: "As informações do cliente foram atualizadas com sucesso.",
      });
      setEditingClient(null);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao atualizar o cliente. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const mergeClientsMutation = useMutation({
    mutationFn: async ({ sourceId, targetId }: { sourceId: string; targetId: string }) => {
      return apiRequest("POST", `/api/admin/master-clients/${sourceId}/merge/${targetId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/master-clients'] });
      toast({
        title: "Clientes mesclados",
        description: "Os clientes foram mesclados com sucesso.",
      });
      setMergingClient(null);
      setMergeTarget("");
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao mesclar clientes. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const deleteAllClientsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", "/api/admin/master-clients/delete-all", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/master-clients'] });
      toast({
        title: "Todos os clientes excluídos",
        description: "Todos os clientes master e dados relacionados foram removidos do sistema.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao excluir clientes. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const deleteConsultorClientsMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("DELETE", `/api/admin/user-client-links/user/${userId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/user-client-links'] });
      toast({
        title: "Clientes excluídos",
        description: "Todos os clientes do consultor foram removidos com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao excluir clientes do consultor. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!selectedVendedorId) {
      toast({
        title: "Vendedor não selecionado",
        description: "Por favor, selecione um vendedor antes de importar.",
        variant: "destructive",
      });
      event.target.value = '';
      return;
    }

    setUploading(true);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('vendedorId', selectedVendedorId);

    try {
      const response = await fetch('/api/clients/import', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: "Importação concluída",
          description: `${result.created} cliente(s) criado(s), ${result.updated} atualizado(s)`,
        });
        queryClient.invalidateQueries({ queryKey: ['/api/admin/master-clients'] });
        queryClient.invalidateQueries({ queryKey: ['/api/admin/user-client-links'] });
        setShowImportModal(false);
        setSelectedVendedorId("");
      } else {
        toast({
          title: "Erro na importação",
          description: result.error || "Erro ao importar arquivo",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao fazer upload do arquivo",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const toggleConsultant = (consultantId: string) => {
    setExpandedConsultant(expandedConsultant === consultantId ? null : consultantId);
  };

  if (isLoading || loadingLinks) {
    return <div className="text-center py-8">Carregando clientes master...</div>;
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Gestão de Clientes Master</CardTitle>
            <CardDescription>
              Base de dados global de clientes - evita duplicação entre usuários
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" data-testid="button-delete-all-clients">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir Todos
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent data-testid="dialog-delete-all-clients">
                <AlertDialogHeader>
                  <AlertDialogTitle>⚠️ ATENÇÃO: Ação Irreversível</AlertDialogTitle>
                  <AlertDialogDescription className="space-y-3">
                    <p className="font-semibold text-destructive">
                      Você está prestes a excluir TODOS os clientes master do sistema.
                    </p>
                    <p>
                      Esta ação irá:
                    </p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Remover todos os clientes master</li>
                      <li>Remover todos os vínculos de usuários com clientes</li>
                      <li>Excluir todas as vendas, metas e históricos relacionados</li>
                    </ul>
                    <p className="font-bold text-destructive">
                      ESTA AÇÃO NÃO PODE SER DESFEITA.
                    </p>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid="button-cancel-delete-all">
                    Cancelar
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteAllClientsMutation.mutate()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={deleteAllClientsMutation.isPending}
                    data-testid="button-confirm-delete-all"
                  >
                    {deleteAllClientsMutation.isPending ? "Excluindo..." : "Confirmar Exclusão Total"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-import-master-clients">
                  <Upload className="h-4 w-4 mr-2" />
                  Importar Clientes
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md" data-testid="import-master-clients-modal">
                <DialogHeader>
                  <DialogTitle>Importar Clientes do Excel</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="vendedor-select">Selecionar Vendedor *</Label>
                    <Select value={selectedVendedorId} onValueChange={setSelectedVendedorId}>
                      <SelectTrigger id="vendedor-select" data-testid="select-vendedor-import">
                        <SelectValue placeholder="Selecione o vendedor para vincular os clientes" />
                      </SelectTrigger>
                      <SelectContent>
                        {vendedores?.map((vendedor) => (
                          <SelectItem key={vendedor.id} value={vendedor.id} data-testid={`option-vendedor-${vendedor.id}`}>
                            {vendedor.name} (@{vendedor.username})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Os clientes importados serão vinculados ao vendedor selecionado
                    </p>
                  </div>

                  <div className="bg-muted p-4 rounded-lg text-sm">
                    <p className="font-medium mb-2">Formato esperado do Excel:</p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li><strong>Coluna A:</strong> Cliente (80/20)</li>
                      <li><strong>Coluna B:</strong> Área de plantio em hectares (ha)</li>
                      <li><strong>Coluna C:</strong> região</li>
                    </ul>
                    <p className="mt-3 text-xs text-muted-foreground">
                      * Clientes duplicados serão identificados por nome e atualizados automaticamente
                    </p>
                  </div>

                  <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center">
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileUpload}
                      disabled={uploading || !selectedVendedorId}
                      className="hidden"
                      id="master-client-file-upload"
                      data-testid="input-file-upload-master-clients"
                    />
                    <label
                      htmlFor="master-client-file-upload"
                      className={`cursor-pointer flex flex-col items-center gap-3 ${(uploading || !selectedVendedorId) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                        <Upload className="text-primary" size={24} />
                      </div>
                      <div>
                        <p className="font-medium">
                          {uploading ? "Importando..." : selectedVendedorId ? "Clique para selecionar arquivo" : "Selecione um vendedor primeiro"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Apenas arquivos Excel (.xlsx, .xls)
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Input
              placeholder="Buscar consultor por nome..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-search-master-clients"
            />

            <div className="space-y-2">
              {vendedores
                ?.filter((consultor) => {
                  const clientsCount = allUserClientLinks?.filter(link => link.userId === consultor.id).length || 0;
                  if (!loadingLinks && !errorLinks && clientsCount === 0) return false;
                  return searchQuery ? consultor.name.toLowerCase().includes(searchQuery.toLowerCase()) : true;
                })
                .map((consultor) => {
                  const clientsCount = allUserClientLinks?.filter(link => link.userId === consultor.id).length || 0;
                  const consultorClients = allUserClientLinks?.filter(link => link.userId === consultor.id) || [];
                  const isExpanded = expandedConsultant === consultor.id;

                  return (
                    <div key={consultor.id} className="border rounded-lg overflow-hidden">
                      <button
                        onClick={() => toggleConsultant(consultor.id)}
                        className="w-full p-4 flex items-center justify-between hover:bg-accent/50 transition-colors text-left"
                        data-testid={`button-toggle-consultant-${consultor.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                            <Users className="text-primary" size={20} />
                          </div>
                          <div>
                            <p className="font-medium">{consultor.name}</p>
                            <p className="text-sm text-muted-foreground">@{consultor.username}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary" data-testid={`badge-clients-count-${consultor.id}`}>
                            {clientsCount} {clientsCount === 1 ? 'cliente' : 'clientes'}
                          </Badge>
                          <div className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                            ▼
                          </div>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t bg-muted/30">
                          {consultorClients.length === 0 ? (
                            <div className="p-4 text-center text-muted-foreground">
                              Nenhum cliente vinculado a este consultor
                            </div>
                          ) : (
                            <>
                              <div className="divide-y">
                                {consultorClients.map((link: any) => (
                                  <div
                                    key={link.id}
                                    className="p-4 flex items-center justify-between hover:bg-accent/30 transition-colors"
                                    data-testid={`client-item-${link.id}`}
                                  >
                                    <div className="flex-1">
                                      <p className="font-medium">{link.masterClient?.name || link.customName || 'Cliente sem nome'}</p>
                                      <div className="flex gap-2 mt-1 text-sm text-muted-foreground">
                                        {link.masterClient?.plantingArea && (
                                          <span>Área: {link.masterClient.plantingArea} ha</span>
                                        )}
                                        {link.masterClient?.regionId && (
                                          <span>
                                            • Região: {regions?.find((r: any) => r.id === link.masterClient.regionId)?.name || link.masterClient.regionId}
                                          </span>
                                        )}
                                        {link.isTop80_20 && (
                                          <Badge variant="default" className="ml-2">TOP 80/20</Badge>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex gap-2">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setEditingClient(link.masterClient)}
                                        data-testid={`button-edit-client-${link.id}`}
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setMergingClient(link.masterClient)}
                                        data-testid={`button-merge-client-${link.id}`}
                                      >
                                        <Users className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <div className="p-4 border-t bg-muted/50">
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      className="w-full"
                                      data-testid={`button-delete-consultor-clients-${consultor.id}`}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Excluir Todos os Clientes deste Consultor
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent data-testid={`dialog-delete-consultor-clients-${consultor.id}`}>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>⚠️ Confirmar Exclusão</AlertDialogTitle>
                                      <AlertDialogDescription className="space-y-3">
                                        <p className="font-semibold text-destructive">
                                          Você está prestes a excluir todos os {clientsCount} cliente(s) de {consultor.name}.
                                        </p>
                                        <p>
                                          Esta ação irá remover todos os vínculos deste consultor com seus clientes.
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                          Os clientes master permanecerão no sistema e poderão ser vinculados novamente a qualquer consultor.
                                        </p>
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel data-testid={`button-cancel-delete-consultor-${consultor.id}`}>
                                        Cancelar
                                      </AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => deleteConsultorClientsMutation.mutate(consultor.id)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        disabled={deleteConsultorClientsMutation.isPending}
                                        data-testid={`button-confirm-delete-consultor-${consultor.id}`}
                                      >
                                        {deleteConsultorClientsMutation.isPending ? "Excluindo..." : "Excluir Clientes"}
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

              {(() => {
                const linkedClientIds = new Set(allUserClientLinks?.map(link => link.masterClientId) || []);
                const unlinkedClients = masterClients?.filter(client => !linkedClientIds.has(client.id)) || [];

                if (unlinkedClients.length > 0) {
                  const isExpanded = expandedConsultant === 'unassigned';

                  return (
                    <div className="border rounded-lg overflow-hidden border-dashed">
                      <button
                        onClick={() => toggleConsultant('unassigned')}
                        className="w-full p-4 flex items-center justify-between hover:bg-accent/50 transition-colors text-left"
                        data-testid="button-toggle-unassigned-clients"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                            <Users className="text-muted-foreground" size={20} />
                          </div>
                          <div>
                            <p className="font-medium text-muted-foreground">Sem Consultor</p>
                            <p className="text-sm text-muted-foreground">Clientes não vinculados</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" data-testid="badge-unassigned-clients-count">
                            {unlinkedClients.length} {unlinkedClients.length === 1 ? 'cliente' : 'clientes'}
                          </Badge>
                          <div className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                            ▼
                          </div>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t bg-muted/30">
                          <div className="divide-y">
                            {unlinkedClients.map((client: any) => (
                              <div
                                key={client.id}
                                className="p-4 flex items-center justify-between hover:bg-accent/30 transition-colors"
                                data-testid={`unassigned-client-item-${client.id}`}
                              >
                                <div className="flex-1">
                                  <p className="font-medium">{client.name}</p>
                                  <div className="flex gap-2 mt-1 text-sm text-muted-foreground">
                                    {client.plantingArea && (
                                      <span>Área: {client.plantingArea} ha</span>
                                    )}
                                    {client.regionId && (
                                      <span>
                                        • Região: {regions?.find((r: any) => r.id === client.regionId)?.name || client.regionId}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setEditingClient(client)}
                                    data-testid={`button-edit-unassigned-client-${client.id}`}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setMergingClient(client)}
                                    data-testid={`button-merge-unassigned-client-${client.id}`}
                                  >
                                    <Users className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }
                return null;
              })()}

              {vendedores?.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum consultor cadastrado
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editingClient} onOpenChange={(open) => !open && setEditingClient(null)}>
        <DialogContent data-testid="dialog-edit-master-client">
          <DialogHeader>
            <DialogTitle>Editar Cliente Master</DialogTitle>
            <DialogDescription>
              Altere as informações do cliente abaixo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-client-name">Nome</Label>
              <Input
                id="edit-client-name"
                value={editingClient?.name || ""}
                onChange={(e) =>
                  setEditingClient({ ...editingClient, name: e.target.value })
                }
                data-testid="input-edit-master-client-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-client-region">Região</Label>
              <Select
                value={editingClient?.regionId || ""}
                onValueChange={(value) =>
                  setEditingClient({ ...editingClient, regionId: value })
                }
              >
                <SelectTrigger data-testid="select-edit-master-client-region">
                  <SelectValue placeholder="Selecione a região" />
                </SelectTrigger>
                <SelectContent>
                  {regions?.map((region: any) => (
                    <SelectItem key={region.id} value={region.id}>
                      {region.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-client-area">Área de Plantio (ha)</Label>
              <Input
                id="edit-client-area"
                value={editingClient?.plantingArea || ""}
                onChange={(e) =>
                  setEditingClient({ ...editingClient, plantingArea: e.target.value })
                }
                data-testid="input-edit-master-client-area"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingClient(null)}
              data-testid="button-cancel-edit-master-client"
            >
              Cancelar
            </Button>
            <Button
              onClick={() =>
                updateClientMutation.mutate({
                  id: editingClient.id,
                  data: {
                    name: editingClient.name,
                    regionId: editingClient.regionId,
                    plantingArea: editingClient.plantingArea,
                  },
                })
              }
              disabled={updateClientMutation.isPending}
              data-testid="button-save-master-client"
            >
              {updateClientMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!mergingClient} onOpenChange={(open) => !open && setMergingClient(null)}>
        <DialogContent data-testid="dialog-merge-master-client">
          <DialogHeader>
            <DialogTitle>Mesclar Clientes Duplicados</DialogTitle>
            <DialogDescription>
              Selecione o cliente de destino. Todos os vínculos de "{mergingClient?.name}" serão transferidos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Cliente de origem (será removido)</Label>
              <Input value={mergingClient?.name || ""} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="merge-target">Cliente de destino (receberá os vínculos)</Label>
              <Select value={mergeTarget} onValueChange={setMergeTarget}>
                <SelectTrigger data-testid="select-merge-target">
                  <SelectValue placeholder="Selecione o cliente de destino" />
                </SelectTrigger>
                <SelectContent>
                  {masterClients
                    ?.filter((c: any) => c.id !== mergingClient?.id)
                    .map((client: any) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setMergingClient(null);
                setMergeTarget("");
              }}
              data-testid="button-cancel-merge"
            >
              Cancelar
            </Button>
            <Button
              onClick={() =>
                mergeClientsMutation.mutate({
                  sourceId: mergingClient.id,
                  targetId: mergeTarget,
                })
              }
              disabled={!mergeTarget || mergeClientsMutation.isPending}
              data-testid="button-confirm-merge"
            >
              {mergeClientsMutation.isPending ? "Mesclando..." : "Mesclar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ParametersManagement() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Parâmetros do Sistema</CardTitle>
        <CardDescription>Configure os parâmetros de safras e classificações</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-center py-8">Parâmetros do sistema serão implementados aqui</p>
      </CardContent>
    </Card>
  );
}

function BarterManagement() {
  const [activeSubTab, setActiveSubTab] = useState("products");

  return (
    <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="space-y-4">
      <TabsList className="grid w-full grid-cols-3 max-w-2xl">
        <TabsTrigger value="products">Produtos</TabsTrigger>
        <TabsTrigger value="seasons">Safras</TabsTrigger>
        <TabsTrigger value="settings">Configurações</TabsTrigger>
      </TabsList>

      <TabsContent value="products">
        <BarterProductsManagement />
      </TabsContent>

      <TabsContent value="seasons">
        <BarterSeasonsManagement />
      </TabsContent>

      <TabsContent value="settings">
        <BarterSettingsManagement />
      </TabsContent>
    </Tabs>
  );
}

function BarterProductsManagement() {
  const [newProduct, setNewProduct] = useState<Partial<InsertBarterProduct & { id: string }>>({ name: "", category: "", dosePerHa: "", unit: "", priceUsd: "", seasonId: "", isActive: true });
  const [editingProduct, setEditingProduct] = useState<BarterProduct | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewProducts, setPreviewProducts] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [importSeasonId, setImportSeasonId] = useState<string>("");
  const { toast } = useToast();

  const { data: products, isLoading } = useQuery<BarterProduct[]>({
    queryKey: ['/api/admin/barter/products'],
  });

  const { data: seasons } = useQuery<any[]>({
    queryKey: ['/api/seasons'],
  });

  const createProductMutation = useMutation({
    mutationFn: async (product: any) => {
      const payload = { ...product, seasonId: product.seasonId || undefined };
      return apiRequest("POST", "/api/admin/barter/products", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/barter/products'] });
      toast({ title: "Produto criado", description: "Produto barter criado com sucesso." });
      setShowDialog(false);
      setNewProduct({ name: "", category: "", dosePerHa: "", unit: "", priceUsd: "", seasonId: "", isActive: true });
    },
    onError: () => {
      toast({ title: "Erro", description: "Erro ao criar produto barter.", variant: "destructive" });
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      // Remove timestamp fields and id before sending update
      const { createdAt, updatedAt, id: _id, ...updateFields } = data;
      const payload = { ...updateFields, seasonId: data.seasonId || undefined };
      return apiRequest("PATCH", `/api/admin/barter/products/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/barter/products'] });
      toast({ title: "Produto atualizado", description: "Produto barter atualizado com sucesso." });
      setEditingProduct(null);
    },
    onError: () => {
      toast({ title: "Erro", description: "Erro ao atualizar produto barter.", variant: "destructive" });
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/barter/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/barter/products'] });
      toast({ title: "Produto excluído", description: "Produto barter excluído com sucesso." });
    },
    onError: () => {
      toast({ title: "Erro", description: "Erro ao excluir produto barter.", variant: "destructive" });
    },
  });

  const deleteAllProductsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", "/api/admin/barter/products");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/barter/products'] });
      toast({ title: "Produtos excluídos", description: "Todos os produtos barter foram excluídos com sucesso." });
      setShowDeleteAllDialog(false);
    },
    onError: () => {
      toast({ title: "Erro", description: "Erro ao excluir produtos barter.", variant: "destructive" });
    },
  });

  const categories = [
    { value: "sementes", label: "Sementes" },
    { value: "fertilizantes", label: "Fertilizantes" },
    { value: "herbicidas", label: "Herbicidas" },
    { value: "inseticidas", label: "Inseticidas" },
    { value: "fungicidas", label: "Fungicidas" },
    { value: "especialidades", label: "Especialidades" },
  ];

  const units = [
    { value: "kg", label: "kg" },
    { value: "lt", label: "lt" },
    { value: "sc", label: "sc" },
    { value: "un", label: "un" },
  ];

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);

    // Preview mode
    const formData = new FormData();
    formData.append('file', file);
    formData.append('preview', 'true');

    try {
      const response = await fetch('/api/admin/barter/products/bulk-import', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to preview');

      const data = await response.json();
      setPreviewProducts(data.products || []);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao processar arquivo para preview.",
        variant: "destructive",
      });
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    setImporting(true);
    const formData = new FormData();
    formData.append('file', selectedFile);
    if (importSeasonId) {
      formData.append('seasonId', importSeasonId);
    }

    try {
      const response = await fetch('/api/admin/barter/products/bulk-import', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to import');

      const data = await response.json();

      queryClient.invalidateQueries({ queryKey: ['/api/admin/barter/products'] });

      toast({
        title: "Importação concluída",
        description: `${data.created} produtos importados com sucesso. ${data.errors > 0 ? `${data.errors} erros.` : ''}`,
      });

      setShowImportDialog(false);
      setSelectedFile(null);
      setPreviewProducts([]);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao importar produtos.",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Produtos Barter</CardTitle>
            <CardDescription>Gerencie o catálogo de produtos para simulações barter</CardDescription>
          </div>
          <div className="flex gap-2">
            <AlertDialog open={showDeleteAllDialog} onOpenChange={setShowDeleteAllDialog}>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={!products || products.length === 0}
                  data-testid="button-delete-all-barter-products"
                >
                  <Trash2 size={16} className="mr-2" />
                  Excluir Todos
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação não pode ser desfeita. Todos os {products?.length || 0} produtos barter serão permanentemente excluídos.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteAllProductsMutation.mutate()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Excluir Todos
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-import-barter-products">
                  <Upload size={16} className="mr-2" />
                  Importar Planilha
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Importar Produtos Barter</DialogTitle>
                  <DialogDescription>
                    Faça upload de uma planilha Excel ou PDF com produtos barter. O sistema detectará automaticamente as categorias e preços.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Safra (Opcional)</Label>
                    <div className="flex gap-2">
                      <Select value={importSeasonId || undefined} onValueChange={setImportSeasonId}>
                        <SelectTrigger data-testid="select-import-season">
                          <SelectValue placeholder="Sem safra específica" />
                        </SelectTrigger>
                        <SelectContent>
                          {seasons?.map((season: any) => (
                            <SelectItem key={season.id} value={season.id}>
                              {season.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {importSeasonId && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => setImportSeasonId('')}
                          data-testid="button-clear-import-season"
                        >
                          <X size={16} />
                        </Button>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Selecione uma safra para associar a todos os produtos importados
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Arquivo (Excel ou PDF)</Label>
                    <Input
                      type="file"
                      accept=".xlsx,.xls,.pdf"
                      onChange={handleFileSelect}
                      data-testid="input-import-file"
                    />
                  </div>

                  {previewProducts.length > 0 && (
                    <div className="space-y-2">
                      <Label>Preview - {previewProducts.length} produtos detectados</Label>
                      <div className="border rounded-md max-h-96 overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Nome</TableHead>
                              <TableHead>Categoria</TableHead>
                              <TableHead>P.A.</TableHead>
                              <TableHead>Dose</TableHead>
                              <TableHead>Fabricante</TableHead>
                              <TableHead>Vermelha</TableHead>
                              <TableHead>Amarela</TableHead>
                              <TableHead>Verde</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {previewProducts.slice(0, 20).map((product, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="font-medium">{product.name}</TableCell>
                                <TableCell>
                                  <Badge variant="outline">{product.category}</Badge>
                                </TableCell>
                                <TableCell className="text-xs">{product.principioAtivo?.substring(0, 30)}...</TableCell>
                                <TableCell className="text-xs">{product.dosePerHa}</TableCell>
                                <TableCell>{product.fabricante}</TableCell>
                                <TableCell>{product.priceVermelha}</TableCell>
                                <TableCell>{product.priceAmarela}</TableCell>
                                <TableCell>{product.priceVerde}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        {previewProducts.length > 20 && (
                          <p className="text-sm text-muted-foreground p-2 text-center">
                            ... e mais {previewProducts.length - 20} produtos
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => {
                    setShowImportDialog(false);
                    setSelectedFile(null);
                    setPreviewProducts([]);
                  }}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleImport}
                    disabled={!selectedFile || previewProducts.length === 0 || importing}
                    data-testid="button-confirm-import"
                  >
                    {importing ? "Importando..." : `Importar ${previewProducts.length} Produtos`}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={showDialog} onOpenChange={setShowDialog}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-barter-product">
                  <Plus size={16} className="mr-2" />
                  Novo Produto
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Novo Produto Barter</DialogTitle>
                  <DialogDescription>Adicione um novo produto ao catálogo barter</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Nome do Produto</Label>
                    <Input
                      value={newProduct.name}
                      onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                      placeholder="Ex: Soja 63I64RSF IPRO"
                      data-testid="input-product-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select value={newProduct.category} onValueChange={(value) => setNewProduct({ ...newProduct, category: value })}>
                      <SelectTrigger data-testid="select-product-category">
                        <SelectValue placeholder="Selecione a categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Safra (Opcional)</Label>
                    <div className="flex gap-2">
                      <Select value={newProduct.seasonId || undefined} onValueChange={(value) => setNewProduct({ ...newProduct, seasonId: value || null })}>
                        <SelectTrigger data-testid="select-product-season">
                          <SelectValue placeholder="Sem safra específica" />
                        </SelectTrigger>
                        <SelectContent>
                          {seasons?.map((season: any) => (
                            <SelectItem key={season.id} value={season.id}>
                              {season.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {newProduct.seasonId && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => setNewProduct({ ...newProduct, seasonId: null })}
                        >
                          <X size={16} />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Dose/Ha</Label>
                      <Input
                        type="text"
                        value={newProduct.dosePerHa || ''}
                        onChange={(e) => setNewProduct({ ...newProduct, dosePerHa: e.target.value })}
                        placeholder="2ml/Kg ou 1Lt/Há"
                        data-testid="input-dose-per-ha"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Unidade</Label>
                      <Select value={newProduct.unit} onValueChange={(value) => setNewProduct({ ...newProduct, unit: value })}>
                        <SelectTrigger data-testid="select-product-unit">
                          <SelectValue placeholder="Unidade" />
                        </SelectTrigger>
                        <SelectContent>
                          {units.map((unit) => (
                            <SelectItem key={unit.value} value={unit.value}>
                              {unit.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Preço USD</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={newProduct.priceUsd}
                      onChange={(e) => setNewProduct({ ...newProduct, priceUsd: e.target.value })}
                      placeholder="320.00"
                      data-testid="input-product-price"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowDialog(false)}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={() => createProductMutation.mutate(newProduct)}
                    disabled={!newProduct.name || !newProduct.category || !newProduct.unit || !newProduct.priceUsd || createProductMutation.isPending}
                    data-testid="button-save-barter-product"
                  >
                    {createProductMutation.isPending ? "Salvando..." : "Salvar"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-center py-8">Carregando produtos...</p>
        ) : (
          <ProductsBySeasonView
            products={products || []}
            seasons={seasons || []}
            categories={categories}
            onEdit={setEditingProduct}
            onDelete={(id) => deleteProductMutation.mutate(id)}
            onToggleActive={(id, isActive) => updateProductMutation.mutate({ id, data: { isActive } })}
            onToggleSeasonActive={(seasonId, isActive) => {
              const seasonProducts = products?.filter(p => p.seasonId === seasonId) || [];
              seasonProducts.forEach(p => updateProductMutation.mutate({ id: p.id, data: { isActive } }));
            }}
          />
        )}
      </CardContent>

      {editingProduct && (
        <Dialog open={!!editingProduct} onOpenChange={() => setEditingProduct(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Produto</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={editingProduct.name}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={editingProduct.category} onValueChange={(value) => setEditingProduct({ ...editingProduct, category: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Safra (Opcional)</Label>
                <div className="flex gap-2">
                  <Select value={editingProduct.seasonId || undefined} onValueChange={(value) => setEditingProduct({ ...editingProduct, seasonId: value || null })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sem safra específica" />
                    </SelectTrigger>
                    <SelectContent>
                      {seasons?.map((season: any) => (
                        <SelectItem key={season.id} value={season.id}>
                          {season.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {editingProduct.seasonId && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setEditingProduct({ ...editingProduct, seasonId: null })}
                    >
                      <X size={16} />
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Preço USD</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editingProduct.priceUsd}
                  onChange={(e) => setEditingProduct({ ...editingProduct, priceUsd: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editingProduct.isActive ? "true" : "false"}
                  onValueChange={(value) => setEditingProduct({ ...editingProduct, isActive: value === "true" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Ativo</SelectItem>
                    <SelectItem value="false">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingProduct(null)}>
                Cancelar
              </Button>
              <Button
                onClick={() => updateProductMutation.mutate({ id: editingProduct.id, data: editingProduct })}
                disabled={updateProductMutation.isPending}
              >
                {updateProductMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}

function ProductsBySeasonView({ products, seasons, categories, onEdit, onDelete, onToggleActive, onToggleSeasonActive }: {
  products: any[];
  seasons: any[];
  categories: any[];
  onEdit: (product: any) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, isActive: boolean) => void;
  onToggleSeasonActive: (seasonId: string, isActive: boolean) => void;
}) {
  const [expandedSeasons, setExpandedSeasons] = useState<Set<string>>(new Set());

  const toggleSeason = (seasonId: string) => {
    const newExpanded = new Set(expandedSeasons);
    if (newExpanded.has(seasonId)) {
      newExpanded.delete(seasonId);
    } else {
      newExpanded.add(seasonId);
    }
    setExpandedSeasons(newExpanded);
  };

  const productsWithoutSeason = products.filter(p => !p.seasonId);
  const productsBySeason = seasons.reduce((acc: any, season: any) => {
    acc[season.id] = products.filter(p => p.seasonId === season.id);
    return acc;
  }, {});

  const seasonGroups = seasons.filter(season => productsBySeason[season.id]?.length > 0);

  return (
    <div className="space-y-4">
      {productsWithoutSeason.length > 0 && (
        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">Produtos sem safra específica</h3>
              <Badge variant="outline">{productsWithoutSeason.length} produtos</Badge>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Dose/Ha</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Preço USD</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productsWithoutSeason.map((product: any) => (
                <TableRow key={product.id}>
                  <TableCell>{product.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{categories.find(c => c.value === product.category)?.label}</Badge>
                  </TableCell>
                  <TableCell>{product.dosePerHa || "-"}</TableCell>
                  <TableCell>{product.unit}</TableCell>
                  <TableCell>${product.priceUsd}</TableCell>
                  <TableCell>
                    <Switch
                      checked={product.isActive}
                      onCheckedChange={(checked) => onToggleActive(product.id, checked)}
                      data-testid={`toggle-product-${product.id}`}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(product)}
                      data-testid={`button-edit-product-${product.id}`}
                    >
                      <Edit size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(product.id)}
                      data-testid={`button-delete-product-${product.id}`}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {seasonGroups.map((season: any) => {
        const seasonProducts = productsBySeason[season.id] || [];
        const allActive = seasonProducts.every((p: any) => p.isActive);
        const isExpanded = expandedSeasons.has(season.id);

        return (
          <div key={season.id} className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleSeason(season.id)}
                  data-testid={`toggle-season-${season.id}`}
                >
                  {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                </Button>
                <h3 className="font-semibold">{season.name}</h3>
                <Badge variant="outline">{seasonProducts.length} produtos</Badge>
                <Badge variant={allActive ? "default" : "secondary"}>
                  {allActive ? "Todos ativos" : "Alguns inativos"}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm">Ativar/Desativar todos</Label>
                <Switch
                  checked={allActive}
                  onCheckedChange={(checked) => onToggleSeasonActive(season.id, checked)}
                  data-testid={`toggle-season-all-${season.id}`}
                />
              </div>
            </div>

            {isExpanded && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Dose/Ha</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Preço USD</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {seasonProducts.map((product: any) => (
                    <TableRow key={product.id}>
                      <TableCell>{product.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{categories.find(c => c.value === product.category)?.label}</Badge>
                      </TableCell>
                      <TableCell>{product.dosePerHa || "-"}</TableCell>
                      <TableCell>{product.unit}</TableCell>
                      <TableCell>${product.priceUsd}</TableCell>
                      <TableCell>
                        <Switch
                          checked={product.isActive}
                          onCheckedChange={(checked) => onToggleActive(product.id, checked)}
                          data-testid={`toggle-product-${product.id}`}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(product)}
                          data-testid={`button-edit-product-${product.id}`}
                        >
                          <Edit size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(product.id)}
                          data-testid={`button-delete-product-${product.id}`}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        );
      })}

      {seasonGroups.length === 0 && productsWithoutSeason.length === 0 && (
        <p className="text-center py-8 text-muted-foreground">Nenhum produto cadastrado</p>
      )}
    </div>
  );
}

function BarterSeasonsManagement() {
  const [newSeason, setNewSeason] = useState({ name: "", type: "", year: new Date().getFullYear(), startDate: "", endDate: "" });
  const [editingSeason, setEditingSeason] = useState<any | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const { toast } = useToast();

  const { data: seasons, isLoading } = useQuery<any[]>({
    queryKey: ['/api/seasons'],
  });

  const createSeasonMutation = useMutation({
    mutationFn: async (seasonData: any) => {
      return apiRequest("POST", "/api/seasons", seasonData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/seasons'] });
      toast({ title: "Safra criada", description: "Safra criada com sucesso." });
      setShowDialog(false);
      setNewSeason({ name: "", type: "", year: new Date().getFullYear(), startDate: "", endDate: "" });
    },
    onError: () => {
      toast({ title: "Erro", description: "Erro ao criar safra.", variant: "destructive" });
    },
  });

  const updateSeasonMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest("PATCH", `/api/seasons/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/seasons'] });
      toast({ title: "Safra atualizada", description: "Safra atualizada com sucesso." });
      setEditingSeason(null);
    },
    onError: () => {
      toast({ title: "Erro", description: "Erro ao atualizar safra.", variant: "destructive" });
    },
  });

  const deleteSeasonMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/seasons/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/seasons'] });
      toast({ title: "Safra excluída", description: "Safra excluída com sucesso." });
    },
    onError: () => {
      toast({ title: "Erro", description: "Erro ao excluir safra.", variant: "destructive" });
    },
  });

  const seasonTypes = [
    { value: "soja_verao", label: "Soja Verão" },
    { value: "safrinha", label: "Safrinha" },
    { value: "milho", label: "Milho" },
    { value: "trigo", label: "Trigo" },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Safras Barter</CardTitle>
            <CardDescription>Gerencie as safras disponíveis para produtos barter</CardDescription>
          </div>
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-barter-season">
                <Plus size={16} className="mr-2" />
                Nova Safra
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova Safra Barter</DialogTitle>
                <DialogDescription>Adicione uma nova safra para organizar produtos barter</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Nome da Safra</Label>
                  <Input
                    value={newSeason.name}
                    onChange={(e) => setNewSeason({ ...newSeason, name: e.target.value })}
                    placeholder="Ex: Soja Verão 24/25"
                    data-testid="input-season-name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={newSeason.type} onValueChange={(value) => setNewSeason({ ...newSeason, type: value })}>
                      <SelectTrigger data-testid="select-season-type">
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {seasonTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Ano</Label>
                    <Input
                      type="number"
                      value={newSeason.year}
                      onChange={(e) => setNewSeason({ ...newSeason, year: parseInt(e.target.value) })}
                      data-testid="input-season-year"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Data Início</Label>
                    <Input
                      type="date"
                      value={newSeason.startDate}
                      onChange={(e) => setNewSeason({ ...newSeason, startDate: e.target.value })}
                      data-testid="input-season-start"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Data Fim</Label>
                    <Input
                      type="date"
                      value={newSeason.endDate}
                      onChange={(e) => setNewSeason({ ...newSeason, endDate: e.target.value })}
                      data-testid="input-season-end"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDialog(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => createSeasonMutation.mutate(newSeason)}
                  disabled={!newSeason.name || !newSeason.type || createSeasonMutation.isPending}
                  data-testid="button-save-barter-season"
                >
                  {createSeasonMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-center py-8">Carregando safras...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Ano</TableHead>
                <TableHead>Período</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {seasons?.map((season: any) => (
                <TableRow key={season.id}>
                  <TableCell className="font-medium">{season.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {seasonTypes.find(t => t.value === season.type)?.label || season.type}
                    </Badge>
                  </TableCell>
                  <TableCell>{season.year}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {season.startDate && season.endDate
                      ? `${new Date(season.startDate).toLocaleDateString()} - ${new Date(season.endDate).toLocaleDateString()}`
                      : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingSeason(season)}
                      data-testid={`button-edit-season-${season.id}`}
                    >
                      <Edit size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteSeasonMutation.mutate(season.id)}
                      data-testid={`button-delete-season-${season.id}`}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {editingSeason && (
        <Dialog open={!!editingSeason} onOpenChange={() => setEditingSeason(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Safra</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={editingSeason.name}
                  onChange={(e) => setEditingSeason({ ...editingSeason, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={editingSeason.type} onValueChange={(value) => setEditingSeason({ ...editingSeason, type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {seasonTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingSeason(null)}>
                Cancelar
              </Button>
              <Button
                onClick={() => updateSeasonMutation.mutate({ id: editingSeason.id, data: editingSeason })}
                disabled={updateSeasonMutation.isPending}
              >
                {updateSeasonMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}

function BarterSettingsManagement() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const { data: barterSettings, isLoading } = useQuery<BarterSettings[]>({
    queryKey: ['/api/admin/barter/settings'],
  });

  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value, description }: { key: string; value: string; description?: string }) => {
      return apiRequest("PUT", `/api/admin/barter/settings/${key}`, { value, description });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/barter/settings'] });
      toast({ title: "Configuração salva", description: "Configuração atualizada com sucesso." });
    },
    onError: () => {
      toast({ title: "Erro", description: "Erro ao salvar configuração.", variant: "destructive" });
    },
  });

  const settingsConfig = [
    { key: "sack_price", label: "Preço da Saca (USD)", description: "Preço da saca usado no cálculo", type: "number" },
    { key: "buffer_percentage", label: "Buffer de Segurança (%)", description: "Percentual de buffer aplicado ao contrato", type: "number" },
    { key: "min_products", label: "Produtos Mínimos", description: "Quantidade mínima de produtos obrigatórios", type: "number" },
    { key: "min_productivity", label: "Produtividade Mínima (sacas/ha)", description: "Produtividade mínima validada", type: "number" },
    { key: "max_productivity", label: "Produtividade Máxima (sacas/ha)", description: "Produtividade máxima validada", type: "number" },
    { key: "required_categories", label: "Categorias Obrigatórias", description: "Categorias separadas por vírgula (ex: sementes,fertilizantes)", type: "text" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configurações Barter</CardTitle>
        <CardDescription>Configure os parâmetros globais do sistema barter</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <p className="text-center py-8">Carregando configurações...</p>
        ) : (
          settingsConfig.map((config) => {
            const currentSetting = barterSettings?.find((s: any) => s.key === config.key);
            const value = settings[config.key] !== undefined ? settings[config.key] : currentSetting?.value || "";

            return (
              <div key={config.key} className="flex items-end gap-4">
                <div className="flex-1 space-y-2">
                  <Label htmlFor={config.key}>{config.label}</Label>
                  <Input
                    id={config.key}
                    type={config.type}
                    value={value}
                    onChange={(e) => setSettings({ ...settings, [config.key]: e.target.value })}
                    placeholder={currentSetting?.value || "Não configurado"}
                    data-testid={`input-setting-${config.key}`}
                  />
                  <p className="text-sm text-muted-foreground">{config.description}</p>
                </div>
                <Button
                  onClick={() => {
                    updateSettingMutation.mutate({
                      key: config.key,
                      value: settings[config.key] || currentSetting?.value || '',
                      description: config.description,
                    });
                  }}
                  disabled={updateSettingMutation.isPending}
                  data-testid={`button-save-setting-${config.key}`}
                >
                  <Save size={16} className="mr-2" />
                  Salvar
                </Button>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

function TimacManagement() {
  const [activeSubTab, setActiveSubTab] = useState("values");

  return (
    <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="space-y-4">
      <TabsList className="grid w-full grid-cols-2 max-w-xl">
        <TabsTrigger value="values">Valores por Tipo</TabsTrigger>
        <TabsTrigger value="points">Pontos dos Produtos</TabsTrigger>
      </TabsList>

      <TabsContent value="values">
        <TimacValuesManagement />
      </TabsContent>

      <TabsContent value="points">
        <TimacProductPointsManagement />
      </TabsContent>
    </Tabs>
  );
}

function TimacValuesManagement() {
  const { toast } = useToast();
  const [values, setValues] = useState({
    consultorValue: "",
    gerentesValue: "",
    faturistasValue: ""
  });

  const { data: settings, isLoading } = useQuery<any>({
    queryKey: ['/api/admin/timac-settings'],
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("PUT", "/api/admin/timac-settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/timac-settings'] });
      toast({
        title: "Valores atualizados",
        description: "Os valores por tipo de usuário foram atualizados com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao atualizar valores. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  // Update local state when settings load
  useEffect(() => {
    if (settings) {
      setValues({
        consultorValue: settings.consultorValue || "",
        gerentesValue: settings.gerentesValue || "",
        faturistasValue: settings.faturistasValue || ""
      });
    }
  }, [settings]);

  const handleSave = () => {
    updateSettingsMutation.mutate({
      consultorValue: values.consultorValue,
      gerentesValue: values.gerentesValue,
      faturistasValue: values.faturistasValue
    });
  };

  if (isLoading) {
    return <div className="text-center py-8">Carregando configurações...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Valores por Tipo de Usuário</CardTitle>
        <CardDescription>
          Configure o valor em USD de cada ponto Timac para cada tipo de usuário
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-4 max-w-md">
          <div className="space-y-2">
            <Label htmlFor="consultor-value">Valor para Consultor (USD por ponto)</Label>
            <Input
              id="consultor-value"
              type="number"
              step="0.01"
              value={values.consultorValue}
              onChange={(e) => setValues({ ...values, consultorValue: e.target.value })}
              placeholder="0.76"
              data-testid="input-consultor-value"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gerentes-value">Valor para Gerentes (USD por ponto)</Label>
            <Input
              id="gerentes-value"
              type="number"
              step="0.01"
              value={values.gerentesValue}
              onChange={(e) => setValues({ ...values, gerentesValue: e.target.value })}
              placeholder="0.76"
              data-testid="input-gerentes-value"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="faturistas-value">Valor para Faturistas (USD por ponto)</Label>
            <Input
              id="faturistas-value"
              type="number"
              step="0.01"
              value={values.faturistasValue}
              onChange={(e) => setValues({ ...values, faturistasValue: e.target.value })}
              placeholder="0.76"
              data-testid="input-faturistas-value"
            />
          </div>

          <Button
            onClick={handleSave}
            disabled={updateSettingsMutation.isPending}
            data-testid="button-save-timac-values"
          >
            <Save size={16} className="mr-2" />
            Salvar Valores
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TimacProductPointsManagement() {
  const { toast } = useToast();
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [editPoints, setEditPoints] = useState("");
  const [showNewProductModal, setShowNewProductModal] = useState(false);
  const [newProductData, setNewProductData] = useState({
    name: "",
    marca: "Timac Agro",
    timacPoints: "1",
    description: ""
  });

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ['/api/products'],
  });

  const createProductMutation = useMutation({
    mutationFn: async (productData: any) => {
      return apiRequest("POST", "/api/products", {
        name: productData.name,
        categoryId: "cat-especialidades",
        marca: productData.marca,
        timacPoints: productData.timacPoints,
        description: productData.description || null,
        isActive: true
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      toast({
        title: "Produto criado",
        description: "O produto Timac foi criado com sucesso.",
      });
      setShowNewProductModal(false);
      setNewProductData({
        name: "",
        marca: "Timac Agro",
        timacPoints: "1",
        description: ""
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao criar produto. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const updatePointsMutation = useMutation({
    mutationFn: async ({ id, timacPoints }: { id: string; timacPoints: string }) => {
      return apiRequest("PATCH", `/api/admin/products/${id}/timac-points`, { timacPoints });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      toast({
        title: "Pontos atualizados",
        description: "Os pontos Timac do produto foram atualizados com sucesso.",
      });
      setEditingProduct(null);
      setEditPoints("");
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao atualizar pontos. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const startEdit = (product: Product) => {
    setEditingProduct(product.id);
    setEditPoints(product.timacPoints || "0");
  };

  const handleSave = (productId: string) => {
    updatePointsMutation.mutate({
      id: productId,
      timacPoints: editPoints
    });
  };

  const handleCreateProduct = () => {
    if (!newProductData.name.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "O nome do produto é obrigatório.",
        variant: "destructive",
      });
      return;
    }
    createProductMutation.mutate(newProductData);
  };

  if (isLoading) {
    return <div className="text-center py-8">Carregando produtos...</div>;
  }

  // Filter products: only Timac brand AND Especialidades category
  const timacProducts = products?.filter(product => {
    const isTimacBrand = product.marca?.toLowerCase().includes('timac');
    const isEspecialidades = product.categoryId === 'cat-especialidades';
    return isTimacBrand && isEspecialidades;
  }) || [];

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>Pontos Timac dos Produtos</CardTitle>
            <CardDescription>
              Configure quantos pontos Timac cada produto gera (apenas produtos Timac da categoria Especialidades)
            </CardDescription>
          </div>
          <Dialog open={showNewProductModal} onOpenChange={setShowNewProductModal}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-timac-product">
                <Plus size={16} className="mr-2" />
                Adicionar Produto Timac
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Adicionar Produto Timac</DialogTitle>
                <DialogDescription>
                  Cadastre um novo produto Timac para calcular pontos
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="product-name">Nome do Produto *</Label>
                  <Input
                    id="product-name"
                    value={newProductData.name}
                    onChange={(e) => setNewProductData({ ...newProductData, name: e.target.value })}
                    placeholder="Ex: FERTIACTYL LEGUMINOSAS"
                    data-testid="input-product-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-marca">Marca</Label>
                  <Input
                    id="product-marca"
                    value={newProductData.marca}
                    onChange={(e) => setNewProductData({ ...newProductData, marca: e.target.value })}
                    placeholder="Timac Agro"
                    data-testid="input-product-marca"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-points">Pontos Timac por Unidade *</Label>
                  <Input
                    id="product-points"
                    type="number"
                    step="0.01"
                    value={newProductData.timacPoints}
                    onChange={(e) => setNewProductData({ ...newProductData, timacPoints: e.target.value })}
                    placeholder="1"
                    data-testid="input-product-points"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-description">Descrição (opcional)</Label>
                  <Input
                    id="product-description"
                    value={newProductData.description}
                    onChange={(e) => setNewProductData({ ...newProductData, description: e.target.value })}
                    placeholder="Informações adicionais"
                    data-testid="input-product-description"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowNewProductModal(false)}
                  data-testid="button-cancel-product"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleCreateProduct}
                  disabled={createProductMutation.isPending}
                  data-testid="button-save-product"
                >
                  {createProductMutation.isPending && <Loader2 size={16} className="mr-2 animate-spin" />}
                  Criar Produto
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">Produto</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Marca</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Pontos Timac</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {timacProducts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    Nenhum produto Timac da categoria Especialidades encontrado
                  </td>
                </tr>
              ) : (
                timacProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3 text-sm">{product.name}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{product.marca || "-"}</td>
                    <td className="px-4 py-3 text-sm">
                      {editingProduct === product.id ? (
                        <Input
                          type="number"
                          step="0.01"
                          value={editPoints}
                          onChange={(e) => setEditPoints(e.target.value)}
                          className="w-32"
                          data-testid={`input-points-${product.id}`}
                        />
                      ) : (
                        <span className="font-medium">{product.timacPoints || "0"}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editingProduct === product.id ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleSave(product.id)}
                            disabled={updatePointsMutation.isPending}
                            data-testid={`button-save-points-${product.id}`}
                          >
                            <Save size={14} className="mr-1" />
                            Salvar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingProduct(null);
                              setEditPoints("");
                            }}
                            data-testid={`button-cancel-points-${product.id}`}
                          >
                            <X size={14} className="mr-1" />
                            Cancelar
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startEdit(product)}
                          data-testid={`button-edit-points-${product.id}`}
                        >
                          <Edit size={14} className="mr-1" />
                          Editar
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}


function SeasonsManagement() {
  const { toast } = useToast();
  const [showNewSeasonModal, setShowNewSeasonModal] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    type: "",
    year: new Date().getFullYear(),
    startDate: "",
    endDate: "",
  });

  const { data: seasons, isLoading } = useQuery<Season[]>({
    queryKey: ["/api/seasons"],
  });

  const createSeasonMutation = useMutation({
    mutationFn: async (seasonData: InsertSeason) => {
      return apiRequest("POST", "/api/seasons", seasonData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/seasons"] });
      toast({
        title: "Safra cadastrada",
        description: "A safra foi cadastrada com sucesso.",
      });
      setShowNewSeasonModal(false);
      resetForm();
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao cadastrar safra. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      type: "",
      year: new Date().getFullYear(),
      startDate: "",
      endDate: "",
    });
  };

  const generateSeasonName = (type: string, year: number) => {
    switch (type) {
      case "soja_verao":
        return `Soja ${year % 100}/${(year + 1) % 100}`;
      case "soja_safrinha":
        return `Soja Safrinha ${year}`;
      case "milho":
        return `Milho ${year % 100}/${year % 100}`;
      case "trigo":
        return `Trigo ${year}`;
      default:
        return `Safra ${year}`;
    }
  };

  const handleTypeChange = (type: string) => {
    setFormData(prev => ({
      ...prev,
      type,
      name: generateSeasonName(type, prev.year),
    }));
  };

  const handleYearChange = (year: string) => {
    const yearNum = parseInt(year);
    setFormData(prev => ({
      ...prev,
      year: yearNum,
      name: prev.type ? generateSeasonName(prev.type, yearNum) : "",
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.type || !formData.startDate || !formData.endDate) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    const seasonData: InsertSeason = {
      name: formData.name,
      type: formData.type,
      year: formData.year,
      startDate: new Date(formData.startDate),
      endDate: new Date(formData.endDate),
      isActive: true,
    };

    createSeasonMutation.mutate(seasonData);
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "soja_verao": return "Soja Verão";
      case "soja_safrinha": return "Soja Safrinha";
      case "milho": return "Milho";
      case "trigo": return "Trigo";
      default: return type;
    }
  };

  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case "soja_verao": return "bg-verde/10 text-verde border-verde/20";
      case "soja_safrinha": return "bg-chart-2/10 text-chart-2 border-chart-2/20";
      case "milho": return "bg-amarela/10 text-amarela border-amarela/20";
      case "trigo": return "bg-chart-4/10 text-chart-4 border-chart-4/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getSeasonProgress = (season: Season) => {
    const now = new Date();
    const start = new Date(season.startDate);
    const end = new Date(season.endDate);

    if (now < start) return 0;
    if (now > end) return 100;

    const total = end.getTime() - start.getTime();
    const elapsed = now.getTime() - start.getTime();
    return Math.round((elapsed / total) * 100);
  };

  const totalSeasons = seasons?.length || 0;
  const activeSeasons = seasons?.filter(s => s.isActive).length || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Gestão de Safras</h2>
          <p className="text-muted-foreground">Controle de safras e períodos de plantio</p>
        </div>
        <Dialog open={showNewSeasonModal} onOpenChange={setShowNewSeasonModal}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-season">
              <Plus className="h-4 w-4 mr-2" />
              Nova Safra
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl" data-testid="new-season-modal">
            <DialogHeader>
              <DialogTitle>Nova Safra</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="type">Tipo de Safra *</Label>
                  <Select value={formData.type} onValueChange={handleTypeChange}>
                    <SelectTrigger data-testid="select-season-type">
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="soja_verao">Soja Verão</SelectItem>
                      <SelectItem value="soja_safrinha">Soja Safrinha</SelectItem>
                      <SelectItem value="milho">Milho</SelectItem>
                      <SelectItem value="trigo">Trigo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="year">Ano *</Label>
                  <Input
                    type="number"
                    min="2020"
                    max="2030"
                    value={formData.year}
                    onChange={(e) => handleYearChange(e.target.value)}
                    data-testid="input-year"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="name">Nome da Safra *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Soja 25/26"
                  data-testid="input-season-name"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startDate">Data de Início *</Label>
                  <Input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                    data-testid="input-start-date"
                  />
                </div>
                <div>
                  <Label htmlFor="endDate">Data de Fim *</Label>
                  <Input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                    data-testid="input-end-date"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowNewSeasonModal(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createSeasonMutation.isPending}>
                  {createSeasonMutation.isPending ? "Cadastrando..." : "Cadastrar Safra"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Calendar className="text-primary" size={24} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Safras</p>
                <p className="text-2xl font-bold">{totalSeasons}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-verde/10 rounded-lg flex items-center justify-center">
                <Sprout className="text-verde" size={24} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Safras Ativas</p>
                <p className="text-2xl font-bold">{activeSeasons}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-chart-2/10 rounded-lg flex items-center justify-center">
                <Target className="text-chart-2" size={24} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ano Agrícola</p>
                <p className="text-2xl font-bold">{new Date().getFullYear()}/{new Date().getFullYear() + 1}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Lista de Safras</CardTitle>
        </CardHeader>
        <CardContent>
          {seasons?.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Nenhuma safra cadastrada</p>
              <Button
                onClick={() => setShowNewSeasonModal(true)}
                className="mt-4"
                data-testid="button-first-season"
              >
                <Plus className="h-4 w-4 mr-2" />
                Cadastrar primeira safra
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Ano</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Progresso</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {seasons?.map((season) => {
                    const progress = getSeasonProgress(season);
                    const isActive = progress > 0 && progress < 100;

                    return (
                      <TableRow key={season.id} data-testid={`season-row-${season.id}`}>
                        <TableCell className="font-medium">{season.name}</TableCell>
                        <TableCell>
                          <Badge className={getTypeBadgeClass(season.type)}>
                            {getTypeLabel(season.type)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono">{season.year}</TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(season.startDate), "dd/MM/yyyy")} - {format(new Date(season.endDate), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={progress} className="flex-1 h-2" />
                            <span className="text-sm text-muted-foreground min-w-[3rem]">
                              {progress}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={season.isActive ? "default" : "secondary"}>
                            {season.isActive ? "Ativa" : "Inativa"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


function PriceTableManagement() {
  const { toast } = useToast();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [importing, setImporting] = useState(false);

  const [formData, setFormData] = useState({
    mercaderia: "",
    principioAtivo: "",
    categoria: "FUNGICIDAS",
    subcategory: "",
    dose: "",
    fabricante: "",
    precoVerde: "",
    precoAmarela: "",
    precoVermelha: "",
    unidade: "$/ha"
  });

  const { data: products, isLoading } = useQuery<any[]>({
    queryKey: ['/api/admin/price-table'],
  });

  const createProductMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/admin/price-table', data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/price-table'] });
      toast({
        title: "Sucesso!",
        description: "Produto adicionado à tabela de preços",
      });
      setShowAddModal(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao adicionar produto",
        variant: "destructive",
      });
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => {
      const response = await apiRequest('PATCH', `/api/admin/price-table/${id}`, data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/price-table'] });
      toast({
        title: "Sucesso!",
        description: "Produto atualizado",
      });
      setEditingProduct(null);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar produto",
        variant: "destructive",
      });
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/admin/price-table/${id}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/price-table'] });
      toast({
        title: "Sucesso!",
        description: "Produto excluído",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir produto",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      mercaderia: "",
      principioAtivo: "",
      categoria: "FUNGICIDAS",
      subcategory: "",
      dose: "",
      fabricante: "",
      precoVerde: "",
      precoAmarela: "",
      precoVermelha: "",
      unidade: "$/ha"
    });
  };

  const handleSubmit = () => {
    if (!formData.mercaderia || !formData.categoria) {
      toast({
        title: "Erro",
        description: "Preencha os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    if (editingProduct) {
      updateProductMutation.mutate({
        id: editingProduct.id,
        data: formData
      });
    } else {
      createProductMutation.mutate(formData);
    }
  };

  const handleEdit = (product: any) => {
    setEditingProduct(product);
    setFormData({
      mercaderia: product.mercaderia || "",
      principioAtivo: product.principioAtivo || "",
      categoria: product.categoria || "FUNGICIDAS",
      subcategory: product.subcategory || "",
      dose: product.dose || "",
      fabricante: product.fabricante || "",
      precoVerde: product.precoVerde || "",
      precoAmarela: product.precoAmarela || "",
      precoVermelha: product.precoVermelha || "",
      unidade: product.unidade || "$/ha"
    });
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/admin/price-table/import', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao importar planilha');
      }

      queryClient.invalidateQueries({ queryKey: ['/api/admin/price-table'] });

      if (result.imported === 0 && result.errors && result.errors.length > 0) {
        // Mostrar primeiro erro para diagnóstico
        const firstError = result.errors[0];
        toast({
          title: "Erro na importação",
          description: firstError.length > 200 ? firstError.substring(0, 200) + "..." : firstError,
          variant: "destructive",
        });
        console.log('Erros de importação:', result.errors);
      } else {
        toast({
          title: result.imported > 0 ? "Importação concluída!" : "Nenhum produto importado",
          description: `${result.imported} produtos importados de ${result.totalRows} linhas.${result.errors ? ` ${result.errors.length} erros encontrados.` : ''}`,
          variant: result.imported > 0 ? "default" : "destructive",
        });

        if (result.errors && result.errors.length > 0) {
          console.log('Erros de importação:', result.errors);
        }
      }
    } catch (error: any) {
      toast({
        title: "Erro na importação",
        description: error.message || "Erro ao importar planilha",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const fungicidasProducts = products?.filter(p => p.categoria === "FUNGICIDAS") || [];
  const inseticidasProducts = products?.filter(p => p.categoria === "INSETICIDAS") || [];
  const otherProducts = products?.filter(p => !["FUNGICIDAS", "INSETICIDAS"].includes(p.categoria)) || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Tabela de Preços</h2>
          <p className="text-muted-foreground">Gestão de produtos e preços para manejo</p>
        </div>
        <div className="flex gap-2">
          <div>
            <input
              type="file"
              id="excel-import"
              accept=".xlsx,.xls"
              onChange={handleFileImport}
              style={{ display: 'none' }}
              disabled={importing}
            />
            <Button
              variant="outline"
              onClick={() => document.getElementById('excel-import')?.click()}
              disabled={importing}
              data-testid="button-import-excel"
            >
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Importar Excel
                </>
              )}
            </Button>
          </div>
          <Button onClick={() => setShowAddModal(true)} data-testid="button-add-product">
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Produto
          </Button>
        </div>
      </div>

      {fungicidasProducts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Fungicidas ({fungicidasProducts.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mercadoria</TableHead>
                  <TableHead>Subcategoria</TableHead>
                  <TableHead>P.A</TableHead>
                  <TableHead>Dose</TableHead>
                  <TableHead>Fabricante</TableHead>
                  <TableHead className="text-right">Verde</TableHead>
                  <TableHead className="text-right">Amarela</TableHead>
                  <TableHead className="text-right">Vermelha</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fungicidasProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.mercadoria}</TableCell>
                    <TableCell>{product.subcategory ? <Badge variant="secondary">{product.subcategory}</Badge> : "-"}</TableCell>
                    <TableCell>{product.principioAtivo || "-"}</TableCell>
                    <TableCell className="text-sm">{product.dose || "-"}</TableCell>
                    <TableCell>{product.fabricante || "-"}</TableCell>
                    <TableCell className="text-right font-mono text-green-600">${Number(product.precoVerde).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono text-yellow-600">${Number(product.precoAmarela).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono text-red-600">${Number(product.precoVermelha).toFixed(2)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(product)}
                          data-testid={`button-edit-product-${product.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              data-testid={`button-delete-product-${product.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir o produto {product.mercaderia}?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteProductMutation.mutate(product.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {inseticidasProducts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Inseticidas ({inseticidasProducts.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mercadoria</TableHead>
                  <TableHead>Subcategoria</TableHead>
                  <TableHead>P.A</TableHead>
                  <TableHead>Dose</TableHead>
                  <TableHead>Fabricante</TableHead>
                  <TableHead className="text-right">Verde</TableHead>
                  <TableHead className="text-right">Amarela</TableHead>
                  <TableHead className="text-right">Vermelha</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inseticidasProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.mercaderia}</TableCell>
                    <TableCell>{product.subcategory ? <Badge variant="secondary">{product.subcategory}</Badge> : "-"}</TableCell>
                    <TableCell>{product.principioAtivo || "-"}</TableCell>
                    <TableCell className="text-sm">{product.dose || "-"}</TableCell>
                    <TableCell>{product.fabricante || "-"}</TableCell>
                    <TableCell className="text-right font-mono text-green-600">${Number(product.precoVerde).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono text-yellow-600">${Number(product.precoAmarela).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono text-red-600">${Number(product.precoVermelha).toFixed(2)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(product)}
                          data-testid={`button-edit-product-${product.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              data-testid={`button-delete-product-${product.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir o produto {product.mercaderia}?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteProductMutation.mutate(product.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {otherProducts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Outras Categorias ({otherProducts.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mercadoria</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Subcategoria</TableHead>
                  <TableHead>P.A</TableHead>
                  <TableHead>Fabricante</TableHead>
                  <TableHead className="text-right">Verde</TableHead>
                  <TableHead className="text-right">Amarela</TableHead>
                  <TableHead className="text-right">Vermelha</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {otherProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.mercaderia}</TableCell>
                    <TableCell><Badge variant="outline">{product.categoria}</Badge></TableCell>
                    <TableCell>{product.subcategory ? <Badge variant="secondary">{product.subcategory}</Badge> : "-"}</TableCell>
                    <TableCell>{product.principioAtivo || "-"}</TableCell>
                    <TableCell>{product.fabricante || "-"}</TableCell>
                    <TableCell className="text-right font-mono text-green-600">${Number(product.precoVerde).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono text-yellow-600">${Number(product.precoAmarela).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono text-red-600">${Number(product.precoVermelha).toFixed(2)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(product)}
                          data-testid={`button-edit-product-${product.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              data-testid={`button-delete-product-${product.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir o produto {product.mercaderia}?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteProductMutation.mutate(product.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {(!products || products.length === 0) && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Nenhum produto cadastrado</p>
            <Button onClick={() => setShowAddModal(true)} className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar primeiro produto
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={showAddModal || editingProduct !== null} onOpenChange={(open) => {
        if (!open) {
          setShowAddModal(false);
          setEditingProduct(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Editar Produto" : "Adicionar Produto"}</DialogTitle>
            <DialogDescription>
              Configure os preços do produto para verde, amarela e vermelha
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Mercadoria *</Label>
              <Input
                value={formData.mercaderia}
                onChange={(e) => setFormData({ ...formData, mercaderia: e.target.value })}
                placeholder="Nome do produto"
                data-testid="input-mercaderia"
              />
            </div>

            <div className="space-y-2">
              <Label>Princípio Ativo</Label>
              <Input
                value={formData.principioAtivo}
                onChange={(e) => setFormData({ ...formData, principioAtivo: e.target.value })}
                placeholder="P.A"
                data-testid="input-principio-ativo"
              />
            </div>

            <div className="space-y-2">
              <Label>Categoria *</Label>
              <Select
                value={formData.categoria}
                onValueChange={(value) => setFormData({ ...formData, categoria: value })}
              >
                <SelectTrigger data-testid="select-categoria">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FUNGICIDAS">Fungicidas</SelectItem>
                  <SelectItem value="INSETICIDAS">Inseticidas</SelectItem>
                  <SelectItem value="TS">TS</SelectItem>
                  <SelectItem value="DESSECAÇÃO">Dessecação</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Subcategoria</Label>
              <Select
                value={formData.subcategory || undefined}
                onValueChange={(value) => setFormData({ ...formData, subcategory: value })}
              >
                <SelectTrigger data-testid="select-subcategory">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Fungicidas">Fungicidas</SelectItem>
                  <SelectItem value="Inseticidas">Inseticidas</SelectItem>
                  <SelectItem value="TS">TS</SelectItem>
                  <SelectItem value="Dessecação">Dessecação</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Dose</Label>
              <Input
                value={formData.dose}
                onChange={(e) => setFormData({ ...formData, dose: e.target.value })}
                placeholder="Ex: 1 L/Ha"
                data-testid="input-dose"
              />
            </div>

            <div className="space-y-2">
              <Label>Fabricante</Label>
              <Input
                value={formData.fabricante}
                onChange={(e) => setFormData({ ...formData, fabricante: e.target.value })}
                placeholder="Nome do fabricante"
                data-testid="input-fabricante"
              />
            </div>

            <div className="space-y-2">
              <Label>Unidade</Label>
              <Select
                value={formData.unidade}
                onValueChange={(value) => setFormData({ ...formData, unidade: value })}
              >
                <SelectTrigger data-testid="select-unidade">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="$/ha">$/ha</SelectItem>
                  <SelectItem value="$/L/Ha">$/L/Ha</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Preço Verde</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.precoVerde}
                onChange={(e) => setFormData({ ...formData, precoVerde: e.target.value })}
                placeholder="0.00"
                data-testid="input-preco-verde"
              />
            </div>

            <div className="space-y-2">
              <Label>Preço Amarela</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.precoAmarela}
                onChange={(e) => setFormData({ ...formData, precoAmarela: e.target.value })}
                placeholder="0.00"
                data-testid="input-preco-amarela"
              />
            </div>

            <div className="space-y-2">
              <Label>Preço Vermelha</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.precoVermelha}
                onChange={(e) => setFormData({ ...formData, precoVermelha: e.target.value })}
                placeholder="0.00"
                data-testid="input-preco-vermelha"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddModal(false);
                setEditingProduct(null);
                resetForm();
              }}
              data-testid="button-cancel-product"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createProductMutation.isPending || updateProductMutation.isPending}
              data-testid="button-save-product"
            >
              {(createProductMutation.isPending || updateProductMutation.isPending) ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SystemManagement() {
  const { toast } = useToast();
  const [allowRegistration, setAllowRegistration] = useState(true);

  const { data: settings, isLoading } = useQuery<any>({
    queryKey: ['/api/admin/system-settings'],
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: { allowUserRegistration: boolean }) => {
      return apiRequest("PATCH", "/api/admin/system-settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/system-settings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/system-settings'] });
      toast({
        title: "Configurações atualizadas",
        description: "As configurações do sistema foram atualizadas com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao atualizar configurações. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  // Update local state when settings load
  useEffect(() => {
    if (settings) {
      setAllowRegistration(settings.allowUserRegistration ?? true);
    }
  }, [settings]);

  const handleToggleRegistration = (checked: boolean) => {
    setAllowRegistration(checked);
    updateSettingsMutation.mutate({ allowUserRegistration: checked });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Configurações do Sistema</h2>
        <p className="text-muted-foreground">Gerencie as configurações globais do sistema</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Autenticação</CardTitle>
          <CardDescription>Controle o acesso e cadastro de novos usuários</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="allow-registration" className="text-base">Permitir Cadastro de Novos Usuários</Label>
              <p className="text-sm text-muted-foreground">
                Quando desabilitado, o botão "Cadastre-se" será removido da tela de login
              </p>
            </div>
            <Switch
              id="allow-registration"
              checked={allowRegistration}
              onCheckedChange={handleToggleRegistration}
              disabled={updateSettingsMutation.isPending}
              data-testid="switch-allow-registration"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
