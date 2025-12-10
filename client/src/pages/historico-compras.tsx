import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, FileText, Trash2, Calendar, DollarSign, Package, TrendingUp, Target, ShoppingCart, Percent, Pencil } from "lucide-react";
import Navbar from "@/components/layout/navbar";
import Header from "@/components/layout/header";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PurchaseHistory {
  id: string;
  userId: string;
  clientId: string;
  seasonId: string | null;
  seasonName: string;
  sourceFile: string;
  totalAmount: string;
  importDate: Date;
}

interface PurchaseHistoryItem {
  id: string;
  purchaseHistoryId: string;
  productCode: string;
  productName: string;
  packageType: string;
  quantity: string;
  unitPrice: string;
  totalPrice: string;
  purchaseDate: Date;
  orderCode: string;
}

interface ParseResult {
  clientId: string;
  clientName: string;
  seasonId: string | null;
  seasonName: string;
  totalAmount: number;
  itemsCount: number;
  items: Array<{
    productCode: string;
    productName: string;
    packageType: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    purchaseDate: string;
    orderCode: string;
  }>;
  fileName: string;
  autoCreatedProducts?: Array<{
    productName: string;
    productCode: string;
    categoryId: string;
    hasCategory: true;
  }>;
  uncategorizedProducts?: Array<{
    productName: string;
    productCode: string;
    hasCategory: false;
  }>;
}

interface HistoricalProduct {
  productCode: string;
  productName: string;
  packageType: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  purchaseDate: Date;
  segment: string | null;
  subcategoryId: string | null;
}

interface CurrentSeasonProduct {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  saleDate: Date;
  segment: string | null;
  subcategoryId: string | null;
}

interface CategoryData {
  categoryId: string;
  categoryName: string;
  historicalProducts: HistoricalProduct[];
  currentSeasonProducts: CurrentSeasonProduct[];
}

interface MonthlyTimelineItem {
  month: number;
  monthName: string;
  hasPurchases: boolean;
  itemCount: number;
  totalValue: number;
  isCurrentMonth: boolean;
}

interface OpportunitiesResponse {
  clientId: string;
  seasonName: string;
  historicalSeasonName: string;
  categoriesData: CategoryData[];
  monthlyTimeline: MonthlyTimelineItem[];
  currentSeasonMonthlyTimeline: MonthlyTimelineItem[];
  summary: {
    totalHistoricalProducts: number;
    totalSoldThisSeason: number;
    conversionRate: string;
  };
}

const getSegmentDisplay = (segment: string | null): { segment: string; color: string } => {
  if (!segment) {
    return { segment: 'Outros', color: 'bg-gray-500' };
  }

  const segmentLower = segment.toLowerCase();
  
  switch (segmentLower) {
    case 'ts':
      return { segment: 'TS', color: 'bg-purple-600' };
    case 'fungicida':
      return { segment: 'Fungicida', color: 'bg-green-600' };
    case 'inseticida':
      return { segment: 'Inseticida', color: 'bg-blue-600' };
    case 'herbicida':
      return { segment: 'Herbicida', color: 'bg-yellow-600' };
    default:
      return { segment: 'Outros', color: 'bg-gray-500' };
  }
};

const groupProductsBySegment = <T extends { segment: string | null }>(products: T[], isAgrochemical: boolean) => {
  if (!isAgrochemical) {
    return { 'Todos': products };
  }
  
  const grouped: Record<string, T[]> = {};
  
  products.forEach(product => {
    const { segment } = getSegmentDisplay(product.segment);
    if (!grouped[segment]) {
      grouped[segment] = [];
    }
    grouped[segment].push(product);
  });
  
  const order = ['TS', 'Herbicida', 'Inseticida', 'Fungicida', 'Outros'];
  const sorted: Record<string, T[]> = {};
  order.forEach(seg => {
    if (grouped[seg]) {
      sorted[seg] = grouped[seg];
    }
  });
  
  return sorted;
};

