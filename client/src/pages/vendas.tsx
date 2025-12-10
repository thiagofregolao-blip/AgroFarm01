import Navbar from "@/components/layout/navbar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import NewSaleModal from "@/components/modals/new-sale-modal";
import EditSaleModal from "@/components/modals/edit-sale-modal";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Search, Filter, Download, Plus, Calendar, DollarSign, Edit, Award, RefreshCcw, ChevronDown, ChevronRight, Repeat, Maximize2, X } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Sale, Client, Category, Product } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const MONTHS = [
  { value: "1", label: "Janeiro" },
  { value: "2", label: "Fevereiro" },
  { value: "3", label: "Março" },
  { value: "4", label: "Abril" },
  { value: "5", label: "Maio" },
  { value: "6", label: "Junho" },
  { value: "7", label: "Julho" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

export default function Vendas() {
  const [showNewSaleModal, setShowNewSaleModal] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSeason, setSelectedSeason] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedMarca, setSelectedMarca] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [expandedBarterClients, setExpandedBarterClients] = useState<Set<string>>(new Set());
  const [showManualCommissionModal, setShowManualCommissionModal] = useState(false);
  const [selectedBarterClientId, setSelectedBarterClientId] = useState<string | null>(null);
  const [manualCommissionValue, setManualCommissionValue] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { toast } = useToast();

  const { data: user } = useQuery<any>({
    queryKey: ["/api/user"],
  });

  const { data: sales, isLoading } = useQuery<Sale[]>({
    queryKey: ["/api/sales"],
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: seasons } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/seasons"],
  });

  const { data: timacSettings } = useQuery<any>({
    queryKey: ["/api/timac-settings"],
  });

  const recalculateSalesMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/sales/recalculate-all", {});
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/sales"] });
      toast({
        title: "Vendas recalculadas",
        description: `${data.updatedCount} de ${data.totalSales} vendas foram recalculadas com sucesso.`,
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao recalcular vendas. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const manualCommissionMutation = useMutation({
    mutationFn: async ({ clientId, commissionAmount }: { clientId: string; commissionAmount: number }) => {
      return apiRequest("PATCH", `/api/sales/barter/${clientId}/manual-commission`, { commissionAmount });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/sales"] });
      toast({
        title: "Comissão atualizada",
        description: `Comissão manual de $${manualCommissionValue} aplicada a ${data.updatedCount} venda(s) barter.`,
      });
      setShowManualCommissionModal(false);
      setManualCommissionValue("");
      setSelectedBarterClientId(null);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao atualizar comissão manual. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  // Reset product filter when marca changes and selected product is not from the selected marca
  useEffect(() => {
    if (selectedMarca && selectedMarca !== "all" && selectedProduct && selectedProduct !== "all") {
      const product = products?.find(p => p.id === selectedProduct);
      if (product && product.marca?.toUpperCase() !== selectedMarca) {
        setSelectedProduct("");
      }
    }
  }, [selectedMarca, selectedProduct, products]);

  const openNewSaleModal = () => {
    setShowNewSaleModal(true);
  };

  const toggleBarterClient = (clientId: string) => {
    const newExpanded = new Set(expandedBarterClients);
    if (newExpanded.has(clientId)) {
      newExpanded.delete(clientId);
    } else {
      newExpanded.add(clientId);
    }
    setExpandedBarterClients(newExpanded);
  };

  const openManualCommissionModal = (clientId: string) => {
    setSelectedBarterClientId(clientId);
    setShowManualCommissionModal(true);
  };

  const handleManualCommissionSubmit = () => {
    if (!selectedBarterClientId) return;
    
    // Normalize decimal separator (replace comma with dot for PT-BR users)
    const normalizedValue = manualCommissionValue.replace(',', '.');
    const value = parseFloat(normalizedValue);
    
    if (isNaN(value) || value < 0) {
      toast({
        title: "Valor inválido",
        description: "Por favor, insira um valor de comissão válido (use . ou , como separador decimal).",
        variant: "destructive",
      });
      return;
    }

    manualCommissionMutation.mutate({
      clientId: selectedBarterClientId,
      commissionAmount: value,
    });
  };

  const getTierBadgeClass = (tier: string) => {
    switch (tier) {
      case 'verde': 
        return 'bg-green-100 text-green-700 border-green-500 dark:bg-green-950 dark:text-green-400 dark:border-green-600';
      case 'amarela': 
        return 'bg-yellow-100 text-yellow-700 border-yellow-500 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-600';
      case 'vermelha': 
        return 'bg-red-100 text-red-700 border-red-500 dark:bg-red-950 dark:text-red-400 dark:border-red-600';
      case 'abaixo_lista':
        return 'bg-gray-700 text-gray-100 border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700';
      case 'barter':
        return 'bg-blue-100 text-blue-700 border-blue-500 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-600';
      default: 
        return 'bg-gray-700 text-gray-100 border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700';
    }
  };

  const getClientName = (clientId: string) => {
    return clients?.find(c => c.id === clientId)?.name || "Cliente não encontrado";
  };

  const getCategoryName = (categoryId: string) => {
    return categories?.find(c => c.id === categoryId)?.name || "Categoria não encontrada";
  };

  const getProductName = (productId: string) => {
    return products?.find(p => p.id === productId)?.name || "Produto manual";
  };

  const getProductMarca = (productId: string) => {
    return products?.find(p => p.id === productId)?.marca || null;
  };

  // Get unique marcas from products (normalized to uppercase for filtering, but preserve original for display)
  const marcaMap = new Map<string, string>();
  products?.forEach(p => {
    if (p.marca && p.marca !== "") {
      const normalized = p.marca.toUpperCase();
      if (!marcaMap.has(normalized)) {
        marcaMap.set(normalized, p.marca);
      }
    }
  });
  
  const uniqueMarcas = Array.from(marcaMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([normalized, original]) => ({ value: normalized, label: original }));

  // Filter products based on selected marca
  const availableProducts = products
    ?.filter(product => {
      if (!selectedMarca || selectedMarca === "all") return true;
      return product.marca?.toUpperCase() === selectedMarca;
    })
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name)) || [];

  const filteredSales = sales?.filter(sale => {
    const clientName = getClientName(sale.clientId).toLowerCase();
    const productName = getProductName(sale.productId).toLowerCase();
    const searchMatch = clientName.includes(searchTerm.toLowerCase()) || 
                       productName.includes(searchTerm.toLowerCase());
    
    const seasonMatch = !selectedSeason || selectedSeason === "all" || sale.seasonId === selectedSeason;
    const categoryMatch = !selectedCategory || selectedCategory === "all" || sale.categoryId === selectedCategory;
    const marcaMatch = !selectedMarca || selectedMarca === "all" || getProductMarca(sale.productId)?.toUpperCase() === selectedMarca;
    const productMatch = !selectedProduct || selectedProduct === "all" || sale.productId === selectedProduct;
    
    // Month filter - extract month from sale date
    const monthMatch = !selectedMonth || selectedMonth === "all" || (() => {
      const saleDate = new Date(sale.saleDate);
      const saleMonth = saleDate.getMonth() + 1; // getMonth() returns 0-11
      return saleMonth.toString() === selectedMonth;
    })();

    return searchMatch && seasonMatch && categoryMatch && marcaMatch && productMatch && monthMatch;
  }) || [];

  // Separate normal sales from barter sales
  const normalSales = filteredSales.filter(sale => sale.commissionTier !== 'barter');
  const barterSales = filteredSales.filter(sale => sale.commissionTier === 'barter');

  // Group barter sales by client
  const barterByClient = barterSales.reduce((acc, sale) => {
    if (!acc[sale.clientId]) {
      acc[sale.clientId] = [];
    }
    acc[sale.clientId].push(sale);
    return acc;
  }, {} as Record<string, Sale[]>);

  // Create barter client groups with totals
  const barterClientGroups = Object.entries(barterByClient).map(([clientId, sales]) => {
    const totalAmount = sales.reduce((sum, sale) => sum + parseFloat(sale.totalAmount), 0);
    const totalCommission = sales.reduce((sum, sale) => sum + parseFloat(sale.commissionAmount), 0);
    return {
      clientId,
      clientName: getClientName(clientId),
      sales,
      totalAmount,
      totalCommission,
      salesCount: sales.length,
    };
  });

  const totalSales = filteredSales.reduce((sum, sale) => sum + parseFloat(sale.totalAmount), 0);
  const totalCommissions = filteredSales.reduce((sum, sale) => sum + parseFloat(sale.commissionAmount), 0);

  // Filtrar apenas vendas com pontos Timac
  const timacSales = filteredSales.filter(sale => sale.timacPoints && parseFloat(sale.timacPoints) > 0);
  
  // Calcular total de pontos usando a mesma lógica da tabela
  const totalTimacPoints = timacSales.reduce((sum, sale) => {
    const product = products?.find(p => p.id === sale.productId);
    const packageSize = product?.packageSize ? parseFloat(product.packageSize) : 1;
    
    const quantity = sale.quantity ? parseFloat(sale.quantity) : 0;
    const cantPedido = packageSize > 0 ? quantity / packageSize : 0;
    const quantidadeTotal = cantPedido * packageSize;
    
    // Use timacPoints from product database instead of hardcoded logic
    const ptsPerUnit = product?.timacPoints ? parseFloat(product.timacPoints) : 0;
    const totalPontos = ptsPerUnit * quantidadeTotal;
    
    return sum + totalPontos;
  }, 0);
  
  // Get value per point based on user type
  const getTimacValuePerPoint = () => {
    if (!timacSettings || !user) return 0.76; // fallback
    
    const userRole = user.role?.toLowerCase() || 'consultor';
    
    if (userRole.includes('consultor')) {
      return parseFloat(timacSettings.consultorValue || "0.76");
    } else if (userRole.includes('gerente')) {
      return parseFloat(timacSettings.gerentesValue || "0.76");
    } else if (userRole.includes('faturista')) {
      return parseFloat(timacSettings.faturistasValue || "0.76");
    }
    
    return parseFloat(timacSettings.consultorValue || "0.76"); // default to consultor
  };
  
  const timacRewardPerPoint = getTimacValuePerPoint();
  const totalTimacReward = totalTimacPoints * timacRewardPerPoint;

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" data-testid="vendas-container">
      <Header 
        onNewSale={openNewSaleModal}
        title="Gestão de Vendas"
        subtitle="Controle e acompanhamento de todas as vendas"
      />
      <Navbar />
      
      <main className="flex-1 overflow-y-auto">
        <div className="p-4 md:p-8 space-y-4 md:space-y-6">
          {/* Filters and Actions - First */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base md:text-lg">Filtros e Ações</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row md:flex-wrap gap-3 md:gap-4 md:items-end">
                <div className="flex-1 md:min-w-64">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por cliente ou produto..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                      data-testid="search-sales"
                    />
                  </div>
                </div>

                <Select value={selectedSeason} onValueChange={setSelectedSeason}>
                  <SelectTrigger className="w-full md:w-48" data-testid="filter-season">
                    <SelectValue placeholder="Filtrar por safra" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as safras</SelectItem>
                    {seasons?.map((season: any) => (
                      <SelectItem key={season.id} value={season.id}>
                        {season.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-full md:w-48" data-testid="filter-category">
                    <SelectValue placeholder="Filtrar por categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as categorias</SelectItem>
                    {categories?.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedMarca} onValueChange={setSelectedMarca}>
                  <SelectTrigger className="w-full md:w-48" data-testid="filter-marca">
                    <SelectValue placeholder="Filtrar por fabricante" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os fabricantes</SelectItem>
                    {uniqueMarcas?.map((marca) => (
                      <SelectItem key={marca.value} value={marca.value}>
                        {marca.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                  <SelectTrigger className="w-full md:w-48" data-testid="filter-product">
                    <SelectValue placeholder="Filtrar por produto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os produtos</SelectItem>
                    {availableProducts.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-full md:w-48" data-testid="filter-month">
                    <SelectValue placeholder="Filtrar por mês" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os meses</SelectItem>
                    {MONTHS.map((month) => (
                      <SelectItem key={month.value} value={month.value}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex gap-2">
                  <Button variant="outline" className="w-full md:w-auto" data-testid="button-export">
                    <Download className="h-4 w-4 mr-2" />
                    Exportar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabs for Vendas and Pontos Timac */}
          <Tabs defaultValue="vendas" className="space-y-4 md:space-y-6">
            {/* Cards de navegação e resumo - empilhados em mobile */}
            <div className="flex flex-col md:flex-row gap-4 md:gap-6">
              {/* Cards de navegação quadrados lado a lado */}
              <TabsList className="grid grid-cols-2 h-auto bg-transparent p-0 gap-3 w-full md:w-auto">
                <TabsTrigger 
                  value="vendas" 
                  data-testid="tab-vendas"
                  className="h-auto p-0 bg-transparent border-0 data-[state=active]:bg-transparent"
                  asChild
                >
                  <Card className="shadow-sm cursor-pointer transition-all aspect-square data-[state=active]:ring-2 data-[state=active]:ring-amber-500 data-[state=active]:bg-amber-50 hover:shadow-md w-full md:w-32">
                    <CardContent className="p-3 md:p-4 h-full flex flex-col items-center justify-center text-center">
                      <div className="w-8 h-8 md:w-10 md:h-10 bg-amber-500/10 rounded-lg flex items-center justify-center mb-2">
                        <DollarSign className="text-amber-500" size={18} />
                      </div>
                      <p className="text-xs md:text-sm font-semibold">Vendas</p>
                    </CardContent>
                  </Card>
                </TabsTrigger>
                
                <TabsTrigger 
                  value="timac" 
                  data-testid="tab-timac"
                  className="h-auto p-0 bg-transparent border-0 data-[state=active]:bg-transparent"
                  asChild
                >
                  <Card className="shadow-sm cursor-pointer transition-all aspect-square data-[state=active]:ring-2 data-[state=active]:ring-blue-500 data-[state=active]:bg-blue-50 hover:shadow-md w-full md:w-32">
                    <CardContent className="p-3 md:p-4 h-full flex flex-col items-center justify-center text-center">
                      <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-500/10 rounded-lg flex items-center justify-center mb-2">
                        <Award className="text-blue-500" size={18} />
                      </div>
                      <p className="text-xs md:text-sm font-semibold">Pontos Timac</p>
                    </CardContent>
                  </Card>
                </TabsTrigger>
              </TabsList>

              {/* Cards de resumo - empilhados em mobile, horizontal em desktop */}
              <div className="grid grid-cols-1 md:flex md:gap-4 md:flex-1 gap-3">
                <Card className="shadow-sm md:flex-1">
                  <CardContent className="p-3 md:p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <DollarSign className="text-primary" size={20} />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Total de Vendas</p>
                        <p className="text-lg md:text-xl font-bold font-mono">${totalSales.toLocaleString()}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-sm md:flex-1">
                  <CardContent className="p-3 md:p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-verde/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <DollarSign className="text-verde" size={20} />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Total de Comissões</p>
                        <p className="text-lg md:text-xl font-bold font-mono text-verde">${totalCommissions.toLocaleString()}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {totalSales > 0 ? ((totalCommissions / totalSales) * 100).toFixed(2) : 0}% sobre vendas
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-sm md:flex-1">
                  <CardContent className="p-3 md:p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-chart-2/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Calendar className="text-chart-2" size={20} />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Total de Vendas</p>
                        <p className="text-lg md:text-xl font-bold">{filteredSales.length}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            <TabsContent value="vendas" className="space-y-6">
          {/* Sales Table */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Lista de Vendas</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredSales.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">Nenhuma venda encontrada</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">Cant. Produtos</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead className="text-right">Valor (USD)</TableHead>
                        <TableHead className="text-right">Comissão</TableHead>
                        <TableHead className="text-center">Faixa</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead className="text-center">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* Render barter client groups first */}
                      {barterClientGroups.map((group) => {
                        const isExpanded = expandedBarterClients.has(group.clientId);
                        return (
                          <>
                            {/* Barter client summary row */}
                            <TableRow 
                              key={`barter-${group.clientId}`} 
                              className="bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/40 cursor-pointer"
                              onClick={() => toggleBarterClient(group.clientId)}
                              data-testid={`barter-client-${group.clientId}`}
                            >
                              <TableCell>
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 inline mr-2" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 inline mr-2" />
                                )}
                                {group.salesCount} venda(s)
                              </TableCell>
                              <TableCell className="font-bold flex items-center gap-2">
                                {group.clientName}
                                <Badge className={getTierBadgeClass('barter')}>
                                  <Repeat className="h-3 w-3 mr-1" />
                                  BARTER
                                </Badge>
                              </TableCell>
                              <TableCell colSpan={3} className="text-muted-foreground italic">
                                {group.salesCount} produto(s)
                              </TableCell>
                              <TableCell className="text-right font-mono font-bold">
                                ${group.totalAmount.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right font-mono text-verde font-bold">
                                ${group.totalCommission.toLocaleString()}
                              </TableCell>
                              <TableCell></TableCell>
                              <TableCell></TableCell>
                              <TableCell className="text-center">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openManualCommissionModal(group.clientId);
                                  }}
                                  data-testid={`button-manual-commission-${group.clientId}`}
                                >
                                  <DollarSign className="h-4 w-4 mr-1" />
                                  Comissão
                                </Button>
                              </TableCell>
                            </TableRow>

                            {/* Expanded product rows */}
                            {isExpanded && group.sales.map((sale) => (
                              <TableRow 
                                key={sale.id} 
                                className="bg-blue-50/50 dark:bg-blue-950/10"
                                data-testid={`barter-sale-${sale.id}`}
                              >
                                <TableCell className="pl-8">
                                  {format(new Date(sale.saleDate), "dd/MM/yyyy")}
                                </TableCell>
                                <TableCell className="text-muted-foreground italic pl-8">
                                  → Produto
                                </TableCell>
                                <TableCell>
                                  {getProductName(sale.productId)}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {sale.quantity ? parseFloat(sale.quantity).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '-'}
                                </TableCell>
                                <TableCell>
                                  {getCategoryName(sale.categoryId)}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  ${parseFloat(sale.totalAmount).toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right font-mono text-verde">
                                  ${parseFloat(sale.commissionAmount).toLocaleString()}
                                </TableCell>
                                <TableCell></TableCell>
                                <TableCell>
                                  {format(new Date(sale.dueDate), "dd/MM/yyyy")}
                                </TableCell>
                                <TableCell></TableCell>
                              </TableRow>
                            ))}
                          </>
                        );
                      })}

                      {/* Render normal sales */}
                      {normalSales.map((sale) => (
                        <TableRow key={sale.id} data-testid={`sale-row-${sale.id}`}>
                          <TableCell>
                            {format(new Date(sale.saleDate), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell className="font-medium">
                            {getClientName(sale.clientId)}
                          </TableCell>
                          <TableCell>
                            {getProductName(sale.productId)}
                            {sale.isManual && (
                              <Badge variant="outline" className="ml-2 text-xs">
                                Manual
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono" data-testid={`quantity-${sale.id}`}>
                            {sale.quantity ? parseFloat(sale.quantity).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '-'}
                          </TableCell>
                          <TableCell>
                            {getCategoryName(sale.categoryId)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            ${parseFloat(sale.totalAmount).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-mono text-verde">
                            ${parseFloat(sale.commissionAmount).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={`${getTierBadgeClass(sale.commissionTier)} capitalize`}>
                              {sale.commissionTier}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {format(new Date(sale.dueDate), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingSale(sale)}
                              data-testid={`button-edit-sale-${sale.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
            </TabsContent>

            <TabsContent value="timac" className="space-y-6">
              {/* Resumo Pontos Timac */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-chart-2/10 rounded-lg flex items-center justify-center">
                        <Award className="text-chart-2" size={24} />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total de Pontos</p>
                        <p className="text-2xl font-bold font-mono">{totalTimacPoints.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-verde/10 rounded-lg flex items-center justify-center">
                        <DollarSign className="text-verde" size={24} />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Valor por Ponto</p>
                        <p className="text-2xl font-bold font-mono text-verde">${timacRewardPerPoint.toFixed(2)} USD</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                        <DollarSign className="text-primary" size={24} />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Premiação Total</p>
                        <p className="text-2xl font-bold font-mono">${totalTimacReward.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Tabela Detalhada Pontos Timac */}
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Análise Detalhada de Pontos Timac</CardTitle>
                </CardHeader>
                <CardContent>
                  {timacSales.length === 0 ? (
                    <div className="text-center py-12">
                      <Award className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">Nenhuma venda com pontos Timac encontrada</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Produtos Timac da categoria Especialidades geram pontos de premiação
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Produto</TableHead>
                            <TableHead>Marca</TableHead>
                            <TableHead>Data</TableHead>
                            <TableHead>Safra</TableHead>
                            <TableHead className="text-right">Cant. Pedido</TableHead>
                            <TableHead className="text-right">Package Size</TableHead>
                            <TableHead className="text-right">Quantidade Total</TableHead>
                            <TableHead className="text-right">Pts/Unidade</TableHead>
                            <TableHead className="text-right">Total Pontos</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {timacSales.map((sale) => {
                            const product = products?.find(p => p.id === sale.productId);
                            const productName = product?.name || "Produto manual";
                            const marca = product?.marca || "-";
                            const packageSize = product?.packageSize ? parseFloat(product.packageSize) : 1;
                            
                            // Calcular Cant. Pedido baseado em quantity e packageSize
                            const quantity = sale.quantity ? parseFloat(sale.quantity) : 0;
                            const cantPedido = packageSize > 0 ? quantity / packageSize : 0;
                            
                            // Quantidade total = Cant. Pedido × Package Size
                            const quantidadeTotal = cantPedido * packageSize;
                            
                            // Use timacPoints from product database
                            const ptsPerUnit = product?.timacPoints ? parseFloat(product.timacPoints) : 0;
                            
                            // Total de pontos = Pts/Unidade × Quantidade Total
                            const totalPontos = ptsPerUnit * quantidadeTotal;
                            
                            const season = seasons?.find(s => s.id === sale.seasonId);
                            
                            return (
                              <TableRow key={sale.id} data-testid={`timac-sale-${sale.id}`}>
                                <TableCell className="font-medium">
                                  {getClientName(sale.clientId)}
                                </TableCell>
                                <TableCell>
                                  {productName}
                                </TableCell>
                                <TableCell>
                                  {marca}
                                </TableCell>
                                <TableCell>
                                  {format(new Date(sale.saleDate), "dd/MM/yyyy")}
                                </TableCell>
                                <TableCell>
                                  {season?.name || '-'}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {cantPedido.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {packageSize.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {quantidadeTotal.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {ptsPerUnit}
                                </TableCell>
                                <TableCell className="text-right font-mono font-bold text-verde">
                                  {totalPontos.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
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
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <NewSaleModal 
        isOpen={showNewSaleModal} 
        onClose={() => setShowNewSaleModal(false)} 
      />
      
      <EditSaleModal 
        isOpen={!!editingSale} 
        onClose={() => setEditingSale(null)} 
        sale={editingSale}
      />

      {/* Manual Commission Modal */}
      <Dialog open={showManualCommissionModal} onOpenChange={setShowManualCommissionModal}>
        <DialogContent data-testid="manual-commission-modal">
          <DialogHeader>
            <DialogTitle>Comissão Manual - BARTER</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="client-name">Cliente</Label>
              <Input
                id="client-name"
                value={selectedBarterClientId ? getClientName(selectedBarterClientId) : ''}
                disabled
                className="bg-muted"
              />
            </div>
            <div>
              <Label htmlFor="commission-amount">Valor da Comissão (USD)</Label>
              <Input
                id="commission-amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={manualCommissionValue}
                onChange={(e) => setManualCommissionValue(e.target.value)}
                data-testid="input-manual-commission"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Este valor será aplicado a todas as vendas barter deste cliente
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowManualCommissionModal(false);
                setManualCommissionValue("");
                setSelectedBarterClientId(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleManualCommissionSubmit}
              disabled={manualCommissionMutation.isPending}
              data-testid="button-submit-manual-commission"
            >
              {manualCommissionMutation.isPending ? "Salvando..." : "Salvar Comissão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fullscreen Dialog */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-background">
          <div className="h-screen flex flex-col">
            {/* Header with close button */}
            <div className="bg-card border-b border-border px-8 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-foreground">Gestão de Vendas</h2>
                <p className="text-sm text-muted-foreground">Controle e acompanhamento de todas as vendas</p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setIsFullscreen(false)}
                  data-testid="button-close-fullscreen"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Content - scrollable */}
            <div className="flex-1 overflow-y-auto p-8">
              {/* Same Tabs content as main view */}
              <Tabs defaultValue="vendas" className="space-y-6">
                {/* Cards de navegação e resumo na mesma linha */}
                <div className="flex gap-6">
                  {/* Cards de navegação quadrados lado a lado */}
                  <TabsList className="grid grid-cols-2 h-auto bg-transparent p-0 gap-3">
                    <TabsTrigger 
                      value="vendas" 
                      data-testid="tab-vendas-fullscreen"
                      className="h-auto p-0 bg-transparent border-0 data-[state=active]:bg-transparent"
                      asChild
                    >
                      <Card className="shadow-sm cursor-pointer transition-all aspect-square data-[state=active]:ring-2 data-[state=active]:ring-amber-500 data-[state=active]:bg-amber-50 hover:shadow-md w-32">
                        <CardContent className="p-4 h-full flex flex-col items-center justify-center text-center">
                          <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center mb-2">
                            <DollarSign className="text-amber-500" size={20} />
                          </div>
                          <p className="text-sm font-semibold">Vendas</p>
                        </CardContent>
                      </Card>
                    </TabsTrigger>
                    
                    <TabsTrigger 
                      value="timac" 
                      data-testid="tab-timac-fullscreen"
                      className="h-auto p-0 bg-transparent border-0 data-[state=active]:bg-transparent"
                      asChild
                    >
                      <Card className="shadow-sm cursor-pointer transition-all aspect-square data-[state=active]:ring-2 data-[state=active]:ring-blue-500 data-[state=active]:bg-blue-50 hover:shadow-md w-32">
                        <CardContent className="p-4 h-full flex flex-col items-center justify-center text-center">
                          <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center mb-2">
                            <Award className="text-blue-500" size={20} />
                          </div>
                          <p className="text-sm font-semibold">Pontos Timac</p>
                        </CardContent>
                      </Card>
                    </TabsTrigger>
                  </TabsList>

                  {/* Cards de resumo compactos */}
                  <div className="flex gap-4 flex-1">
                    <Card className="shadow-sm flex-1">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                            <DollarSign className="text-primary" size={20} />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Total de Vendas</p>
                            <p className="text-xl font-bold font-mono">${totalSales.toLocaleString()}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="shadow-sm flex-1">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-verde/10 rounded-lg flex items-center justify-center flex-shrink-0">
                            <DollarSign className="text-verde" size={20} />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Total de Comissões</p>
                            <p className="text-xl font-bold font-mono text-verde">${totalCommissions.toLocaleString()}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {totalSales > 0 ? ((totalCommissions / totalSales) * 100).toFixed(2) : 0}% sobre vendas
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="shadow-sm flex-1">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-chart-2/10 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Calendar className="text-chart-2" size={20} />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Total de Vendas</p>
                            <p className="text-xl font-bold">{filteredSales.length}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                <TabsContent value="vendas" className="space-y-6">
              {/* Filters and Actions */}
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Filtros e Ações</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-64">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por cliente ou produto..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                      data-testid="search-sales-fullscreen"
                    />
                  </div>
                </div>

                <Select value={selectedSeason} onValueChange={setSelectedSeason}>
                  <SelectTrigger className="w-48" data-testid="filter-season-fullscreen">
                    <SelectValue placeholder="Filtrar por safra" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as safras</SelectItem>
                    {seasons?.map((season: any) => (
                      <SelectItem key={season.id} value={season.id}>
                        {season.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-48" data-testid="filter-category-fullscreen">
                    <SelectValue placeholder="Filtrar por categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as categorias</SelectItem>
                    {categories?.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedMarca} onValueChange={setSelectedMarca}>
                  <SelectTrigger className="w-48" data-testid="filter-marca-fullscreen">
                    <SelectValue placeholder="Filtrar por fabricante" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os fabricantes</SelectItem>
                    {uniqueMarcas?.map((marca) => (
                      <SelectItem key={marca.value} value={marca.value}>
                        {marca.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                  <SelectTrigger className="w-48" data-testid="filter-product-fullscreen">
                    <SelectValue placeholder="Filtrar por produto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os produtos</SelectItem>
                    {availableProducts.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-48" data-testid="filter-month-fullscreen">
                    <SelectValue placeholder="Filtrar por mês" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os meses</SelectItem>
                    {MONTHS.map((month) => (
                      <SelectItem key={month.value} value={month.value}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex gap-2">
                  <Button variant="outline" data-testid="button-export-fullscreen">
                    <Download className="h-4 w-4 mr-2" />
                    Exportar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sales Table */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Lista de Vendas</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredSales.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">Nenhuma venda encontrada</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">Cant. Produtos</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead className="text-right">Valor (USD)</TableHead>
                        <TableHead className="text-right">Comissão</TableHead>
                        <TableHead className="text-center">Faixa</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead className="text-center">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* Render barter client groups first */}
                      {barterClientGroups.map((group) => {
                        const isExpanded = expandedBarterClients.has(group.clientId);
                        return (
                          <>
                            {/* Barter client summary row */}
                            <TableRow 
                              key={`barter-${group.clientId}`} 
                              className="bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/40 cursor-pointer"
                              onClick={() => toggleBarterClient(group.clientId)}
                              data-testid={`barter-client-${group.clientId}-fullscreen`}
                            >
                              <TableCell>
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 inline mr-2" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 inline mr-2" />
                                )}
                                {group.salesCount} venda(s)
                              </TableCell>
                              <TableCell className="font-bold flex items-center gap-2">
                                {group.clientName}
                                <Badge className={getTierBadgeClass('barter')}>
                                  <Repeat className="h-3 w-3 mr-1" />
                                  BARTER
                                </Badge>
                              </TableCell>
                              <TableCell colSpan={3} className="text-muted-foreground italic">
                                {group.salesCount} produto(s)
                              </TableCell>
                              <TableCell className="text-right font-mono font-bold">
                                ${group.totalAmount.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right font-mono text-verde font-bold">
                                ${group.totalCommission.toLocaleString()}
                              </TableCell>
                              <TableCell></TableCell>
                              <TableCell></TableCell>
                              <TableCell className="text-center">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openManualCommissionModal(group.clientId);
                                  }}
                                  data-testid={`button-manual-commission-${group.clientId}-fullscreen`}
                                >
                                  <DollarSign className="h-4 w-4 mr-1" />
                                  Comissão
                                </Button>
                              </TableCell>
                            </TableRow>

                            {/* Expanded product rows */}
                            {isExpanded && group.sales.map((sale) => (
                              <TableRow 
                                key={sale.id} 
                                className="bg-blue-50/50 dark:bg-blue-950/10"
                                data-testid={`barter-sale-${sale.id}-fullscreen`}
                              >
                                <TableCell className="pl-8">
                                  {format(new Date(sale.saleDate), "dd/MM/yyyy")}
                                </TableCell>
                                <TableCell className="text-muted-foreground italic pl-8">
                                  → Produto
                                </TableCell>
                                <TableCell>
                                  {getProductName(sale.productId)}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {sale.quantity ? parseFloat(sale.quantity).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '-'}
                                </TableCell>
                                <TableCell>
                                  {getCategoryName(sale.categoryId)}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  ${parseFloat(sale.totalAmount).toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right font-mono text-verde">
                                  ${parseFloat(sale.commissionAmount).toLocaleString()}
                                </TableCell>
                                <TableCell></TableCell>
                                <TableCell>
                                  {format(new Date(sale.dueDate), "dd/MM/yyyy")}
                                </TableCell>
                                <TableCell></TableCell>
                              </TableRow>
                            ))}
                          </>
                        );
                      })}

                      {/* Render normal sales */}
                      {normalSales.map((sale) => (
                        <TableRow key={sale.id} data-testid={`sale-row-${sale.id}-fullscreen`}>
                          <TableCell>
                            {format(new Date(sale.saleDate), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell className="font-medium">
                            {getClientName(sale.clientId)}
                          </TableCell>
                          <TableCell>
                            {getProductName(sale.productId)}
                            {sale.isManual && (
                              <Badge variant="outline" className="ml-2 text-xs">
                                Manual
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono" data-testid={`quantity-${sale.id}-fullscreen`}>
                            {sale.quantity ? parseFloat(sale.quantity).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '-'}
                          </TableCell>
                          <TableCell>
                            {getCategoryName(sale.categoryId)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            ${parseFloat(sale.totalAmount).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-mono text-verde">
                            ${parseFloat(sale.commissionAmount).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={`${getTierBadgeClass(sale.commissionTier)} capitalize`}>
                              {sale.commissionTier}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {format(new Date(sale.dueDate), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingSale(sale)}
                              data-testid={`button-edit-sale-${sale.id}-fullscreen`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
            </TabsContent>

            <TabsContent value="timac" className="space-y-6">
              {/* Resumo Pontos Timac */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-chart-2/10 rounded-lg flex items-center justify-center">
                        <Award className="text-chart-2" size={24} />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total de Pontos</p>
                        <p className="text-2xl font-bold font-mono">{totalTimacPoints.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-verde/10 rounded-lg flex items-center justify-center">
                        <DollarSign className="text-verde" size={24} />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Valor por Ponto</p>
                        <p className="text-2xl font-bold font-mono text-verde">${timacRewardPerPoint.toFixed(2)} USD</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                        <DollarSign className="text-primary" size={24} />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Premiação Total</p>
                        <p className="text-2xl font-bold font-mono">${totalTimacReward.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Tabela Detalhada Pontos Timac */}
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Análise Detalhada de Pontos Timac</CardTitle>
                </CardHeader>
                <CardContent>
                  {timacSales.length === 0 ? (
                    <div className="text-center py-12">
                      <Award className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">Nenhuma venda com pontos Timac encontrada</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Produtos Timac da categoria Especialidades geram pontos de premiação
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Produto</TableHead>
                            <TableHead>Marca</TableHead>
                            <TableHead>Data</TableHead>
                            <TableHead>Safra</TableHead>
                            <TableHead className="text-right">Cant. Pedido</TableHead>
                            <TableHead className="text-right">Package Size</TableHead>
                            <TableHead className="text-right">Quantidade Total</TableHead>
                            <TableHead className="text-right">Pts/Unidade</TableHead>
                            <TableHead className="text-right">Total Pontos</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {timacSales.map((sale) => {
                            const product = products?.find(p => p.id === sale.productId);
                            const productName = product?.name || "Produto manual";
                            const marca = product?.marca || "-";
                            const packageSize = product?.packageSize ? parseFloat(product.packageSize) : 1;
                            
                            // Calcular Cant. Pedido baseado em quantity e packageSize
                            const quantity = sale.quantity ? parseFloat(sale.quantity) : 0;
                            const cantPedido = packageSize > 0 ? quantity / packageSize : 0;
                            
                            // Quantidade total = Cant. Pedido × Package Size
                            const quantidadeTotal = cantPedido * packageSize;
                            
                            // Use timacPoints from product database
                            const ptsPerUnit = product?.timacPoints ? parseFloat(product.timacPoints) : 0;
                            
                            // Total de pontos = Pts/Unidade × Quantidade Total
                            const totalPontos = ptsPerUnit * quantidadeTotal;
                            
                            const season = seasons?.find(s => s.id === sale.seasonId);
                            
                            return (
                              <TableRow key={sale.id} data-testid={`timac-sale-${sale.id}-fullscreen`}>
                                <TableCell className="font-medium">
                                  {getClientName(sale.clientId)}
                                </TableCell>
                                <TableCell>
                                  {productName}
                                </TableCell>
                                <TableCell>
                                  {marca}
                                </TableCell>
                                <TableCell>
                                  {format(new Date(sale.saleDate), "dd/MM/yyyy")}
                                </TableCell>
                                <TableCell>
                                  {season?.name || '-'}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {cantPedido.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {packageSize.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {quantidadeTotal.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {ptsPerUnit}
                                </TableCell>
                                <TableCell className="text-right font-mono font-bold text-verde">
                                  {totalPontos.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
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
            </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
