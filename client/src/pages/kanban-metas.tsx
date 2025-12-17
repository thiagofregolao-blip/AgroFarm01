import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import MarketManagementPanel from "@/components/MarketManagementPanel";
import Header from "@/components/layout/header";
import Navbar from "@/components/layout/navbar";
import {
  TrendingUp,
  DollarSign,
  Layers,
  Users,
  Map as MapIcon,
  Sprout,
  ArrowUpRight,
  Briefcase
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from "recharts";

interface Client {
  id: string;
  name: string;
}

interface Season {
  id: string;
  name: string;
}

interface CategoryCard {
  categoryId: string;
  categoryName: string;
  categoryType: string;
  potentialUsd: number;
  potentialHa: number;
  cvaleUsd: number;
  cvaleMarketUsd: number;
  oportunidadesUsd: number;
  jaNegociadoUsd: number;
  totalCapturedUsd: number;
  penetrationPercent: number;
}

interface ClientBreakdown {
  clientId: string;
  clientName: string;
  categories: Record<string, {
    potentialUsd: number;
    salesUsd: number;
    oportunidadesUsd: number;
    jaNegociadoUsd: number;
  }>;
}

interface MonthlySales {
  month: string;
  total: number;
}

interface SegmentData {
  total: number;
  clients: Array<{ id: string; name: string; value: number }>;
}

interface SegmentBreakdown {
  agroquimicos: {
    total: number;
    subcategories: Record<string, number>;
    clients: Array<{ id: string; name: string; value: number }>;
  };
  fertilizantes: SegmentData;
  sementes: SegmentData;
  corretivos: SegmentData;
  especialidades: SegmentData;
}

interface DashboardData {
  cards: CategoryCard[];
  clientBreakdown: ClientBreakdown[];
  monthlySales: MonthlySales[];
  segmentBreakdown?: SegmentBreakdown;
}

export default function KanbanMetasPage() {
  const [viewSeasonId, setViewSeasonId] = useState<string>("");
  const [showMarketPanel, setShowMarketPanel] = useState(false);
  const [selectedMarketClient, setSelectedMarketClient] = useState<{
    clientId: string;
    clientName: string;
  } | null>(null);

  const { data: seasons } = useQuery<Season[]>({
    // ... (lines 86-367 remain unchanged, skipping for brevity in this replace block if possible, but I must replace contiguous block.
    // To save tokens, I will Target the Interface definition AND the Chart Section separately in two tool calls if needed, or just one big block if I include the middle.)
    // The file is 529 lines. Replacing from interface (line 72) to Chart (line 400+) is too much context drift.
    // I will split this into TWO edits.
    // Edit 1: Update Interface.
    // Edit 2: Update Layout.
    // This call will be EDIT 1: Update Interface.

    queryKey: ["/api/seasons"]
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients", { top8020: "true" }],
    queryFn: async () => {
      const res = await fetch("/api/clients?top8020=true", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch clients");
      return res.json();
    }
  });

  const { data: dashboardData, isLoading: isLoadingData } = useQuery<DashboardData>({
    queryKey: ["/api/market-opportunity/category-cards", viewSeasonId],
    queryFn: async () => {
      const res = await fetch(`/api/market-opportunity/category-cards/${viewSeasonId}`, {
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to fetch dashboard data");
      return res.json();
    },
    enabled: !!viewSeasonId
  });

  const handleNextClient = () => {
    if (!clients || !selectedMarketClient) return;

    const currentIndex = clients.findIndex(c => c.id === selectedMarketClient.clientId);
    if (currentIndex === -1 || currentIndex === clients.length - 1) return;

    const nextClient = clients[currentIndex + 1];
    setSelectedMarketClient({
      clientId: nextClient.id,
      clientName: nextClient.name
    });
  };

  const hasNextClient = () => {
    if (!clients || !selectedMarketClient) return false;
    const currentIndex = clients.findIndex(c => c.id === selectedMarketClient.clientId);
    return currentIndex !== -1 && currentIndex < clients.length - 1;
  };

  // Aggregated Metrics
  const metrics = useMemo(() => {
    if (!dashboardData) return null;

    const totalPotential = dashboardData.cards.reduce((acc, card) => acc + card.potentialUsd, 0);
    const totalSales = dashboardData.cards.reduce((acc, card) => acc + card.cvaleUsd, 0);
    const totalOpportunities = dashboardData.cards.reduce((acc, card) => acc + (card.oportunidadesUsd || 0), 0);
    const totalRealized = dashboardData.cards.reduce((acc, card) => acc + (card.jaNegociadoUsd || 0), 0);
    const totalArea = dashboardData.cards.reduce((acc, card) => acc + card.potentialHa, 0); // Note: This might sum duplicates if multiple cats utilize same area. Ideally aggregate by client.

    // Better Area Calculation: Sum 'userArea' from clients? 
    // Since backend aggregates into cards, let's use what we have or accept approximation.
    // Actually, 'clientBreakdown' + client list could give exact area if available.
    // For now, let's just stick to the Card sums or a placeholder if inaccurate.

    return {
      totalPotential,
      totalSales,
      totalOpportunities,
      totalRealized,
      totalArea, // Caution with duplicates
      clientCount: dashboardData.clientBreakdown?.length || 0
    };
  }, [dashboardData]);

  // Handle Client Click
  const handleClientClick = (clientId: string, clientName: string) => {
    setSelectedMarketClient({ clientId, clientName });
    setShowMarketPanel(true);
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      <Header
        title="Dashboard de Mercado"
        subtitle="Visão estratégica e monitoramento"
        showNewSaleButton={false}
      />
      <Navbar />

      <div className="flex-1 flex overflow-hidden">
        {/* LEFT SIDEBAR - METRICS & FILTERS */}
        <aside className="w-[320px] bg-white border-r flex flex-col h-full overflow-y-auto z-10 shadow-sm">
          <div className="p-6 space-y-8">

            {/* Filter Section */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-slate-500 uppercase tracking-wider">Filtros</h3>
              <div className="space-y-2">
                <Label>Safra Ativa</Label>
                <Select value={viewSeasonId} onValueChange={setViewSeasonId}>
                  <SelectTrigger className="w-full bg-slate-50" data-testid="select-season">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {seasons?.map(season => (
                      <SelectItem key={season.id} value={season.id}>
                        {season.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Metrics Section */}
            {metrics && (
              <div className="space-y-6">
                <h3 className="font-semibold text-sm text-slate-500 uppercase tracking-wider">Indicadores Chave</h3>

                {/* Total Clients */}
                <div className="bg-gradient-to-br from-green-50 to-white p-4 rounded-xl border border-green-100 shadow-sm">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-green-100 rounded-lg text-green-700">
                      <Users className="h-5 w-5" />
                    </div>
                    <span className="text-sm font-medium text-slate-600">Total Clientes (80/20)</span>
                  </div>
                  <div className="text-3xl font-bold text-slate-800 ml-1">
                    {metrics.clientCount}
                  </div>
                </div>



                {/* Financial Metrics */}
                <div className="space-y-3">
                  <MetricRow
                    label="Potencial Total"
                    value={metrics.totalPotential}
                    color="text-slate-600"
                    icon={<Sprout className="h-4 w-4" />}
                  />
                  <MetricRow
                    label="Vendas C.Vale"
                    value={metrics.totalSales}
                    color="text-blue-600"
                    icon={<TrendingUp className="h-4 w-4" />}
                  />
                  <MetricRow
                    label="Oportunidades"
                    value={metrics.totalOpportunities}
                    color="text-green-600"
                    icon={<ArrowUpRight className="h-4 w-4" />}
                  />
                  <MetricRow
                    label="Realizado Mercado"
                    value={metrics.totalRealized}
                    color="text-orange-500"
                    icon={<Briefcase className="h-4 w-4" />}
                  />
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* MAIN CONTENT Area */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50/50">
          {!viewSeasonId ? (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              <div className="text-center">
                <Layers className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <p>Selecione uma safra para visualizar o dashboard</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-8">

              {/* TOP: Category Cards - Market Progress */}
              {dashboardData?.cards && dashboardData.cards.length > 0 && (
                <section className="space-y-4">
                  <h2 className="text-xl font-semibold flex items-center gap-2 text-slate-800">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Progresso de Mercado por Categoria
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                    {dashboardData.cards.map((card) => (
                      <Card key={card.categoryId} className="border-slate-200 shadow-sm hover:shadow-md transition-all" data-testid={`category-card-${card.categoryType}`}>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg font-bold text-slate-700">{card.categoryName}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {/* Potencial */}
                          <div className="flex items-start gap-2">
                            <Layers className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div className="flex-1">
                              <div className="text-xs text-muted-foreground">Potencial de Mercado</div>
                              <div className="font-semibold text-slate-700">
                                ${card.potentialUsd.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {card.potentialHa.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ha
                              </div>
                            </div>
                          </div>

                          {/* C.Vale */}
                          <div className="flex items-start gap-2">
                            <DollarSign className="h-4 w-4 text-blue-600 mt-0.5" />
                            <div className="flex-1">
                              <div className="text-xs text-muted-foreground">Vendas C.Vale</div>
                              <div className="font-semibold text-blue-600">
                                ${card.cvaleUsd.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              </div>
                            </div>
                          </div>

                          {/* Oportunidades */}
                          <div className="flex items-start gap-2">
                            <DollarSign className="h-4 w-4 text-green-600 mt-0.5" />
                            <div className="flex-1">
                              <div className="text-xs text-muted-foreground">Oportunidades</div>
                              <div className="font-semibold text-green-600">
                                ${(card.oportunidadesUsd || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              </div>
                            </div>
                          </div>

                          {/* Já Negociado */}
                          <div className="flex items-start gap-2">
                            <DollarSign className="h-4 w-4 text-orange-400 mt-0.5" />
                            <div className="flex-1">
                              <div className="text-xs text-muted-foreground">Já Negociado</div>
                              <div className="font-semibold text-orange-400">
                                ${(card.jaNegociadoUsd || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              </div>
                            </div>
                          </div>

                          {/* Total Capturado */}
                          <div className="pt-2 border-t border-slate-100">
                            <div className="text-xs text-muted-foreground mb-1">Total Capturado</div>
                            <div className="font-bold text-slate-800">
                              ${(card.totalCapturedUsd || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </div>
                          </div>

                          {/* Barra de Progresso - Andamento de Mercado */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-muted-foreground">Andamento de Mercado</span>
                              <span className="font-bold text-green-600">
                                {Math.min(100, (((card.cvaleUsd || 0) + (card.jaNegociadoUsd || 0)) / (card.potentialUsd || 1)) * 100).toFixed(1)}%
                              </span>
                            </div>
                            <Progress
                              value={Math.min(100, (((card.cvaleUsd || 0) + (card.jaNegociadoUsd || 0)) / (card.potentialUsd || 1)) * 100)}
                              className="h-2 bg-green-100"
                              indicatorClassName="bg-green-600"
                              data-testid={`progress-market-${card.categoryType}`}
                            />
                          </div>

                          {/* Barra de Progresso - Vendas C.Vale vs Potencial */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-muted-foreground">Vendas C.Vale / Potencial</span>
                              <span className="font-semibold text-blue-600">
                                {Math.min(100, ((card.cvaleUsd || 0) / (card.potentialUsd || 1)) * 100).toFixed(1)}%
                              </span>
                            </div>
                            <Progress
                              value={Math.min(100, ((card.cvaleUsd || 0) / (card.potentialUsd || 1)) * 100)}
                              className="h-2 bg-blue-100"
                              indicatorClassName="bg-blue-600"
                              data-testid={`progress-cvale-${card.categoryType}`}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </section>
              )}

              {/* MIDDLE: Sales Chart + Segment Breakdown (Flex 55/45) */}
              <div className="flex flex-col lg:flex-row gap-6">

                {/* LEFT: Sales Chart (55%) */}
                {dashboardData?.monthlySales && (
                  <section className="lg:w-[55%] bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h2 className="text-lg font-bold text-slate-800">Evolução de Vendas</h2>
                        <p className="text-sm text-slate-500">Desempenho mensal do consultor na safra</p>
                      </div>
                      <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                        <DollarSign className="h-5 w-5" />
                      </div>
                    </div>

                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dashboardData.monthlySales}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                          <XAxis
                            dataKey="month"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#64748B', fontSize: 12 }}
                            dy={10}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#64748B', fontSize: 12 }}
                            tickFormatter={(value) => `$${value / 1000}k`}
                          />
                          <Tooltip
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                            cursor={{ fill: '#F1F5F9' }}
                            formatter={(value: number) => [`$${value.toLocaleString('pt-BR')}`, 'Vendas']}
                          />
                          <Bar
                            dataKey="total"
                            fill="#3B82F6"
                            radius={[6, 6, 0, 0]}
                            barSize={32}
                          >
                            {dashboardData.monthlySales.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={index === dashboardData.monthlySales.length - 1 ? '#22C55E' : '#3B82F6'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </section>
                )}

                {/* RIGHT: Opportunities by Segment (45%) */}
                {dashboardData?.segmentBreakdown && (
                  <section className="lg:w-[45%] bg-white rounded-2xl p-6 shadow-sm border border-slate-100 overflow-y-auto max-h-[400px]">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h2 className="text-lg font-bold text-slate-800">Oportunidades</h2>
                        <p className="text-sm text-slate-500">Por segmento de produto</p>
                      </div>
                      <div className="p-2 bg-green-50 text-green-600 rounded-lg">
                        <TrendingUp className="h-5 w-5" />
                      </div>
                    </div>

                    <div className="space-y-6">
                      {/* Agroquímicos Group */}
                      <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                        <div className="flex justify-between items-center mb-3">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-red-500" />
                            <span className="font-semibold text-slate-700">Agroquímicos</span>
                          </div>
                          <span className="font-bold text-slate-800">
                            ${dashboardData.segmentBreakdown.agroquimicos.total.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </span>
                        </div>

                        {/* Subcategories (Fungicides, etc.) */}
                        <div className="space-y-2 pl-4 border-l-2 border-slate-200 mb-4">
                          {Object.entries(dashboardData.segmentBreakdown.agroquimicos.subcategories)
                            .sort(([, a], [, b]) => b - a)
                            .map(([name, value]) => (
                              <div key={name} className="flex justify-between items-center text-sm">
                                <span className="text-slate-500">{name}</span>
                                <span className="font-medium text-slate-700">
                                  ${value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </span>
                              </div>
                            ))}
                        </div>

                        {/* Client Breakdown for Agroquímicos */}
                        <div className="pl-4 pt-3 border-t border-slate-200">
                          <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Por Cliente</p>
                          <div className="space-y-1">
                            {dashboardData.segmentBreakdown.agroquimicos.clients.length > 0 ? (
                              dashboardData.segmentBreakdown.agroquimicos.clients.slice(0, 5).map((client) => (
                                <div key={client.id} className="flex justify-between items-center text-xs">
                                  <span className="text-slate-600 truncate max-w-[140px]" title={client.name}>{client.name}</span>
                                  <span className="font-medium text-slate-900 border-b border-dashed border-slate-300">
                                    ${client.value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <span className="text-xs text-slate-400 italic">Sem oportunidades</span>
                            )}
                            {dashboardData.segmentBreakdown.agroquimicos.clients.length > 5 && (
                              <p className="text-[10px] text-slate-400 text-right mt-1">+ {dashboardData.segmentBreakdown.agroquimicos.clients.length - 5} outros</p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Other Segments */}
                      {[
                        { key: 'fertilizantes', label: 'Fertilizantes', data: dashboardData.segmentBreakdown.fertilizantes, color: 'bg-blue-500' },
                        { key: 'sementes', label: 'Sementes', data: dashboardData.segmentBreakdown.sementes, color: 'bg-green-500' },
                        { key: 'especialidades', label: 'Especialidades', data: dashboardData.segmentBreakdown.especialidades, color: 'bg-purple-500' },
                        { key: 'corretivos', label: 'Corretivos', data: dashboardData.segmentBreakdown.corretivos, color: 'bg-yellow-500' }
                      ].map((item) => (
                        <div key={item.key} className="rounded-lg border border-slate-100 p-3 hover:bg-slate-50 transition-colors">
                          <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${item.color}`} />
                              <span className="font-medium text-slate-600">{item.label}</span>
                            </div>
                            <span className="font-bold text-slate-800">
                              ${item.data.total.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </span>
                          </div>

                          {/* Client List */}
                          <div className="pl-4 space-y-1">
                            {item.data.clients.length > 0 ? (
                              item.data.clients.slice(0, 5).map((client) => (
                                <div key={client.id} className="flex justify-between items-center text-xs">
                                  <span className="text-slate-500 truncate max-w-[140px]" title={client.name}>{client.name}</span>
                                  <span className="text-slate-700">
                                    ${client.value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <span className="text-xs text-slate-400 italic pl-1">Sem oportunidades</span>
                            )}
                            {item.data.clients.length > 5 && (
                              <p className="text-[10px] text-slate-400 text-right">+ {item.data.clients.length - 5} outros</p>
                            )}
                          </div>
                        </div>
                      ))}

                    </div>
                  </section>
                )}
              </div>

              {/* BOTTOM: Client Breakdown List (Replacing Grid Table) */}
              <section className="space-y-4">
                <div className="flex items-center justify-between sticky top-0 z-10 bg-slate-50/95 backdrop-blur py-2">
                  <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Visão Detalhada por Cliente (80/20)
                  </h2>
                  <span className="text-xs font-medium px-3 py-1 bg-white border rounded-full text-slate-500 shadow-sm">
                    {dashboardData?.clientBreakdown?.length || 0} Clientes Listados
                  </span>
                </div>

                {isLoadingData ? (
                  <div className="text-center py-12 text-slate-400">Carregando dados...</div>
                ) : (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {dashboardData?.clientBreakdown?.map((client) => (
                      <div
                        key={client.clientId}
                        onClick={() => handleClientClick(client.clientId, client.clientName)}
                        className="group bg-white rounded-xl border border-slate-200 hover:border-green-500/50 hover:shadow-md transition-all cursor-pointer p-5"
                      >
                        <div className="flex justify-between items-start mb-4 border-b border-slate-50 pb-3">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-lg group-hover:bg-green-50 group-hover:text-green-600 transition-colors">
                              {client.clientName.charAt(0)}
                            </div>
                            <div>
                              <h3 className="font-bold text-slate-800 group-hover:text-green-700 transition-colors">{client.clientName}</h3>
                              <p className="text-xs text-slate-400">Clique para gerenciar</p>
                            </div>
                          </div>
                          <ArrowUpRight className="h-5 w-5 text-slate-300 group-hover:text-green-500 transition-colors" />
                        </div>

                        {/* Mini Sparklines / Summary for Categories */}
                        <ScrollArea className="w-full whitespace-nowrap pb-2">
                          <div className="flex gap-3">
                            {dashboardData.cards.map(card => {
                              const catData = client.categories[card.categoryId];
                              if (!catData || (catData.potentialUsd <= 0 && catData.salesUsd <= 0)) return null;

                              const progress = Math.min(100, (catData.salesUsd / (catData.potentialUsd || 1)) * 100);

                              return (
                                <div key={card.categoryId} className="inline-block w-[140px] bg-slate-50 rounded-lg p-3 border border-slate-100 flex-shrink-0">
                                  <div className="text-[10px] font-semibold text-slate-500 uppercase truncate mb-2" title={card.categoryName}>
                                    {card.categoryName}
                                  </div>
                                  <div className="flex justify-between items-end mb-1">
                                    <span className="text-xs text-slate-400">Vendas</span>
                                    <span className="text-sm font-bold text-blue-600">${abbreviateNumber(catData.salesUsd)}</span>
                                  </div>
                                  <Progress value={progress} className="h-1.5 bg-slate-200" indicatorClassName={progress >= 100 ? "bg-green-500" : "bg-blue-500"} />
                                  <div className="flex justify-between mt-1 text-[10px] text-slate-400">
                                    <span>Pot: ${abbreviateNumber(catData.potentialUsd)}</span>
                                    <span>{progress.toFixed(0)}%</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </ScrollArea>
                      </div>
                    ))}
                  </div>
                )}
              </section>

            </div>
          )}
        </main>
      </div>

      {/* Market Management Panel Dialog */}
      {selectedMarketClient && (
        <MarketManagementPanel
          clientId={selectedMarketClient.clientId}
          clientName={selectedMarketClient.clientName}
          seasonId={viewSeasonId}
          isOpen={showMarketPanel}
          onClose={() => {
            setShowMarketPanel(false);
            setSelectedMarketClient(null);
          }}
          onNextClient={handleNextClient}
          hasNextClient={hasNextClient()}
        />
      )
      }
    </div>
  );
}

// Helpers
function MetricRow({ label, value, color, icon }: { label: string, value: number, color: string, icon: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center p-3 rounded-lg hover:bg-slate-50 transition-colors">
      <div className="flex items-center gap-3">
        <div className={`p-1.5 rounded-md bg-white border shadow-sm ${color.replace('text-', 'text-opacity-80 ')}`}>
          {icon}
        </div>
        <span className="text-sm text-slate-500 font-medium">{label}</span>
      </div>
      <span className={`font-bold ${color}`}>
        ${value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
      </span>
    </div>
  )
}

function abbreviateNumber(value: number) {
  if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
  if (value >= 1000) return (value / 1000).toFixed(1) + 'k';
  return value.toString();
}
