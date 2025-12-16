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
  oportunidades: number;
  jaNegociado: number;
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
  status: 'ABERTO' | 'FECHADO' | 'PARCIAL' | null;
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
    applicationStatuses: Record<string, 'ABERTO' | 'FECHADO' | 'PARCIAL' | null>;
    pipelineStatuses: Record<string, 'ABERTO' | 'FECHADO' | 'PARCIAL' | null>;
  }>({
    marketValues: {},
    applicationStatuses: {},
    pipelineStatuses: {}
  });

  // Fetch data
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['client-market-panel', clientId, seasonId],
    queryFn: async () => {
      const res = await fetch(`/api/client-market-panel/${clientId}?seasonId=${seasonId}`);
      if (!res.ok) throw new Error('Failed to fetch data');
      return res.json();
    },
    enabled: isOpen && !!clientId && !!seasonId
  });

  // Reset edited values when client changes
  useEffect(() => {
    setEditedValues({
      marketValues: {},
      applicationStatuses: {},
      pipelineStatuses: {}
    });
    setExpandedCategories(new Set());
  }, [clientId, seasonId]);

  const getApplicationStatus = (appKey: string, originalStatus: 'ABERTO' | 'FECHADO' | 'PARCIAL' | null) => {
    return appKey in editedValues.applicationStatuses
      ? editedValues.applicationStatuses[appKey]
      : originalStatus;
  };

  const getPipelineStatus = (categoryId: string, originalStatus: 'ABERTO' | 'FECHADO' | 'PARCIAL' | null) => {
    return categoryId in editedValues.pipelineStatuses
      ? editedValues.pipelineStatuses[categoryId]
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
        })),
        pipelineStatuses: Object.entries(editedValues.pipelineStatuses).map(([categoryId, status]) => ({
          categoryId,
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

      let oportunidades = 0;
      let jaNegociado = 0;

      const pipelineItem = data?.pipeline?.find((p: any) => p.categoryId === cat.id);
      const pipelineStatus = getPipelineStatus(cat.id, pipelineItem?.status);

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

        // For Agroquímicos: 
        // Oportunidades = Sum of OPEN applications
        // Já Negociado = Sum of CLOSED applications
        data?.applications
          ?.filter((app: ApplicationData) => app.categoria && ['FUNGICIDAS', 'INSETICIDAS', 'DESSECAÇÃO', 'TRATAMENTO DE SEMENTE'].includes(app.categoria))
          ?.forEach((app: ApplicationData) => {
            const appKey = `${app.categoria}-${app.applicationNumber}`;
            const status = getApplicationStatus(appKey, app.status);
            if (status === 'ABERTO') {
              oportunidades += app.totalValue;
            } else if (status === 'FECHADO') {
              jaNegociado += app.totalValue;
            } else if (status === 'PARCIAL') {
              const half = app.totalValue / 2;
              oportunidades += half;
              jaNegociado += half;
            }
          });
      } else {
        // For others:
        // If status is CLOSED -> Já Negociado = Mercado Value (Potential - Sales), Oportunidades = 0
        // If status is OPEN -> Oportunidades = Mercado Value, Já Negociado = 0
        const mercadoResidual = Math.max(0, mercadoValue); // This "mercadoValue" variable from earlier is actually (Potential - C.Vale - FechadoApps). For general categories, "Fechado" is tracked via pipeline, not apps usually? 
        // Wait, calculateFechadoValues only works for applications (Agroquimicos). So for general categories, mercadoValue is (Potential - C.Vale).

        if (pipelineStatus === 'FECHADO') {
          jaNegociado = mercadoResidual;
          oportunidades = 0;
        } else if (pipelineStatus === 'PARCIAL') {
          const splitValue = mercadoResidual / 2;
          oportunidades = splitValue;
          jaNegociado = splitValue;
        } else {
          oportunidades = mercadoResidual;
          jaNegociado = 0;
        }
      }

      // Calculate Mercado (Percentage)
      // Formula: (C.Vale + Já Negociado) / Potencial
      const mercadoPercentage = potencialValue > 0
        ? (cValeValue + jaNegociado) / potencialValue
        : 0;

      return {
        categoryId: cat.id,
        categoryName: cat.name,
        categoryType: cat.type,
        potencial: potencialValue,
        cVale: cValeValue,
        mercado: mercadoPercentage,
        oportunidades: oportunidades,
        jaNegociado: jaNegociado,
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

  const formatPercentage = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'percent',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }).format(value);
  };


  const RenderCategoryRow = ({ category }: { category: CategoryData }) => {
    const pipelineItem = data?.pipeline?.find((p: any) => p.categoryId === category.categoryId);
    const status = getPipelineStatus(category.categoryId, pipelineItem?.status || null);

    return (
      <div className="grid grid-cols-12 gap-2 items-center text-sm p-2 border rounded">
        <div className="col-span-6 font-medium">
          {category.categoryName}
        </div>
        <div className="col-span-2 text-right font-semibold">
          {formatCurrency(category.potencial)}
        </div>
        <div className="col-span-4 flex items-center justify-center gap-2">
          <label className="flex items-center gap-1 cursor-pointer">
            <Checkbox
              checked={status === 'FECHADO'}
              onCheckedChange={(checked) => {
                if (checked) {
                  setEditedValues(prev => ({
                    ...prev,
                    pipelineStatuses: {
                      ...prev.pipelineStatuses,
                      [category.categoryId]: 'FECHADO'
                    }
                  }));
                } else if (status === 'FECHADO') {
                  setEditedValues(prev => ({
                    ...prev,
                    pipelineStatuses: {
                      ...prev.pipelineStatuses,
                      [category.categoryId]: null
                    }
                  }));
                }
              }}
              className="h-6 w-6"
            />
            <span className="text-red-600 text-xs font-semibold">Fechado</span>
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <Checkbox
              checked={status === 'ABERTO' || status === null}
              onCheckedChange={(checked) => {
                if (checked) {
                  setEditedValues(prev => ({
                    ...prev,
                    pipelineStatuses: {
                      ...prev.pipelineStatuses,
                      [category.categoryId]: 'ABERTO'
                    }
                  }));
                }
              }}
              className="h-6 w-6"
            />
            <span className="text-green-600 text-xs font-semibold">Aberto</span>
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <Checkbox
              checked={status === 'PARCIAL'}
              className="h-6 w-6 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
              onCheckedChange={(checked) => {
                if (checked) {
                  setEditedValues(prev => ({
                    ...prev,
                    pipelineStatuses: {
                      ...prev.pipelineStatuses,
                      [category.categoryId]: 'PARCIAL'
                    }
                  }));
                } else if (status === 'PARCIAL') {
                  setEditedValues(prev => ({
                    ...prev,
                    pipelineStatuses: {
                      ...prev.pipelineStatuses,
                      [category.categoryId]: null // Default to null/Aberto if unchecked?
                    }
                  }));
                }
              }}
            />
            <span className="text-blue-600 text-xs font-semibold">Parcial</span>
          </label>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[70vw] w-full h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-6 pb-2 shrink-0">
          <DialogTitle className="text-2xl font-bold">{clientName}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 pt-2">
              <div className="space-y-6">
                {/* Main Layout Container */}
                <div className="flex gap-6">

                  {/* LEFT SIDEBAR - Summary Cards */}
                  <div className="w-1/4 space-y-4 min-w-[250px]">
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

                  {/* RIGHT CONTENT - Stacked Tables */}
                  <div className="flex-1 flex flex-col gap-6">
                    {/* Top - Potencial/C Vale/Mercado Table */}
                    <div className="space-y-2">
                      <div className="grid grid-cols-6 gap-2 text-center font-semibold text-sm border-b-2 pb-2">
                        <div className="text-left py-2">Categorias</div>
                        <div className="py-2">Potencial</div>
                        <div className="py-2">C.Vale</div>
                        <div className="py-2">Oport.</div>
                        <div className="py-2">Já Neg.</div>
                        <div className="py-2">Andamento</div>
                      </div>

                      {categoryData.map((category) => (
                        <div key={category.categoryId} className="space-y-1">
                          <div className="grid grid-cols-6 gap-2 items-center">
                            <div className="flex items-center gap-1 col-span-1">
                              <span className="text-lg">{getCategoryIcon(category.categoryType)}</span>
                              <span className="text-sm font-medium truncate" title={category.categoryName}>{category.categoryName}</span>
                              {category.categoryType === 'agroquimicos' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 shrink-0"
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
                            <div className="text-center text-green-600 font-semibold text-sm truncate">
                              {formatCurrency(category.potencial)}
                            </div>
                            <div className="text-center font-semibold text-sm truncate">
                              {formatCurrency(category.cVale)}
                            </div>
                            <div className="text-center font-semibold text-sm text-blue-600 truncate">
                              {formatCurrency(category.oportunidades)}
                            </div>
                            <div className="text-center font-semibold text-sm text-gray-500 truncate">
                              {formatCurrency(category.jaNegociado)}
                            </div>
                            <div className="text-center font-semibold text-sm">
                              {formatPercentage(category.mercado)}
                            </div>
                          </div>

                          {/* Subcategories for Agroquímicos */}
                          {category.categoryType === 'agroquimicos' && expandedCategories.has('agroquimicos') && category.subcategories && (
                            <div className="ml-2 mt-2 border-l-2 border-green-200 pl-2">
                              <div className="grid grid-cols-6 gap-2 text-sm font-medium text-gray-500 mb-1">
                                <div className="col-span-2"></div>
                                <div className="text-center">C.Vale</div>
                                <div className="text-center"></div>
                                <div className="text-center"></div>
                                <div className="text-center">Perdido</div>
                              </div>
                              {Object.entries(category.subcategories).map(([sub, values]) => (
                                <div key={sub} className="grid grid-cols-6 gap-2 text-sm text-gray-700 py-0.5">
                                  <div className="col-span-2 truncate" title={sub}>{sub}</div>
                                  <div className="text-center font-semibold text-blue-600 truncate">
                                    {formatCurrency(values.cVale)}
                                  </div>
                                  <div></div>
                                  <div></div>
                                  <div className="text-center font-semibold text-red-600 truncate">
                                    {formatCurrency(values.mercado)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Right Table - Applications Table */}
                    <div className="space-y-4">
                      <div className="font-semibold text-center pb-2 border-b-2">
                        Oportunidades de Mercado
                      </div>

                      <Tabs defaultValue="fungicidas" className="w-full">
                        <TabsList className="grid w-full grid-cols-4 h-auto p-1 lg:grid-cols-7 ">
                          <TabsTrigger value="fungicidas" className="text-xs px-2 py-1.5">Fungicidas</TabsTrigger>
                          <TabsTrigger value="inseticidas" className="text-xs px-2 py-1.5">Inseticidas</TabsTrigger>
                          <TabsTrigger value="ts" className="text-xs px-2 py-1.5">TS</TabsTrigger>
                          <TabsTrigger value="dessecacao" className="text-xs px-2 py-1.5">Dessec.</TabsTrigger>
                          <TabsTrigger value="fertilizantes" className="text-xs px-2 py-1.5">Fertil.</TabsTrigger>
                          <TabsTrigger value="sementes" className="text-xs px-2 py-1.5">Sementes</TabsTrigger>
                          <TabsTrigger value="especialidades" className="text-xs px-2 py-1.5">Espec.</TabsTrigger>
                        </TabsList>

                        <div className="mt-4">
                          <TabsContent value="fungicidas" className="space-y-2 mt-0">
                            <div className="grid grid-cols-12 gap-2 text-sm font-medium text-gray-500 border-b pb-1">
                              <div className="col-span-1">Aplicação</div>
                              <div className="col-span-4">Produto</div>
                              <div className="col-span-2 text-right">Potencial</div>
                              <div className="col-span-5 text-center">Status</div>
                            </div>
                            {data?.applications?.filter((app: ApplicationData) => app.categoria === 'FUNGICIDAS').map((app: ApplicationData) => {
                              const appKey = `${app.categoria}-${app.applicationNumber}`;
                              const productsText = app.products.map(p => p.productName).join(' + ');
                              return (
                                <div key={appKey} className="grid grid-cols-12 gap-2 items-center text-sm p-2 border rounded">
                                  <div className="col-span-1 font-medium">
                                    Fungicida {app.applicationNumber}
                                  </div>
                                  <div className="col-span-4 text-gray-700 truncate" title={productsText}>
                                    {productsText}
                                  </div>
                                  <div className="col-span-2 text-right font-semibold">
                                    {formatCurrency(app.totalValue)}
                                  </div>
                                  <div className="col-span-5 flex items-center justify-center gap-1">
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
                                        className="h-6 w-6"
                                      />
                                      <span className="text-xs font-semibold text-red-600">Fechado</span>
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
                                        className="h-6 w-6"
                                      />
                                      <span className="text-xs font-semibold text-green-600">Aberto</span>
                                    </label>
                                    <label className="flex items-center gap-1 cursor-pointer">
                                      <Checkbox
                                        checked={getApplicationStatus(appKey, app.status) === 'PARCIAL'}
                                        className="h-6 w-6 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                        onCheckedChange={(checked) => {
                                          setEditedValues(prev => ({
                                            ...prev,
                                            applicationStatuses: {
                                              ...prev.applicationStatuses,
                                              [appKey]: checked ? 'PARCIAL' : null
                                            }
                                          }));
                                        }}
                                      />
                                      <span className="text-xs font-semibold text-blue-600">Parcial</span>
                                    </label>
                                  </div>
                                </div>
                              );
                            })}
                          </TabsContent>

                          <TabsContent value="inseticidas" className="space-y-2 mt-0">
                            <div className="grid grid-cols-12 gap-2 text-sm font-medium text-gray-500 border-b pb-1">
                              <div className="col-span-1">Aplicação</div>
                              <div className="col-span-4">Produto</div>
                              <div className="col-span-2 text-right">Potencial</div>
                              <div className="col-span-5 text-center">Status</div>
                            </div>
                            {data?.applications?.filter((app: ApplicationData) => app.categoria === 'INSETICIDAS').map((app: ApplicationData) => {
                              const appKey = `${app.categoria}-${app.applicationNumber}`;
                              const productsText = app.products.map(p => p.productName).join(' + ');
                              return (
                                <div key={appKey} className="grid grid-cols-12 gap-2 items-center text-sm p-2 border rounded">
                                  <div className="col-span-1 font-medium">
                                    Inseticida {app.applicationNumber}
                                  </div>
                                  <div className="col-span-4 text-gray-700 truncate" title={productsText}>
                                    {productsText}
                                  </div>
                                  <div className="col-span-2 text-right font-semibold">
                                    {formatCurrency(app.totalValue)}
                                  </div>
                                  <div className="col-span-5 flex items-center justify-center gap-1">
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
                                        className="h-6 w-6"
                                      />
                                      <span className="text-xs font-semibold text-red-600">Fechado</span>
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
                                        className="h-6 w-6"
                                      />
                                      <span className="text-xs font-semibold text-green-600">Aberto</span>
                                    </label>
                                    <label className="flex items-center gap-1 cursor-pointer">
                                      <Checkbox
                                        checked={getApplicationStatus(appKey, app.status) === 'PARCIAL'}
                                        className="h-6 w-6 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                        onCheckedChange={(checked) => {
                                          setEditedValues(prev => ({
                                            ...prev,
                                            applicationStatuses: {
                                              ...prev.applicationStatuses,
                                              [appKey]: checked ? 'PARCIAL' : null
                                            }
                                          }));
                                        }}
                                      />
                                      <span className="text-xs font-semibold text-blue-600">Parcial</span>
                                    </label>
                                  </div>
                                </div>
                              );
                            })}
                          </TabsContent>

                          <TabsContent value="ts" className="space-y-2 mt-0">
                            <div className="grid grid-cols-12 gap-2 text-sm font-medium text-gray-500 border-b pb-1">
                              <div className="col-span-1">Aplicação</div>
                              <div className="col-span-4">Produto</div>
                              <div className="col-span-2 text-right">Potencial</div>
                              <div className="col-span-5 text-center">Status</div>
                            </div>
                            {data?.applications?.filter((app: ApplicationData) => app.categoria === 'TRATAMENTO DE SEMENTE').map((app: ApplicationData) => {
                              const appKey = `${app.categoria}-${app.applicationNumber}`;
                              const productsText = app.products.map(p => p.productName).join(' + ');
                              return (
                                <div key={appKey} className="grid grid-cols-12 gap-2 items-center text-sm p-2 border rounded">
                                  <div className="col-span-1 font-medium">
                                    TS {app.applicationNumber}
                                  </div>
                                  <div className="col-span-4 text-gray-700 truncate" title={productsText}>
                                    {productsText}
                                  </div>
                                  <div className="col-span-2 text-right font-semibold">
                                    {formatCurrency(app.totalValue)}
                                  </div>
                                  <div className="col-span-5 flex items-center justify-center gap-1">
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
                                        className="h-6 w-6"
                                      />
                                      <span className="text-xs font-semibold text-red-600">Fechado</span>
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
                                        className="h-6 w-6"
                                      />
                                      <span className="text-xs font-semibold text-green-600">Aberto</span>
                                    </label>
                                    <label className="flex items-center gap-1 cursor-pointer">
                                      <Checkbox
                                        checked={getApplicationStatus(appKey, app.status) === 'PARCIAL'}
                                        className="h-6 w-6 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                        onCheckedChange={(checked) => {
                                          setEditedValues(prev => ({
                                            ...prev,
                                            applicationStatuses: {
                                              ...prev.applicationStatuses,
                                              [appKey]: checked ? 'PARCIAL' : null
                                            }
                                          }));
                                        }}
                                      />
                                      <span className="text-xs font-semibold text-blue-600">Parcial</span>
                                    </label>
                                  </div>
                                </div>
                              );
                            })}
                          </TabsContent>

                          <TabsContent value="dessecacao" className="space-y-2 mt-0">
                            <div className="grid grid-cols-12 gap-2 text-sm font-medium text-gray-500 border-b pb-1">
                              <div className="col-span-1">Aplicação</div>
                              <div className="col-span-4">Produto</div>
                              <div className="col-span-2 text-right">Potencial</div>
                              <div className="col-span-5 text-center">Status</div>
                            </div>
                            {data?.applications?.filter((app: ApplicationData) => app.categoria === 'DESSECAÇÃO').map((app: ApplicationData) => {
                              const appKey = `${app.categoria}-${app.applicationNumber}`;
                              const productsText = app.products.map(p => p.productName).join(' + ');
                              return (
                                <div key={appKey} className="grid grid-cols-12 gap-2 items-center text-sm p-2 border rounded">
                                  <div className="col-span-1 font-medium">
                                    Dessecação {app.applicationNumber}
                                  </div>
                                  <div className="col-span-4 text-gray-700 truncate" title={productsText}>
                                    {productsText}
                                  </div>
                                  <div className="col-span-2 text-right font-semibold">
                                    {formatCurrency(app.totalValue)}
                                  </div>
                                  <div className="col-span-5 flex items-center justify-center gap-1">
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
                                        className="h-6 w-6"
                                      />
                                      <span className="text-xs font-semibold text-red-600">Fechado</span>
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
                                        className="h-6 w-6"
                                      />
                                      <span className="text-xs font-semibold text-green-600">Aberto</span>
                                    </label>
                                    <label className="flex items-center gap-1 cursor-pointer">
                                      <Checkbox
                                        checked={getApplicationStatus(appKey, app.status) === 'PARCIAL'}
                                        className="h-6 w-6 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                        onCheckedChange={(checked) => {
                                          setEditedValues(prev => ({
                                            ...prev,
                                            applicationStatuses: {
                                              ...prev.applicationStatuses,
                                              [appKey]: checked ? 'PARCIAL' : null
                                            }
                                          }));
                                        }}
                                      />
                                      <span className="text-xs font-semibold text-blue-600">Parcial</span>
                                    </label>
                                  </div>
                                </div>
                              );
                            })}
                          </TabsContent>

                          <TabsContent value="fertilizantes" className="space-y-2 mt-0">
                            <div className="grid grid-cols-12 gap-2 text-sm font-medium text-gray-500 border-b pb-1">
                              <div className="col-span-6">Categoria</div>
                              <div className="col-span-2 text-right">Potencial</div>
                              <div className="col-span-4 text-center">Status</div>
                            </div>
                            {categoryData.filter(c => c.categoryType === 'fertilizantes').map(cat => (
                              <RenderCategoryRow key={cat.categoryId} category={cat} />
                            ))}
                          </TabsContent>

                          <TabsContent value="sementes" className="space-y-2 mt-0">
                            <div className="grid grid-cols-12 gap-2 text-sm font-medium text-gray-500 border-b pb-1">
                              <div className="col-span-6">Categoria</div>
                              <div className="col-span-2 text-right">Potencial</div>
                              <div className="col-span-4 text-center">Status</div>
                            </div>
                            {categoryData.filter(c => c.categoryType === 'sementes').map(cat => (
                              <RenderCategoryRow key={cat.categoryId} category={cat} />
                            ))}
                          </TabsContent>

                          <TabsContent value="especialidades" className="space-y-2 mt-0">
                            <div className="grid grid-cols-12 gap-2 text-sm font-medium text-gray-500 border-b pb-1">
                              <div className="col-span-6">Categoria</div>
                              <div className="col-span-2 text-right">Potencial</div>
                              <div className="col-span-4 text-center">Status</div>
                            </div>
                            {categoryData.filter(c => c.categoryType === 'especialidades').map(cat => (
                              <RenderCategoryRow key={cat.categoryId} category={cat} />
                            ))}
                          </TabsContent>
                        </div>

                        <div className="text-sm text-gray-500 mt-2 italic">
                          Marque "Aberto" para aplicações em negociação ou "Fechado" se perdeu para concorrente
                        </div>
                      </Tabs>

                      {/* Footer - Valor Capturado */}
                      <div className="mt-4 pt-2 border-t-2">
                        <div className="flex items-center justify-between">
                          <span className="text-base font-medium">Valor</span>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                            <span className="font-semibold text-base">Capturado</span>
                            <span className="text-2xl font-bold text-blue-600">
                              {formatCurrency(valorCapturado)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Save Buttons */}
            <div className="p-4 border-t shrink-0 bg-white dark:bg-zinc-950 flex justify-between gap-2">
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
