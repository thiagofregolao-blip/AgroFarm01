import Navbar from "@/components/layout/navbar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Edit, Save, X, Percent, TrendingUp, BarChart, Upload, FileSpreadsheet, Trash2 } from "lucide-react";
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { Category } from "@shared/schema";

export default function Comissoes() {
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<any>({});
  const [showImportModal, setShowImportModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>("");
  const { toast } = useToast();

  const { data: user } = useQuery<{ role: string }>({
    queryKey: ["/api/user"],
  });

  const isAdmin = user?.role === "administrador";

  const { data: categories, isLoading } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: analytics } = useQuery<{
    totalSales: number;
    totalCommissions: number;
    salesByCategory: { categoryId: string; categoryName: string; total: number; commissions: number }[];
    topClients: { clientId: string; clientName: string; total: number; percentage: number }[];
  }>({
    queryKey: ["/api/analytics/sales"],
  });

  const { data: importBatches, isLoading: batchesLoading } = useQuery<Array<{
    batchId: string;
    importDate: Date;
    salesCount: number;
    totalAmount: number;
    totalCommissions: number;
  }>>({
    queryKey: ["/api/sales/import-batches"],
  });

  const { data: seasons } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/seasons"],
  });

  const { data: timacPoints } = useQuery<{
    totalPoints: string;
    rewardPerPoint: string;
    totalReward: string;
    currency: string;
  }>({
    queryKey: ["/api/timac-points"],
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

  const deleteBatchMutation = useMutation({
    mutationFn: async (batchId: string) => {
      return apiRequest("DELETE", `/api/sales/import-batches/${batchId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales/import-batches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/sales"] });
      toast({
        title: "Lote excluído",
        description: "O lote de vendas foi excluído com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao excluir o lote. Tente novamente.",
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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!selectedSeasonId) {
      toast({
        title: "Safra não selecionada",
        description: "Por favor, selecione uma safra antes de fazer o upload.",
        variant: "destructive",
      });
      event.target.value = '';
      return;
    }

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast({
        title: "Arquivo inválido",
        description: "Por favor, selecione um arquivo Excel (.xlsx ou .xls)",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('seasonId', selectedSeasonId);

      const response = await fetch('/api/sales/import-excel', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        const duplicateMsg = result.skippedDuplicates > 0 
          ? ` ${result.skippedDuplicates} pedido(s) duplicado(s) ignorado(s).` 
          : '';
        
        toast({
          title: "Importação concluída!",
          description: `${result.importedSales} vendas importadas com sucesso. ${result.createdClients} novos clientes, ${result.createdProducts} novos produtos criados.${duplicateMsg}`,
        });
        
        queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
        queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
        queryClient.invalidateQueries({ queryKey: ["/api/products"] });
        queryClient.invalidateQueries({ queryKey: ["/api/analytics/sales"] });
        queryClient.invalidateQueries({ queryKey: ["/api/sales/import-batches"] });
        
        setShowImportModal(false);
        setSelectedSeasonId("");
      } else {
        toast({
          title: "Erro na importação",
          description: result.message || "Verifique o arquivo e tente novamente.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro ao importar",
        description: "Erro ao processar o arquivo. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const getTierBadgeClass = (tier: string) => {
    switch (tier) {
      case 'verde': return 'badge-verde';
      case 'amarela': return 'badge-amarela'; 
      case 'vermelha': return 'badge-vermelha';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getCategoryColor = (categoryName: string) => {
    const normalized = categoryName.toLowerCase();
    if (normalized.includes('agroquímico') || normalized.includes('agroquimico')) return '#ef4444'; // vermelho
    if (normalized.includes('fertilizante')) return '#3b82f6'; // azul
    if (normalized.includes('especialidade')) return '#22c55e'; // verde
    if (normalized.includes('semente') || normalized.includes('semilla')) return '#eab308'; // amarelo
    return '#8b5cf6'; // roxo padrão
  };

  const chartData = analytics?.salesByCategory?.map((item: any) => ({
    name: item.categoryName,
    value: item.commissions,
    fill: getCategoryColor(item.categoryName),
  })) || [];

  const totalCommissions = analytics?.totalCommissions || 0;

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" data-testid="comissoes-container">
      <Header 
        onNewSale={() => {}}
        title="Gestão de Comissões"
        subtitle="Configuração e acompanhamento de comissões por categoria"
      />
      <Navbar />
      
      <main className="flex-1 overflow-y-auto">

        <div className="p-4 md:p-8">
          {/* Import Button */}
          <div className="flex justify-end mb-6">
            <Button
              onClick={() => setShowImportModal(true)}
              className="gap-2"
              data-testid="button-import-excel"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Importar Excel
            </Button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
            <Card className="shadow-sm">
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-verde/10 rounded-lg flex items-center justify-center">
                    <Percent className="text-verde" size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Comissões Totais</p>
                    <p className="text-2xl font-bold font-mono text-verde">
                      ${totalCommissions.toLocaleString()}
                    </p>
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
                    <p className="text-sm text-muted-foreground">Categorias Ativas</p>
                    <p className="text-2xl font-bold">{categories?.length || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                    <BarChart className="text-accent" size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Maior Comissão</p>
                    <p className="text-2xl font-bold">4,00%</p>
                    <p className="text-xs text-muted-foreground">Especialidades</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Commission Chart and Batch Management Side by Side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-6 md:mb-8">
            {/* Commission Chart */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Comissões por Categoria</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="name" 
                        tick={{ fontSize: 12 }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip 
                        formatter={(value: number) => [`$${value.toLocaleString()}`, 'Comissão']}
                      />
                      <Bar 
                        dataKey="value" 
                        radius={[4, 4, 0, 0]}
                      />
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Imported Batches Management */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" />
                  Gerenciamento de Planilhas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80 overflow-y-auto">
                  {batchesLoading ? (
                    <p className="text-muted-foreground text-center py-4">Carregando...</p>
                  ) : importBatches && importBatches.length > 0 ? (
                    <div className="space-y-2">
                      {importBatches.map((batch) => (
                        <div
                          key={batch.batchId}
                          className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                          data-testid={`batch-${batch.batchId}`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-4">
                              <div>
                                <p className="font-medium">
                                  Importado em {new Date(batch.importDate).toLocaleDateString('pt-BR', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {batch.salesCount} vendas • ${batch.totalAmount.toLocaleString()} • 
                                  Comissão: ${batch.totalCommissions.toLocaleString()}
                                </p>
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm('Tem certeza que deseja excluir este lote de vendas?')) {
                                deleteBatchMutation.mutate(batch.batchId);
                              }
                            }}
                            data-testid={`button-delete-batch-${batch.batchId}`}
                            disabled={deleteBatchMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">
                      Nenhuma planilha importada ainda. Use o botão "Importar Excel" acima para fazer upload de vendas.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Commission Configuration Table */}
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Configuração de Comissões</CardTitle>
              <div className="flex gap-2">
                {isAdmin && editingCategory && (
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
                      {isAdmin && <TableHead className="text-center">Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories?.map((category) => (
                      <TableRow key={category.id} data-testid={`commission-row-${category.id}`}>
                        <TableCell className="font-medium">{category.name}</TableCell>
                        
                        {/* Verde Commission */}
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
                            <Badge className="badge-verde font-mono">
                              {parseFloat(category.greenCommission).toFixed(2)}%
                            </Badge>
                          )}
                        </TableCell>
                        
                        {/* Verde Margin */}
                        <TableCell className="text-center text-xs">
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
                        
                        {/* Amarela Commission */}
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
                            <Badge className="badge-amarela font-mono">
                              {parseFloat(category.yellowCommission).toFixed(2)}%
                            </Badge>
                          )}
                        </TableCell>
                        
                        {/* Amarela Margin */}
                        <TableCell className="text-center text-xs">
                          {editingCategory === category.id ? (
                            <div className="flex gap-1">
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
                        
                        {/* Vermelha Commission */}
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
                            <Badge className="badge-vermelha font-mono">
                              {parseFloat(category.redCommission).toFixed(2)}%
                            </Badge>
                          )}
                        </TableCell>
                        
                        {/* Vermelha Margin */}
                        <TableCell className="text-center text-xs">
                          {editingCategory === category.id ? (
                            <div className="flex gap-1">
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
                        
                        {/* Below List Commission */}
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
                            <Badge variant="outline" className="font-mono">
                              {parseFloat(category.belowListCommission).toFixed(2)}%
                            </Badge>
                          )}
                        </TableCell>
                        
                        {/* Actions */}
                        {isAdmin && (
                          <TableCell className="text-center">
                            {editingCategory === category.id ? (
                              <span className="text-sm text-blue-600">Editando...</span>
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
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Import Excel Modal */}
      <Dialog open={showImportModal} onOpenChange={(open) => {
        setShowImportModal(open);
        if (!open) setSelectedSeasonId("");
      }}>
        <DialogContent className="sm:max-w-md" data-testid="import-excel-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Importar Planilha Excel
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="text-sm text-muted-foreground">
              <p className="mb-2">Selecione um arquivo Excel com as seguintes colunas:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li><strong>Entidad</strong> - Nome do cliente</li>
                <li><strong>Tabla de Precio</strong> - Verde/Amarela/Vermelha/Abaixo de Lista/Barter</li>
                <li><strong>Mercadería</strong> - Nome do produto</li>
                <li><strong>Subgrupo</strong> - Categoria do produto</li>
                <li><strong>Vl.Unitario Medio</strong> - Preço unitário</li>
                <li><strong>Cant. Pedido</strong> - Quantidade</li>
                <li><strong>Vl. Pedido</strong> - Valor total</li>
                <li><strong>Fecha Venc.</strong> - Data de vencimento</li>
                <li><strong>Fecha Emisión</strong> - Data da venda</li>
              </ul>
            </div>

            <div className="space-y-2">
              <label htmlFor="season-select" className="text-sm font-medium text-foreground">
                Safra <span className="text-red-500">*</span>
              </label>
              <Select value={selectedSeasonId} onValueChange={setSelectedSeasonId}>
                <SelectTrigger id="season-select" data-testid="select-season">
                  <SelectValue placeholder="Selecione a safra..." />
                </SelectTrigger>
                <SelectContent>
                  {seasons?.map((season) => (
                    <SelectItem key={season.id} value={season.id}>
                      {season.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Todas as vendas importadas serão atribuídas à safra selecionada.
              </p>
            </div>

            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-colors">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
                id="excel-upload"
                data-testid="input-excel-file"
              />
              <label
                htmlFor="excel-upload"
                className="cursor-pointer flex flex-col items-center gap-3"
              >
                {uploading ? (
                  <>
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                    <p className="text-sm text-muted-foreground">Processando arquivo...</p>
                  </>
                ) : (
                  <>
                    <Upload className="h-12 w-12 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Clique para selecionar arquivo Excel</p>
                      <p className="text-xs text-muted-foreground mt-1">Formatos aceitos: .xlsx, .xls</p>
                    </div>
                  </>
                )}
              </label>
            </div>

            <div className="text-xs text-amber-600 bg-amber-50 p-3 rounded-lg">
              <strong>Nota:</strong> Vendas marcadas como "Barter" serão importadas sem comissão calculada. Você precisará editar manualmente após a importação.
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
