import Navbar from "@/components/layout/navbar";
import Header from "@/components/layout/header";
import StatCard from "@/components/dashboard/stat-card";
import CommissionsChart from "@/components/dashboard/commissions-chart";
import RecentSales from "@/components/dashboard/recent-sales";
import OpportunityAlerts from "@/components/dashboard/opportunity-alerts";
import TopClients from "@/components/dashboard/top-clients";
import NewSaleModal from "@/components/modals/new-sale-modal";
import ImportPDFModal from "@/components/modals/import-pdf-modal";
import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { DollarSign, Percent, Target, Users, ChevronDown, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

export default function Dashboard() {
  const [showNewSaleModal, setShowNewSaleModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedSeasonIds, setSelectedSeasonIds] = useState<string[]>([]);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const { data: analytics, isLoading: analyticsLoading } = useQuery<{
    totalSales: number;
    totalCommissions: number;
    salesByCategory: { categoryId: string; categoryName: string; total: number; commissions: number }[];
    topClients: { clientId: string; clientName: string; total: number; percentage: number }[];
  }>({
    queryKey: ["/api/analytics/sales"],
  });

  const { data: activeSeason } = useQuery<{ id: string; name: string }>({
    queryKey: ["/api/seasons/active"],
  });

  const { data: seasons } = useQuery<{ id: string; name: string; type: string; isActive: boolean }[]>({
    queryKey: ["/api/seasons"],
  });

  const { data: clients } = useQuery<any[]>({
    queryKey: ["/api/clients"],
  });

  const { data: seasonGoals } = useQuery<any[]>({
    queryKey: ["/api/season-goals"],
  });

  const { data: sales } = useQuery<any[]>({
    queryKey: ["/api/sales"],
  });

  const { data: categories } = useQuery<any[]>({
    queryKey: ["/api/categories"],
  });

  useEffect(() => {
    if (activeSeason && selectedSeasonIds.length === 0) {
      setSelectedSeasonIds([activeSeason.id]);
    }
  }, [activeSeason]);

  const openNewSaleModal = () => {
    setShowNewSaleModal(true);
  };

  const openImportModal = () => {
    setShowImportModal(true);
  };

  const handleSeasonToggle = (seasonId: string) => {
    setSelectedSeasonIds(prev => 
      prev.includes(seasonId) 
        ? prev.filter(id => id !== seasonId)
        : [...prev, seasonId]
    );
  };

  const handleSelectAll = () => {
    if (!seasons || seasons.length === 0) return;
    
    if (selectedSeasonIds.length === seasons.length) {
      setSelectedSeasonIds([]);
    } else {
      setSelectedSeasonIds(seasons.map(s => s.id));
    }
  };

  const selectedSeasons = useMemo(() => {
    return seasons?.filter(s => selectedSeasonIds.includes(s.id)) || [];
  }, [seasons, selectedSeasonIds]);

  const buttonText = useMemo(() => {
    if (selectedSeasonIds.length === 0) return "Selecione safras";
    if (selectedSeasonIds.length === 1) {
      const season = seasons?.find(s => s.id === selectedSeasonIds[0]);
      return season?.name || "1 safra selecionada";
    }
    return `Safras: ${selectedSeasonIds.length} selecionadas`;
  }, [selectedSeasonIds, seasons]);

  const filteredSales = useMemo(() => {
    return sales?.filter(s => selectedSeasonIds.includes(s.seasonId)) || [];
  }, [sales, selectedSeasonIds]);

  const filteredAnalytics = useMemo(() => {
    const totalSales = filteredSales.reduce((sum, sale) => sum + parseFloat(sale.totalAmount), 0);
    const totalCommissions = filteredSales.reduce((sum, sale) => sum + parseFloat(sale.commissionAmount), 0);

    const salesByCategory: { [key: string]: { categoryId: string; categoryName: string; total: number; commissions: number } } = {};
    
    filteredSales.forEach(sale => {
      const category = categories?.find(c => c.id === sale.categoryId);
      if (category) {
        if (!salesByCategory[sale.categoryId]) {
          salesByCategory[sale.categoryId] = {
            categoryId: sale.categoryId,
            categoryName: category.name,
            total: 0,
            commissions: 0
          };
        }
        salesByCategory[sale.categoryId].total += parseFloat(sale.totalAmount);
        salesByCategory[sale.categoryId].commissions += parseFloat(sale.commissionAmount);
      }
    });

    const clientSales: { [key: string]: { clientId: string; clientName: string; total: number } } = {};
    
    filteredSales.forEach(sale => {
      const client = clients?.find(c => c.id === sale.clientId);
      if (client) {
        if (!clientSales[sale.clientId]) {
          clientSales[sale.clientId] = {
            clientId: sale.clientId,
            clientName: client.name,
            total: 0
          };
        }
        clientSales[sale.clientId].total += parseFloat(sale.totalAmount);
      }
    });

    const topClients = Object.values(clientSales)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
      .map(client => ({
        ...client,
        percentage: totalSales > 0 ? (client.total / totalSales) * 100 : 0
      }));

    return {
      totalSales,
      totalCommissions,
      salesByCategory: Object.values(salesByCategory),
      topClients
    };
  }, [filteredSales, categories, clients]);

  const selectedGoals = useMemo(() => {
    return seasonGoals?.filter(goal => selectedSeasonIds.includes(goal.seasonId)) || [];
  }, [seasonGoals, selectedSeasonIds]);

  const aggregatedGoal = useMemo(() => {
    if (selectedGoals.length === 0) return undefined;
    
    if (selectedGoals.length === 1) {
      return selectedGoals[0];
    }
    
    const aggregated = {
      id: 'aggregated-goal',
      seasonId: selectedSeasonIds[0],
      goalAmount: "0",
      metaAgroquimicos: "0",
      metaEspecialidades: "0",
      metaSementesMilho: "0",
      metaSementesSoja: "0",
      metaSementesTrigo: "0",
      metaSementesDiversas: "0",
      metaFertilizantes: "0",
      metaCorretivos: "0",
      userId: selectedGoals[0].userId
    };
    
    selectedGoals.forEach(goal => {
      aggregated.goalAmount = (parseFloat(aggregated.goalAmount) + parseFloat(goal.goalAmount || "0")).toString();
      aggregated.metaAgroquimicos = (parseFloat(aggregated.metaAgroquimicos) + parseFloat(goal.metaAgroquimicos || "0")).toString();
      aggregated.metaEspecialidades = (parseFloat(aggregated.metaEspecialidades) + parseFloat(goal.metaEspecialidades || "0")).toString();
      aggregated.metaSementesMilho = (parseFloat(aggregated.metaSementesMilho) + parseFloat(goal.metaSementesMilho || "0")).toString();
      aggregated.metaSementesSoja = (parseFloat(aggregated.metaSementesSoja) + parseFloat(goal.metaSementesSoja || "0")).toString();
      aggregated.metaSementesTrigo = (parseFloat(aggregated.metaSementesTrigo) + parseFloat(goal.metaSementesTrigo || "0")).toString();
      aggregated.metaSementesDiversas = (parseFloat(aggregated.metaSementesDiversas) + parseFloat(goal.metaSementesDiversas || "0")).toString();
      aggregated.metaFertilizantes = (parseFloat(aggregated.metaFertilizantes) + parseFloat(goal.metaFertilizantes || "0")).toString();
      aggregated.metaCorretivos = (parseFloat(aggregated.metaCorretivos) + parseFloat(goal.metaCorretivos || "0")).toString();
    });
    
    return aggregated;
  }, [selectedGoals, selectedSeasonIds]);

  const totalGoal = useMemo(() => {
    return selectedGoals.reduce((sum, goal) => sum + parseFloat(goal.goalAmount), 0);
  }, [selectedGoals]);

  const totalRealized = useMemo(() => {
    return filteredSales.reduce((sum, sale) => sum + parseFloat(sale.totalAmount), 0);
  }, [filteredSales]);

  const goalAchievement = useMemo(() => {
    return totalGoal > 0
      ? Math.min(100, Math.round((totalRealized / totalGoal) * 100))
      : 0;
  }, [totalRealized, totalGoal]);

  const totalClients = clients?.length || 0;
  
  const commissionPercentage = filteredAnalytics.totalSales > 0
    ? ((filteredAnalytics.totalCommissions / filteredAnalytics.totalSales) * 100).toFixed(2)
    : '0.00';

  const seasonsSubtitle = selectedSeasonIds.length > 0 ? "Safras selecionadas" : "Nenhuma safra selecionada";

  if (analyticsLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" data-testid="dashboard-container">
      <Header 
        onNewSale={openNewSaleModal}
        title="Dashboard Principal"
        subtitle="Visão geral de vendas e comissões"
      />
      <Navbar />
      
      <main className="flex-1 overflow-y-auto">

        <div className="p-8">
          {/* Season Filter */}
          <div className="mb-6">
            <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  className="w-auto min-w-[250px] justify-between bg-white dark:bg-gray-800 border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-900/20"
                  data-testid="button-season-filter"
                >
                  <span className="text-green-700 dark:text-green-400 font-medium">{buttonText}</span>
                  <ChevronDown className="h-4 w-4 ml-2 text-green-600 dark:text-green-500" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="start" data-testid="popover-season-filter">
                <div className="space-y-4">
                  <div className="font-semibold text-sm text-green-700 dark:text-green-400">
                    Selecionar Safras
                  </div>
                  
                  <div className="flex items-center space-x-2 pb-2 border-b border-green-100 dark:border-green-800">
                    <Checkbox 
                      id="select-all"
                      checked={selectedSeasonIds.length === seasons?.length && seasons?.length > 0}
                      onCheckedChange={handleSelectAll}
                      data-testid="checkbox-select-all-seasons"
                    />
                    <label
                      htmlFor="select-all"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      Selecionar Todas
                    </label>
                  </div>

                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {seasons?.map((season) => (
                      <div key={season.id} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`season-${season.id}`}
                          checked={selectedSeasonIds.includes(season.id)}
                          onCheckedChange={() => handleSeasonToggle(season.id)}
                          data-testid={`checkbox-season-${season.id}`}
                        />
                        <label
                          htmlFor={`season-${season.id}`}
                          className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                        >
                          {season.name}
                          {season.isActive && (
                            <span className="ml-2 text-xs text-green-600 dark:text-green-400 font-medium">
                              (Ativa)
                            </span>
                          )}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard
              title="Vendas Totais (USD)"
              value={`$${filteredAnalytics.totalSales.toLocaleString()}`}
              icon={DollarSign}
              subtitle={seasonsSubtitle}
            />
            
            <StatCard
              title="Comissões Totais (USD)"
              value={`$${filteredAnalytics.totalCommissions.toLocaleString()}`}
              icon={Percent}
              subtitle={`${commissionPercentage}% do total de vendas`}
              color="secondary"
            />
            
            <StatCard
              title="Atingimento de Meta"
              value={`${goalAchievement}%`}
              icon={Target}
              subtitle={totalGoal > 0 ? `Meta: $${totalGoal.toLocaleString()}` : "Sem meta definida"}
              color="accent"
              showProgress={true}
              progressValue={goalAchievement}
            />
            
            <StatCard
              title="Clientes Ativos"
              value={totalClients.toString()}
              icon={Users}
              subtitle="Total cadastrado"
              color="chart-4"
            />
          </div>

          {/* CRM Mobile Card */}
          <div className="mb-8">
            <div className="bg-gradient-to-br from-green-500 to-green-700 dark:from-green-600 dark:to-green-800 rounded-lg p-6 shadow-lg hover:shadow-xl transition-shadow cursor-pointer" onClick={() => window.location.href = '/crm'} data-testid="card-crm-mobile">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="bg-white/20 p-3 rounded-lg">
                    <MapPin className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-white text-xl font-bold">CRM Móvel</h3>
                    <p className="text-white/90 text-sm">Gestão de visitas e rastreamento GPS</p>
                  </div>
                </div>
                <Button variant="secondary" className="bg-white text-green-700 hover:bg-white/90">
                  Acessar
                </Button>
              </div>
            </div>
          </div>

          {/* Charts Row & Top Clients */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="lg:col-span-2">
              <CommissionsChart 
                seasonGoal={aggregatedGoal}
                salesData={filteredSales}
                categories={categories || []}
              />
            </div>
            <TopClients clients={filteredAnalytics.topClients} />
          </div>

          {/* Recent Sales */}
          <div className="mb-8">
            <RecentSales />
          </div>

          {/* Opportunity Alerts */}
          <div className="mb-8">
            <OpportunityAlerts />
          </div>
        </div>
      </main>

      {/* Modals */}
      <NewSaleModal 
        isOpen={showNewSaleModal} 
        onClose={() => setShowNewSaleModal(false)} 
      />
      <ImportPDFModal 
        isOpen={showImportModal} 
        onClose={() => setShowImportModal(false)} 
      />
    </div>
  );
}
