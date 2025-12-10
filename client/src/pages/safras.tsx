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
import { Progress } from "@/components/ui/progress";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Calendar, Target, TrendingUp, Sprout } from "lucide-react";
import { format } from "date-fns";
import { classifySeason } from "@/lib/seasons";
import type { Season, InsertSeason } from "@shared/schema";

export default function Safras() {
  const [showNewSeasonModal, setShowNewSeasonModal] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    type: "",
    year: new Date().getFullYear(),
    startDate: "",
    endDate: "",
  });

  const { data: seasons, isLoading } = useQuery<Season[]>({
    queryKey: ["/api/seasons"],
  });

  const { data: analytics } = useQuery({
    queryKey: ["/api/analytics/sales"],
  });

  const { data: activeSeason } = useQuery<{ name: string }>({
    queryKey: ["/api/seasons/active"],
  });

  const createSeasonMutation = useMutation({
    mutationFn: async (seasonData: InsertSeason) => {
      return apiRequest("POST", "/api/seasons", seasonData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/seasons"] });
      toast({
        title: "Safra cadastrada",
        description: "A safra foi cadastrada com sucesso.",
      });
      setShowNewSeasonModal(false);
      resetForm();
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao cadastrar safra. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      type: "",
      year: new Date().getFullYear(),
      startDate: "",
      endDate: "",
    });
  };

  const generateSeasonName = (type: string, year: number) => {
    switch (type) {
      case "soja_verao":
        return `Soja ${year % 100}/${(year + 1) % 100}`;
      case "soja_safrinha":
        return `Soja Safrinha ${year}`;
      case "milho":
        return `Milho ${year % 100}/${year % 100}`;
      case "trigo":
        return `Trigo ${year}`;
      default:
        return `Safra ${year}`;
    }
  };

  const handleTypeChange = (type: string) => {
    setFormData(prev => ({
      ...prev,
      type,
      name: generateSeasonName(type, prev.year),
    }));
  };

  const handleYearChange = (year: string) => {
    const yearNum = parseInt(year);
    setFormData(prev => ({
      ...prev,
      year: yearNum,
      name: prev.type ? generateSeasonName(prev.type, yearNum) : "",
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.type || !formData.startDate || !formData.endDate) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    const seasonData: InsertSeason = {
      name: formData.name,
      type: formData.type,
      year: formData.year,
      startDate: new Date(formData.startDate),
      endDate: new Date(formData.endDate),
      isActive: true,
    };

    createSeasonMutation.mutate(seasonData);
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

  const getSeasonProgress = (season: Season) => {
    const now = new Date();
    const start = new Date(season.startDate);
    const end = new Date(season.endDate);
    
    if (now < start) return 0;
    if (now > end) return 100;
    
    const total = end.getTime() - start.getTime();
    const elapsed = now.getTime() - start.getTime();
    return Math.round((elapsed / total) * 100);
  };

  const totalSeasons = seasons?.length || 0;
  const activeSeasons = seasons?.filter(s => s.isActive).length || 0;
  const currentYear = new Date().getFullYear();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" data-testid="safras-container">
      <Header 
        onNewSale={() => {}}
        title="Gestão de Safras"
        subtitle="Controle de safras e períodos de plantio"
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
                    <Calendar className="text-primary" size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total de Safras</p>
                    <p className="text-2xl font-bold">{totalSeasons}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-verde/10 rounded-lg flex items-center justify-center">
                    <Sprout className="text-verde" size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Safras Ativas</p>
                    <p className="text-2xl font-bold">{activeSeasons}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-chart-2/10 rounded-lg flex items-center justify-center">
                    <Target className="text-chart-2" size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Safra Atual</p>
                    <p className="text-lg font-bold">{activeSeason?.name || "Nenhuma"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                    <TrendingUp className="text-accent" size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Ano Agrícola</p>
                    <p className="text-2xl font-bold">{currentYear}/{currentYear + 1}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* New Season Button */}
          <div className="mb-8">
            <Dialog open={showNewSeasonModal} onOpenChange={setShowNewSeasonModal}>
              <DialogTrigger asChild>
                <Button data-testid="button-new-season">
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Safra
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl" data-testid="new-season-modal">
                <DialogHeader>
                  <DialogTitle>Nova Safra</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="type">Tipo de Safra *</Label>
                      <Select value={formData.type} onValueChange={handleTypeChange}>
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
                    <div>
                      <Label htmlFor="year">Ano *</Label>
                      <Input
                        type="number"
                        min="2020"
                        max="2030"
                        value={formData.year}
                        onChange={(e) => handleYearChange(e.target.value)}
                        data-testid="input-year"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="name">Nome da Safra *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Ex: Soja 25/26"
                      data-testid="input-season-name"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="startDate">Data de Início *</Label>
                      <Input
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                        data-testid="input-start-date"
                      />
                    </div>
                    <div>
                      <Label htmlFor="endDate">Data de Fim *</Label>
                      <Input
                        type="date"
                        value={formData.endDate}
                        onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                        data-testid="input-end-date"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowNewSeasonModal(false)}
                      data-testid="button-cancel"
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      disabled={createSeasonMutation.isPending}
                      data-testid="button-save"
                    >
                      {createSeasonMutation.isPending ? "Salvando..." : "Salvar Safra"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Seasons Table */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Lista de Safras</CardTitle>
            </CardHeader>
            <CardContent>
              {seasons?.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">Nenhuma safra cadastrada</p>
                  <Button 
                    onClick={() => setShowNewSeasonModal(true)} 
                    className="mt-4"
                    data-testid="button-first-season"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Cadastrar primeira safra
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Ano</TableHead>
                        <TableHead>Período</TableHead>
                        <TableHead>Progresso</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-right">Vendas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {seasons?.map((season) => {
                        const progress = getSeasonProgress(season);
                        const isActive = progress > 0 && progress < 100;
                        
                        return (
                          <TableRow key={season.id} data-testid={`season-row-${season.id}`}>
                            <TableCell className="font-medium">{season.name}</TableCell>
                            <TableCell>
                              <Badge className={getTypeBadgeClass(season.type)}>
                                {getTypeLabel(season.type)}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono">{season.year}</TableCell>
                            <TableCell className="text-sm">
                              {format(new Date(season.startDate), "dd/MM/yyyy")} - {format(new Date(season.endDate), "dd/MM/yyyy")}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress value={progress} className="flex-1 h-2" />
                                <span className="text-sm font-mono w-12">{progress}%</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              {season.isActive && isActive ? (
                                <Badge className="bg-verde/10 text-verde">Ativa</Badge>
                              ) : progress === 100 ? (
                                <Badge variant="outline">Finalizada</Badge>
                              ) : (
                                <Badge variant="outline" className="text-muted-foreground">
                                  Aguardando
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              $0 {/* This would be calculated from sales data */}
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
        </div>
      </main>
    </div>
  );
}
