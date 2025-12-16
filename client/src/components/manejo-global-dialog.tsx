import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Target, Trash } from "lucide-react";

type ApplicationCategory =
  | "FUNGICIDAS"
  | "INSETICIDAS"
  | "DESSECAÇÃO"
  | "TRATAMENTO DE SEMENTE"
  | "FERTILIZANTES"
  | "SEMENTES"
  | "ESPECIALIDADES"
  | "CORRETIVOS";

export function ManejoGlobalDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();

  const { data: seasons } = useQuery<any[]>({ queryKey: ["/api/seasons"] });
  const { data: priceTableProducts } = useQuery<any[]>({ queryKey: ["/api/price-table-products"] });

  const [viewSeasonId, setViewSeasonId] = useState<string>("");
  const [showAddApplicationDialog, setShowAddApplicationDialog] = useState(false);
  const [applicationCategory, setApplicationCategory] = useState<ApplicationCategory>("FUNGICIDAS");
  const [applicationNumber, setApplicationNumber] = useState<number>(1);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [selectedPriceTier, setSelectedPriceTier] = useState<string>("verde");
  const [customProductName, setCustomProductName] = useState<string>("");
  const [customPricePerHa, setCustomPricePerHa] = useState<string>("");
  const [productsInApplication, setProductsInApplication] = useState<
    Array<{ productId?: string; priceTier?: string; customName?: string; customPricePerHa?: string }>
  >([]);

  // Auto-selecionar safra ativa ao abrir
  useEffect(() => {
    if (!open) return;
    if (viewSeasonId) return;
    const active = seasons?.find((s: any) => s.isActive);
    if (active?.id) setViewSeasonId(active.id);
  }, [open, seasons, viewSeasonId]);

  const { data: globalManagementApplications } = useQuery<any[]>({
    queryKey: ["/api/global-management", viewSeasonId],
    queryFn: viewSeasonId
      ? async () => {
          const res = await fetch(`/api/global-management?seasonId=${viewSeasonId}`);
          if (!res.ok) throw new Error("Failed to fetch global management");
          return res.json();
        }
      : undefined,
    enabled: !!viewSeasonId,
  });

  const fungicidasProducts = useMemo(
    () => priceTableProducts?.filter((p: any) => p.categoria === "FUNGICIDAS") || [],
    [priceTableProducts],
  );
  const inseticidasProducts = useMemo(
    () => priceTableProducts?.filter((p: any) => p.categoria === "INSETICIDAS") || [],
    [priceTableProducts],
  );
  const desseccaoProducts = useMemo(
    () => priceTableProducts?.filter((p: any) => p.categoria === "DESSECAÇÃO") || [],
    [priceTableProducts],
  );
  const tratamentoSementeProducts = useMemo(
    () => priceTableProducts?.filter((p: any) => p.categoria === "TRATAMENTO_SEMENTE") || [],
    [priceTableProducts],
  );
  const especialidadesProducts = useMemo(
    () => priceTableProducts?.filter((p: any) => p.categoria === "ESPECIALIDADES") || [],
    [priceTableProducts],
  );

  const createApplicationMutation = useMutation({
    mutationFn: async (data: {
      categoria: string;
      applicationNumber: number;
      seasonId: string;
      productId?: string;
      priceTier?: string;
      customName?: string;
      customPricePerHa?: string;
    }) => apiRequest("POST", "/api/global-management", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/global-management", viewSeasonId] });
      toast({ title: "Aplicação adicionada!", description: "A aplicação foi adicionada para toda a equipe." });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.message || "Não foi possível adicionar a aplicação.",
        variant: "destructive",
      });
    },
  });

  const deleteApplicationMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/global-management/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/global-management", viewSeasonId] });
      toast({ title: "Aplicação removida!", description: "A aplicação foi removida para toda a equipe." });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.message || "Não foi possível remover a aplicação.",
        variant: "destructive",
      });
    },
  });

  const openAddApplication = (categoria: ApplicationCategory, defaultProductId?: string) => {
    if (!viewSeasonId) {
      toast({
        title: "Safra não selecionada",
        description: "Selecione uma safra antes de adicionar aplicações.",
        variant: "destructive",
      });
      return;
    }
    setApplicationCategory(categoria);
    const existingApps = globalManagementApplications?.filter((a: any) => a.categoria === categoria) || [];
    const maxNumber = existingApps.length > 0 ? Math.max(...existingApps.map((a: any) => a.applicationNumber)) : 0;
    setApplicationNumber(maxNumber + 1);
    setSelectedProductId(defaultProductId || "");
    setSelectedPriceTier("verde");
    setProductsInApplication([]);
    setCustomProductName("");
    setCustomPricePerHa("");
    setShowAddApplicationDialog(true);
  };

  const groupedAppsByNumber = (categoria: ApplicationCategory) => {
    const apps = globalManagementApplications?.filter((a: any) => a.categoria === categoria) || [];
    return apps.reduce((acc: Record<string, any[]>, app: any) => {
      const key = String(app.applicationNumber);
      if (!acc[key]) acc[key] = [];
      acc[key].push(app);
      return acc;
    }, {});
  };

  const renderCategoryList = (categoria: ApplicationCategory, emptyText: string) => {
    const grouped = groupedAppsByNumber(categoria);
    const appNumbers = Object.keys(grouped).sort((a, b) => Number(a) - Number(b));
    if (appNumbers.length === 0) {
      return <p className="text-muted-foreground text-sm text-center py-4">{emptyText}</p>;
    }
    return appNumbers.map((appNum) => {
      const apps = grouped[appNum];
      const totalCost = apps.reduce((sum: number, app: any) => sum + Number(app.pricePerHa || 0), 0);
      return (
        <div key={appNum} className="border rounded p-2">
          <div className="flex items-start gap-2">
            <span className="font-medium min-w-[100px] mt-1">Aplicação {appNum}</span>
            <div className="flex-1 space-y-1">
              {apps.map((app: any) => {
                const product = priceTableProducts?.find((p: any) => p.id === app.productId);
                return (
                  <div key={app.id} className="flex items-center gap-2 text-sm">
                    <span className="flex-1">{product?.mercaderia || "Produto"}</span>
                    {app.priceTier && (
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          app.priceTier === "verde"
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                            : app.priceTier === "amarela"
                              ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100"
                              : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
                        }`}
                      >
                        {app.priceTier === "verde" ? "Verde" : app.priceTier === "amarela" ? "Amarela" : "Vermelha"}
                      </span>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => deleteApplicationMutation.mutate(app.id)}
                      data-testid={`button-delete-app-${app.id}`}
                    >
                      <Trash className="h-3 w-3 text-red-600" />
                    </Button>
                  </div>
                );
              })}
            </div>
            <span className="font-mono font-bold text-lg">${totalCost.toFixed(2)}/ha</span>
          </div>
        </div>
      );
    });
  };

  const isTableBased =
    applicationCategory === "FUNGICIDAS" ||
    applicationCategory === "INSETICIDAS" ||
    applicationCategory === "DESSECAÇÃO" ||
    applicationCategory === "TRATAMENTO DE SEMENTE" ||
    applicationCategory === "ESPECIALIDADES";

  const selectedProduct = selectedProductId
    ? priceTableProducts?.find((p: any) => p.id === selectedProductId)
    : undefined;

  const costPerHaPreview = useMemo(() => {
    if (!selectedProduct || !isTableBased) return null;
    let basePrice = 0;
    if (selectedPriceTier === "verde") basePrice = Number(selectedProduct.preco_verde || selectedProduct.precoVerde || 0);
    else if (selectedPriceTier === "amarela")
      basePrice = Number(selectedProduct.preco_amarela || selectedProduct.precoAmarela || 0);
    else basePrice = Number(selectedProduct.preco_vermelha || selectedProduct.precoVermelha || 0);

    let dose = 1;
    if (selectedProduct.dose) {
      const doseStr = selectedProduct.dose.toString().replace(",", ".");
      const doseMatch = doseStr.match(/[\d.]+/);
      if (doseMatch) dose = parseFloat(doseMatch[0]);
    }
    const cost = basePrice * dose;
    return {
      cost: cost.toFixed(2),
      explanation: `$${basePrice.toFixed(2)} × ${selectedProduct.dose || "1"} = $${cost.toFixed(2)}/ha`,
    };
  }, [isTableBased, selectedPriceTier, selectedProduct]);

  const productOptions = useMemo(() => {
    if (applicationCategory === "FUNGICIDAS") return fungicidasProducts;
    if (applicationCategory === "INSETICIDAS") return inseticidasProducts;
    if (applicationCategory === "DESSECAÇÃO") return desseccaoProducts;
    if (applicationCategory === "TRATAMENTO DE SEMENTE") return tratamentoSementeProducts;
    if (applicationCategory === "ESPECIALIDADES") return especialidadesProducts;
    return [];
  }, [
    applicationCategory,
    fungicidasProducts,
    inseticidasProducts,
    desseccaoProducts,
    tratamentoSementeProducts,
    especialidadesProducts,
  ]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configurar Manejo Global</DialogTitle>
            <DialogDescription>
              Configure as aplicações de fungicidas, inseticidas e demais categorias para todos os clientes da equipe.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Safra *</Label>
              <Select value={viewSeasonId} onValueChange={setViewSeasonId}>
                <SelectTrigger data-testid="select-manejo-season">
                  <SelectValue placeholder="Selecione a safra" />
                </SelectTrigger>
                <SelectContent>
                  {seasons?.map((season: any) => (
                    <SelectItem key={season.id} value={season.id}>
                      {season.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Tabs defaultValue="AGROQUIMICOS" className="space-y-4">
              <TabsList>
                <TabsTrigger value="FERTILIZANTES">Fertilizantes</TabsTrigger>
                <TabsTrigger value="AGROQUIMICOS">Agroquímicos</TabsTrigger>
                <TabsTrigger value="SEMENTES">Sementes</TabsTrigger>
                <TabsTrigger value="ESPECIALIDADES">Especialidades</TabsTrigger>
                <TabsTrigger value="CORRETIVOS">Corretivos</TabsTrigger>
              </TabsList>

              <TabsContent value="AGROQUIMICOS" className="space-y-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">Fungicidas</h3>
                      <Button
                        size="sm"
                        disabled={!viewSeasonId}
                        onClick={() => {
                          if (fungicidasProducts.length === 0) {
                            toast({
                              title: "Sem produtos",
                              description: "Cadastre produtos de fungicidas primeiro no painel admin.",
                              variant: "destructive",
                            });
                            return;
                          }
                          openAddApplication("FUNGICIDAS", fungicidasProducts[0]?.id);
                        }}
                      >
                        <Target className="h-4 w-4 mr-1" />
                        Adicionar Aplicação
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {renderCategoryList("FUNGICIDAS", "Nenhuma aplicação de fungicida configurada")}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">Inseticidas</h3>
                      <Button
                        size="sm"
                        disabled={!viewSeasonId}
                        onClick={() => {
                          if (inseticidasProducts.length === 0) {
                            toast({
                              title: "Sem produtos",
                              description: "Cadastre produtos de inseticidas primeiro no painel admin.",
                              variant: "destructive",
                            });
                            return;
                          }
                          openAddApplication("INSETICIDAS", inseticidasProducts[0]?.id);
                        }}
                      >
                        <Target className="h-4 w-4 mr-1" />
                        Adicionar Aplicação
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {renderCategoryList("INSETICIDAS", "Nenhuma aplicação de inseticida configurada")}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">Dessecação</h3>
                      <Button
                        size="sm"
                        disabled={!viewSeasonId}
                        onClick={() => {
                          if (desseccaoProducts.length === 0) {
                            toast({
                              title: "Sem produtos",
                              description: "Cadastre produtos de dessecação primeiro na tabela de preços.",
                              variant: "destructive",
                            });
                            return;
                          }
                          openAddApplication("DESSECAÇÃO", desseccaoProducts[0]?.id);
                        }}
                      >
                        <Target className="h-4 w-4 mr-1" />
                        Adicionar Aplicação
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {renderCategoryList("DESSECAÇÃO", "Nenhuma aplicação de dessecação configurada")}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">Tratamento de Semente</h3>
                      <Button
                        size="sm"
                        disabled={!viewSeasonId}
                        onClick={() => {
                          if (tratamentoSementeProducts.length === 0) {
                            toast({
                              title: "Sem produtos",
                              description: "Cadastre produtos de tratamento de semente primeiro na tabela de preços.",
                              variant: "destructive",
                            });
                            return;
                          }
                          openAddApplication("TRATAMENTO DE SEMENTE", tratamentoSementeProducts[0]?.id);
                        }}
                      >
                        <Target className="h-4 w-4 mr-1" />
                        Adicionar Aplicação
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {renderCategoryList("TRATAMENTO DE SEMENTE", "Nenhuma aplicação de TS configurada")}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="FERTILIZANTES">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">Fertilizantes</h3>
                      <Button size="sm" disabled={!viewSeasonId} onClick={() => openAddApplication("FERTILIZANTES")}>
                        <Target className="h-4 w-4 mr-1" />
                        Adicionar Aplicação
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {renderCategoryList("FERTILIZANTES", "Nenhuma aplicação de fertilizante configurada")}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="SEMENTES">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">Sementes</h3>
                      <Button size="sm" disabled={!viewSeasonId} onClick={() => openAddApplication("SEMENTES")}>
                        <Target className="h-4 w-4 mr-1" />
                        Adicionar Aplicação
                      </Button>
                    </div>
                    <div className="space-y-2">{renderCategoryList("SEMENTES", "Nenhuma aplicação de sementes configurada")}</div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="ESPECIALIDADES">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">Especialidades</h3>
                      <Button
                        size="sm"
                        disabled={!viewSeasonId}
                        onClick={() => {
                          if (especialidadesProducts.length === 0) {
                            toast({
                              title: "Sem produtos",
                              description: "Cadastre produtos de especialidades primeiro na tabela de preços.",
                              variant: "destructive",
                            });
                            return;
                          }
                          openAddApplication("ESPECIALIDADES", especialidadesProducts[0]?.id);
                        }}
                      >
                        <Target className="h-4 w-4 mr-1" />
                        Adicionar Aplicação
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {renderCategoryList("ESPECIALIDADES", "Nenhuma aplicação de especialidades configurada")}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="CORRETIVOS">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">Corretivos</h3>
                      <Button size="sm" disabled={!viewSeasonId} onClick={() => openAddApplication("CORRETIVOS")}>
                        <Target className="h-4 w-4 mr-1" />
                        Adicionar Aplicação
                      </Button>
                    </div>
                    <div className="space-y-2">{renderCategoryList("CORRETIVOS", "Nenhuma aplicação de corretivos configurada")}</div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} data-testid="button-close-manejo">
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Adição de Aplicação */}
      <Dialog open={showAddApplicationDialog} onOpenChange={setShowAddApplicationDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Adicionar Aplicação de{" "}
              {applicationCategory === "FUNGICIDAS" && "Fungicida"}
              {applicationCategory === "INSETICIDAS" && "Inseticida"}
              {applicationCategory === "DESSECAÇÃO" && "Dessecação"}
              {applicationCategory === "TRATAMENTO DE SEMENTE" && "Tratamento de semente"}
              {applicationCategory === "FERTILIZANTES" && "Fertilizantes"}
              {applicationCategory === "SEMENTES" && "Sementes"}
              {applicationCategory === "ESPECIALIDADES" && "Especialidades"}
              {applicationCategory === "CORRETIVOS" && "Corretivos"}
            </DialogTitle>
            <DialogDescription>Escolha o número da aplicação e adicione um ou mais produtos.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="application-number">Número da Aplicação</Label>
              <Select value={applicationNumber.toString()} onValueChange={(val) => setApplicationNumber(Number(val))}>
                <SelectTrigger id="application-number" data-testid="select-application-number">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1ª Aplicação</SelectItem>
                  <SelectItem value="2">2ª Aplicação</SelectItem>
                  <SelectItem value="3">3ª Aplicação</SelectItem>
                  <SelectItem value="4">4ª Aplicação</SelectItem>
                  <SelectItem value="5">5ª Aplicação</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-semibold mb-3">Adicionar produto:</h4>
              <div className="space-y-3">
                {isTableBased ? (
                  <>
                    <div>
                      <Label htmlFor="product-select">Produto</Label>
                      <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                        <SelectTrigger id="product-select" data-testid="select-product">
                          <SelectValue placeholder="Selecione um produto" />
                        </SelectTrigger>
                        <SelectContent>
                          {productOptions.map((product: any) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.mercaderia}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="price-tier-select">Tier de Preço</Label>
                      <Select value={selectedPriceTier} onValueChange={setSelectedPriceTier}>
                        <SelectTrigger id="price-tier-select" data-testid="select-price-tier">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="verde">Verde</SelectItem>
                          <SelectItem value="amarela">Amarela</SelectItem>
                          <SelectItem value="vermelha">Vermelha</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {costPerHaPreview && (
                      <div className="p-3 bg-muted rounded-lg">
                        <div className="text-sm text-muted-foreground">Custo por hectare (preço × dose):</div>
                        <div className="text-xl font-bold">${costPerHaPreview.cost}/ha</div>
                        <div className="text-xs text-muted-foreground mt-1">{costPerHaPreview.explanation}</div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div>
                      <Label htmlFor="custom-name">Nome do produto / formulação</Label>
                      <Input
                        id="custom-name"
                        value={customProductName}
                        onChange={(e) => setCustomProductName(e.target.value)}
                        placeholder="Ex: Formulação X"
                      />
                    </div>
                    <div>
                      <Label htmlFor="custom-price">Investimento por ha (USD/ha)</Label>
                      <Input
                        id="custom-price"
                        type="number"
                        step="0.01"
                        value={customPricePerHa}
                        onChange={(e) => setCustomPricePerHa(e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                  </>
                )}

                <Button
                  onClick={() => {
                    if (isTableBased) {
                      if (!selectedProductId) {
                        toast({
                          title: "Erro",
                          description: "Selecione um produto primeiro.",
                          variant: "destructive",
                        });
                        return;
                      }
                      setProductsInApplication((prev) => [...prev, { productId: selectedProductId, priceTier: selectedPriceTier }]);
                      setSelectedProductId("");
                      setSelectedPriceTier("verde");
                    } else {
                      if (!customProductName || !customPricePerHa) {
                        toast({
                          title: "Erro",
                          description: "Informe o nome e o valor por hectare.",
                          variant: "destructive",
                        });
                        return;
                      }
                      setProductsInApplication((prev) => [...prev, { customName: customProductName, customPricePerHa }]);
                      setCustomProductName("");
                      setCustomPricePerHa("");
                    }
                  }}
                  disabled={isTableBased && !selectedProductId}
                  className="w-full"
                  data-testid="button-add-to-list"
                >
                  <Target className="h-4 w-4 mr-1" />
                  Adicionar à Lista
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddApplicationDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                if (productsInApplication.length === 0) {
                  toast({
                    title: "Erro",
                    description: "Adicione pelo menos um produto à lista.",
                    variant: "destructive",
                  });
                  return;
                }

                for (const item of productsInApplication) {
                  await createApplicationMutation.mutateAsync({
                    categoria: applicationCategory,
                    applicationNumber,
                    seasonId: viewSeasonId,
                    productId: item.productId,
                    priceTier: item.priceTier,
                    customName: item.customName,
                    customPricePerHa: item.customPricePerHa,
                  });
                }

                setShowAddApplicationDialog(false);
                setProductsInApplication([]);
              }}
              disabled={productsInApplication.length === 0 || createApplicationMutation.isPending}
              data-testid="button-conclude"
            >
              {createApplicationMutation.isPending ? "Salvando..." : "Concluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}


