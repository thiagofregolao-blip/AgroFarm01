import { useState, useEffect, Fragment } from "react";
import Navbar from "@/components/layout/navbar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Download, ChevronDown, ChevronRight, Settings, HelpCircle, Maximize2, X, Plus, Edit2, Check, Target, BarChart3 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getValidCategoriesForSeason, getSeasonTypeFromName } from "@/lib/seasons";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const AGROQUIMICOS_SUBCATEGORIES = ['Tratamento de semente', 'Dessecação', 'Inseticidas', 'Fungicidas'];

export default function Mercado() {
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedSubcategories, setExpandedSubcategories] = useState<Set<string>>(new Set());
  const [configClientId, setConfigClientId] = useState<string | null>(null);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>("");
  const [rateValues, setRateValues] = useState<Record<string, string>>({});
  const [subcategoryValues, setSubcategoryValues] = useState<Record<string, Record<string, string>>>({});
  const [externalPurchaseValues, setExternalPurchaseValues] = useState<Record<string, string>>({});
  const [externalSubcategoryValues, setExternalSubcategoryValues] = useState<Record<string, Record<string, string>>>({});
  const [benchmarkValues, setBenchmarkValues] = useState<Record<string, string>>({});
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [inlineExternalValue, setInlineExternalValue] = useState<string>("");
  const [inlineExternalCompany, setInlineExternalCompany] = useState<string>("");
  const [showMatrixDialog, setShowMatrixDialog] = useState(false);
  const [showComparisonDialog, setShowComparisonDialog] = useState(false);
  const { toast } = useToast();

  // Query for seasons
  const { data: seasons } = useQuery<Array<{
    id: string;
    name: string;
    isActive: boolean;
  }>>({
    queryKey: ["/api/seasons"],
  });

  // Query for categories
  const { data: categories } = useQuery<Array<{
    id: string;
    name: string;
  }>>({
    queryKey: ["/api/categories"],
  });

  // Get active season for queries
  const activeSeason = seasons?.find(s => s.isActive);

  const { data: marketData, isLoading } = useQuery<{
    clientAnalysis: Array<{
      clientId: string;
      clientName: string;
      plantingArea: number;
      totalPotential: number;
      totalRealized: number;
      totalPercentage: number;
      categoryDetails: Record<string, {
        categoryName: string;
        potential: number;
        cvaleAmount: number;
        externalAmount: number;
        externalCompany: string | null;
        totalRealized: number;
        opportunity: number;
        isClosed: boolean;
        percentage: number;
        hasCustomRate: boolean;
        subcategories: any;
      }>;
    }>;
    benchmark: Record<string, number>;
    opportunities: Array<{
      clientId: string;
      clientName: string;
      categoryId: string;
      categoryName: string;
      clientPercentage: number;
      marketPercentage: number;
      gap: number;
      potential: number;
      realized: number;
    }>;
  }>({
    queryKey: ["/api/market-analysis", activeSeason?.id],
    queryFn: async () => {
      const url = activeSeason?.id ? `/api/market-analysis?seasonId=${activeSeason.id}` : '/api/market-analysis';
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch market analysis');
      return res.json();
    },
    enabled: !!activeSeason?.id,
  });

  // Query for active season benchmarks
  const { data: activeSeasonBenchmarks } = useQuery<Array<{
    id: string;
    categoryId: string;
    seasonId: string;
    marketPercentage: string;
  }>>({
    queryKey: [`/api/market-benchmarks/${activeSeason?.id}`],
    enabled: !!activeSeason?.id,
  });

  const toggleClient = (clientId: string) => {
    const newExpanded = new Set(expandedClients);
    if (newExpanded.has(clientId)) {
      newExpanded.delete(clientId);
    } else {
      newExpanded.add(clientId);
    }
    setExpandedClients(newExpanded);
  };

  const toggleCategory = (clientId: string, categoryId: string) => {
    const key = `${clientId}-${categoryId}`;
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedCategories(newExpanded);
  };

  const toggleSubcategory = (clientId: string, categoryId: string, subcategoryId: string) => {
    const key = `${clientId}-${categoryId}-${subcategoryId}`;
    const newExpanded = new Set(expandedSubcategories);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedSubcategories(newExpanded);
  };

  // Query for client rates when config dialog opens
  const { data: clientRates } = useQuery<Array<{
    id: string;
    clientId: string;
    categoryId: string;
    seasonId: string;
    investmentPerHa: string;
    subcategories: any;
  }>>({
    queryKey: [`/api/clients/${configClientId}/market-rates/${selectedSeasonId}`],
    enabled: !!configClientId && !!selectedSeasonId,
  });

  // Query for external purchases when config dialog opens
  const { data: externalPurchases } = useQuery<Array<{
    id: string;
    clientId: string;
    categoryId: string;
    seasonId: string;
    amount: string;
    subcategories: any;
  }>>({
    queryKey: [`/api/clients/${configClientId}/external-purchases/${selectedSeasonId}`],
    enabled: !!configClientId && !!selectedSeasonId,
  });

  const saveRateMutation = useMutation({
    mutationFn: async ({ clientId, categoryId, seasonId, investmentPerHa, subcategories }: { clientId: string; categoryId: string; seasonId: string; investmentPerHa: string; subcategories?: any }) => {
      return apiRequest("POST", `/api/clients/${clientId}/market-rates`, {
        categoryId,
        seasonId,
        investmentPerHa,
        subcategories: subcategories || null
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/market-analysis"] });
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${configClientId}/market-rates/${selectedSeasonId}`] });
      toast({
        title: "Configuração salva",
        description: "Valores de investimento/ha atualizados com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao salvar configuração. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const saveExternalPurchaseMutation = useMutation({
    mutationFn: async ({ clientId, categoryId, seasonId, amount, subcategories }: { clientId: string; categoryId: string; seasonId: string; amount: string; subcategories?: any }) => {
      return apiRequest("POST", `/api/external-purchases`, {
        clientId,
        categoryId,
        seasonId,
        amount,
        subcategories: subcategories || null
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/market-analysis"] });
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${configClientId}/external-purchases/${selectedSeasonId}`] });
      toast({
        title: "Compra externa salva",
        description: "Valor de compra externa registrado com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao salvar compra externa. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const saveInlineExternalPurchaseMutation = useMutation({
    mutationFn: async ({ clientId, categoryId, seasonId, amount, company }: { clientId: string; categoryId: string; seasonId: string; amount: string; company?: string }) => {
      return apiRequest("POST", `/api/external-purchases`, {
        clientId,
        categoryId,
        seasonId,
        amount,
        company: company || null,
        subcategories: null
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/market-analysis"] });
      setEditingCell(null);
      setInlineExternalValue("");
      setInlineExternalCompany("");
      toast({
        title: "Compra externa salva",
        description: "Valor registrado com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao salvar. Tente novamente.",
        variant: "destructive",
      });
    },
  });


  const saveBenchmarkMutation = useMutation({
    mutationFn: async ({ categoryId, seasonId, marketPercentage }: { categoryId: string; seasonId: string; marketPercentage: string }) => {
      return apiRequest("POST", `/api/market-benchmarks`, {
        categoryId,
        seasonId,
        marketPercentage,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/market-benchmarks/${variables.seasonId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/market-analysis"] });
      setBenchmarkValues({});
      toast({
        title: "Benchmark salvo",
        description: "Valor de benchmark atualizado com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao salvar benchmark. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  // Load existing subcategories when clientRates changes
  useEffect(() => {
    if (clientRates && configClientId) {
      const subcats: Record<string, Record<string, string>> = {};
      clientRates.forEach(rate => {
        if (rate.subcategories) {
          subcats[rate.categoryId] = rate.subcategories;
        }
      });
      setSubcategoryValues(subcats);
    }
  }, [clientRates, configClientId]);

  // Load existing external purchases when externalPurchases changes
  useEffect(() => {
    if (externalPurchases && configClientId) {
      const subcats: Record<string, Record<string, string>> = {};
      externalPurchases.forEach(purchase => {
        if (purchase.subcategories) {
          subcats[purchase.categoryId] = purchase.subcategories;
        }
      });
      setExternalSubcategoryValues(subcats);
    }
  }, [externalPurchases, configClientId]);

  const openConfigDialog = (clientId: string) => {
    setConfigClientId(clientId);
    setRateValues({});
    setSubcategoryValues({});
    setExternalPurchaseValues({});
    setExternalSubcategoryValues({});
    // Set active season by default
    const activeSeason = seasons?.find(s => s.isActive);
    if (activeSeason) {
      setSelectedSeasonId(activeSeason.id);
    }
  };

  const closeConfigDialog = () => {
    setConfigClientId(null);
    setRateValues({});
    setSubcategoryValues({});
    setExternalPurchaseValues({});
    setExternalSubcategoryValues({});
    setSelectedSeasonId("");
  };

  const handleSaveRate = (categoryId: string, categoryName: string) => {
    if (!configClientId || !rateValues[categoryId] || !selectedSeasonId) return;
    
    // Check if this is Agroquímicos and has subcategories
    const isAgroquimicos = categoryName.toLowerCase().includes('agroqu');
    const subcategories = isAgroquimicos && subcategoryValues[categoryId] 
      ? subcategoryValues[categoryId]
      : undefined;
    
    saveRateMutation.mutate({
      clientId: configClientId,
      categoryId,
      seasonId: selectedSeasonId,
      investmentPerHa: rateValues[categoryId],
      subcategories,
    });
  };

  const getCurrentValue = (categoryId: string): string => {
    // Check if user has entered a value
    if (rateValues[categoryId]) return rateValues[categoryId];
    
    // Check if there's an existing client rate
    const existingRate = clientRates?.find(r => r.categoryId === categoryId);
    if (existingRate) return existingRate.investmentPerHa;
    
    return "";
  };

  const getCurrentExternalPurchaseValue = (categoryId: string): string => {
    // Check if user has entered a value
    if (externalPurchaseValues[categoryId]) return externalPurchaseValues[categoryId];
    
    // Check if there's an existing external purchase
    const existingPurchase = externalPurchases?.find(p => p.categoryId === categoryId);
    if (existingPurchase) return existingPurchase.amount;
    
    return "";
  };

  const handleSaveExternalPurchase = (categoryId: string, categoryName: string) => {
    if (!configClientId || !externalPurchaseValues[categoryId] || !selectedSeasonId) return;
    
    // Check if this is Agroquímicos and has subcategories
    const isAgroquimicos = categoryName.toLowerCase().includes('agroqu');
    const subcategories = isAgroquimicos && externalSubcategoryValues[categoryId] 
      ? externalSubcategoryValues[categoryId]
      : undefined;
    
    saveExternalPurchaseMutation.mutate({
      clientId: configClientId,
      categoryId,
      seasonId: selectedSeasonId,
      amount: externalPurchaseValues[categoryId],
      subcategories,
    });
  };

  const handleOpenInlineEdit = async (clientId: string, categoryId: string, currentValue: number) => {
    setInlineExternalValue(currentValue > 0 ? currentValue.toString() : "");
    
    // Fetch existing external purchase to get company name
    if (activeSeason) {
      try {
        const response = await fetch(`/api/clients/${clientId}/external-purchases/${activeSeason.id}`);
        if (response.ok) {
          const purchases = await response.json();
          const existingPurchase = purchases.find((p: any) => p.categoryId === categoryId);
          setInlineExternalCompany(existingPurchase?.company || "");
        } else {
          setInlineExternalCompany("");
        }
      } catch (error) {
        console.error('Error fetching external purchase:', error);
        setInlineExternalCompany("");
      }
    } else {
      setInlineExternalCompany("");
    }
  };

  const handleSaveInlineExternal = (clientId: string, categoryId: string) => {
    if (!activeSeason || !inlineExternalValue) return;

    saveInlineExternalPurchaseMutation.mutate({
      clientId,
      categoryId,
      seasonId: activeSeason.id,
      amount: inlineExternalValue,
      company: inlineExternalCompany || undefined,
    });
  };



  const exportPDF = () => {
    if (!marketData) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Title
    doc.setFontSize(18);
    doc.text("Análise de Mercado - Agro Farm Digital", pageWidth / 2, 15, { align: "center" });
    
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, pageWidth / 2, 22, { align: "center" });

    // Benchmark Section
    doc.setFontSize(14);
    doc.text("Benchmark Regional", 14, 35);
    
    const benchmarkData = Object.entries(marketData.benchmark).map(([categoryId, percentage]) => {
      const categoryName = marketData.clientAnalysis[0]?.categoryDetails[categoryId]?.categoryName || categoryId;
      return [categoryName, `${percentage.toFixed(1)}%`];
    });

    autoTable(doc, {
      startY: 40,
      head: [["Segmento", "% Mercado"]],
      body: benchmarkData,
      theme: "striped",
      headStyles: { fillColor: [74, 144, 226] },
    });

    // Client Analysis Section
    const clientAnalysisY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(14);
    doc.text("Análise por Cliente", 14, clientAnalysisY);

    const clientData = marketData.clientAnalysis.map((client) => [
      client.clientName,
      client.plantingArea.toLocaleString(),
      `$${client.totalPotential.toLocaleString()}`,
      `$${client.totalRealized.toLocaleString()}`,
      `${client.totalPercentage.toFixed(1)}%`,
    ]);

    autoTable(doc, {
      startY: clientAnalysisY + 5,
      head: [["Cliente", "Área (ha)", "Potencial", "Realizado", "% Rodado"]],
      body: clientData,
      theme: "striped",
      headStyles: { fillColor: [74, 144, 226] },
    });

    // Opportunities Section
    const opportunitiesY = (doc as any).lastAutoTable.finalY + 15;
    
    // Check if we need a new page
    if (opportunitiesY > 250) {
      doc.addPage();
      doc.setFontSize(14);
      doc.text("Oportunidades Comerciais", 14, 20);
      
      const oppData = marketData.opportunities?.slice(0, 15).map((opp) => [
        opp.clientName,
        opp.categoryName,
        `${opp.clientPercentage.toFixed(1)}%`,
        `${opp.marketPercentage.toFixed(1)}%`,
        `+${opp.gap.toFixed(1)}%`,
        `$${opp.potential.toLocaleString()}`,
      ]);

      autoTable(doc, {
        startY: 25,
        head: [["Cliente", "Segmento", "% Cliente", "% Mercado", "Gap", "Potencial"]],
        body: oppData,
        theme: "striped",
        headStyles: { fillColor: [74, 144, 226] },
      });
    } else {
      doc.setFontSize(14);
      doc.text("Oportunidades Comerciais", 14, opportunitiesY);
      
      const oppData = marketData.opportunities?.slice(0, 15).map((opp) => [
        opp.clientName,
        opp.categoryName,
        `${opp.clientPercentage.toFixed(1)}%`,
        `${opp.marketPercentage.toFixed(1)}%`,
        `+${opp.gap.toFixed(1)}%`,
        `$${opp.potential.toLocaleString()}`,
      ]);

      autoTable(doc, {
        startY: opportunitiesY + 5,
        head: [["Cliente", "Segmento", "% Cliente", "% Mercado", "Gap", "Potencial"]],
        body: oppData,
        theme: "striped",
        headStyles: { fillColor: [74, 144, 226] },
      });
    }

    // Save the PDF
    doc.save(`analise-mercado-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Cálculo da Matriz Potencial x Participação
  const calculateMatrix = () => {
    if (!marketData?.clientAnalysis) return { clients: [], stats: null };
    
    const clients = marketData.clientAnalysis.map(client => {
      const participation = client.totalPotential > 0 
        ? (client.totalRealized / client.totalPotential) * 100 
        : 0;
      
      return {
        id: client.clientId,
        name: client.clientName,
        area: client.plantingArea,
        potential: client.totalPotential,
        realized: client.totalRealized,
        participation: participation,
      };
    });
    
    // Ordenar por potencial (área de plantio como proxy)
    const sortedByPotential = [...clients].sort((a, b) => b.area - a.area);
    const top30Index = Math.ceil(clients.length * 0.3);
    const bottom30Index = Math.floor(clients.length * 0.7);
    
    // Classificar cada cliente
    const classified = clients.map(client => {
      const potentialIndex = sortedByPotential.findIndex(c => c.id === client.id);
      const potentialLevel = potentialIndex < top30Index ? 'ALTO' : 
                            potentialIndex >= bottom30Index ? 'BAIXO' : 'MÉDIO';
      
      const participationLevel = client.participation >= 50 ? 'ALTA' : 
                                 client.participation < 30 ? 'BAIXA' : 'MÉDIA';
      
      // Definir quadrante (baseado nos critérios da literatura)
      let quadrant = '';
      let strategy = '';
      
      if (potentialLevel === 'ALTO' && participationLevel === 'ALTA') {
        // Top 30% potencial + ≥50% participação
        quadrant = 'Estrelas';
        strategy = 'DEFENDER e CRESCER JUNTO';
      } else if (potentialLevel === 'ALTO' && (participationLevel === 'BAIXA' || participationLevel === 'MÉDIA')) {
        // Top 30% potencial + <50% participação
        quadrant = 'Diamantes Brutos';
        strategy = 'INVESTIR para CONQUISTAR';
      } else if ((potentialLevel === 'BAIXO' || potentialLevel === 'MÉDIO') && participationLevel === 'ALTA') {
        // Não top 30% potencial + ≥50% participação
        quadrant = 'Vacas Leiteiras';
        strategy = 'MANTER eficiência';
      } else {
        // Não top 30% potencial + <50% participação
        quadrant = 'Ocasionais';
        strategy = 'Atendimento BÁSICO';
      }
      
      return {
        ...client,
        potentialLevel,
        participationLevel,
        quadrant,
        strategy,
      };
    });
    
    // Estatísticas por quadrante
    const stats = {
      stars: classified.filter(c => c.quadrant === 'Estrelas').length,
      diamonds: classified.filter(c => c.quadrant === 'Diamantes Brutos').length,
      cows: classified.filter(c => c.quadrant === 'Vacas Leiteiras').length,
      ocasionals: classified.filter(c => c.quadrant === 'Ocasionais').length,
    };
    
    return { clients: classified, stats };
  };
  
  const matrixData = calculateMatrix();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" data-testid="mercado-container">
      <Header 
        title="Análise de Mercado"
        subtitle="Potencial vs Realizado por Cliente"
        onNewSale={() => {}}
      />
      <Navbar />
      
      <main className="flex-1 overflow-y-auto">
        
        {/* Botões de Ação */}
        {/* <div className="px-8 pt-4 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMatrixDialog(true)}
            className="gap-2"
            data-testid="button-matrix-analysis"
          >
            <Target className="h-4 w-4" />
            Matriz Potencial x Participação
          </Button>
        </div> */}

        <div className="p-8 pt-8">
          {/* Header with Export Button */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Análise de Mercado {activeSeason && `- ${activeSeason.name}`}</h2>
            <div className="flex gap-2">
              <Button onClick={() => setShowComparisonDialog(true)} variant="outline" data-testid="button-comparison-table">
                <BarChart3 className="mr-2 h-4 w-4" />
                Ver Comparativo
              </Button>
            </div>
          </div>

          {/* Client Analysis Table */}
          <Card className="shadow-sm mb-8" data-testid="card-client-analysis">
            <CardHeader>
              <CardTitle>Análise por Cliente</CardTitle>
              <p className="text-sm text-muted-foreground">Potencial e realização por segmento</p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Área (ha)</TableHead>
                    <TableHead className="text-right">Potencial (USD)</TableHead>
                    <TableHead className="text-right">Realizado (USD)</TableHead>
                    <TableHead className="text-right">% Rodado</TableHead>
                    <TableHead className="text-center w-24">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {marketData?.clientAnalysis
                    .sort((a, b) => a.clientName.localeCompare(b.clientName))
                    .map((client) => {
                      const hasNoPlantingArea = !client.plantingArea || client.plantingArea === 0;
                      return (
                    <>
                      <TableRow 
                        key={client.clientId} 
                        className={`hover:bg-muted/50 ${hasNoPlantingArea ? 'bg-orange-50/50' : ''}`}
                        data-testid={`row-client-${client.clientId}`}
                      >
                        <TableCell 
                          className="cursor-pointer"
                          onClick={() => toggleClient(client.clientId)}
                        >
                          {expandedClients.has(client.clientId) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium cursor-pointer" onClick={() => toggleClient(client.clientId)}>
                          {client.clientName}
                          {hasNoPlantingArea && (
                            <span className="ml-2 text-xs text-orange-600 font-normal">⚠️ Sem área</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right cursor-pointer" onClick={() => toggleClient(client.clientId)}>
                          {hasNoPlantingArea ? (
                            <span className="text-orange-600 font-medium">-</span>
                          ) : (
                            client.plantingArea.toLocaleString()
                          )}
                        </TableCell>
                        <TableCell className="text-right cursor-pointer" onClick={() => toggleClient(client.clientId)}>${client.totalPotential.toLocaleString()}</TableCell>
                        <TableCell className="text-right cursor-pointer" onClick={() => toggleClient(client.clientId)}>${client.totalRealized.toLocaleString()}</TableCell>
                        <TableCell className="text-right cursor-pointer" onClick={() => toggleClient(client.clientId)}>
                          <div className="flex items-center justify-end gap-2">
                            <span className="font-semibold">{client.totalPercentage.toFixed(1)}%</span>
                            <Progress 
                              value={Math.min(client.totalPercentage, 100)} 
                              className="h-2 w-20" 
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              openConfigDialog(client.clientId);
                            }}
                            data-testid={`button-config-${client.clientId}`}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                      {expandedClients.has(client.clientId) && (
                        <TableRow>
                          <TableCell colSpan={7} className="bg-gray-50 p-0">
                            <div className="py-4 px-6">
                              <p className="text-sm font-semibold mb-3">Detalhamento por Segmento:</p>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="w-8"></TableHead>
                                    <TableHead>Segmento</TableHead>
                                    <TableHead className="text-right">Potencial</TableHead>
                                    <TableHead className="text-right">C.Vale</TableHead>
                                    <TableHead className="text-right">Outras</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                    <TableHead className="text-right">Oportunidades</TableHead>
                                    <TableHead className="text-center">Status</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {Object.entries(client.categoryDetails)
                                    .filter(([_, details]) => details.potential > 0 || details.totalRealized > 0)
                                    .map(([categoryId, details]) => {
                                      const isAgroquimicos = details.categoryName.toLowerCase().includes('agroqu');
                                      const hasSubcategories = Array.isArray(details.subcategories) && details.subcategories.length > 0;
                                      const categoryKey = `${client.clientId}-${categoryId}`;
                                      const isCategoryExpanded = expandedCategories.has(categoryKey);
                                      
                                      return (
                                        <>
                                          <TableRow 
                                            key={categoryId}
                                            className={hasSubcategories ? 'hover:bg-muted/50 cursor-pointer' : ''}
                                            onClick={() => {
                                              if (hasSubcategories) {
                                                toggleCategory(client.clientId, categoryId);
                                              }
                                            }}
                                          >
                                            <TableCell className="w-8">
                                              {hasSubcategories && (
                                                isCategoryExpanded ? (
                                                  <ChevronDown className="h-4 w-4" />
                                                ) : (
                                                  <ChevronRight className="h-4 w-4" />
                                                )
                                              )}
                                            </TableCell>
                                            <TableCell className="font-medium">{details.categoryName}</TableCell>
                                            <TableCell className="text-right">${details.potential.toLocaleString()}</TableCell>
                                            <TableCell className="text-right text-green-700 font-medium">${details.cvaleAmount.toLocaleString()}</TableCell>
                                            <TableCell 
                                              className="text-right text-orange-600"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              <Popover
                                                onOpenChange={(open) => {
                                                  if (open) {
                                                    handleOpenInlineEdit(client.clientId, categoryId, details.externalAmount);
                                                  } else {
                                                    setInlineExternalValue("");
                                                    setInlineExternalCompany("");
                                                  }
                                                }}
                                              >
                                                <PopoverTrigger asChild>
                                                  <button 
                                                    className="hover:bg-orange-100 px-2 py-1 rounded transition-colors flex items-center gap-1 w-full justify-end"
                                                    data-testid={`button-edit-external-${client.clientId}-${categoryId}`}
                                                  >
                                                    <div className="flex flex-col items-end">
                                                      <span>${details.externalAmount.toLocaleString()}</span>
                                                      {details.externalCompany && (
                                                        <span className="text-xs text-muted-foreground">{details.externalCompany}</span>
                                                      )}
                                                    </div>
                                                    <Edit2 className="h-3 w-3 opacity-50" />
                                                  </button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-80" align="end">
                                                  <div className="space-y-3">
                                                    <div className="space-y-2">
                                                      <Label htmlFor={`inline-value-${client.clientId}-${categoryId}`}>
                                                        Valor (USD)
                                                      </Label>
                                                      <Input
                                                        id={`inline-value-${client.clientId}-${categoryId}`}
                                                        type="number"
                                                        placeholder="Ex: 5000"
                                                        value={inlineExternalValue}
                                                        onChange={(e) => setInlineExternalValue(e.target.value)}
                                                        data-testid={`input-inline-value-${client.clientId}-${categoryId}`}
                                                      />
                                                    </div>
                                                    <div className="space-y-2">
                                                      <Label htmlFor={`inline-company-${client.clientId}-${categoryId}`}>
                                                        Empresa (opcional)
                                                      </Label>
                                                      <Input
                                                        id={`inline-company-${client.clientId}-${categoryId}`}
                                                        type="text"
                                                        placeholder="Ex: Empresa Concorrente"
                                                        value={inlineExternalCompany}
                                                        onChange={(e) => setInlineExternalCompany(e.target.value)}
                                                        data-testid={`input-inline-company-${client.clientId}-${categoryId}`}
                                                      />
                                                    </div>
                                                    <Button
                                                      onClick={() => handleSaveInlineExternal(client.clientId, categoryId)}
                                                      disabled={!inlineExternalValue || saveInlineExternalPurchaseMutation.isPending}
                                                      className="w-full"
                                                      data-testid={`button-save-inline-${client.clientId}-${categoryId}`}
                                                    >
                                                      <Check className="h-4 w-4 mr-2" />
                                                      {saveInlineExternalPurchaseMutation.isPending ? "Salvando..." : "Salvar"}
                                                    </Button>
                                                  </div>
                                                </PopoverContent>
                                              </Popover>
                                            </TableCell>
                                            <TableCell className="text-right font-semibold">${details.totalRealized.toLocaleString()}</TableCell>
                                            <TableCell className="text-right">
                                              {details.opportunity > 0 ? (
                                                <span className="text-blue-600 font-medium">${details.opportunity.toLocaleString()}</span>
                                              ) : (
                                                <span className="text-gray-400">-</span>
                                              )}
                                            </TableCell>
                                            <TableCell className="text-center">
                                              {details.isClosed ? (
                                                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded">FECHADO</span>
                                              ) : details.percentage >= 50 ? (
                                                <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded">EM PROGRESSO</span>
                                              ) : (
                                                <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded">ABERTO</span>
                                              )}
                                            </TableCell>
                                          </TableRow>
                                          {/* Subcategory rows for Agroquímicos */}
                                          {isAgroquimicos && hasSubcategories && isCategoryExpanded && Array.isArray(details.subcategories) && (
                                            <>
                                              {details.subcategories
                                                .filter((sub: any) => sub.totalAmount > 0)
                                                .map((sub: any) => {
                                                  const subcategoryKey = `${client.clientId}-${categoryId}-${sub.id}`;
                                                  const isSubcategoryExpanded = expandedSubcategories.has(subcategoryKey);
                                                  const hasProducts = Array.isArray(sub.products) && sub.products.length > 0;
                                                  
                                                  return (
                                                    <Fragment key={`${client.clientId}-${categoryId}-${sub.id}`}>
                                                      <TableRow 
                                                        className={`bg-gray-100/50 ${hasProducts ? 'hover:bg-gray-200/50 cursor-pointer' : ''}`}
                                                        onClick={() => {
                                                          if (hasProducts) {
                                                            toggleSubcategory(client.clientId, categoryId, sub.id);
                                                          }
                                                        }}
                                                      >
                                                        <TableCell className="w-8 pl-4">
                                                          {hasProducts && (
                                                            isSubcategoryExpanded ? (
                                                              <ChevronDown className="h-3 w-3" />
                                                            ) : (
                                                              <ChevronRight className="h-3 w-3" />
                                                            )
                                                          )}
                                                        </TableCell>
                                                        <TableCell className="pl-8 text-sm text-gray-600">↳ {sub.name}</TableCell>
                                                        <TableCell className="text-right text-sm text-gray-600">-</TableCell>
                                                        <TableCell className="text-right text-sm text-green-700">${sub.cvaleAmount.toLocaleString()}</TableCell>
                                                        <TableCell className="text-right text-sm text-orange-600">${sub.externalAmount.toLocaleString()}</TableCell>
                                                        <TableCell className="text-right text-sm text-gray-700 font-medium">${sub.totalAmount.toLocaleString()}</TableCell>
                                                        <TableCell className="text-right text-sm text-gray-600">-</TableCell>
                                                        <TableCell className="text-center text-sm text-gray-600">-</TableCell>
                                                      </TableRow>
                                                      
                                                      {/* Product rows for this subcategory */}
                                                      {hasProducts && isSubcategoryExpanded && sub.products.map((product: any) => (
                                                        <TableRow key={`${categoryId}-${sub.id}-${product.productId}`} className="bg-gray-50">
                                                          <TableCell className="w-8"></TableCell>
                                                          <TableCell className="pl-16 text-xs text-gray-500">
                                                            ↳↳ {product.productName}
                                                          </TableCell>
                                                          <TableCell className="text-right text-xs text-gray-500">-</TableCell>
                                                          <TableCell className="text-right text-xs text-green-600">
                                                            ${product.cvaleAmount.toLocaleString()} ({(product.quantity || 0).toFixed(1)} un)
                                                          </TableCell>
                                                          <TableCell className="text-right text-xs text-gray-500">-</TableCell>
                                                          <TableCell className="text-right text-xs text-gray-600">
                                                            ${product.cvaleAmount.toLocaleString()}
                                                          </TableCell>
                                                          <TableCell className="text-right text-xs text-gray-500">-</TableCell>
                                                          <TableCell className="text-center text-xs text-gray-500">-</TableCell>
                                                        </TableRow>
                                                      ))}
                                                    </Fragment>
                                                  );
                                                })}
                                            </>
                                          )}
                                        </>
                                      );
                                    })}
                                  {/* Totals row */}
                                  <TableRow className="border-t-2 border-gray-300 bg-gray-100 font-bold">
                                    <TableCell className="w-8"></TableCell>
                                    <TableCell className="font-bold">TOTAL CLIENTE</TableCell>
                                    <TableCell className="text-right">${client.totalPotential.toLocaleString()}</TableCell>
                                    <TableCell className="text-right text-green-700">
                                      ${Object.values(client.categoryDetails).reduce((sum, d) => sum + d.cvaleAmount, 0).toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-right text-orange-600">
                                      ${Object.values(client.categoryDetails).reduce((sum, d) => sum + d.externalAmount, 0).toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-right">${client.totalRealized.toLocaleString()}</TableCell>
                                    <TableCell className="text-right text-blue-600">
                                      ${(client.totalPotential - client.totalRealized > 0 ? client.totalPotential - client.totalRealized : 0).toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      {client.totalPercentage >= 100 ? (
                                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded">FECHADO</span>
                                      ) : client.totalPercentage >= 50 ? (
                                        <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded">EM PROGRESSO</span>
                                      ) : (
                                        <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded">ABERTO</span>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                </TableBody>
                              </Table>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                      );
                    })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Configuration Dialog */}
      <Dialog open={!!configClientId} onOpenChange={(open) => !open && closeConfigDialog()}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configurar Investimento por Hectare</DialogTitle>
            <DialogDescription>
              Configure o valor de investimento esperado (USD) por hectare para cada segmento.
              Estes valores serão multiplicados pela área de plantio do cliente para calcular o potencial.
            </DialogDescription>
          </DialogHeader>

          {/* Warning for clients without planting area */}
          {configClientId && (() => {
            const client = marketData?.clientAnalysis.find(c => c.clientId === configClientId);
            return (!client?.plantingArea || client.plantingArea <= 0) && (
              <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <span className="text-orange-600 text-lg">⚠️</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-orange-900">Cliente sem área de plantio</p>
                    <p className="text-sm text-orange-700 mt-1">
                      Este cliente não possui área de plantio cadastrada. Configure a área na página de Clientes para que os valores de potencial possam ser calculados.
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}
          
          {/* Season Selection */}
          <div className="mt-4">
            <Label htmlFor="season-select" className="text-base font-semibold">Safra</Label>
            <Select value={selectedSeasonId} onValueChange={setSelectedSeasonId}>
              <SelectTrigger id="season-select" data-testid="select-season">
                <SelectValue placeholder="Selecione a safra" />
              </SelectTrigger>
              <SelectContent>
                {seasons?.map((season) => (
                  <SelectItem key={season.id} value={season.id} data-testid={`season-option-${season.id}`}>
                    {season.name} {season.isActive && "(Ativa)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4 mt-4">
            {categories?.map((category) => {
              const categoryId = category.id;
              const categoryName = category.name;
              const currentValue = getCurrentValue(categoryId);
              const isAgroquimicos = categoryName.toLowerCase().includes('agroqu');
              const agroquimicosSubcategories = ['Tratamento de semente', 'Dessecação', 'Inseticidas', 'Fungicidas'];
              
              return (
                <div key={categoryId} className="border rounded-lg p-4 space-y-3">
                  <Label htmlFor={`rate-${categoryId}`} className="text-base font-semibold">
                    {categoryName}
                  </Label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        id={`rate-${categoryId}`}
                        type="number"
                        step="0.01"
                        placeholder="Ex: 150.00"
                        value={currentValue}
                        onChange={(e) => setRateValues({ ...rateValues, [categoryId]: e.target.value })}
                        data-testid={`input-rate-${categoryId}`}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        USD por hectare (total geral)
                      </p>
                    </div>
                    <Button
                      onClick={() => handleSaveRate(categoryId, categoryName)}
                      disabled={!rateValues[categoryId] || saveRateMutation.isPending}
                      data-testid={`button-save-rate-${categoryId}`}
                    >
                      Salvar
                    </Button>
                  </div>
                  
                  {/* Subcategories for Agroquímicos */}
                  {isAgroquimicos && (
                    <div className="mt-4 pl-4 border-l-2 border-primary/20 space-y-3">
                      <p className="text-sm font-medium text-muted-foreground">
                        Detalhamento por subcategoria (opcional):
                      </p>
                      {agroquimicosSubcategories.map((subcat) => (
                        <div key={subcat} className="flex items-center gap-2">
                          <Label htmlFor={`subcat-${categoryId}-${subcat}`} className="text-sm w-28">
                            {subcat}:
                          </Label>
                          <Input
                            id={`subcat-${categoryId}-${subcat}`}
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={subcategoryValues[categoryId]?.[subcat] || ''}
                            onChange={(e) => setSubcategoryValues({
                              ...subcategoryValues,
                              [categoryId]: {
                                ...subcategoryValues[categoryId],
                                [subcat]: e.target.value
                              }
                            })}
                            className="flex-1"
                            data-testid={`input-subcat-${categoryId}-${subcat}`}
                          />
                          <span className="text-xs text-muted-foreground w-16">$/ha</span>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {clientRates?.find(r => r.categoryId === categoryId) && (
                    <p className="text-xs text-green-600">
                      ✓ Valor customizado configurado: ${parseFloat(clientRates.find(r => r.categoryId === categoryId)!.investmentPerHa).toFixed(2)}/ha
                    </p>
                  )}

                  {/* External Purchases Section */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <Label htmlFor={`external-${categoryId}`} className="text-sm font-medium text-gray-700">
                      Compras Externas (Outras Empresas)
                    </Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Valor total que o cliente comprou de concorrentes nesta categoria
                    </p>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Input
                          id={`external-${categoryId}`}
                          type="number"
                          step="0.01"
                          placeholder="Ex: 5000.00"
                          value={getCurrentExternalPurchaseValue(categoryId)}
                          onChange={(e) => setExternalPurchaseValues({ ...externalPurchaseValues, [categoryId]: e.target.value })}
                          data-testid={`input-external-${categoryId}`}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Total USD comprado de concorrentes
                        </p>
                      </div>
                      <Button
                        onClick={() => handleSaveExternalPurchase(categoryId, categoryName)}
                        disabled={!externalPurchaseValues[categoryId] || saveExternalPurchaseMutation.isPending}
                        variant="secondary"
                        data-testid={`button-save-external-${categoryId}`}
                      >
                        Salvar
                      </Button>
                    </div>

                    {/* External Subcategories for Agroquímicos */}
                    {isAgroquimicos && (
                      <div className="mt-3 pl-4 border-l-2 border-orange-200 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          Detalhamento externo por subcategoria (opcional):
                        </p>
                        {agroquimicosSubcategories.map((subcat) => (
                          <div key={subcat} className="flex items-center gap-2">
                            <Label htmlFor={`ext-subcat-${categoryId}-${subcat}`} className="text-xs w-28">
                              {subcat}:
                            </Label>
                            <Input
                              id={`ext-subcat-${categoryId}-${subcat}`}
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={externalSubcategoryValues[categoryId]?.[subcat] || ''}
                              onChange={(e) => setExternalSubcategoryValues({
                                ...externalSubcategoryValues,
                                [categoryId]: {
                                  ...externalSubcategoryValues[categoryId],
                                  [subcat]: e.target.value
                                }
                              })}
                              className="flex-1 h-8 text-sm"
                              data-testid={`input-ext-subcat-${categoryId}-${subcat}`}
                            />
                            <span className="text-xs text-muted-foreground w-12">USD</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {externalPurchases?.find(p => p.categoryId === categoryId) && (
                      <p className="text-xs text-orange-600 mt-2">
                        ✓ Compra externa registrada: ${parseFloat(externalPurchases.find(p => p.categoryId === categoryId)!.amount).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex justify-end">
            <Button variant="outline" onClick={closeConfigDialog} data-testid="button-close-config">
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Comparison Table Dialog */}
      <Dialog open={showComparisonDialog} onOpenChange={setShowComparisonDialog}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Comparativo C.Vale vs Mercado</DialogTitle>
            <DialogDescription>
              Performance por categoria - {activeSeason?.name || 'Safra Ativa'}
            </DialogDescription>
          </DialogHeader>
          
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Família</TableHead>
                <TableHead className="text-right">Mercado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories?.map((category) => {
                const categoryId = category.id;
                
                // Get market benchmark percentage
                const benchmark = activeSeasonBenchmarks?.find(b => b.categoryId === categoryId);
                const marketPercentage = benchmark 
                  ? parseFloat(benchmark.marketPercentage) 
                  : null;
                
                return (
                  <TableRow key={categoryId} data-testid={`row-comparison-dialog-${categoryId}`}>
                    <TableCell className="font-medium">{category.name}</TableCell>
                    <TableCell className="text-right" data-testid={`text-mercado-dialog-${categoryId}`}>
                      {marketPercentage !== null 
                        ? `${marketPercentage.toFixed(1)}%` 
                        : <span className="text-muted-foreground text-xs">-</span>
                      }
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div className="mt-6 flex justify-end">
            <Button variant="outline" onClick={() => setShowComparisonDialog(false)} data-testid="button-close-comparison">
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Matriz Potencial x Participação Dialog */}
      <Dialog open={showMatrixDialog} onOpenChange={setShowMatrixDialog}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Matriz Potencial x Participação</DialogTitle>
            <DialogDescription>
              Análise estratégica de clientes baseada em potencial de crescimento e participação atual (Share of Wallet)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Resumo por Quadrante */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-green-900 dark:text-green-100">🌟 Estrelas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-700 dark:text-green-300">{matrixData.stats?.stars || 0}</div>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">Alto Potencial + Alta Participação</p>
                </CardContent>
              </Card>

              <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-blue-900 dark:text-blue-100">💎 Diamantes Brutos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{matrixData.stats?.diamonds || 0}</div>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Alto Potencial + Baixa Participação</p>
                </CardContent>
              </Card>

              <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-yellow-900 dark:text-yellow-100">🔄 Vacas Leiteiras</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{matrixData.stats?.cows || 0}</div>
                  <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">Baixo Potencial + Alta Participação</p>
                </CardContent>
              </Card>

              <Card className="border-gray-200 bg-gray-50 dark:bg-gray-950/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-900 dark:text-gray-100">📦 Ocasionais</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-700 dark:text-gray-300">{matrixData.stats?.ocasionals || 0}</div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Baixo Potencial + Baixa Participação</p>
                </CardContent>
              </Card>
            </div>

            {/* Visualização da Matriz */}
            <Card>
              <CardHeader>
                <CardTitle>Mapa Estratégico</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 min-h-[400px]">
                  {/* Quadrante: Diamantes Brutos (top left) */}
                  <div className="border-2 border-blue-300 bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4 flex flex-col">
                    <div className="font-semibold text-blue-900 dark:text-blue-100 mb-1">💎 Diamantes Brutos</div>
                    <div className="text-[10px] text-blue-700 dark:text-blue-300 mb-2">Alto Potencial + Baixa Participação</div>
                    <div className="text-xs font-medium text-blue-800 dark:text-blue-200 mb-3">INVESTIR para CONQUISTAR</div>
                    <div className="flex-1 overflow-y-auto space-y-1">
                      {matrixData.clients.filter(c => c.quadrant === 'Diamantes Brutos').map(client => (
                        <div key={client.id} className="text-xs bg-white dark:bg-gray-800 rounded p-2">
                          <div className="font-medium">{client.name}</div>
                          <div className="text-muted-foreground">{client.participation.toFixed(1)}% participação</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Quadrante: Estrelas (top right) */}
                  <div className="border-2 border-green-300 bg-green-50 dark:bg-green-950/20 rounded-lg p-4 flex flex-col">
                    <div className="font-semibold text-green-900 dark:text-green-100 mb-1">🌟 Estrelas</div>
                    <div className="text-[10px] text-green-700 dark:text-green-300 mb-2">Alto Potencial + Alta Participação</div>
                    <div className="text-xs font-medium text-green-800 dark:text-green-200 mb-3">DEFENDER e CRESCER JUNTO</div>
                    <div className="flex-1 overflow-y-auto space-y-1">
                      {matrixData.clients.filter(c => c.quadrant === 'Estrelas').map(client => (
                        <div key={client.id} className="text-xs bg-white dark:bg-gray-800 rounded p-2">
                          <div className="font-medium">{client.name}</div>
                          <div className="text-muted-foreground">{client.participation.toFixed(1)}% participação</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Quadrante: Ocasionais (bottom left) */}
                  <div className="border-2 border-gray-300 bg-gray-50 dark:bg-gray-950/20 rounded-lg p-4 flex flex-col">
                    <div className="font-semibold text-gray-900 dark:text-gray-100 mb-1">📦 Ocasionais</div>
                    <div className="text-[10px] text-gray-700 dark:text-gray-300 mb-2">Baixo Potencial + Baixa Participação</div>
                    <div className="text-xs font-medium text-gray-800 dark:text-gray-200 mb-3">Atendimento BÁSICO</div>
                    <div className="flex-1 overflow-y-auto space-y-1">
                      {matrixData.clients.filter(c => c.quadrant === 'Ocasionais').map(client => (
                        <div key={client.id} className="text-xs bg-white dark:bg-gray-800 rounded p-2">
                          <div className="font-medium">{client.name}</div>
                          <div className="text-muted-foreground">{client.participation.toFixed(1)}% participação</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Quadrante: Vacas Leiteiras (bottom right) */}
                  <div className="border-2 border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg p-4 flex flex-col">
                    <div className="font-semibold text-yellow-900 dark:text-yellow-100 mb-1">🔄 Vacas Leiteiras</div>
                    <div className="text-[10px] text-yellow-700 dark:text-yellow-300 mb-2">Baixo Potencial + Alta Participação</div>
                    <div className="text-xs font-medium text-yellow-800 dark:text-yellow-200 mb-3">MANTER eficiência</div>
                    <div className="flex-1 overflow-y-auto space-y-1">
                      {matrixData.clients.filter(c => c.quadrant === 'Vacas Leiteiras').map(client => (
                        <div key={client.id} className="text-xs bg-white dark:bg-gray-800 rounded p-2">
                          <div className="font-medium">{client.name}</div>
                          <div className="text-muted-foreground">{client.participation.toFixed(1)}% participação</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Metodologia */}
            <Card className="bg-muted/50">
              <CardHeader>
                <CardTitle className="text-sm">📚 Metodologia Aplicada (Literatura de Marketing)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div>
                  <span className="font-semibold">Potencial:</span> Baseado em área de plantio. 
                  Top 30% = Alto Potencial, Bottom 30% = Baixo Potencial
                </div>
                <div>
                  <span className="font-semibold">Participação (Share of Wallet):</span> % de vendas realizadas sobre o potencial estimado. 
                  ≥50% = Alta Participação, &lt;30% = Baixa Participação
                </div>
                <div className="text-muted-foreground pt-2 border-t">
                  Referências: Kotler (Marketing Management), Zeithaml & Bitner (Services Marketing), Kaplan & Norton (Balanced Scorecard)
                </div>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      {/* Fullscreen Dialog */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-background">
          <div className="h-screen flex flex-col">
            {/* Header with close button */}
            <div className="bg-card border-b border-border px-8 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-foreground">Análise de Mercado</h2>
                <p className="text-sm text-muted-foreground">Potencial vs Realizado por Cliente</p>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsFullscreen(false)}
                data-testid="button-close-fullscreen-mercado"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Content - scrollable */}
            <div className="flex-1 overflow-y-auto p-8">
              {/* Header with Export Button */}
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Análise de Mercado</h2>
                <div className="flex gap-2">
                  <Button onClick={() => setShowComparisonDialog(true)} variant="outline" data-testid="button-comparison-table-fullscreen">
                    <BarChart3 className="mr-2 h-4 w-4" />
                    Ver Comparativo
                  </Button>
                </div>
              </div>

              {/* Client Analysis Table */}
              <Card className="shadow-sm mb-8" data-testid="card-client-analysis-fullscreen">
                <CardHeader>
                  <CardTitle>Análise por Cliente</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Potencial e realização por segmento
                  </p>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Família</TableHead>
                        <TableHead className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <span>C.Vale</span>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button className="inline-flex" data-testid="help-cvale-fullscreen">
                                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="font-semibold mb-1">Nossa participação no potencial dos clientes</p>
                                  <p className="text-sm">% C.Vale = (Total Vendido ÷ Total Potencial) × 100</p>
                                  <p className="text-xs text-muted-foreground mt-2">
                                    Representa quanto capturamos do potencial de compra dos nossos clientes
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableHead>
                        <TableHead className="text-right">Mercado</TableHead>
                        <TableHead className="text-right">% Desvio</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categories?.map((category) => {
                        const categoryId = category.id;
                        
                        // Calculate C.Vale percentage (total realized / total potential)
                        let totalPotential = 0;
                        let totalRealized = 0;
                        
                        marketData?.clientAnalysis.forEach(client => {
                          const categoryDetails = client.categoryDetails[categoryId];
                          if (categoryDetails) {
                            totalPotential += categoryDetails.potential;
                            totalRealized += categoryDetails.totalRealized;
                          }
                        });
                        
                        const cvalePercentage = totalPotential > 0 
                          ? (totalRealized / totalPotential) * 100 
                          : 0;
                        
                        // Get market benchmark percentage
                        const benchmark = activeSeasonBenchmarks?.find(b => b.categoryId === categoryId);
                        const marketPercentage = benchmark 
                          ? parseFloat(benchmark.marketPercentage) 
                          : null;
                        
                        // Calculate deviation
                        const deviation = marketPercentage !== null 
                          ? cvalePercentage - marketPercentage 
                          : null;
                        
                        const deviationColor = deviation !== null
                          ? deviation >= 0 ? 'text-green-600' : 'text-red-600'
                          : 'text-muted-foreground';
                        
                        return (
                          <TableRow key={categoryId} data-testid={`row-comparison-${categoryId}-fullscreen`}>
                            <TableCell className="font-medium">{category.name}</TableCell>
                            <TableCell className="text-right font-semibold" data-testid={`text-cvale-${categoryId}-fullscreen`}>
                              {cvalePercentage.toFixed(1)}%
                            </TableCell>
                            <TableCell className="text-right" data-testid={`text-mercado-${categoryId}-fullscreen`}>
                              {marketPercentage !== null 
                                ? `${marketPercentage.toFixed(1)}%` 
                                : <span className="text-muted-foreground text-xs">-</span>
                              }
                            </TableCell>
                            <TableCell className={`text-right font-semibold ${deviationColor}`} data-testid={`text-desvio-${categoryId}-fullscreen`}>
                              {deviation !== null 
                                ? `${deviation >= 0 ? '+' : ''}${deviation.toFixed(1)}%`
                                : <span className="text-muted-foreground text-xs">-</span>
                              }
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Client Analysis Table */}
              <Card className="shadow-sm mb-8" data-testid="card-client-analysis-fullscreen">
                <CardHeader>
                  <CardTitle>Análise por Cliente</CardTitle>
                  <p className="text-sm text-muted-foreground">Potencial e realização por segmento</p>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead className="text-right">Área (ha)</TableHead>
                        <TableHead className="text-right">Potencial (USD)</TableHead>
                        <TableHead className="text-right">Realizado (USD)</TableHead>
                        <TableHead className="text-right">% Rodado</TableHead>
                        <TableHead className="text-center w-24">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {marketData?.clientAnalysis
                        .sort((a, b) => a.clientName.localeCompare(b.clientName))
                        .map((client) => {
                          const hasNoPlantingArea = !client.plantingArea || client.plantingArea === 0;
                          return (
                        <>
                          <TableRow 
                            key={client.clientId} 
                            className={`hover:bg-muted/50 ${hasNoPlantingArea ? 'bg-orange-50/50' : ''}`}
                            data-testid={`row-client-${client.clientId}-fullscreen`}
                          >
                            <TableCell 
                              className="cursor-pointer"
                              onClick={() => toggleClient(client.clientId)}
                            >
                              {expandedClients.has(client.clientId) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </TableCell>
                            <TableCell className="font-medium cursor-pointer" onClick={() => toggleClient(client.clientId)}>
                              {client.clientName}
                              {hasNoPlantingArea && (
                                <span className="ml-2 text-xs text-orange-600 font-normal">⚠️ Sem área</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right cursor-pointer" onClick={() => toggleClient(client.clientId)}>
                              {hasNoPlantingArea ? (
                                <span className="text-orange-600 font-medium">-</span>
                              ) : (
                                client.plantingArea.toLocaleString()
                              )}
                            </TableCell>
                            <TableCell className="text-right cursor-pointer" onClick={() => toggleClient(client.clientId)}>${client.totalPotential.toLocaleString()}</TableCell>
                            <TableCell className="text-right cursor-pointer" onClick={() => toggleClient(client.clientId)}>${client.totalRealized.toLocaleString()}</TableCell>
                            <TableCell className="text-right cursor-pointer" onClick={() => toggleClient(client.clientId)}>
                              <div className="flex items-center justify-end gap-2">
                                <span className="font-semibold">{client.totalPercentage.toFixed(1)}%</span>
                                <Progress 
                                  value={Math.min(client.totalPercentage, 100)} 
                                  className="h-2 w-20" 
                                />
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openConfigDialog(client.clientId);
                                }}
                                data-testid={`button-config-${client.clientId}-fullscreen`}
                              >
                                <Settings className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                          {expandedClients.has(client.clientId) && (
                            <TableRow>
                              <TableCell colSpan={7} className="bg-gray-50 p-0">
                                <div className="py-4 px-6">
                                  <p className="text-sm font-semibold mb-3">Detalhamento por Segmento:</p>
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="w-8"></TableHead>
                                        <TableHead>Segmento</TableHead>
                                        <TableHead className="text-right">Potencial</TableHead>
                                        <TableHead className="text-right">C.Vale</TableHead>
                                        <TableHead className="text-right">Outras</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                        <TableHead className="text-right">Oportunidades</TableHead>
                                        <TableHead className="text-center">Status</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {Object.entries(client.categoryDetails)
                                        .filter(([_, details]) => details.potential > 0 || details.totalRealized > 0)
                                        .map(([categoryId, details]) => {
                                          const isAgroquimicos = details.categoryName.toLowerCase().includes('agroqu');
                                          const hasSubcategories = Array.isArray(details.subcategories) && details.subcategories.length > 0;
                                          const categoryKey = `${client.clientId}-${categoryId}`;
                                          const isCategoryExpanded = expandedCategories.has(categoryKey);
                                          
                                          return (
                                            <>
                                              <TableRow 
                                                key={categoryId}
                                                className={hasSubcategories ? 'hover:bg-muted/50 cursor-pointer' : ''}
                                                onClick={() => {
                                                  if (hasSubcategories) {
                                                    toggleCategory(client.clientId, categoryId);
                                                  }
                                                }}
                                              >
                                                <TableCell className="w-8">
                                                  {hasSubcategories && (
                                                    isCategoryExpanded ? (
                                                      <ChevronDown className="h-4 w-4" />
                                                    ) : (
                                                      <ChevronRight className="h-4 w-4" />
                                                    )
                                                  )}
                                                </TableCell>
                                                <TableCell className="font-medium">{details.categoryName}</TableCell>
                                                <TableCell className="text-right">${details.potential.toLocaleString()}</TableCell>
                                                <TableCell className="text-right text-green-700 font-medium">${details.cvaleAmount.toLocaleString()}</TableCell>
                                                <TableCell 
                                                  className="text-right text-orange-600"
                                                  onClick={(e) => e.stopPropagation()}
                                                >
                                                  <Popover
                                                    onOpenChange={(open) => {
                                                      if (open) {
                                                        handleOpenInlineEdit(client.clientId, categoryId, details.externalAmount);
                                                      } else {
                                                        setInlineExternalValue("");
                                                        setInlineExternalCompany("");
                                                      }
                                                    }}
                                                  >
                                                    <PopoverTrigger asChild>
                                                      <button 
                                                        className="hover:bg-orange-100 px-2 py-1 rounded transition-colors flex items-center gap-1 w-full justify-end"
                                                        data-testid={`button-edit-external-fullscreen-${client.clientId}-${categoryId}`}
                                                      >
                                                        <div className="flex flex-col items-end">
                                                          <span>${details.externalAmount.toLocaleString()}</span>
                                                          {details.externalCompany && (
                                                            <span className="text-xs text-muted-foreground">{details.externalCompany}</span>
                                                          )}
                                                        </div>
                                                        <Edit2 className="h-3 w-3 opacity-50" />
                                                      </button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-80" align="end">
                                                      <div className="space-y-3">
                                                        <div className="space-y-2">
                                                          <Label htmlFor={`inline-value-fullscreen-${client.clientId}-${categoryId}`}>
                                                            Valor (USD)
                                                          </Label>
                                                          <Input
                                                            id={`inline-value-fullscreen-${client.clientId}-${categoryId}`}
                                                            type="number"
                                                            placeholder="Ex: 5000"
                                                            value={inlineExternalValue}
                                                            onChange={(e) => setInlineExternalValue(e.target.value)}
                                                            data-testid={`input-inline-value-fullscreen-${client.clientId}-${categoryId}`}
                                                          />
                                                        </div>
                                                        <div className="space-y-2">
                                                          <Label htmlFor={`inline-company-fullscreen-${client.clientId}-${categoryId}`}>
                                                            Empresa (opcional)
                                                          </Label>
                                                          <Input
                                                            id={`inline-company-fullscreen-${client.clientId}-${categoryId}`}
                                                            type="text"
                                                            placeholder="Ex: Empresa Concorrente"
                                                            value={inlineExternalCompany}
                                                            onChange={(e) => setInlineExternalCompany(e.target.value)}
                                                            data-testid={`input-inline-company-fullscreen-${client.clientId}-${categoryId}`}
                                                          />
                                                        </div>
                                                        <Button
                                                          onClick={() => handleSaveInlineExternal(client.clientId, categoryId)}
                                                          disabled={!inlineExternalValue || saveInlineExternalPurchaseMutation.isPending}
                                                          className="w-full"
                                                          data-testid={`button-save-inline-fullscreen-${client.clientId}-${categoryId}`}
                                                        >
                                                          <Check className="h-4 w-4 mr-2" />
                                                          {saveInlineExternalPurchaseMutation.isPending ? "Salvando..." : "Salvar"}
                                                        </Button>
                                                      </div>
                                                    </PopoverContent>
                                                  </Popover>
                                                </TableCell>
                                                <TableCell className="text-right font-semibold">${details.totalRealized.toLocaleString()}</TableCell>
                                                <TableCell className="text-right">
                                                  {details.opportunity > 0 ? (
                                                    <span className="text-blue-600 font-medium">${details.opportunity.toLocaleString()}</span>
                                                  ) : (
                                                    <span className="text-gray-400">-</span>
                                                  )}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                  {details.isClosed ? (
                                                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded">FECHADO</span>
                                                  ) : details.percentage >= 50 ? (
                                                    <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded">EM PROGRESSO</span>
                                                  ) : (
                                                    <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded">ABERTO</span>
                                                  )}
                                                </TableCell>
                                              </TableRow>
                                              {/* Subcategory rows for Agroquímicos */}
                                              {isAgroquimicos && hasSubcategories && isCategoryExpanded && Array.isArray(details.subcategories) && (
                                                <>
                                                  {details.subcategories
                                                    .filter((sub: any) => sub.totalAmount > 0)
                                                    .map((sub: any) => {
                                                      const subcategoryKey = `${client.clientId}-${categoryId}-${sub.id}`;
                                                      const isSubcategoryExpanded = expandedSubcategories.has(subcategoryKey);
                                                      const hasProducts = Array.isArray(sub.products) && sub.products.length > 0;
                                                      
                                                      return (
                                                        <Fragment key={`${client.clientId}-${categoryId}-${sub.id}`}>
                                                          <TableRow 
                                                            className={`bg-gray-100/50 ${hasProducts ? 'hover:bg-gray-200/50 cursor-pointer' : ''}`}
                                                            onClick={() => {
                                                              if (hasProducts) {
                                                                toggleSubcategory(client.clientId, categoryId, sub.id);
                                                              }
                                                            }}
                                                          >
                                                            <TableCell className="w-8 pl-4">
                                                              {hasProducts && (
                                                                isSubcategoryExpanded ? (
                                                                  <ChevronDown className="h-3 w-3" />
                                                                ) : (
                                                                  <ChevronRight className="h-3 w-3" />
                                                                )
                                                              )}
                                                            </TableCell>
                                                            <TableCell className="pl-8 text-sm text-gray-600">↳ {sub.name}</TableCell>
                                                            <TableCell className="text-right text-sm text-gray-600">-</TableCell>
                                                            <TableCell className="text-right text-sm text-green-700">${sub.cvaleAmount.toLocaleString()}</TableCell>
                                                            <TableCell className="text-right text-sm text-orange-600">${sub.externalAmount.toLocaleString()}</TableCell>
                                                            <TableCell className="text-right text-sm text-gray-700 font-medium">${sub.totalAmount.toLocaleString()}</TableCell>
                                                            <TableCell className="text-right text-sm text-gray-600">-</TableCell>
                                                            <TableCell className="text-center text-sm text-gray-600">-</TableCell>
                                                          </TableRow>
                                                          
                                                          {/* Product rows for this subcategory */}
                                                          {hasProducts && isSubcategoryExpanded && sub.products.map((product: any) => (
                                                            <TableRow key={`${categoryId}-${sub.id}-${product.productId}`} className="bg-gray-50">
                                                              <TableCell className="w-8"></TableCell>
                                                              <TableCell className="pl-16 text-xs text-gray-500">
                                                                ↳↳ {product.productName}
                                                              </TableCell>
                                                              <TableCell className="text-right text-xs text-gray-500">-</TableCell>
                                                              <TableCell className="text-right text-xs text-green-600">
                                                                ${product.cvaleAmount.toLocaleString()} ({(product.quantity || 0).toFixed(1)} un)
                                                              </TableCell>
                                                              <TableCell className="text-right text-xs text-gray-500">-</TableCell>
                                                              <TableCell className="text-right text-xs text-gray-600">
                                                                ${product.cvaleAmount.toLocaleString()}
                                                              </TableCell>
                                                              <TableCell className="text-right text-xs text-gray-500">-</TableCell>
                                                              <TableCell className="text-center text-xs text-gray-500">-</TableCell>
                                                            </TableRow>
                                                          ))}
                                                        </Fragment>
                                                      );
                                                    })}
                                                </>
                                              )}
                                            </>
                                          );
                                        })}
                                      {/* Totals row */}
                                      <TableRow className="border-t-2 border-gray-300 bg-gray-100 font-bold">
                                        <TableCell className="w-8"></TableCell>
                                        <TableCell className="font-bold">TOTAL CLIENTE</TableCell>
                                        <TableCell className="text-right">${client.totalPotential.toLocaleString()}</TableCell>
                                        <TableCell className="text-right text-green-700">
                                          ${Object.values(client.categoryDetails).reduce((sum, d) => sum + d.cvaleAmount, 0).toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-right text-orange-600">
                                          ${Object.values(client.categoryDetails).reduce((sum, d) => sum + d.externalAmount, 0).toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-right">${client.totalRealized.toLocaleString()}</TableCell>
                                        <TableCell className="text-right text-blue-600">
                                          ${(client.totalPotential - client.totalRealized > 0 ? client.totalPotential - client.totalRealized : 0).toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-center">
                                          {client.totalPercentage >= 100 ? (
                                            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded">FECHADO</span>
                                          ) : client.totalPercentage >= 50 ? (
                                            <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded">EM PROGRESSO</span>
                                          ) : (
                                            <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded">ABERTO</span>
                                          )}
                                        </TableCell>
                                      </TableRow>
                                    </TableBody>
                                  </Table>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      );
                    })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
