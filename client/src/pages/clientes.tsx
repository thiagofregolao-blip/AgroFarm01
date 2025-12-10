import Navbar from "@/components/layout/navbar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, Edit, Users, MapPin, TrendingUp, FileSpreadsheet, Upload, Trash2, Users2 } from "lucide-react";
import type { Client, Region, InsertClient } from "@shared/schema";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";

function FamilyGroupBadge({ clientId }: { clientId: string }) {
  const { data: familyRelations } = useQuery<string[]>({
    queryKey: ["/api/clients", clientId, "family"],
  });

  const familyCount = (familyRelations?.length || 0) + 1;

  if (!familyRelations || familyRelations.length === 0) {
    return null;
  }

  return (
    <Badge variant="outline" className="ml-2" data-testid={`badge-family-${clientId}`}>
      <Users2 className="h-3 w-3 mr-1" />
      Grupo ({familyCount})
    </Badge>
  );
}

export default function Clientes() {
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("");
  const [showTop8020Only, setShowTop8020Only] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [familyRelations, setFamilyRelations] = useState<string[]>([]);
  const [selectedVendedorId, setSelectedVendedorId] = useState<string>("");
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    regionId: "",
    plantingArea: "",
    cultures: "",
    plantingProgress: "0",
    isTop80_20: false,
    includeInMarketArea: false,
  });

  const { data: clients, isLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: regions } = useQuery<Region[]>({
    queryKey: ["/api/regions"],
  });

  const { data: analytics } = useQuery<{
    totalSales: number;
    totalCommissions: number;
    salesByCategory: { categoryId: string; categoryName: string; total: number; commissions: number }[];
    topClients: { clientId: string; clientName: string; total: number; percentage: number }[];
  }>({
    queryKey: ["/api/analytics/sales"],
  });

  const { data: vendedores } = useQuery<{ id: string; username: string; name?: string; role: string }[]>({
    queryKey: ["/api/admin/vendedores"],
  });

  const createClientMutation = useMutation({
    mutationFn: async (clientData: InsertClient) => {
      return apiRequest("POST", "/api/clients", clientData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          query.queryKey[0] === "/api/clients" || 
          (typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/clients"))
      });
      toast({
        title: "Cliente cadastrado",
        description: "O cliente foi cadastrado com sucesso.",
      });
      setShowNewClientModal(false);
      resetForm();
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao cadastrar cliente. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const updateClientMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertClient> }) => {
      return apiRequest("PATCH", `/api/clients/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          query.queryKey[0] === "/api/clients" || 
          (typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/clients"))
      });
      queryClient.invalidateQueries({ predicate: (query) => 
        query.queryKey[0]?.toString().startsWith('/api/market-percentage/') ?? false
      });
      toast({
        title: "Cliente atualizado",
        description: "As informações do cliente foram atualizadas.",
      });
      setEditingClient(null);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao atualizar cliente. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const deleteClientMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/clients/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          query.queryKey[0] === "/api/clients" || 
          (typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/clients"))
      });
      toast({
        title: "Cliente excluído",
        description: "O cliente foi excluído com sucesso.",
      });
      setClientToDelete(null);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao excluir cliente. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const { data: familyRelationsData } = useQuery<string[]>({
    queryKey: ["/api/clients", editingClient?.id, "family"],
    enabled: !!editingClient?.id,
  });

  const addFamilyRelationMutation = useMutation({
    mutationFn: async ({ clientId, relatedClientId }: { clientId: string; relatedClientId: string }) => {
      return apiRequest("POST", `/api/clients/${clientId}/family`, { relatedClientId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", editingClient?.id, "family"] });
      toast({
        title: "Relação adicionada",
        description: "Cliente vinculado ao grupo familiar.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao adicionar relação familiar.",
        variant: "destructive",
      });
    },
  });

  const removeFamilyRelationMutation = useMutation({
    mutationFn: async ({ clientId, relatedId }: { clientId: string; relatedId: string }) => {
      return apiRequest("DELETE", `/api/clients/${clientId}/family/${relatedId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", editingClient?.id, "family"] });
      toast({
        title: "Relação removida",
        description: "Cliente desvinculado do grupo familiar.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao remover relação familiar.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      regionId: "",
      plantingArea: "",
      cultures: "",
      plantingProgress: "0",
      isTop80_20: false,
      includeInMarketArea: false,
    });
  };

  useEffect(() => {
    if (editingClient) {
      setFormData({
        name: editingClient.name,
        regionId: editingClient.regionId,
        plantingArea: editingClient.plantingArea,
        cultures: Array.isArray(editingClient.cultures) ? editingClient.cultures.join(", ") : "",
        plantingProgress: editingClient.plantingProgress,
        isTop80_20: editingClient.isTop80_20,
        includeInMarketArea: editingClient.includeInMarketArea || false,
      });
    }
  }, [editingClient]);

  useEffect(() => {
    if (familyRelationsData) {
      setFamilyRelations(familyRelationsData);
    }
  }, [familyRelationsData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.regionId || !formData.plantingArea) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    const clientData: InsertClient = {
      name: formData.name,
      regionId: formData.regionId,
      plantingArea: formData.plantingArea,
      cultures: formData.cultures.split(",").map(c => c.trim()).filter(c => c),
      plantingProgress: formData.plantingProgress,
      isTop80_20: formData.isTop80_20,
      isActive: true,
    };

    createClientMutation.mutate(clientData);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingClient || !formData.name || !formData.regionId || !formData.plantingArea) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    const clientData: Partial<InsertClient> = {
      name: formData.name,
      regionId: formData.regionId,
      plantingArea: formData.plantingArea,
      cultures: formData.cultures.split(",").map(c => c.trim()).filter(c => c),
      plantingProgress: formData.plantingProgress,
      isTop80_20: formData.isTop80_20,
    };

    updateClientMutation.mutate({ id: editingClient.id, data: clientData });
  };

  const toggleClient8020 = async (client: Client) => {
    const newStatus = !client.isTop80_20;
    updateClientMutation.mutate({ 
      id: client.id, 
      data: { isTop80_20: newStatus } 
    });
    
    toast({
      title: newStatus ? "Cliente marcado como 80/20" : "Cliente desmarcado como 80/20",
      description: `${client.name} ${newStatus ? 'agora é' : 'não é mais'} um cliente 80/20`,
    });
  };

  const toggleClientMarketArea = async (client: Client) => {
    const newStatus = !client.includeInMarketArea;
    updateClientMutation.mutate({ 
      id: client.id, 
      data: { includeInMarketArea: newStatus } 
    });
    
    toast({
      title: newStatus ? "Cliente incluído no mercado" : "Cliente removido do mercado",
      description: `${client.name} ${newStatus ? 'agora está' : 'não está mais'} no mercado`,
    });
  };

  const handleFamilyRelationToggle = (relatedClientId: string, isChecked: boolean) => {
    if (!editingClient) return;

    if (isChecked) {
      addFamilyRelationMutation.mutate({
        clientId: editingClient.id,
        relatedClientId,
      });
    } else {
      removeFamilyRelationMutation.mutate({
        clientId: editingClient.id,
        relatedId: relatedClientId,
      });
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!selectedVendedorId) {
      toast({
        title: "Vendedor não selecionado",
        description: "Por favor, selecione um vendedor antes de importar",
        variant: "destructive",
      });
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

      if (!response.ok) {
        throw new Error(result.message || 'Erro ao importar clientes');
      }

      queryClient.invalidateQueries({ 
        predicate: (query) => 
          query.queryKey[0] === "/api/clients" || 
          (typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/clients"))
      });
      
      toast({
        title: "Importação concluída",
        description: `${result.created || 0} clientes criados, ${result.updated || 0} atualizados`,
      });
      
      setShowImportModal(false);
      setSelectedVendedorId("");
    } catch (error: any) {
      toast({
        title: "Erro na importação",
        description: error.message || "Erro ao importar arquivo Excel",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      // Reset file input
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const getRegionName = (regionId: string) => {
    return regions?.find(r => r.id === regionId)?.name || "Região não encontrada";
  };

  const getClientSales = (clientId: string) => {
    const clientSales = analytics?.topClients?.find((c: any) => c.clientId === clientId);
    return clientSales ? clientSales.total : 0;
  };

  const filteredClients = clients?.filter(client => {
    const nameMatch = client.name.toLowerCase().includes(searchTerm.toLowerCase());
    const regionMatch = !selectedRegion || selectedRegion === "all" || client.regionId === selectedRegion;
    return nameMatch && regionMatch;
  }).sort((a, b) => a.name.localeCompare(b.name)) || [];

  const totalClients = clients?.length || 0;
  const top8020Clients = clients?.filter(c => c.isTop80_20).length || 0;
  const totalPlantingArea = clients?.reduce((sum, client) => {
    const area = parseFloat(client.plantingArea || '0');
    return sum + (isNaN(area) ? 0 : area);
  }, 0) || 0;
  const top8020PlantingArea = clients?.filter(c => c.isTop80_20).reduce((sum, client) => {
    const area = parseFloat(client.plantingArea || '0');
    return sum + (isNaN(area) ? 0 : area);
  }, 0) || 0;
  const marketAreaTotal = clients?.filter(c => c.includeInMarketArea).reduce((sum, client) => {
    const area = parseFloat(client.plantingArea || '0');
    return sum + (isNaN(area) ? 0 : area);
  }, 0) || 0;

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" data-testid="clientes-container">
      <Header 
        onNewSale={() => {}}
        title="Gestão de Clientes"
        subtitle="Cadastro e acompanhamento da carteira de clientes"
      />
      <Navbar />
      
      <main className="flex-1 overflow-y-auto">

        <div className="p-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
            <Card className="shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Users className="text-primary" size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total de Clientes</p>
                    <p className="text-2xl font-bold">{totalClients}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                    <MapPin className="text-accent" size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Área Total</p>
                    <p className="text-2xl font-bold">{totalPlantingArea.toLocaleString()} ha</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-chart-2/10 rounded-lg flex items-center justify-center">
                    <TrendingUp className="text-chart-2" size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Clientes 80/20</p>
                    <p className="text-2xl font-bold">{top8020Clients}</p>
                    <p className="text-xs text-muted-foreground">
                      {totalClients > 0 ? ((top8020Clients / totalClients) * 100).toFixed(1) : 0}% do total
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-orange-100 dark:bg-orange-950 rounded-lg flex items-center justify-center">
                    <MapPin className="text-orange-600 dark:text-orange-400" size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Área 80/20</p>
                    <p className="text-2xl font-bold">{top8020PlantingArea.toLocaleString()} ha</p>
                    <p className="text-xs text-muted-foreground">
                      {totalPlantingArea > 0 ? ((top8020PlantingArea / totalPlantingArea) * 100).toFixed(1) : 0}% do total
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-950 rounded-lg flex items-center justify-center">
                    <MapPin className="text-green-600 dark:text-green-400" size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Área de Mercado</p>
                    <p className="text-2xl font-bold">{marketAreaTotal.toLocaleString()} ha</p>
                    <p className="text-xs text-muted-foreground">
                      {totalPlantingArea > 0 ? ((marketAreaTotal / totalPlantingArea) * 100).toFixed(1) : 0}% do total
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters and Actions */}
          <Card className="shadow-sm mb-8">
            <CardHeader>
              <CardTitle>Filtros e Ações</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-64">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome do cliente..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                      data-testid="search-clients"
                    />
                  </div>
                </div>

                <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                  <SelectTrigger className="w-48" data-testid="filter-region">
                    <SelectValue placeholder="Filtrar por região" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as regiões</SelectItem>
                    {regions?.map((region) => (
                      <SelectItem key={region.id} value={region.id}>
                        {region.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex gap-2">
                  <Button
                    variant={showTop8020Only ? "default" : "outline"}
                    onClick={() => setShowTop8020Only(!showTop8020Only)}
                    data-testid="toggle-top-clients"
                  >
                    {showTop8020Only ? "Mostrar Todos" : "Apenas 80/20"}
                  </Button>
                  
                  <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
                    <DialogTrigger asChild>
                      <Button variant="outline" data-testid="button-import-clients">
                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                        Importar Clientes
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md" data-testid="import-clients-modal">
                      <DialogHeader>
                        <DialogTitle>Importar Clientes do Excel</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
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

                        <div className="space-y-2">
                          <Label htmlFor="vendedor-select">Selecionar Vendedor *</Label>
                          <Select value={selectedVendedorId} onValueChange={setSelectedVendedorId}>
                            <SelectTrigger data-testid="select-vendedor">
                              <SelectValue placeholder="Escolha o vendedor" />
                            </SelectTrigger>
                            <SelectContent>
                              {vendedores?.map((vendedor) => (
                                <SelectItem key={vendedor.id} value={vendedor.id}>
                                  {vendedor.name || vendedor.username}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center">
                          <input
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={handleFileUpload}
                            disabled={uploading}
                            className="hidden"
                            id="client-file-upload"
                            data-testid="input-file-upload"
                          />
                          <label 
                            htmlFor="client-file-upload" 
                            className={`cursor-pointer flex flex-col items-center gap-3 ${uploading ? 'opacity-50' : ''}`}
                          >
                            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                              <Upload className="text-primary" size={24} />
                            </div>
                            <div>
                              <p className="font-medium">
                                {uploading ? "Importando..." : "Clique para selecionar arquivo"}
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
                  
                  <Dialog open={showNewClientModal} onOpenChange={setShowNewClientModal}>
                    <DialogTrigger asChild>
                      <Button data-testid="button-new-client">
                        <Plus className="h-4 w-4 mr-2" />
                        Novo Cliente
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl" data-testid="new-client-modal">
                      <DialogHeader>
                        <DialogTitle>Novo Cliente</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="name">Nome do Cliente *</Label>
                            <Input
                              value={formData.name}
                              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                              data-testid="input-client-name"
                            />
                          </div>
                          <div>
                            <Label htmlFor="region">Região *</Label>
                            <Select value={formData.regionId} onValueChange={(value) => 
                              setFormData(prev => ({ ...prev, regionId: value }))
                            }>
                              <SelectTrigger data-testid="select-region">
                                <SelectValue placeholder="Selecione a região" />
                              </SelectTrigger>
                              <SelectContent>
                                {regions?.map((region) => (
                                  <SelectItem key={region.id} value={region.id}>
                                    {region.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="plantingArea">Área de Plantio (ha) *</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={formData.plantingArea}
                              onChange={(e) => setFormData(prev => ({ ...prev, plantingArea: e.target.value }))}
                              data-testid="input-planting-area"
                            />
                          </div>
                          <div>
                            <Label htmlFor="plantingProgress">Progresso de Plantio (%)</Label>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              value={formData.plantingProgress}
                              onChange={(e) => setFormData(prev => ({ ...prev, plantingProgress: e.target.value }))}
                              data-testid="input-planting-progress"
                            />
                          </div>
                        </div>

                        <div>
                          <Label htmlFor="cultures">Culturas (separadas por vírgula)</Label>
                          <Input
                            placeholder="Ex: Soja, Milho, Trigo"
                            value={formData.cultures}
                            onChange={(e) => setFormData(prev => ({ ...prev, cultures: e.target.value }))}
                            data-testid="input-cultures"
                          />
                        </div>

                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="isTop8020"
                            checked={formData.isTop80_20}
                            onChange={(e) => setFormData(prev => ({ ...prev, isTop80_20: e.target.checked }))}
                            data-testid="checkbox-top-client"
                          />
                          <Label htmlFor="isTop8020">Cliente 80/20 (principal contribuinte)</Label>
                        </div>

                        <div className="flex justify-end gap-3 pt-4">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowNewClientModal(false)}
                            data-testid="button-cancel"
                          >
                            Cancelar
                          </Button>
                          <Button
                            type="submit"
                            disabled={createClientMutation.isPending}
                            data-testid="button-save"
                          >
                            {createClientMutation.isPending ? "Salvando..." : "Salvar Cliente"}
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Edit Client Modal */}
          <Dialog open={!!editingClient} onOpenChange={(open) => {
            if (!open) {
              setEditingClient(null);
              resetForm();
            }
          }}>
            <DialogContent className="max-w-2xl" data-testid="edit-client-modal">
              <DialogHeader>
                <DialogTitle>Editar Cliente</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-name">Nome do Cliente *</Label>
                    <Input
                      id="edit-name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      data-testid="input-edit-client-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-region">Região *</Label>
                    <Select value={formData.regionId} onValueChange={(value) => 
                      setFormData(prev => ({ ...prev, regionId: value }))
                    }>
                      <SelectTrigger data-testid="select-edit-region">
                        <SelectValue placeholder="Selecione a região" />
                      </SelectTrigger>
                      <SelectContent>
                        {regions?.map((region) => (
                          <SelectItem key={region.id} value={region.id}>
                            {region.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-plantingArea">Área de Plantio (ha) *</Label>
                    <Input
                      id="edit-plantingArea"
                      type="number"
                      step="0.01"
                      value={formData.plantingArea}
                      onChange={(e) => setFormData(prev => ({ ...prev, plantingArea: e.target.value }))}
                      data-testid="input-edit-planting-area"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-plantingProgress">Progresso de Plantio (%)</Label>
                    <Input
                      id="edit-plantingProgress"
                      type="number"
                      min="0"
                      max="100"
                      value={formData.plantingProgress}
                      onChange={(e) => setFormData(prev => ({ ...prev, plantingProgress: e.target.value }))}
                      data-testid="input-edit-planting-progress"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="edit-cultures">Culturas (separadas por vírgula)</Label>
                  <Input
                    id="edit-cultures"
                    placeholder="Ex: Soja, Milho, Trigo"
                    value={formData.cultures}
                    onChange={(e) => setFormData(prev => ({ ...prev, cultures: e.target.value }))}
                    data-testid="input-edit-cultures"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="edit-isTop8020"
                    checked={formData.isTop80_20}
                    onChange={(e) => setFormData(prev => ({ ...prev, isTop80_20: e.target.checked }))}
                    data-testid="checkbox-edit-top-client"
                  />
                  <Label htmlFor="edit-isTop8020">Cliente 80/20 (principal contribuinte)</Label>
                </div>

                <div className="border-t pt-4 mt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Users2 className="h-5 w-5 text-muted-foreground" />
                    <Label className="text-base font-semibold">Grupo Familiar</Label>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Vincular clientes da mesma família (área compartilhada nos cálculos)
                  </p>
                  <div className="max-h-60 overflow-y-auto border rounded-md p-3 space-y-2">
                    {clients?.filter(c => c.id !== editingClient?.id).length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhum outro cliente disponível
                      </p>
                    ) : (
                      clients?.filter(c => c.id !== editingClient?.id).map(client => (
                        <div key={client.id} className="flex items-center space-x-2" data-testid={`family-relation-${client.id}`}>
                          <Checkbox
                            id={`family-${client.id}`}
                            checked={familyRelations.includes(client.id)}
                            onCheckedChange={(checked) => handleFamilyRelationToggle(client.id, checked as boolean)}
                            data-testid={`checkbox-family-${client.id}`}
                          />
                          <Label
                            htmlFor={`family-${client.id}`}
                            className="text-sm font-normal cursor-pointer flex-1"
                          >
                            {client.name}
                            <span className="text-muted-foreground ml-2">
                              ({getRegionName(client.regionId)})
                            </span>
                          </Label>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditingClient(null)}
                    data-testid="button-cancel-edit"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={updateClientMutation.isPending}
                    data-testid="button-save-edit"
                  >
                    {updateClientMutation.isPending ? "Salvando..." : "Salvar Alterações"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          {/* Clients Table */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Lista de Clientes</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredClients.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">Nenhum cliente encontrado</p>
                  <Button 
                    onClick={() => setShowNewClientModal(true)} 
                    className="mt-4"
                    data-testid="button-first-client"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Cadastrar primeiro cliente
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Região</TableHead>
                        <TableHead>Área (ha)</TableHead>
                        <TableHead>Culturas</TableHead>
                        <TableHead>Progresso</TableHead>
                        <TableHead className="text-right">Vendas (USD)</TableHead>
                        <TableHead className="text-center">80/20</TableHead>
                        <TableHead className="text-center">Mercado</TableHead>
                        <TableHead className="text-center">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredClients.map((client) => (
                        <TableRow key={client.id} data-testid={`client-row-${client.id}`}>
                          <TableCell className="font-medium">
                            <div className="flex items-center">
                              {client.name}
                              <FamilyGroupBadge clientId={client.id} />
                            </div>
                          </TableCell>
                          <TableCell>{getRegionName(client.regionId)}</TableCell>
                          <TableCell className="font-mono">
                            {parseFloat(client.plantingArea).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {(Array.isArray(client.cultures) ? client.cultures : []).map((culture: string, index: number) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  {culture}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-muted rounded-full h-2">
                                <div
                                  className="progress-bar-fill bg-primary h-full rounded-full"
                                  style={{ width: `${client.plantingProgress}%` }}
                                />
                              </div>
                              <span className="text-sm font-mono">{client.plantingProgress}%</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            ${getClientSales(client.id).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge 
                              onClick={() => toggleClient8020(client)}
                              className={`cursor-pointer transition-all hover:scale-105 ${
                                client.isTop80_20 
                                  ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                                  : 'bg-white dark:bg-white text-black dark:text-black border border-input hover:bg-white/80 dark:hover:bg-white/80'
                              }`}
                              data-testid={`badge-8020-${client.id}`}
                            >
                              80/20
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge 
                              onClick={() => toggleClientMarketArea(client)}
                              style={{
                                backgroundColor: client.includeInMarketArea ? '#F7D601' : 'white',
                                color: client.includeInMarketArea ? 'black' : 'black',
                                border: client.includeInMarketArea ? 'none' : '1px solid hsl(var(--input))'
                              }}
                              className="cursor-pointer transition-all hover:scale-105"
                              data-testid={`badge-market-${client.id}`}
                            >
                              Mercado
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingClient(client)}
                                data-testid={`button-edit-${client.id}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setClientToDelete(client)}
                                data-testid={`button-delete-${client.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!clientToDelete} onOpenChange={(open) => !open && setClientToDelete(null)}>
        <AlertDialogContent data-testid="delete-client-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o cliente <strong>{clientToDelete?.name}</strong>? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancelar</AlertDialogCancel>
            <Button
              onClick={() => {
                if (clientToDelete) {
                  deleteClientMutation.mutate(clientToDelete.id);
                }
              }}
              disabled={deleteClientMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteClientMutation.isPending ? "Excluindo..." : "Excluir"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