export default function HistoricoCompras() {
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [selectedHistory, setSelectedHistory] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedAnalysisHistory, setSelectedAnalysisHistory] = useState<string>("");
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>("");
  const [showEditProductModal, setShowEditProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<{ id: string; name: string; categoryId: string; subcategoryId: string | null; segment: string | null } | null>(null);
  const [editFormData, setEditFormData] = useState({
    categoryId: "",
    subcategoryId: "",
    segment: ""
  });
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedTimelineType, setSelectedTimelineType] = useState<'historical' | 'current' | null>(null);

  const { data: histories, isLoading: loadingHistories } = useQuery<PurchaseHistory[]>({
    queryKey: selectedClientId 
      ? ["/api/clients", selectedClientId, "purchase-history"]
      : ["/api/purchase-history"],
    enabled: !selectedClientId || !!selectedClientId,
  });

  const { data: historyItems, isLoading: loadingItems } = useQuery<PurchaseHistoryItem[]>({
    queryKey: ["/api/purchase-history", selectedHistory, "items"],
    enabled: !!selectedHistory,
  });

  const { data: clients } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["/api/clients"],
  });

  const { data: seasons } = useQuery<Array<{ id: string; name: string; isActive: boolean }>>({
    queryKey: ["/api/seasons"],
  });

  const { data: subcategories } = useQuery<Array<{ id: string; name: string; categoryId: string }>>({
    queryKey: ["/api/subcategories"],
  });

  const { data: categories } = useQuery<Array<{ id: string; name: string; type: string }>>({
    queryKey: ["/api/categories"],
  });

  const { data: products } = useQuery<Array<{ id: string; name: string; categoryId: string; subcategoryId: string | null; segment: string | null }>>({
    queryKey: ["/api/products"],
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest("PATCH", `/api/products/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-history"] });
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey as string[];
          return key[0] === "/api/purchase-history" && key[2] === "opportunities";
        }
      });
      toast({
        title: "Produto atualizado",
        description: "O produto foi reclassificado com sucesso.",
      });
      setShowEditProductModal(false);
      setEditingProduct(null);
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao atualizar produto.",
      });
    },
  });

  const { data: opportunitiesData, isLoading: loadingOpportunities } = useQuery<OpportunitiesResponse>({
    queryKey: ["/api/purchase-history", selectedAnalysisHistory, "opportunities", selectedSeasonId],
    queryFn: async () => {
      const timestamp = Date.now();
      const url = selectedSeasonId 
        ? `/api/purchase-history/${selectedAnalysisHistory}/opportunities?seasonId=${selectedSeasonId}&_t=${timestamp}`
        : `/api/purchase-history/${selectedAnalysisHistory}/opportunities?_t=${timestamp}`;
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch opportunities");
      return response.json();
    },
    enabled: !!selectedAnalysisHistory && !!selectedSeasonId,
  });

  const parseMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/purchase-history/parse-pdf", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to parse PDF");
      }
      return response.json();
    },
    onSuccess: (data: ParseResult) => {
      setParseResult(data);
      toast({
        title: "PDF Analisado",
        description: `${data.itemsCount} produtos encontrados para ${data.clientName}`,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Erro ao analisar PDF",
        description: error.message,
      });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: ParseResult) => {
      return apiRequest("POST", "/api/purchase-history", {
        clientId: data.clientId,
        seasonId: data.seasonId,
        seasonName: data.seasonName,
        sourceFile: data.fileName,
        totalAmount: data.totalAmount.toString(),
        items: data.items.map(item => ({
          ...item,
          quantity: item.quantity.toString(),
          unitPrice: item.unitPrice.toString(),
          totalPrice: item.totalPrice.toString(),
        })),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-history"] });
      setParseResult(null);
      setSelectedFile(null);
      toast({
        title: "Histórico Salvo",
        description: "Histórico de compras importado com sucesso",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao salvar histórico",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/purchase-history/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-history"] });
      if (selectedHistory) {
        setSelectedHistory(null);
      }
      toast({
        title: "Excluído",
        description: "Histórico removido com sucesso",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao excluir histórico",
      });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setSelectedFile(file);
      parseMutation.mutate(file);
    } else {
      toast({
        variant: "destructive",
        title: "Arquivo Inválido",
        description: "Selecione um arquivo PDF",
      });
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file && file.type === "application/pdf") {
      setSelectedFile(file);
      parseMutation.mutate(file);
    } else {
      toast({
        variant: "destructive",
        title: "Arquivo Inválido",
        description: "Arraste um arquivo PDF",
      });
    }
  };

  const getClientName = (clientId: string) => {
    return clients?.find((c) => c.id === clientId)?.name || "Desconhecido";
  };

  const getSubcategoryName = (subcategoryId: string | null) => {
    if (!subcategoryId) return null;
    return subcategories?.find(s => s.id === subcategoryId)?.name || null;
  };

  const openEditModal = (productName: string) => {
    const product = products?.find(p => p.name === productName);
    if (!product) {
      toast({
        variant: "destructive",
        title: "Produto não encontrado",
        description: "Não foi possível encontrar este produto.",
      });
      return;
    }

    setEditingProduct(product);
    setEditFormData({
      categoryId: product.categoryId,
      subcategoryId: product.subcategoryId || "",
      segment: product.segment || ""
    });
    setShowEditProductModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingProduct || !editFormData.categoryId) {
      toast({
        variant: "destructive",
        title: "Campos obrigatórios",
        description: "Selecione uma categoria.",
      });
      return;
    }

    const updateData: any = {
      categoryId: editFormData.categoryId,
    };

    if (editFormData.subcategoryId) {
      updateData.subcategoryId = editFormData.subcategoryId;
    }

    const category = categories?.find(c => c.id === editFormData.categoryId);
    if (category?.type === "agroquimicos" && editFormData.segment) {
      updateData.segment = editFormData.segment;
    }

    updateProductMutation.mutate({ id: editingProduct.id, data: updateData });
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header
        onNewSale={() => {}}
        title="Histórico de Compras"
        subtitle="Importe PDFs de compras anteriores para análise de oportunidades"
      />
      <Navbar />
      <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto p-6">
            <Tabs defaultValue="importacao" className="space-y-6">
              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="importacao" data-testid="tab-importacao">
                  Importação
                </TabsTrigger>
                <TabsTrigger value="analise" data-testid="tab-analise">
                  Análise de Oportunidades
                </TabsTrigger>
              </TabsList>

              <TabsContent value="importacao" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Upload className="h-5 w-5" />
                      Importar PDF
                    </CardTitle>
                    <CardDescription>
                      Faça upload de um PDF de fatura da C.VALE para extrair histórico de compras
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <Label
                          htmlFor="pdf-upload"
                          className={`flex-1 border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                            isDragging
                              ? "border-green-500 bg-green-50"
                              : "border-green-300 hover:border-green-500"
                          }`}
                          data-testid="label-upload"
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={handleDrop}
                        >
                          <div className="flex flex-col items-center gap-2">
                            <FileText className="h-12 w-12 text-green-600" />
                            <span className="font-medium">
                              {selectedFile
                                ? selectedFile.name
                                : isDragging
                                ? "Solte o PDF aqui"
                                : "Clique ou arraste um PDF"}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              Formato: Fatura C.VALE
                            </span>
                          </div>
                          <Input
                            id="pdf-upload"
                            type="file"
                            accept=".pdf"
                            className="hidden"
                            onChange={handleFileSelect}
                            disabled={parseMutation.isPending}
                            data-testid="input-pdf-upload"
                          />
                        </Label>
                      </div>

                      {parseMutation.isPending && (
                        <div className="text-center py-4">
                          <p className="text-sm text-muted-foreground">Analisando PDF...</p>
                        </div>
                      )}

                      {parseResult && (
                        <Card className="border-green-200 bg-green-50">
                          <CardHeader>
                            <CardTitle className="text-lg">Resultado da Análise</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-sm font-medium text-muted-foreground">Cliente</p>
                                <p className="font-semibold">{parseResult.clientName}</p>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-muted-foreground">Safra</p>
                                <p className="font-semibold">{parseResult.seasonName}</p>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-muted-foreground">Total</p>
                                <p className="font-semibold">
                                  ${parseResult.totalAmount.toLocaleString("pt-BR")}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-muted-foreground">Produtos</p>
                                <p className="font-semibold">{parseResult.itemsCount} itens</p>
                              </div>
                            </div>
                            
                            {parseResult.autoCreatedProducts && parseResult.autoCreatedProducts.length > 0 && (
                              <div className="pt-3 border-t">
                                <p className="text-sm font-medium text-muted-foreground mb-2">
                                  Produtos Criados Automaticamente ({parseResult.autoCreatedProducts.length})
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {parseResult.autoCreatedProducts.map((product, idx) => (
                                    <Badge
                                      key={idx}
                                      variant="default"
                                      className="bg-green-600"
                                      data-testid={`badge-auto-product-${idx}`}
                                    >
                                      {product.productName}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {parseResult.uncategorizedProducts && parseResult.uncategorizedProducts.length > 0 && (
                              <div className="pt-3 border-t">
                                <p className="text-sm font-medium text-muted-foreground mb-2">
                                  Produtos Não Categorizados ({parseResult.uncategorizedProducts.length})
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {parseResult.uncategorizedProducts.map((product, idx) => (
                                    <Badge
                                      key={idx}
                                      variant="secondary"
                                      className="bg-yellow-600 text-white"
                                      data-testid={`badge-uncategorized-product-${idx}`}
                                    >
                                      {product.productName} (sem categoria)
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            <div className="flex gap-2 pt-2">
                              <Button
                                onClick={() => saveMutation.mutate(parseResult)}
                                disabled={saveMutation.isPending}
                                className="flex-1"
                                data-testid="button-save-history"
                              >
                                <Package className="mr-2 h-4 w-4" />
                                Salvar Histórico
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setParseResult(null);
                                  setSelectedFile(null);
                                }}
                                data-testid="button-cancel-parse"
                              >
                                Cancelar
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Históricos Importados</CardTitle>
                    <CardDescription>
                      {histories?.length || 0} históricos de compras salvos
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loadingHistories ? (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground">Carregando...</p>
                      </div>
                    ) : histories && histories.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Safra</TableHead>
                            <TableHead>Arquivo</TableHead>
                            <TableHead>Total</TableHead>
                            <TableHead>Data Importação</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {histories.map((history) => (
                            <TableRow
                              key={history.id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => setSelectedHistory(history.id)}
                              data-testid={`row-history-${history.id}`}
                            >
                              <TableCell className="font-medium">
                                {getClientName(history.clientId)}
                              </TableCell>
                              <TableCell>{history.seasonName}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {history.sourceFile}
                              </TableCell>
                              <TableCell>
                                ${parseFloat(history.totalAmount).toLocaleString("pt-BR")}
                              </TableCell>
                              <TableCell>
                                {new Date(history.importDate).toLocaleDateString("pt-BR")}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteMutation.mutate(history.id);
                                  }}
                                  data-testid={`button-delete-${history.id}`}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="text-center py-8">
                        <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
                        <p className="mt-2 text-muted-foreground">
                          Nenhum histórico importado ainda
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="analise" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      Selecionar Cliente
                    </CardTitle>
                    <CardDescription>
                      Escolha um cliente para filtrar os históricos e safras
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Select
                      value={selectedClientId}
                      onValueChange={(value) => {
                        setSelectedClientId(value);
                        setSelectedAnalysisHistory("");
                      }}
                    >
                      <SelectTrigger className="w-full" data-testid="select-client">
                        <SelectValue placeholder="Selecione um cliente..." />
                      </SelectTrigger>
                      <SelectContent>
                        {clients && clients.length > 0 ? (
                          clients.map((client) => (
                            <SelectItem key={client.id} value={client.id} data-testid={`option-client-${client.id}`}>
                              {client.name}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no-clients" disabled>
                            Nenhum cliente disponível
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>

                {selectedClientId && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Histórico</CardTitle>
                        <CardDescription>
                          Selecione um histórico de compras
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Select
                          value={selectedAnalysisHistory}
                          onValueChange={setSelectedAnalysisHistory}
                        >
                          <SelectTrigger className="w-full" data-testid="select-analysis-history">
                            <SelectValue placeholder="Selecione um histórico..." />
                          </SelectTrigger>
                          <SelectContent>
                            {histories && histories.length > 0 ? (
                              histories.map((history) => (
                                <SelectItem key={history.id} value={history.id} data-testid={`option-history-${history.id}`}>
                                  {history.seasonName} ({history.sourceFile})
                                </SelectItem>
                              ))
                            ) : (
                              <SelectItem value="no-histories" disabled>
                                Nenhum histórico disponível
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Safra para Comparar</CardTitle>
                        <CardDescription>
                          Selecione uma safra para análise
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Select
                          value={selectedSeasonId}
                          onValueChange={setSelectedSeasonId}
                        >
                          <SelectTrigger className="w-full" data-testid="select-season">
                            <SelectValue placeholder="Selecione uma safra..." />
                          </SelectTrigger>
                          <SelectContent>
                            {seasons && seasons.length > 0 ? (
                              seasons.map((season) => (
                                <SelectItem key={season.id} value={season.id} data-testid={`option-season-${season.id}`}>
                                  {season.name} {season.isActive && <Badge className="ml-2">Ativa</Badge>}
                                </SelectItem>
                              ))
                            ) : (
                              <SelectItem value="no-seasons" disabled>
                                Nenhuma safra disponível
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {loadingOpportunities && (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">Carregando análise de oportunidades...</p>
                  </div>
                )}

                {!selectedClientId && !loadingOpportunities && (
                  <div className="text-center py-12">
                    <Target className="mx-auto h-16 w-16 text-muted-foreground/50" />
                    <p className="mt-4 text-lg font-medium text-muted-foreground">
                      Selecione um cliente para começar
                    </p>
                  </div>
                )}

                {selectedClientId && !selectedAnalysisHistory && !loadingOpportunities && (
                  <div className="text-center py-12">
                    <Target className="mx-auto h-16 w-16 text-muted-foreground/50" />
                    <p className="mt-4 text-lg font-medium text-muted-foreground">
                      Selecione um histórico para visualizar oportunidades
                    </p>
                  </div>
                )}

                {opportunitiesData && selectedAnalysisHistory && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card data-testid="card-total-historical">
                        <CardHeader className="pb-3">
                          <CardDescription className="text-xs">Total Histórico</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center gap-2">
                            <Package className="h-5 w-5 text-blue-600" />
                            <div className="text-2xl font-bold" data-testid="value-total-historical">
                              {opportunitiesData.summary.totalHistoricalProducts}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">Produtos</p>
                        </CardContent>
                      </Card>

                      <Card data-testid="card-sold-this-season">
                        <CardHeader className="pb-3">
                          <CardDescription className="text-xs">Vendidos na Safra</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center gap-2">
                            <ShoppingCart className="h-5 w-5 text-green-600" />
                            <div className="text-2xl font-bold" data-testid="value-sold-this-season">
                              {opportunitiesData.summary.totalSoldThisSeason}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">Produtos</p>
                        </CardContent>
                      </Card>

                      <Card data-testid="card-conversion-rate">
                        <CardHeader className="pb-3">
                          <CardDescription className="text-xs">Taxa de Conversão</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center gap-2">
                            <Percent className="h-5 w-5 text-purple-600" />
                            <div className="text-2xl font-bold" data-testid="value-conversion-rate">
                              {opportunitiesData.summary.conversionRate}%
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">Convertidos</p>
                        </CardContent>
                      </Card>
                    </div>

                    <Card data-testid="card-segment-summary">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <DollarSign className="h-5 w-5" />
                          Resumo por Segmento
                        </CardTitle>
                        <CardDescription>
                          Comparação de valores totais entre {opportunitiesData.historicalSeasonName} e {opportunitiesData.seasonName}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {(() => {
                          const agrochemicalCategory = opportunitiesData.categoriesData.find(
                            cat => cat.categoryName.toLowerCase().includes('agroquímico')
                          );

                          const segments = ['TS', 'Herbicida', 'Inseticida', 'Fungicida', 'Outros'];
                          const segmentTotals: Record<string, { historical: number; current: number }> = {};
                          const categoryTotals: Record<string, { name: string; historical: number; current: number }> = {};
                          let grandTotalHistorical = 0;
                          let grandTotalCurrent = 0;

                          segments.forEach(segment => {
                            segmentTotals[segment] = { historical: 0, current: 0 };
                          });

                          if (agrochemicalCategory) {
                            agrochemicalCategory.historicalProducts.forEach(product => {
                              const { segment } = getSegmentDisplay(product.segment);
                              if (!segmentTotals[segment]) {
                                segmentTotals[segment] = { historical: 0, current: 0 };
                              }
                              segmentTotals[segment].historical += product.totalPrice;
                            });

                            agrochemicalCategory.currentSeasonProducts.forEach(product => {
                              const { segment } = getSegmentDisplay(product.segment);
                              if (!segmentTotals[segment]) {
                                segmentTotals[segment] = { historical: 0, current: 0 };
                              }
                              segmentTotals[segment].current += product.totalPrice;
                            });
                          }

                          opportunitiesData.categoriesData.forEach(category => {
                            const isAgrochemical = category.categoryName.toLowerCase().includes('agroquímico');
                            
                            if (!isAgrochemical) {
                              let historical = 0;
                              let current = 0;
                              
                              category.historicalProducts.forEach(product => {
                                historical += product.totalPrice;
                              });
                              
                              category.currentSeasonProducts.forEach(product => {
                                current += product.totalPrice;
                              });
                              
                              categoryTotals[category.categoryId] = {
                                name: category.categoryName,
                                historical,
                                current
                              };
                            }
                            
                            category.historicalProducts.forEach(product => {
                              grandTotalHistorical += product.totalPrice;
                            });
                            category.currentSeasonProducts.forEach(product => {
                              grandTotalCurrent += product.totalPrice;
                            });
                          });

                          return (
                            <div className="space-y-1">
                              {agrochemicalCategory && (
                                <div className="space-y-0">
                                  <div className="grid grid-cols-3 gap-4 p-3 bg-green-50 border-l-4 border-green-600">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-green-800">Agroquímicos</span>
                                    </div>
                                    <div className="text-center">
                                      <div className="font-semibold text-gray-700">
                                        ${(segmentTotals['TS'].historical + segmentTotals['Herbicida'].historical + segmentTotals['Inseticida'].historical + segmentTotals['Fungicida'].historical + segmentTotals['Outros'].historical).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </div>
                                    </div>
                                    <div className="text-center">
                                      <div className="font-semibold text-gray-700">
                                        ${(segmentTotals['TS'].current + segmentTotals['Herbicida'].current + segmentTotals['Inseticida'].current + segmentTotals['Fungicida'].current + segmentTotals['Outros'].current).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {segments.map(segment => {
                                    const totals = segmentTotals[segment];
                                    if (segment === 'Outros' && totals.historical === 0 && totals.current === 0) {
                                      return null;
                                    }
                                    
                                    return (
                                      <div 
                                        key={segment}
                                        className="grid grid-cols-3 gap-4 py-2 px-3 pl-8 hover:bg-gray-50"
                                        data-testid={`segment-row-${segment.toLowerCase()}`}
                                      >
                                        <div className="flex items-center gap-2">
                                          <span className="text-sm text-gray-700">{segment}</span>
                                        </div>
                                        <div className="text-center">
                                          <div className="text-sm text-gray-600" data-testid={`historical-${segment.toLowerCase()}`}>
                                            ${totals.historical.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                          </div>
                                        </div>
                                        <div className="text-center">
                                          <div className="text-sm text-gray-600" data-testid={`current-${segment.toLowerCase()}`}>
                                            ${totals.current.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                              
                              {Object.entries(categoryTotals).map(([categoryId, data]) => (
                                <div 
                                  key={categoryId}
                                  className="grid grid-cols-3 gap-4 p-3 border-b hover:bg-gray-50"
                                  data-testid={`category-row-${categoryId}`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-gray-700">{data.name}</span>
                                  </div>
                                  <div className="text-center">
                                    <div className="font-medium text-gray-600" data-testid={`historical-${categoryId}`}>
                                      ${data.historical.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                  </div>
                                  <div className="text-center">
                                    <div className="font-medium text-gray-600" data-testid={`current-${categoryId}`}>
                                      ${data.current.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                  </div>
                                </div>
                              ))}
                              
                              <div className="grid grid-cols-3 gap-4 p-4 bg-green-50 border-l-4 border-green-600 mt-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-base">TOTAL GERAL</span>
                                </div>
                                <div className="text-center">
                                  <div className="text-xs text-gray-500 mb-0.5">Safra Anterior</div>
                                  <div className="font-bold text-lg text-gray-800" data-testid="grand-total-historical">
                                    ${grandTotalHistorical.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </div>
                                </div>
                                <div className="text-center">
                                  <div className="text-xs text-gray-500 mb-0.5">Safra Atual</div>
                                  <div className="font-bold text-lg text-gray-800" data-testid="grand-total-current">
                                    ${grandTotalCurrent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </CardContent>
                    </Card>

                    <Card data-testid="card-timeline">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Calendar className="h-5 w-5" />
                          Linha do Tempo Comparativa
                        </CardTitle>
                        <CardDescription>
                          Compare os meses de compra entre as duas safras
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Timeline Histórico */}
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 mb-2">
                            {opportunitiesData.historicalSeasonName}
                          </h4>
                          <div className="grid grid-cols-12 gap-1.5">
                            {opportunitiesData.monthlyTimeline.map((month) => (
                              <div
                                key={month.month}
                                className="relative group"
                                data-testid={`historical-month-${month.month}`}
                              >
                                <div
                                  onClick={() => {
                                    if (month.hasPurchases) {
                                      setSelectedMonth(month.month);
                                      setSelectedTimelineType('historical');
                                    }
                                  }}
                                  className={`p-2 rounded text-center transition-all ${
                                    month.hasPurchases
                                      ? "bg-green-500 text-white shadow hover:shadow-md cursor-pointer"
                                      : "bg-gray-100 text-gray-400"
                                  } ${
                                    month.isCurrentMonth
                                      ? "ring-2 ring-blue-500 ring-offset-1"
                                      : ""
                                  }`}
                                >
                                  <div className="text-[10px] font-semibold capitalize">
                                    {month.monthName}
                                  </div>
                                  {month.hasPurchases && (
                                    <div className="text-[10px] mt-0.5">
                                      {month.itemCount}
                                    </div>
                                  )}
                                </div>
                                {month.hasPurchases && (
                                  <div className="absolute z-10 invisible group-hover:visible bg-black text-white text-xs rounded py-1.5 px-2 bottom-full left-1/2 transform -translate-x-1/2 mb-1 whitespace-nowrap shadow-lg">
                                    <div className="font-semibold">{month.itemCount} produtos</div>
                                    <div>Total: ${month.totalValue.toLocaleString("pt-BR", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2
                                    })}</div>
                                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-black"></div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Timeline Safra Atual */}
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 mb-2">
                            {opportunitiesData.seasonName}
                          </h4>
                          <div className="grid grid-cols-12 gap-1.5">
                            {opportunitiesData.currentSeasonMonthlyTimeline.map((month) => (
                              <div
                                key={month.month}
                                className="relative group"
                                data-testid={`current-month-${month.month}`}
                              >
                                <div
                                  onClick={() => {
                                    if (month.hasPurchases) {
                                      setSelectedMonth(month.month);
                                      setSelectedTimelineType('current');
                                    }
                                  }}
                                  className={`p-2 rounded text-center transition-all ${
                                    month.hasPurchases
                                      ? "bg-blue-500 text-white shadow hover:shadow-md cursor-pointer"
                                      : "bg-gray-100 text-gray-400"
                                  } ${
                                    month.isCurrentMonth
                                      ? "ring-2 ring-blue-500 ring-offset-1"
                                      : ""
                                  }`}
                                >
                                  <div className="text-[10px] font-semibold capitalize">
                                    {month.monthName}
                                  </div>
                                  {month.hasPurchases && (
                                    <div className="text-[10px] mt-0.5">
                                      {month.itemCount}
                                    </div>
                                  )}
                                </div>
                                {month.hasPurchases && (
                                  <div className="absolute z-10 invisible group-hover:visible bg-black text-white text-xs rounded py-1.5 px-2 bottom-full left-1/2 transform -translate-x-1/2 mb-1 whitespace-nowrap shadow-lg">
                                    <div className="font-semibold">{month.itemCount} {month.itemCount === 1 ? 'venda' : 'vendas'}</div>
                                    <div>Total: ${month.totalValue.toLocaleString("pt-BR", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2
                                    })}</div>
                                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-black"></div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Legenda */}
                        <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground flex-wrap">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded bg-green-500"></div>
                            <span>Histórico</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded bg-blue-500"></div>
                            <span>Safra Atual</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded bg-green-500 ring-2 ring-blue-500 ring-offset-1"></div>
                            <span>Mês atual</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded bg-gray-100"></div>
                            <span>Sem dados</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card data-testid="card-opportunities-table">
                      <CardHeader>
                        <CardTitle>Comparação de Produtos por Categoria</CardTitle>
                        <CardDescription>
                          {opportunitiesData.historicalSeasonName} vs {opportunitiesData.seasonName} - lado a lado
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {opportunitiesData.categoriesData.length === 0 ? (
                          <div className="text-center py-8">
                            <TrendingUp className="mx-auto h-12 w-12 text-muted-foreground/50" />
                            <p className="mt-2 text-muted-foreground">
                              Nenhum dado encontrado para comparação
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-6">
                            {opportunitiesData.categoriesData.map((category) => {
                              const isAgrochemical = category.categoryName.toLowerCase().includes('agroquímico');
                              const historicalGroups = groupProductsBySegment(category.historicalProducts, isAgrochemical);
                              const currentGroups = groupProductsBySegment(category.currentSeasonProducts, isAgrochemical);
                              
                              return (
                                <div key={category.categoryId} className="border rounded-lg p-4 bg-white">
                                  <h3 className="font-semibold text-lg mb-4 text-green-700">
                                    {category.categoryName}
                                  </h3>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <h4 className="font-medium text-sm text-muted-foreground border-b pb-2">
                                        {opportunitiesData.historicalSeasonName || 'Safra Histórica'}
                                      </h4>
                                      {category.historicalProducts.length === 0 ? (
                                        <p className="text-sm text-muted-foreground py-4">Nenhum produto</p>
                                      ) : (
                                        <div className="space-y-3">
                                          {Object.entries(historicalGroups).map(([segment, products]) => (
                                            <div key={segment}>
                                              {isAgrochemical && (
                                                <div className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-2">
                                                  <Badge className={`${getSegmentDisplay(products[0].segment).color} text-white text-xs`}>
                                                    {segment}
                                                  </Badge>
                                                </div>
                                              )}
                                              <div className="space-y-1">
                                                {products.map((product, idx) => {
                                                  const subcategoryName = getSubcategoryName(product.subcategoryId);
                                                  const isUncategorized = category.categoryName === 'Outros';
                                                  return (
                                                    <div 
                                                      key={idx} 
                                                      className="p-2 rounded border border-gray-200 hover:bg-gray-50"
                                                      data-testid={`historical-product-${category.categoryId}-${idx}`}
                                                    >
                                                      <div className="flex justify-between items-start gap-2">
                                                        <div className="flex-1">
                                                          <div className="font-medium text-sm">{product.productName}</div>
                                                          <div className="text-xs text-muted-foreground">{product.packageType}</div>
                                                          {subcategoryName && (
                                                            <div className="text-xs text-blue-600 mt-0.5 font-medium">{subcategoryName}</div>
                                                          )}
                                                          <div className="flex justify-between items-center mt-1">
                                                            <span className="text-xs">Qtd: {product.quantity.toFixed(2)}</span>
                                                            <span className="text-xs font-semibold">${product.totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                          </div>
                                                        </div>
                                                        {isUncategorized && (
                                                          <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => openEditModal(product.productName)}
                                                            data-testid={`button-edit-${idx}`}
                                                            className="h-6 w-6 p-0"
                                                          >
                                                            <Pencil className="h-3 w-3" />
                                                          </Button>
                                                        )}
                                                      </div>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    
                                    <div className="space-y-2">
                                      <h4 className="font-medium text-sm text-muted-foreground border-b pb-2">
                                        {opportunitiesData.seasonName || 'Safra Atual'}
                                      </h4>
                                      {category.currentSeasonProducts.length === 0 ? (
                                        <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-center">
                                          <p className="text-sm font-medium text-yellow-700">⚠️ Oportunidade!</p>
                                          <p className="text-xs text-yellow-600 mt-1">Nenhuma venda registrada</p>
                                        </div>
                                      ) : (
                                        <div className="space-y-3">
                                          {Object.entries(currentGroups).map(([segment, products]) => (
                                            <div key={segment}>
                                              {isAgrochemical && (
                                                <div className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-2">
                                                  <Badge className={`${getSegmentDisplay(products[0].segment).color} text-white text-xs`}>
                                                    {segment}
                                                  </Badge>
                                                </div>
                                              )}
                                              <div className="space-y-1">
                                                {products.map((product, idx) => {
                                                  const subcategoryName = getSubcategoryName(product.subcategoryId);
                                                  return (
                                                    <div 
                                                      key={idx} 
                                                      className="p-2 rounded border border-green-200 bg-green-50"
                                                      data-testid={`current-product-${category.categoryId}-${idx}`}
                                                    >
                                                      <div className="font-medium text-sm">{product.productName}</div>
                                                      {subcategoryName && (
                                                        <div className="text-xs text-blue-600 mt-0.5 font-medium">{subcategoryName}</div>
                                                      )}
                                                      <div className="flex justify-between items-center mt-1">
                                                        <span className="text-xs">Qtd: {product.quantity.toFixed(2)}</span>
                                                        <span className="text-xs font-semibold text-green-700">${product.totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                      </div>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </>
                )}
              </TabsContent>
            </Tabs>
          </div>

      {/* Month Products Modal */}
      <Dialog open={selectedMonth !== null} onOpenChange={(open) => { if (!open) { setSelectedMonth(null); setSelectedTimelineType(null); } }}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto" data-testid="month-products-modal">
          <DialogHeader>
            <DialogTitle>
              {selectedTimelineType === 'historical' ? 'Compras' : 'Vendas'} de {selectedMonth !== null && opportunitiesData?.monthlyTimeline.find(m => m.month === selectedMonth)?.monthName}
            </DialogTitle>
            <DialogDescription>
              {selectedTimelineType === 'historical' 
                ? `Produtos comprados neste mês (${opportunitiesData?.historicalSeasonName})`
                : `Vendas realizadas neste mês (${opportunitiesData?.seasonName})`
              }
            </DialogDescription>
          </DialogHeader>
          
          {selectedMonth !== null && selectedTimelineType && opportunitiesData && (() => {
            const monthProducts = selectedTimelineType === 'historical'
              ? opportunitiesData.categoriesData.flatMap(cat => 
                  cat.historicalProducts
                    .filter(p => new Date(p.purchaseDate).getMonth() + 1 === selectedMonth)
                    .map(p => ({ ...p, categoryId: cat.categoryId, categoryName: cat.categoryName }))
                )
              : opportunitiesData.categoriesData.flatMap(cat => 
                  cat.currentSeasonProducts
                    .filter(p => new Date(p.saleDate).getMonth() + 1 === selectedMonth)
                    .map(p => ({ 
                      ...p, 
                      categoryId: cat.categoryId, 
                      categoryName: cat.categoryName,
                      productCode: p.productId,
                      packageType: '',
                      purchaseDate: p.saleDate
                    }))
                );

            const groupedByCategory: Record<string, typeof monthProducts> = {};
            monthProducts.forEach(p => {
              if (!groupedByCategory[p.categoryId]) {
                groupedByCategory[p.categoryId] = [];
              }
              groupedByCategory[p.categoryId].push(p);
            });

            const totalValue = monthProducts.reduce((sum, p) => sum + p.totalPrice, 0);

            return (
              <div className="space-y-4">
                <div className={`rounded p-3 ${selectedTimelineType === 'historical' ? 'bg-green-50 border border-green-200' : 'bg-blue-50 border border-blue-200'}`}>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total de Produtos</p>
                      <p className="text-lg font-semibold">{monthProducts.length}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Valor Total</p>
                      <p className="text-lg font-semibold">${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                </div>

                {Object.keys(groupedByCategory).length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhum produto encontrado</p>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(groupedByCategory).map(([categoryId, products]) => {
                      if (products.length === 0) return null;
                      const isAgrochemical = products[0].categoryName.toLowerCase().includes('agroquímico');
                      const segmentGroups = groupProductsBySegment(products, isAgrochemical);
                      
                      return (
                        <div key={categoryId} className="border rounded-lg p-4">
                          <h3 className="font-semibold text-lg mb-3 text-green-700">
                            {products[0].categoryName}
                          </h3>
                          
                          <div className="space-y-3">
                            {Object.entries(segmentGroups).map(([segment, segmentProducts]) => (
                              <div key={segment}>
                                {isAgrochemical && (
                                  <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                                    <Badge className={`${getSegmentDisplay(segmentProducts[0].segment).color} text-white text-xs`}>
                                      {segment}
                                    </Badge>
                                  </div>
                                )}
                                <div className="space-y-2">
                                  {segmentProducts.map((product, idx) => {
                                    const subcategoryName = getSubcategoryName(product.subcategoryId);
                                    return (
                                      <div 
                                        key={idx} 
                                        className="p-3 rounded border border-gray-200 bg-white hover:bg-gray-50"
                                        data-testid={`month-product-${idx}`}
                                      >
                                        <div className="flex justify-between items-start gap-3">
                                          <div className="flex-1">
                                            <div className="font-medium text-sm">{product.productName}</div>
                                            <div className="text-xs text-muted-foreground mt-0.5">
                                              Código: {product.productCode} | {product.packageType}
                                            </div>
                                            {subcategoryName && (
                                              <div className="text-xs text-blue-600 mt-0.5 font-medium">{subcategoryName}</div>
                                            )}
                                            <div className="flex justify-between items-center mt-2 text-xs">
                                              <span className="text-muted-foreground">Quantidade: {product.quantity.toFixed(2)}</span>
                                              <span className="text-muted-foreground">Preço Unit.: ${product.unitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                            </div>
                                          </div>
                                          <div className="text-right">
                                            <div className="text-xs text-muted-foreground">Total</div>
                                            <div className="text-base font-semibold text-green-700">
                                              ${product.totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Edit Product Modal */}
      <Dialog open={showEditProductModal} onOpenChange={setShowEditProductModal}>
        <DialogContent className="max-w-2xl" data-testid="edit-product-modal">
          <DialogHeader>
            <DialogTitle>Reclassificar Produto</DialogTitle>
            <DialogDescription>
              Atribua a categoria e subcategoria corretas para: {editingProduct?.name}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <Label htmlFor="edit-category">Categoria *</Label>
              <Select
                value={editFormData.categoryId}
                onValueChange={(value) => setEditFormData(prev => ({ ...prev, categoryId: value, subcategoryId: "", segment: "" }))}
              >
                <SelectTrigger id="edit-category" data-testid="select-edit-category">
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categories?.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id} data-testid={`option-category-${cat.id}`}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {editFormData.categoryId && (
              <>
                <div>
                  <Label htmlFor="edit-subcategory">Subcategoria (opcional)</Label>
                  <Select
                    value={editFormData.subcategoryId || undefined}
                    onValueChange={(value) => setEditFormData(prev => ({ ...prev, subcategoryId: value }))}
                  >
                    <SelectTrigger id="edit-subcategory" data-testid="select-edit-subcategory">
                      <SelectValue placeholder="Nenhuma selecionada" />
                    </SelectTrigger>
                    <SelectContent>
                      {subcategories?.filter(s => s.categoryId === editFormData.categoryId).map((sub) => (
                        <SelectItem key={sub.id} value={sub.id} data-testid={`option-subcategory-${sub.id}`}>
                          {sub.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {categories?.find(c => c.id === editFormData.categoryId)?.type === "agroquimicos" && (
                  <div>
                    <Label htmlFor="edit-segment">Segmento (opcional)</Label>
                    <Select
                      value={editFormData.segment || undefined}
                      onValueChange={(value) => setEditFormData(prev => ({ ...prev, segment: value }))}
                    >
                      <SelectTrigger id="edit-segment" data-testid="select-edit-segment">
                        <SelectValue placeholder="Nenhum selecionado" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Fungicida">Fungicida</SelectItem>
                        <SelectItem value="Inseticida">Inseticida</SelectItem>
                        <SelectItem value="Herbicida">Herbicida</SelectItem>
                        <SelectItem value="TS">TS (Tratamento de Sementes)</SelectItem>
                        <SelectItem value="Outros">Outros</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEditProductModal(false)}
                data-testid="button-edit-cancel"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={updateProductMutation.isPending}
                data-testid="button-edit-save"
              >
                {updateProductMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedHistory} onOpenChange={() => setSelectedHistory(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Histórico</DialogTitle>
            <DialogDescription>
              Produtos comprados nesta safra
            </DialogDescription>
          </DialogHeader>
          {loadingItems ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Carregando itens...</p>
            </div>
          ) : historyItems && historyItems.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Embalagem</TableHead>
                  <TableHead>Qtd</TableHead>
                  <TableHead>Preço Unit.</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyItems.map((item) => (
                  <TableRow key={item.id} data-testid={`item-${item.id}`}>
                    <TableCell className="font-mono text-sm">
                      {item.productCode}
                    </TableCell>
                    <TableCell className="font-medium">{item.productName}</TableCell>
                    <TableCell className="text-sm">{item.packageType}</TableCell>
                    <TableCell>{parseFloat(item.quantity).toFixed(2)}</TableCell>
                    <TableCell>
                      ${parseFloat(item.unitPrice).toFixed(2)}
                    </TableCell>
                    <TableCell className="font-semibold">
                      ${parseFloat(item.totalPrice).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {new Date(item.purchaseDate).toLocaleDateString("pt-BR")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Nenhum item encontrado</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
      </main>
    </div>
  );
}
