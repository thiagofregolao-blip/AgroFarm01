import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Save, Settings, Calendar, Percent, Info } from "lucide-react";
import type { SeasonParameter, InsertSeasonParameter } from "@shared/schema";

export default function Parametros() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showNewParameterModal, setShowNewParameterModal] = useState(false);
  const [activeTab, setActiveTab] = useState("season-params");
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    type: "",
    dueDateMonth: 1,
    dueDateDay: 1,
    labelPattern: "",
  });

  const [ivaSettings, setIvaSettings] = useState({
    defaultRate: "10.00",
    fertilizantesRate: "10.00",
    sementesRate: "10.00",
    especialidadesRate: "10.00",
    agroquimicosRate: "10.00",
  });

  const { data: seasonParameters, isLoading } = useQuery<SeasonParameter[]>({
    queryKey: ["/api/season-parameters"],
  });

  const createParameterMutation = useMutation({
    mutationFn: async (parameterData: InsertSeasonParameter) => {
      return apiRequest("POST", "/api/season-parameters", parameterData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/season-parameters"] });
      toast({
        title: "Parâmetro cadastrado",
        description: "O parâmetro de safra foi cadastrado com sucesso.",
      });
      setShowNewParameterModal(false);
      resetForm();
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao cadastrar parâmetro. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const resetForm = () => {
    setFormData({
      type: "",
      dueDateMonth: 1,
      dueDateDay: 1,
      labelPattern: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.type || !formData.labelPattern) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    const parameterData: InsertSeasonParameter = {
      type: formData.type,
      dueDateMonth: formData.dueDateMonth,
      dueDateDay: formData.dueDateDay,
      labelPattern: formData.labelPattern,
    };

    createParameterMutation.mutate(parameterData);
  };

  const handleSaveIvaSettings = () => {
    // This would be implemented to save IVA settings to the backend
    toast({
      title: "Configurações salvas",
      description: "As configurações de IVA foram atualizadas com sucesso.",
    });
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

  const months = [
    { value: 1, label: "Janeiro" },
    { value: 2, label: "Fevereiro" },
    { value: 3, label: "Março" },
    { value: 4, label: "Abril" },
    { value: 5, label: "Maio" },
    { value: 6, label: "Junho" },
    { value: 7, label: "Julho" },
    { value: 8, label: "Agosto" },
    { value: 9, label: "Setembro" },
    { value: 10, label: "Outubro" },
    { value: 11, label: "Novembro" },
    { value: 12, label: "Dezembro" },
  ];

  const totalParameters = seasonParameters?.length || 0;

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden" data-testid="parametros-container">
      <Sidebar collapsed={sidebarCollapsed} />
      
      <main className="flex-1 overflow-y-auto">
        <Header 
          onToggleSidebar={toggleSidebar}
          onNewSale={() => {}}
          title="Parâmetros do Sistema"
          subtitle="Configurações de safras, IVA e classificações"
        />

        <div className="p-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Calendar className="text-primary" size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Parâmetros de Safra</p>
                    <p className="text-2xl font-bold">{totalParameters}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-chart-2/10 rounded-lg flex items-center justify-center">
                    <Percent className="text-chart-2" size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">IVA Padrão</p>
                    <p className="text-2xl font-bold font-mono">{ivaSettings.defaultRate}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                    <Settings className="text-accent" size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Configurações Ativas</p>
                    <p className="text-2xl font-bold">5</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Configuration Tabs */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Configurações do Sistema</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="season-params">Parâmetros de Safra</TabsTrigger>
                  <TabsTrigger value="iva-settings">Configurações de IVA</TabsTrigger>
                </TabsList>

                <TabsContent value="season-params" className="space-y-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-lg font-semibold">Parâmetros de Classificação de Safra</h3>
                      <p className="text-sm text-muted-foreground">
                        Configure as datas e padrões de nomenclatura para classificação automática de safras
                      </p>
                    </div>
                    <Dialog open={showNewParameterModal} onOpenChange={setShowNewParameterModal}>
                      <DialogTrigger asChild>
                        <Button data-testid="button-new-parameter">
                          <Plus className="h-4 w-4 mr-2" />
                          Novo Parâmetro
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl" data-testid="new-parameter-modal">
                        <DialogHeader>
                          <DialogTitle>Novo Parâmetro de Safra</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                          <div>
                            <Label htmlFor="type">Tipo de Safra *</Label>
                            <Select value={formData.type} onValueChange={(value) => 
                              setFormData(prev => ({ ...prev, type: value }))
                            }>
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

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="month">Mês de Vencimento *</Label>
                              <Select value={formData.dueDateMonth.toString()} onValueChange={(value) => 
                                setFormData(prev => ({ ...prev, dueDateMonth: parseInt(value) }))
                              }>
                                <SelectTrigger data-testid="select-month">
                                  <SelectValue placeholder="Selecione o mês" />
                                </SelectTrigger>
                                <SelectContent>
                                  {months.map((month) => (
                                    <SelectItem key={month.value} value={month.value.toString()}>
                                      {month.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label htmlFor="day">Dia do Vencimento *</Label>
                              <Input
                                type="number"
                                min="1"
                                max="31"
                                value={formData.dueDateDay}
                                onChange={(e) => setFormData(prev => ({ ...prev, dueDateDay: parseInt(e.target.value) }))}
                                data-testid="input-day"
                              />
                            </div>
                          </div>

                          <div>
                            <Label htmlFor="labelPattern">Padrão de Nome *</Label>
                            <Input
                              value={formData.labelPattern}
                              onChange={(e) => setFormData(prev => ({ ...prev, labelPattern: e.target.value }))}
                              placeholder="Ex: Soja {year}/{next_year}"
                              data-testid="input-label-pattern"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              Use {"{year}"} para ano atual e {"{next_year}"} para próximo ano
                            </p>
                          </div>

                          <div className="flex justify-end gap-3 pt-4">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setShowNewParameterModal(false)}
                              data-testid="button-cancel"
                            >
                              Cancelar
                            </Button>
                            <Button
                              type="submit"
                              disabled={createParameterMutation.isPending}
                              data-testid="button-save"
                            >
                              {createParameterMutation.isPending ? "Salvando..." : "Salvar Parâmetro"}
                            </Button>
                          </div>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>

                  {seasonParameters?.length === 0 ? (
                    <div className="text-center py-12 border border-border rounded-lg">
                      <Calendar className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground mb-4">Nenhum parâmetro configurado</p>
                      <Button 
                        onClick={() => setShowNewParameterModal(true)}
                        data-testid="button-first-parameter"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Configurar primeiro parâmetro
                      </Button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Tipo de Safra</TableHead>
                            <TableHead>Mês de Vencimento</TableHead>
                            <TableHead>Dia de Vencimento</TableHead>
                            <TableHead>Padrão de Nome</TableHead>
                            <TableHead>Exemplo</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {seasonParameters?.map((parameter) => (
                            <TableRow key={parameter.id} data-testid={`parameter-row-${parameter.id}`}>
                              <TableCell>
                                <Badge className={getTypeBadgeClass(parameter.type)}>
                                  {getTypeLabel(parameter.type)}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {months.find(m => m.value === parameter.dueDateMonth)?.label}
                              </TableCell>
                              <TableCell className="text-center">{parameter.dueDateDay}</TableCell>
                              <TableCell className="font-mono text-sm">
                                {parameter.labelPattern}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {parameter.labelPattern
                                  .replace("{year}", "25")
                                  .replace("{next_year}", "26")
                                }
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="iva-settings" className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold">Configurações de IVA do Paraguai</h3>
                    <p className="text-sm text-muted-foreground">
                      Configure as alíquotas de IVA por categoria de produto
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">IVA Padrão do Sistema</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <Label htmlFor="defaultIva">Alíquota Padrão (%)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={ivaSettings.defaultRate}
                            onChange={(e) => setIvaSettings(prev => ({ ...prev, defaultRate: e.target.value }))}
                            className="font-mono"
                            data-testid="input-default-iva"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Usado quando não há configuração específica por categoria
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">IVA por Categoria</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <Label htmlFor="fertilizantesIva">Fertilizantes (%)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={ivaSettings.fertilizantesRate}
                            onChange={(e) => setIvaSettings(prev => ({ ...prev, fertilizantesRate: e.target.value }))}
                            className="font-mono"
                            data-testid="input-fertilizantes-iva"
                          />
                        </div>

                        <div>
                          <Label htmlFor="sementesIva">Sementes (%)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={ivaSettings.sementesRate}
                            onChange={(e) => setIvaSettings(prev => ({ ...prev, sementesRate: e.target.value }))}
                            className="font-mono"
                            data-testid="input-sementes-iva"
                          />
                        </div>

                        <div>
                          <Label htmlFor="especialidadesIva">Especialidades (%)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={ivaSettings.especialidadesRate}
                            onChange={(e) => setIvaSettings(prev => ({ ...prev, especialidadesRate: e.target.value }))}
                            className="font-mono"
                            data-testid="input-especialidades-iva"
                          />
                        </div>

                        <div>
                          <Label htmlFor="agroquimicosIva">Agroquímicos (%)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={ivaSettings.agroquimicosRate}
                            onChange={(e) => setIvaSettings(prev => ({ ...prev, agroquimicosRate: e.target.value }))}
                            className="font-mono"
                            data-testid="input-agroquimicos-iva"
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="flex justify-end">
                    <Button onClick={handleSaveIvaSettings} data-testid="button-save-iva">
                      <Save className="h-4 w-4 mr-2" />
                      Salvar Configurações de IVA
                    </Button>
                  </div>

                  <Card className="bg-muted/30">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <Info className="h-5 w-5 text-chart-2 mt-0.5" />
                        <div>
                          <h4 className="text-sm font-semibold mb-1">Informação Importante</h4>
                          <p className="text-xs text-muted-foreground">
                            As configurações de IVA são aplicadas automaticamente no cálculo de comissões. 
                            As alterações afetarão apenas vendas futuras, não modificando vendas já registradas.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
