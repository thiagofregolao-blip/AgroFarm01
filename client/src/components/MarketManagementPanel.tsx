import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Wheat, CreditCard, TrendingUp, ChevronDown, ChevronRight } from "lucide-react";

interface MarketManagementPanelProps {
  clientId: string;
  clientName: string;
  seasonId: string;
  isOpen: boolean;
  onClose: () => void;
  onNextClient?: () => void;
  hasNextClient?: boolean;
}

interface CategoryData {
  categoryId: string;
  categoryName: string;
  categoryType: string;
  potencial: number;
  cVale: number;
  mercado: number;
  subcategories?: Record<string, { mercado: number; cVale: number }>;
}

interface ProductData {
  globalApplicationId: string;
  productName: string;
  pricePerHa: number;
  totalValue: number;
  trackingId: string | null;
}

interface ApplicationData {
  categoria: string;
  applicationNumber: number;
  products: ProductData[];
  totalValue: number;
  status: 'ABERTO' | 'FECHADO' | null;
}

export default function MarketManagementPanel({ 
  clientId, 
  clientName, 
  seasonId, 
  isOpen, 
  onClose,
  onNextClient,
  hasNextClient = false
}: MarketManagementPanelProps) {
  const { toast } = useToast();
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [editedValues, setEditedValues] = useState<{
    creditLine?: number;
    marketValues: Record<string, { value: number; subcategories?: Record<string, number> }>;
    applicationStatuses: Record<string, 'ABERTO' | 'FECHADO' | null>;
  }>({
    marketValues: {},
    applicationStatuses: {}
  });

  // Fetch data
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['client-market-panel', clientId, seasonId],
    queryFn: async () => {
      const res = await fetch(`/api/client-market-panel/${clientId}/${seasonId}`);
      if (!res.ok) throw new Error('Failed to fetch data');
      return res.json();
    },
    enabled: isOpen && !!clientId && !!seasonId
  });

  // Reset edited values when client changes
  useEffect(() => {
    setEditedValues({
      marketValues: {},
      applicationStatuses: {}
    });
    setExpandedCategories(new Set());
  }, [clientId, seasonId]);

  // Helper function to get the current status (respects null as intentional clear)
  const getApplicationStatus = (appKey: string, originalStatus: 'ABERTO' | 'FECHADO' | null) => {
    return appKey in editedValues.applicationStatuses 
      ? editedValues.applicationStatuses[appKey] 
      : originalStatus;
  };

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      // Only save manually edited market values (if any)
      const manualMarketValues = Object.entries(editedValues.marketValues).map(([categoryId, data]) => ({
        categoryId,
        marketValue: data.value,
        subcategories: data.subcategories
      }));
      
      const payload = {
        seasonId,
        creditLine: editedValues.creditLine,
        marketValues: manualMarketValues,
        applicationStatuses: Object.entries(editedValues.applicationStatuses).map(([id, status]) => ({
          id,
          status
        }))
      };
      console.log("PATCH payload:", payload);
      return apiRequest('PATCH', `/api/client-market-panel/${clientId}`, payload);
    },
    onError: (error: any) => {
      console.error("Save error:", error);
      toast({ title: "Erro ao salvar dados", description: error?.message || "Erro desconhecido", variant: "destructive" });
    }
  });

  // Calculate FECHADO applications totals
  const calculateFechadoValues = () => {
    const fechadoByCategory: Record<string, { total: number; subcategories: Record<string, number> }> = {};
    
    // Map application categories to subcategories
    const categoryMapping: Record<string, string> = {
      'FUNGICIDAS': 'Fungicidas',
      'INSETICIDAS': 'Inseticidas',
      'DESSECAÇÃO': 'Dessecação',
      'TRATAMENTO DE SEMENTE': 'Tratamento de semente'
    };
    
    data?.applications?.forEach((app: ApplicationData) => {
      const appKey = `${app.categoria}-${app.applicationNumber}`;
      const status = getApplicationStatus(appKey, app.status);
      
      if (status === 'FECHADO') {
        const subcategoryName = categoryMapping[app.categoria] || app.categoria;
        
        // Find the category ID for Agroquímicos
        const agroquimicosCategory = data?.categories?.find((c: any) => c.type === 'agroquimicos');
        if (agroquimicosCategory) {
          if (!fechadoByCategory[agroquimicosCategory.id]) {
            fechadoByCategory[agroquimicosCategory.id] = { total: 0, subcategories: {} };
          }
          fechadoByCategory[agroquimicosCategory.id].subcategories[subcategoryName] = 
            (fechadoByCategory[agroquimicosCategory.id].subcategories[subcategoryName] || 0) + app.totalValue;
          fechadoByCategory[agroquimicosCategory.id].total += app.totalValue;
        }
      }
    });
    
    return fechadoByCategory;
  };
  
  const calculatedFechadoValues = calculateFechadoValues();

  // Prepare category data
  const categories = data?.categories ?? [];
  const seasonName = data?.season?.name?.toLowerCase();
  const isSojaSeason = seasonName?.includes('soja') ?? false;
  
  const categoryData: CategoryData[] = categories
    .map((cat: any) => {
      const potential = data.potentials?.find((p: any) => p.categoryId === cat.id);
      const cVale = data.cVale?.find((c: any) => c.categoryId === cat.id);
      
      const potencialValue = potential?.investmentPerHa * data.client.area || 0;
      const cValeValue = cVale?.value || 0;
      const fechadoTotal = calculatedFechadoValues[cat.id]?.total || 0;
      
      // Calculate Mercado = Potencial - C.Vale - FECHADO
      const mercadoValue = potencialValue - cValeValue - fechadoTotal;
      
      // Calculate subcategories for Agroquímicos
      const combinedSubcategories: Record<string, { mercado: number; cVale: number }> = {};
      const subcategoryNames = ['Tratamento de semente', 'Dessecação', 'Inseticidas', 'Fungicidas'];
      
      if (cat.type === 'agroquimicos') {
        subcategoryNames.forEach(subName => {
          const potencialSubValue = potential?.subcategories?.[subName] ? potential.subcategories[subName] * data.client.area : 0;
          const cValeSubValue = cVale?.subcategories?.[subName] || 0;
          const fechadoSubValue = calculatedFechadoValues[cat.id]?.subcategories?.[subName] || 0;
          const mercadoSubValue = potencialSubValue - cValeSubValue - fechadoSubValue;
          
          if (potencialSubValue > 0 || cValeSubValue > 0 || fechadoSubValue > 0) {
            combinedSubcategories[subName] = {
              mercado: Math.max(0, mercadoSubValue),
              cVale: cValeSubValue
            };
          }
        });
      }
      
      return {
        categoryId: cat.id,
        categoryName: cat.name,
        categoryType: cat.type,
        potencial: potencialValue,
        cVale: cValeValue,
        mercado: Math.max(0, mercadoValue),
        subcategories: Object.keys(combinedSubcategories).length > 0 ? combinedSubcategories : undefined
      };
    })
    .filter((cat: CategoryData) => {
      // Filter out corn-related categories when viewing SOJA season
      if (isSojaSeason) {
        const cornCategories = ['Sementes Diversas', 'Sementes Trigo', 'Sementes Milho', 'Outros'];
        return !cornCategories.includes(cat.categoryName);
      }
      return true;
    });

  // Calculate footer values
  const valorCapturado = data?.applications?.filter((app: ApplicationData) => {
    const appKey = `${app.categoria}-${app.applicationNumber}`;
    return getApplicationStatus(appKey, app.status) === 'ABERTO';
  }).reduce((sum: number, app: ApplicationData) => sum + app.totalValue, 0) || 0;

  const toggleCategory = (categoryType: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryType)) {
      newExpanded.delete(categoryType);
    } else {
      newExpanded.add(categoryType);
    }
    setExpandedCategories(newExpanded);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(value);
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">{clientName}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Top Cards */}
            <div className="grid grid-cols-4 gap-4">
              <Card className="p-4 border-2 shadow-sm">
                <div className="flex items-center justify-center gap-2 text-amber-600 mb-2">
                  <Wheat className="h-5 w-5" />
                  <span className="text-sm font-medium">Área de Plantio</span>
                </div>
                <div className="text-center text-2xl font-bold">{data?.client?.area || 0} ha</div>
              </Card>

              <Card className="p-4 border-2 shadow-sm">
                <div className="flex items-center justify-center gap-2 text-blue-600 mb-2">
                  <CreditCard className="h-5 w-5" />
                  <span className="text-sm font-medium">Linha de Crédito</span>
                </div>
                <Input
                  type="number"
                  className="text-center text-xl font-semibold"
                  value={editedValues.creditLine ?? data?.client?.creditLine ?? ''}
                  onChange={(e) => setEditedValues(prev => ({ 
                    ...prev, 
                    creditLine: parseFloat(e.target.value) || 0 
                  }))}
                  data-testid="input-credit-line"
                />
              </Card>

              <Card className="p-4 border-2 shadow-sm bg-green-50 dark:bg-green-950/20">
                <div className="flex items-center justify-center gap-2 text-green-600 mb-2">
                  <TrendingUp className="h-5 w-5" />
                  <span className="text-sm font-medium">Vendas (safra Atual)</span>
                </div>
                <div className="text-center text-2xl font-bold text-green-700">
                  {formatCurrency(data?.sales?.currentSeason || 0)}
                </div>
              </Card>

              <Card className="p-4 border-2 shadow-sm bg-gray-50 dark:bg-gray-950/20">
                <div className="flex items-center justify-center gap-2 text-gray-600 mb-2">
                  <TrendingUp className="h-5 w-5" />
                  <span className="text-sm font-medium">Vendas (safra anterior)</span>
                </div>
                <div className="text-center text-2xl font-bold text-gray-700">
                  {formatCurrency(data?.sales?.previousSeason || 0)}
                </div>
              </Card>
            </div>

            {/* Main Content - Two Columns */}
            <div className="grid grid-cols-2 gap-6">
              {/* Left Side - Potencial/C Vale/Mercado Table */}
              <div className="space-y-2">
                <div className="grid grid-cols-4 gap-2 text-center font-semibold text-sm border-b-2 pb-2">
                  <div className="text-left">Categorias</div>
                  <div>Potencial</div>
                  <div>C Vale</div>
                  <div>Mercado</div>
                </div>

                {categoryData.map((category) => (
                  <div key={category.categoryId} className="space-y-1">
                    <div className="grid grid-cols-4 gap-2 items-center">
                      <div className="flex items-center gap-1 col-span-1">
                        <span className="text-lg">{getCategoryIcon(category.categoryType)}</span>
                        <span className="text-sm font-medium">{category.categoryName}</span>
                        {category.categoryType === 'agroquimicos' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => toggleCategory(category.categoryType)}
                            data-testid={`button-toggle-agroquimicos`}
                          >
                            {expandedCategories.has(category.categoryType) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>
                      <div className="text-center text-green-600 font-semibold text-sm">
                        {formatCurrency(category.potencial)}
                      </div>
                      <div className="text-center font-semibold text-sm">
                        {formatCurrency(category.cVale)}
                      </div>
                      <div className="text-center font-semibold text-sm">
                        {formatCurrency(editedValues.marketValues[category.categoryId]?.value ?? category.mercado)}
                      </div>
                    </div>

                    {/* Subcategories for Agroquímicos */}
                    {category.categoryType === 'agroquimicos' && expandedCategories.has('agroquimicos') && category.subcategories && (
                      <div className="ml-8 mt-2 border-l-2 border-green-200 pl-4">
                        <div className="grid grid-cols-4 gap-4 text-xs font-medium text-gray-500 mb-1">
                          <div></div>
                          <div></div>
                          <div className="text-center">C.Vale</div>
                          <div className="text-center">Perdido</div>
                        </div>
                        {Object.entries(category.subcategories).map(([sub, values]) => (
                          <div key={sub} className="grid grid-cols-4 gap-4 text-xs text-gray-700 py-0.5">
                            <div className="col-span-2">{sub}</div>
                            <div className="text-center font-semibold text-blue-600">
                              {formatCurrency(values.cVale)}
                            </div>
                            <div className="text-center font-semibold text-red-600">
                              {formatCurrency(values.mercado)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Right Side - Applications Table */}
              <div className="space-y-4">
                <div className="font-semibold text-center pb-2 border-b-2">
                  Oportunidades de Mercado
                </div>

                <Tabs defaultValue="fungicidas" className="w-full">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="fungicidas">Fungicidas</TabsTrigger>
                    <TabsTrigger value="inseticidas">Inseticidas</TabsTrigger>
                    <TabsTrigger value="ts">TS</TabsTrigger>
                    <TabsTrigger value="dessecacao">Dessecação</TabsTrigger>
                  </TabsList>

                  <TabsContent value="fungicidas" className="space-y-2 mt-4">
                    <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 border-b pb-1">
                      <div className="col-span-2">Aplicação</div>
                      <div className="col-span-5">Produto</div>
                      <div className="col-span-2 text-right">Potencial</div>
                      <div className="col-span-3 text-center">Status</div>
                    </div>
                    {data?.applications?.filter((app: ApplicationData) => app.categoria === 'FUNGICIDAS').map((app: ApplicationData) => {
                      const appKey = `${app.categoria}-${app.applicationNumber}`;
                      const productsText = app.products.map(p => p.productName).join(' + ');
                      return (
                        <div key={appKey} className="grid grid-cols-12 gap-2 items-center text-xs p-2 border rounded">
                          <div className="col-span-2 font-medium">
                            Fungicida {app.applicationNumber}
                          </div>
                          <div className="col-span-5 text-gray-700">
                            {productsText}
                          </div>
                          <div className="col-span-2 text-right font-semibold">
                            {formatCurrency(app.totalValue)}
                          </div>
                          <div className="col-span-3 flex items-center justify-center gap-2">
                            <label className="flex items-center gap-1 cursor-pointer">
                              <Checkbox
                                checked={getApplicationStatus(appKey, app.status) === 'FECHADO'}
                                onCheckedChange={(checked) => {
                                  setEditedValues(prev => ({
                                    ...prev,
                                    applicationStatuses: {
                                      ...prev.applicationStatuses,
                                      [appKey]: checked ? 'FECHADO' : null
                                    }
                                  }));
                                }}
                                data-testid={`checkbox-fechado-${appKey}`}
                              />
                              <span className="text-red-600 text-xs">Fechado</span>
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer">
                              <Checkbox
                                checked={getApplicationStatus(appKey, app.status) === 'ABERTO'}
                                onCheckedChange={(checked) => {
                                  setEditedValues(prev => ({
                                    ...prev,
                                    applicationStatuses: {
                                      ...prev.applicationStatuses,
                                      [appKey]: checked ? 'ABERTO' : null
                                    }
                                  }));
                                }}
                                data-testid={`checkbox-aberto-${appKey}`}
                              />
                              <span className="text-green-600 text-xs">Aberto</span>
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </TabsContent>

                  <TabsContent value="inseticidas" className="space-y-2 mt-4">
                    <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 border-b pb-1">
                      <div className="col-span-2">Aplicação</div>
                      <div className="col-span-5">Produto</div>
                      <div className="col-span-2 text-right">Potencial</div>
                      <div className="col-span-3 text-center">Status</div>
                    </div>
                    {data?.applications?.filter((app: ApplicationData) => app.categoria === 'INSETICIDAS').map((app: ApplicationData) => {
                      const appKey = `${app.categoria}-${app.applicationNumber}`;
                      const productsText = app.products.map(p => p.productName).join(' + ');
                      return (
                        <div key={appKey} className="grid grid-cols-12 gap-2 items-center text-xs p-2 border rounded">
                          <div className="col-span-2 font-medium">
                            Inseticida {app.applicationNumber}
                          </div>
                          <div className="col-span-5 text-gray-700">
                            {productsText}
                          </div>
                          <div className="col-span-2 text-right font-semibold">
                            {formatCurrency(app.totalValue)}
                          </div>
                          <div className="col-span-3 flex items-center justify-center gap-2">
                            <label className="flex items-center gap-1 cursor-pointer">
                              <Checkbox
                                checked={getApplicationStatus(appKey, app.status) === 'FECHADO'}
                                onCheckedChange={(checked) => {
                                  setEditedValues(prev => ({
                                    ...prev,
                                    applicationStatuses: {
                                      ...prev.applicationStatuses,
                                      [appKey]: checked ? 'FECHADO' : null
                                    }
                                  }));
                                }}
                                data-testid={`checkbox-fechado-${appKey}`}
                              />
                              <span className="text-red-600 text-xs">Fechado</span>
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer">
                              <Checkbox
                                checked={getApplicationStatus(appKey, app.status) === 'ABERTO'}
                                onCheckedChange={(checked) => {
                                  setEditedValues(prev => ({
                                    ...prev,
                                    applicationStatuses: {
                                      ...prev.applicationStatuses,
                                      [appKey]: checked ? 'ABERTO' : null
                                    }
                                  }));
                                }}
                                data-testid={`checkbox-aberto-${appKey}`}
                              />
                              <span className="text-green-600 text-xs">Aberto</span>
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </TabsContent>

                  <TabsContent value="ts" className="space-y-2 mt-4">
                    <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 border-b pb-1">
                      <div className="col-span-2">Aplicação</div>
                      <div className="col-span-5">Produto</div>
                      <div className="col-span-2 text-right">Potencial</div>
                      <div className="col-span-3 text-center">Status</div>
                    </div>
                    {data?.applications?.filter((app: ApplicationData) => app.categoria === 'TRATAMENTO DE SEMENTE').map((app: ApplicationData) => {
                      const appKey = `${app.categoria}-${app.applicationNumber}`;
                      const productsText = app.products.map(p => p.productName).join(' + ');
                      return (
                        <div key={appKey} className="grid grid-cols-12 gap-2 items-center text-xs p-2 border rounded">
                          <div className="col-span-2 font-medium">
                            TS {app.applicationNumber}
                          </div>
                          <div className="col-span-5 text-gray-700">
                            {productsText}
                          </div>
                          <div className="col-span-2 text-right font-semibold">
                            {formatCurrency(app.totalValue)}
                          </div>
                          <div className="col-span-3 flex items-center justify-center gap-2">
                            <label className="flex items-center gap-1 cursor-pointer">
                              <Checkbox
                                checked={getApplicationStatus(appKey, app.status) === 'FECHADO'}
                                onCheckedChange={(checked) => {
                                  setEditedValues(prev => ({
                                    ...prev,
                                    applicationStatuses: {
                                      ...prev.applicationStatuses,
                                      [appKey]: checked ? 'FECHADO' : null
                                    }
                                  }));
                                }}
                                data-testid={`checkbox-fechado-${appKey}`}
                              />
                              <span className="text-red-600 text-xs">Fechado</span>
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer">
                              <Checkbox
                                checked={getApplicationStatus(appKey, app.status) === 'ABERTO'}
                                onCheckedChange={(checked) => {
                                  setEditedValues(prev => ({
                                    ...prev,
                                    applicationStatuses: {
                                      ...prev.applicationStatuses,
                                      [appKey]: checked ? 'ABERTO' : null
                                    }
                                  }));
                                }}
                                data-testid={`checkbox-aberto-${appKey}`}
                              />
                              <span className="text-green-600 text-xs">Aberto</span>
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </TabsContent>

                  <TabsContent value="dessecacao" className="space-y-2 mt-4">
                    <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 border-b pb-1">
                      <div className="col-span-2">Aplicação</div>
                      <div className="col-span-5">Produto</div>
                      <div className="col-span-2 text-right">Potencial</div>
                      <div className="col-span-3 text-center">Status</div>
                    </div>
                    {data?.applications?.filter((app: ApplicationData) => app.categoria === 'DESSECAÇÃO').map((app: ApplicationData) => {
                      const appKey = `${app.categoria}-${app.applicationNumber}`;
                      const productsText = app.products.map(p => p.productName).join(' + ');
                      return (
                        <div key={appKey} className="grid grid-cols-12 gap-2 items-center text-xs p-2 border rounded">
                          <div className="col-span-2 font-medium">
                            Dessecação {app.applicationNumber}
                          </div>
                          <div className="col-span-5 text-gray-700">
                            {productsText}
                          </div>
                          <div className="col-span-2 text-right font-semibold">
                            {formatCurrency(app.totalValue)}
                          </div>
                          <div className="col-span-3 flex items-center justify-center gap-2">
                            <label className="flex items-center gap-1 cursor-pointer">
                              <Checkbox
                                checked={getApplicationStatus(appKey, app.status) === 'FECHADO'}
                                onCheckedChange={(checked) => {
                                  setEditedValues(prev => ({
                                    ...prev,
                                    applicationStatuses: {
                                      ...prev.applicationStatuses,
                                      [appKey]: checked ? 'FECHADO' : null
                                    }
                                  }));
                                }}
                                data-testid={`checkbox-fechado-${appKey}`}
                              />
                              <span className="text-red-600 text-xs">Fechado</span>
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer">
                              <Checkbox
                                checked={getApplicationStatus(appKey, app.status) === 'ABERTO'}
                                onCheckedChange={(checked) => {
                                  setEditedValues(prev => ({
                                    ...prev,
                                    applicationStatuses: {
                                      ...prev.applicationStatuses,
                                      [appKey]: checked ? 'ABERTO' : null
                                    }
                                  }));
                                }}
                                data-testid={`checkbox-aberto-${appKey}`}
                              />
                              <span className="text-green-600 text-xs">Aberto</span>
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </TabsContent>

                  <div className="text-xs text-gray-500 mt-4 italic">
                    Marque "Aberto" para aplicações em negociação ou "Fechado" se perdeu para concorrente
                  </div>
                </Tabs>

                {/* Footer - Valor Capturado */}
                <div className="mt-6 pt-4 border-t-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Valor</span>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                      <span className="font-semibold">Capturado</span>
                      <span className="text-2xl font-bold text-blue-600">
                        {formatCurrency(valorCapturado)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Save Buttons */}
            <div className="flex justify-between gap-2 pt-4 border-t">
              <Button variant="outline" onClick={onClose} data-testid="button-cancel">
                Cancelar
              </Button>
              <div className="flex gap-2">
                <Button 
                  variant="outline"
                  onClick={() => {
                    saveMutation.mutate(undefined, {
                      onSuccess: () => {
                        toast({ title: "Dados salvos com sucesso!" });
                        queryClient.invalidateQueries({ queryKey: ['client-market-panel'] });
                        queryClient.invalidateQueries({ queryKey: ['kanban-metas'] });
                        onClose();
                      }
                    });
                  }} 
                  disabled={saveMutation.isPending}
                  data-testid="button-save-close"
                >
                  {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar e Fechar
                </Button>
                {hasNextClient && onNextClient && (
                  <Button 
                    onClick={() => {
                      saveMutation.mutate(undefined, {
                        onSuccess: () => {
                          toast({ title: "Dados salvos! Próximo cliente carregado." });
                          queryClient.invalidateQueries({ queryKey: ['client-market-panel'] });
                          queryClient.invalidateQueries({ queryKey: ['kanban-metas'] });
                          onNextClient();
                        }
                      });
                    }} 
                    disabled={saveMutation.isPending}
                    data-testid="button-save-next"
                  >
                    {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Salvar e Próximo Cliente
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function getCategoryIcon(type: string): string {
  const icons: Record<string, string> = {
    fertilizantes: '🌱',
    agroquimicos: '🌾',
    especialidades: '🔬',
    sementes: '🌽',
    corretivos: '🔶'
  };
  return icons[type] || '📦';
}
