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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Target, TrendingUp, Calendar, Edit, CheckCircle, Trash2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from "date-fns";
import type { Season, SeasonGoal, InsertSeasonGoal } from "@shared/schema";

export default function Metas() {
  const [showNewGoalModal, setShowNewGoalModal] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState("");
  const [editingGoal, setEditingGoal] = useState<SeasonGoal | null>(null);
  const [goalToDelete, setGoalToDelete] = useState<string | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    seasonId: "",
    goalAmount: "",
    metaAgroquimicos: "",
    metaEspecialidades: "",
    metaSementesMilho: "",
    metaSementesSoja: "",
    metaSementesTrigo: "",
    metaSementesDiversas: "",
    metaFertilizantes: "",
    metaCorretivos: "",
  });

  const { data: seasons } = useQuery<Season[]>({
    queryKey: ["/api/seasons"],
  });

  const { data: analytics } = useQuery({
    queryKey: ["/api/analytics/sales"],
  });

  const { data: categories } = useQuery({
    queryKey: ["/api/categories"],
  });

  const { data: seasonGoals, isLoading: goalsLoading } = useQuery<SeasonGoal[]>({
    queryKey: ["/api/season-goals"],
  });

  const createGoalMutation = useMutation({
    mutationFn: async (goalData: InsertSeasonGoal) => {
      return apiRequest("POST", "/api/season-goals", goalData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/season-goals"] });
      toast({
        title: "Meta cadastrada",
        description: "A meta foi cadastrada com sucesso.",
      });
      setShowNewGoalModal(false);
      resetForm();
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao cadastrar meta. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const updateGoalMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertSeasonGoal> }) => {
      return apiRequest("PATCH", `/api/season-goals/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/season-goals"] });
      toast({
        title: "Meta atualizada",
        description: "A meta foi atualizada com sucesso.",
      });
      setEditingGoal(null);
      setShowNewGoalModal(false);
      resetForm();
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao atualizar meta. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const deleteGoalMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/season-goals/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/season-goals"] });
      toast({
        title: "Meta excluída",
        description: "A meta foi excluída com sucesso.",
      });
      setGoalToDelete(null);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao excluir meta. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      seasonId: "",
      goalAmount: "",
      metaAgroquimicos: "",
      metaEspecialidades: "",
      metaSementesMilho: "",
      metaSementesSoja: "",
      metaSementesTrigo: "",
      metaSementesDiversas: "",
      metaFertilizantes: "",
      metaCorretivos: "",
    });
    setEditingGoal(null);
  };

  const handleEditClick = (goal: SeasonGoal) => {
    setEditingGoal(goal);
    setFormData({
      seasonId: goal.seasonId,
      goalAmount: goal.goalAmount,
      metaAgroquimicos: goal.metaAgroquimicos || "0",
      metaEspecialidades: goal.metaEspecialidades || "0",
      metaSementesMilho: goal.metaSementesMilho || "0",
      metaSementesSoja: goal.metaSementesSoja || "0",
      metaSementesTrigo: goal.metaSementesTrigo || "0",
      metaSementesDiversas: goal.metaSementesDiversas || "0",
      metaFertilizantes: goal.metaFertilizantes || "0",
      metaCorretivos: goal.metaCorretivos || "0",
    });
    setShowNewGoalModal(true);
  };

  const handleDeleteClick = (goalId: string) => {
    setGoalToDelete(goalId);
  };

  const confirmDelete = () => {
    if (goalToDelete) {
      deleteGoalMutation.mutate(goalToDelete);
    }
  };

  const calculateGlobalGoal = () => {
    const agro = parseFloat(formData.metaAgroquimicos) || 0;
    const espec = parseFloat(formData.metaEspecialidades) || 0;
    const sementesMilho = parseFloat(formData.metaSementesMilho) || 0;
    const sementesSoja = parseFloat(formData.metaSementesSoja) || 0;
    const sementesTrigo = parseFloat(formData.metaSementesTrigo) || 0;
    const sementesDiversas = parseFloat(formData.metaSementesDiversas) || 0;
    const fert = parseFloat(formData.metaFertilizantes) || 0;
    const corr = parseFloat(formData.metaCorretivos) || 0;
    return agro + espec + sementesMilho + sementesSoja + sementesTrigo + sementesDiversas + fert + corr;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const globalGoal = calculateGlobalGoal();
    
    if (!formData.seasonId || globalGoal === 0) {
      toast({
        title: "Campos obrigatórios",
        description: "Selecione uma safra e preencha pelo menos uma meta de categoria.",
        variant: "destructive",
      });
      return;
    }

    const goalData: InsertSeasonGoal = {
      seasonId: formData.seasonId,
      goalAmount: globalGoal.toString(),
      metaAgroquimicos: formData.metaAgroquimicos || "0",
      metaEspecialidades: formData.metaEspecialidades || "0",
      metaSementesMilho: formData.metaSementesMilho || "0",
      metaSementesSoja: formData.metaSementesSoja || "0",
      metaSementesTrigo: formData.metaSementesTrigo || "0",
      metaSementesDiversas: formData.metaSementesDiversas || "0",
      metaFertilizantes: formData.metaFertilizantes || "0",
      metaCorretivos: formData.metaCorretivos || "0",
      userId: "default-vendedor-id",
    };

    if (editingGoal) {
      updateGoalMutation.mutate({ id: editingGoal.id, data: goalData });
    } else {
      createGoalMutation.mutate(goalData);
    }
  };

  const getSeasonName = (seasonId: string) => {
    return seasons?.find(s => s.id === seasonId)?.name || "Safra não encontrada";
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

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "soja_verao": return "Soja Verão";
      case "soja_safrinha": return "Soja Safrinha";
      case "milho": return "Milho";
      case "trigo": return "Trigo";
      default: return type;
    }
  };

  const { data: sales } = useQuery({
    queryKey: ["/api/sales"],
  });

  const goalsWithDetails = (seasonGoals || []).map(goal => {
    const season = seasons?.find(s => s.id === goal.seasonId);
    const goalSales = (sales as any[])?.filter(s => s.seasonId === goal.seasonId) || [];
    
    const categoryMap: Record<string, string> = {
      "Agroquímicos": "cat-agroquimicos",
      "Especialidades": "cat-especialidades",
      "Sementes Milho": "cat-sem-milho",
      "Sementes Soja": "cat-sem-soja",
      "Sementes Trigo": "cat-sem-trigo",
      "Sementes Diversas": "cat-sem-diversas",
      "Fertilizantes": "cat-fertilizantes",
      "Corretivos": "cat-corretivos",
    };
    
    const salesByCategory = goalSales.reduce((acc: Record<string, number>, sale: any) => {
      const categoryId = sale.categoryId;
      const amount = parseFloat(sale.totalAmount || "0");
      acc[categoryId] = (acc[categoryId] || 0) + amount;
      return acc;
    }, {});
    
    const realizadoAgroquimicos = salesByCategory[categoryMap["Agroquímicos"]] || 0;
    const realizadoEspecialidades = salesByCategory[categoryMap["Especialidades"]] || 0;
    const realizadoSementesMilho = salesByCategory[categoryMap["Sementes Milho"]] || 0;
    const realizadoSementesSoja = salesByCategory[categoryMap["Sementes Soja"]] || 0;
    const realizadoSementesTrigo = salesByCategory[categoryMap["Sementes Trigo"]] || 0;
    const realizadoSementesDiversas = salesByCategory[categoryMap["Sementes Diversas"]] || 0;
    const realizadoFertilizantes = salesByCategory[categoryMap["Fertilizantes"]] || 0;
    const realizadoCorretivos = salesByCategory[categoryMap["Corretivos"]] || 0;
    
    const achievedAmount = realizadoAgroquimicos + realizadoEspecialidades + 
                          realizadoSementesMilho + realizadoSementesSoja + 
                          realizadoSementesTrigo + realizadoSementesDiversas + 
                          realizadoFertilizantes + realizadoCorretivos;
    
    const metaAgroquimicosNum = parseFloat(goal.metaAgroquimicos || "0");
    const metaEspecialidadesNum = parseFloat(goal.metaEspecialidades || "0");
    const metaSementesMilhoNum = parseFloat(goal.metaSementesMilho || "0");
    const metaSementesSojaNum = parseFloat(goal.metaSementesSoja || "0");
    const metaSementesTrigoNum = parseFloat(goal.metaSementesTrigo || "0");
    const metaSementesDiversasNum = parseFloat(goal.metaSementesDiversas || "0");
    const metaFertilizantesNum = parseFloat(goal.metaFertilizantes || "0");
    const metaCorretivosNum = parseFloat(goal.metaCorretivos || "0");
    
    const percentAgroquimicos = metaAgroquimicosNum > 0 ? (realizadoAgroquimicos / metaAgroquimicosNum) * 100 : 0;
    const percentEspecialidades = metaEspecialidadesNum > 0 ? (realizadoEspecialidades / metaEspecialidadesNum) * 100 : 0;
    const percentSementesMilho = metaSementesMilhoNum > 0 ? (realizadoSementesMilho / metaSementesMilhoNum) * 100 : 0;
    const percentSementesSoja = metaSementesSojaNum > 0 ? (realizadoSementesSoja / metaSementesSojaNum) * 100 : 0;
    const percentSementesTrigo = metaSementesTrigoNum > 0 ? (realizadoSementesTrigo / metaSementesTrigoNum) * 100 : 0;
    const percentSementesDiversas = metaSementesDiversasNum > 0 ? (realizadoSementesDiversas / metaSementesDiversasNum) * 100 : 0;
    const percentFertilizantes = metaFertilizantesNum > 0 ? (realizadoFertilizantes / metaFertilizantesNum) * 100 : 0;
    const percentCorretivos = metaCorretivosNum > 0 ? (realizadoCorretivos / metaCorretivosNum) * 100 : 0;
    
    const goalAmountNum = parseFloat(goal.goalAmount);
    const percentage = goalAmountNum > 0 ? (achievedAmount / goalAmountNum) * 100 : 0;

    return {
      id: goal.id,
      seasonId: goal.seasonId,
      seasonName: season?.name || "Safra desconhecida",
      seasonType: season?.type || "unknown",
      goalAmount: goalAmountNum,
      achievedAmount,
      percentage,
      status: percentage >= 100 ? "concluida" as const : "em_andamento" as const,
      metaAgroquimicos: goal.metaAgroquimicos || "0",
      metaEspecialidades: goal.metaEspecialidades || "0",
      metaSementesMilho: goal.metaSementesMilho || "0",
      metaSementesSoja: goal.metaSementesSoja || "0",
      metaSementesTrigo: goal.metaSementesTrigo || "0",
      metaSementesDiversas: goal.metaSementesDiversas || "0",
      metaFertilizantes: goal.metaFertilizantes || "0",
      metaCorretivos: goal.metaCorretivos || "0",
      realizadoAgroquimicos,
      realizadoEspecialidades,
      realizadoSementesMilho,
      realizadoSementesSoja,
      realizadoSementesTrigo,
      realizadoSementesDiversas,
      realizadoFertilizantes,
      realizadoCorretivos,
      percentAgroquimicos,
      percentEspecialidades,
      percentSementesMilho,
      percentSementesSoja,
      percentSementesTrigo,
      percentSementesDiversas,
      percentFertilizantes,
      percentCorretivos,
    };
  });

  const totalGoals = goalsWithDetails.length;
  const activeGoals = goalsWithDetails.filter(g => g.status === "em_andamento").length;
  const averageAchievement = totalGoals > 0 
    ? goalsWithDetails.reduce((sum, goal) => sum + goal.percentage, 0) / totalGoals 
    : 0;

  return (
    <div className="h-screen flex flex-col overflow-hidden" data-testid="metas-container">
      <Header 
        onNewSale={() => {}}
        title="Gestão de Metas"
        subtitle="Definição e acompanhamento de metas por safra"
      />
      <Navbar />
      
      <main className="flex-1 overflow-y-auto">

        <div className="p-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Target className="text-primary" size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total de Metas</p>
                    <p className="text-2xl font-bold">{totalGoals}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-chart-2/10 rounded-lg flex items-center justify-center">
                    <Calendar className="text-chart-2" size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Metas Ativas</p>
                    <p className="text-2xl font-bold">{activeGoals}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-verde/10 rounded-lg flex items-center justify-center">
                    <TrendingUp className="text-verde" size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Atingimento Médio</p>
                    <p className="text-2xl font-bold">{averageAchievement.toFixed(0)}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                    <CheckCircle className="text-accent" size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Meta Atual</p>
                    <p className="text-2xl font-bold">82%</p>
                    <p className="text-xs text-muted-foreground">Soja 25/26</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Goals Management */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Goals List */}
            <div className="lg:col-span-2">
              <Card className="shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Metas por Safra</CardTitle>
                  <Dialog open={showNewGoalModal} onOpenChange={(open) => {
                    setShowNewGoalModal(open);
                    if (!open) resetForm();
                  }}>
                    <DialogTrigger asChild>
                      <Button data-testid="button-new-goal">
                        <Plus className="h-4 w-4 mr-2" />
                        Nova Meta
                      </Button>
                    </DialogTrigger>
                    <DialogContent data-testid="new-goal-modal">
                      <DialogHeader>
                        <DialogTitle>{editingGoal ? "Editar Meta de Safra" : "Nova Meta de Safra"}</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                          <Label htmlFor="season">Safra *</Label>
                          <Select value={formData.seasonId} onValueChange={(value) => 
                            setFormData(prev => ({ ...prev, seasonId: value }))
                          }>
                            <SelectTrigger data-testid="select-season">
                              <SelectValue placeholder="Selecione a safra" />
                            </SelectTrigger>
                            <SelectContent>
                              {seasons?.map((season) => (
                                <SelectItem key={season.id} value={season.id}>
                                  {season.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-3">
                          <Label className="text-base font-semibold">Metas por Categoria (USD)</Label>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="metaAgroquimicos">Agroquímicos</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={formData.metaAgroquimicos}
                                onChange={(e) => setFormData(prev => ({ ...prev, metaAgroquimicos: e.target.value }))}
                                placeholder="0.00"
                                className="font-mono"
                                data-testid="input-meta-agroquimicos"
                              />
                            </div>

                            <div>
                              <Label htmlFor="metaEspecialidades">Especialidades</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={formData.metaEspecialidades}
                                onChange={(e) => setFormData(prev => ({ ...prev, metaEspecialidades: e.target.value }))}
                                placeholder="0.00"
                                className="font-mono"
                                data-testid="input-meta-especialidades"
                              />
                            </div>

                            <div>
                              <Label htmlFor="metaSementesMilho">Sementes Milho</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={formData.metaSementesMilho}
                                onChange={(e) => setFormData(prev => ({ ...prev, metaSementesMilho: e.target.value }))}
                                placeholder="0.00"
                                className="font-mono"
                                data-testid="input-meta-sementes-milho"
                              />
                            </div>

                            <div>
                              <Label htmlFor="metaSementesSoja">Sementes Soja</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={formData.metaSementesSoja}
                                onChange={(e) => setFormData(prev => ({ ...prev, metaSementesSoja: e.target.value }))}
                                placeholder="0.00"
                                className="font-mono"
                                data-testid="input-meta-sementes-soja"
                              />
                            </div>

                            <div>
                              <Label htmlFor="metaSementesTrigo">Sementes Trigo</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={formData.metaSementesTrigo}
                                onChange={(e) => setFormData(prev => ({ ...prev, metaSementesTrigo: e.target.value }))}
                                placeholder="0.00"
                                className="font-mono"
                                data-testid="input-meta-sementes-trigo"
                              />
                            </div>

                            <div>
                              <Label htmlFor="metaSementesDiversas">Sementes Diversas</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={formData.metaSementesDiversas}
                                onChange={(e) => setFormData(prev => ({ ...prev, metaSementesDiversas: e.target.value }))}
                                placeholder="0.00"
                                className="font-mono"
                                data-testid="input-meta-sementes-diversas"
                              />
                            </div>

                            <div>
                              <Label htmlFor="metaFertilizantes">Fertilizantes</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={formData.metaFertilizantes}
                                onChange={(e) => setFormData(prev => ({ ...prev, metaFertilizantes: e.target.value }))}
                                placeholder="0.00"
                                className="font-mono"
                                data-testid="input-meta-fertilizantes"
                              />
                            </div>

                            <div>
                              <Label htmlFor="metaCorretivos">Corretivos</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={formData.metaCorretivos}
                                onChange={(e) => setFormData(prev => ({ ...prev, metaCorretivos: e.target.value }))}
                                placeholder="0.00"
                                className="font-mono"
                                data-testid="input-meta-corretivos"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="bg-muted p-4 rounded-lg">
                          <Label className="text-base font-semibold">Meta Global (USD)</Label>
                          <p className="text-2xl font-bold font-mono mt-2 text-primary">
                            ${calculateGlobalGoal().toLocaleString()}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Soma das metas por categoria
                          </p>
                        </div>

                        <div className="flex justify-end gap-3 pt-4">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowNewGoalModal(false)}
                            data-testid="button-cancel"
                          >
                            Cancelar
                          </Button>
                          <Button
                            type="submit"
                            disabled={createGoalMutation.isPending}
                            data-testid="button-save"
                          >
                            {createGoalMutation.isPending ? "Salvando..." : "Salvar Meta"}
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </CardHeader>
                <CardContent>
                  {goalsLoading ? (
                    <div className="text-center py-12 text-muted-foreground">
                      Carregando metas...
                    </div>
                  ) : goalsWithDetails.length === 0 ? (
                    <div className="text-center py-12">
                      <Target className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground mb-4">Nenhuma meta definida</p>
                      <Button 
                        onClick={() => setShowNewGoalModal(true)}
                        data-testid="button-first-goal"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Definir primeira meta
                      </Button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Safra</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead className="text-right">Meta (USD)</TableHead>
                            <TableHead className="text-right">Realizado (USD)</TableHead>
                            <TableHead>Atingimento</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                            <TableHead className="text-center">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {goalsWithDetails.map((goal) => (
                            <TableRow key={goal.id} data-testid={`goal-row-${goal.id}`}>
                              <TableCell className="font-medium">{goal.seasonName}</TableCell>
                              <TableCell>
                                <Badge className={getTypeBadgeClass(goal.seasonType)}>
                                  {getTypeLabel(goal.seasonType)}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div>
                                  <p className="font-mono font-bold">${goal.goalAmount.toLocaleString()}</p>
                                  <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                    {parseFloat(goal.metaAgroquimicos || "0") > 0 && (
                                      <p>Agroquímicos: ${parseFloat(goal.metaAgroquimicos).toLocaleString()}</p>
                                    )}
                                    {parseFloat(goal.metaEspecialidades || "0") > 0 && (
                                      <p>Especialidades: ${parseFloat(goal.metaEspecialidades).toLocaleString()}</p>
                                    )}
                                    {parseFloat(goal.metaSementesMilho || "0") > 0 && (
                                      <p>Sementes Milho: ${parseFloat(goal.metaSementesMilho).toLocaleString()}</p>
                                    )}
                                    {parseFloat(goal.metaSementesSoja || "0") > 0 && (
                                      <p>Sementes Soja: ${parseFloat(goal.metaSementesSoja).toLocaleString()}</p>
                                    )}
                                    {parseFloat(goal.metaSementesTrigo || "0") > 0 && (
                                      <p>Sementes Trigo: ${parseFloat(goal.metaSementesTrigo).toLocaleString()}</p>
                                    )}
                                    {parseFloat(goal.metaSementesDiversas || "0") > 0 && (
                                      <p>Sementes Diversas: ${parseFloat(goal.metaSementesDiversas).toLocaleString()}</p>
                                    )}
                                    {parseFloat(goal.metaFertilizantes || "0") > 0 && (
                                      <p>Fertilizantes: ${parseFloat(goal.metaFertilizantes).toLocaleString()}</p>
                                    )}
                                    {parseFloat(goal.metaCorretivos || "0") > 0 && (
                                      <p>Corretivos: ${parseFloat(goal.metaCorretivos).toLocaleString()}</p>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div>
                                  <p className="font-mono font-bold">${goal.achievedAmount.toLocaleString()}</p>
                                  <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                    {goal.realizadoAgroquimicos > 0 && (
                                      <p>Agroquímicos: ${goal.realizadoAgroquimicos.toLocaleString()}</p>
                                    )}
                                    {goal.realizadoEspecialidades > 0 && (
                                      <p>Especialidades: ${goal.realizadoEspecialidades.toLocaleString()}</p>
                                    )}
                                    {goal.realizadoSementesMilho > 0 && (
                                      <p>Sementes Milho: ${goal.realizadoSementesMilho.toLocaleString()}</p>
                                    )}
                                    {goal.realizadoSementesSoja > 0 && (
                                      <p>Sementes Soja: ${goal.realizadoSementesSoja.toLocaleString()}</p>
                                    )}
                                    {goal.realizadoSementesTrigo > 0 && (
                                      <p>Sementes Trigo: ${goal.realizadoSementesTrigo.toLocaleString()}</p>
                                    )}
                                    {goal.realizadoSementesDiversas > 0 && (
                                      <p>Sementes Diversas: ${goal.realizadoSementesDiversas.toLocaleString()}</p>
                                    )}
                                    {goal.realizadoFertilizantes > 0 && (
                                      <p>Fertilizantes: ${goal.realizadoFertilizantes.toLocaleString()}</p>
                                    )}
                                    {goal.realizadoCorretivos > 0 && (
                                      <p>Corretivos: ${goal.realizadoCorretivos.toLocaleString()}</p>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-mono">{goal.percentage.toFixed(0)}%</span>
                                  </div>
                                  <Progress 
                                    value={Math.min(goal.percentage, 100)} 
                                    className="h-2"
                                  />
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                {goal.status === "concluida" ? (
                                  <Badge className="bg-verde/10 text-verde">
                                    {goal.percentage >= 100 ? "Atingida" : "Concluída"}
                                  </Badge>
                                ) : goal.percentage >= 100 ? (
                                  <Badge className="bg-verde/10 text-verde">Superada</Badge>
                                ) : goal.percentage >= 80 ? (
                                  <Badge className="bg-amarela/10 text-amarela">Próxima</Badge>
                                ) : (
                                  <Badge variant="outline">Em andamento</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditClick(seasonGoals?.find(g => g.id === goal.id) as SeasonGoal)}
                                    data-testid={`button-edit-${goal.id}`}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteClick(goal.id)}
                                    data-testid={`button-delete-${goal.id}`}
                                    className="text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
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

            {/* Goal Summary */}
            <div>
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Progresso por Categoria</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">Atingimento individual de cada segmento</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {goalsWithDetails.length > 0 && goalsWithDetails[0] && (
                    <>
                      {parseFloat(goalsWithDetails[0].metaAgroquimicos) > 0 && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Agroquímicos</span>
                            <span className="font-mono font-semibold">{goalsWithDetails[0].percentAgroquimicos.toFixed(0)}%</span>
                          </div>
                          <Progress value={Math.min(goalsWithDetails[0].percentAgroquimicos, 100)} className="h-1.5" />
                          <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span>${goalsWithDetails[0].realizadoAgroquimicos.toLocaleString()}</span>
                            <span>${parseFloat(goalsWithDetails[0].metaAgroquimicos).toLocaleString()}</span>
                          </div>
                        </div>
                      )}
                      
                      {parseFloat(goalsWithDetails[0].metaEspecialidades) > 0 && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Especialidades</span>
                            <span className="font-mono font-semibold">{goalsWithDetails[0].percentEspecialidades.toFixed(0)}%</span>
                          </div>
                          <Progress value={Math.min(goalsWithDetails[0].percentEspecialidades, 100)} className="h-1.5" />
                          <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span>${goalsWithDetails[0].realizadoEspecialidades.toLocaleString()}</span>
                            <span>${parseFloat(goalsWithDetails[0].metaEspecialidades).toLocaleString()}</span>
                          </div>
                        </div>
                      )}
                      
                      {parseFloat(goalsWithDetails[0].metaSementesMilho) > 0 && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Sementes Milho</span>
                            <span className="font-mono font-semibold">{goalsWithDetails[0].percentSementesMilho.toFixed(0)}%</span>
                          </div>
                          <Progress value={Math.min(goalsWithDetails[0].percentSementesMilho, 100)} className="h-1.5" />
                          <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span>${goalsWithDetails[0].realizadoSementesMilho.toLocaleString()}</span>
                            <span>${parseFloat(goalsWithDetails[0].metaSementesMilho).toLocaleString()}</span>
                          </div>
                        </div>
                      )}
                      
                      {parseFloat(goalsWithDetails[0].metaSementesSoja) > 0 && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Sementes Soja</span>
                            <span className="font-mono font-semibold">{goalsWithDetails[0].percentSementesSoja.toFixed(0)}%</span>
                          </div>
                          <Progress value={Math.min(goalsWithDetails[0].percentSementesSoja, 100)} className="h-1.5" />
                          <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span>${goalsWithDetails[0].realizadoSementesSoja.toLocaleString()}</span>
                            <span>${parseFloat(goalsWithDetails[0].metaSementesSoja).toLocaleString()}</span>
                          </div>
                        </div>
                      )}
                      
                      {parseFloat(goalsWithDetails[0].metaSementesTrigo) > 0 && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Sementes Trigo</span>
                            <span className="font-mono font-semibold">{goalsWithDetails[0].percentSementesTrigo.toFixed(0)}%</span>
                          </div>
                          <Progress value={Math.min(goalsWithDetails[0].percentSementesTrigo, 100)} className="h-1.5" />
                          <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span>${goalsWithDetails[0].realizadoSementesTrigo.toLocaleString()}</span>
                            <span>${parseFloat(goalsWithDetails[0].metaSementesTrigo).toLocaleString()}</span>
                          </div>
                        </div>
                      )}
                      
                      {parseFloat(goalsWithDetails[0].metaSementesDiversas) > 0 && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Sementes Diversas</span>
                            <span className="font-mono font-semibold">{goalsWithDetails[0].percentSementesDiversas.toFixed(0)}%</span>
                          </div>
                          <Progress value={Math.min(goalsWithDetails[0].percentSementesDiversas, 100)} className="h-1.5" />
                          <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span>${goalsWithDetails[0].realizadoSementesDiversas.toLocaleString()}</span>
                            <span>${parseFloat(goalsWithDetails[0].metaSementesDiversas).toLocaleString()}</span>
                          </div>
                        </div>
                      )}
                      
                      {parseFloat(goalsWithDetails[0].metaFertilizantes) > 0 && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Fertilizantes</span>
                            <span className="font-mono font-semibold">{goalsWithDetails[0].percentFertilizantes.toFixed(0)}%</span>
                          </div>
                          <Progress value={Math.min(goalsWithDetails[0].percentFertilizantes, 100)} className="h-1.5" />
                          <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span>${goalsWithDetails[0].realizadoFertilizantes.toLocaleString()}</span>
                            <span>${parseFloat(goalsWithDetails[0].metaFertilizantes).toLocaleString()}</span>
                          </div>
                        </div>
                      )}
                      
                      {parseFloat(goalsWithDetails[0].metaCorretivos) > 0 && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Corretivos</span>
                            <span className="font-mono font-semibold">{goalsWithDetails[0].percentCorretivos.toFixed(0)}%</span>
                          </div>
                          <Progress value={Math.min(goalsWithDetails[0].percentCorretivos, 100)} className="h-1.5" />
                          <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span>${goalsWithDetails[0].realizadoCorretivos.toLocaleString()}</span>
                            <span>${parseFloat(goalsWithDetails[0].metaCorretivos).toLocaleString()}</span>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  
                  {goalsWithDetails.length === 0 && (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      Crie uma meta para visualizar o progresso
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!goalToDelete} onOpenChange={(open) => !open && setGoalToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta meta? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
