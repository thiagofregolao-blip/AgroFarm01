import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, TrendingUp, Target, ListChecks, ArrowLeft, Download, Plus, Edit, Trash2, Trash, Calendar, CheckCircle, FileDown, Settings, Loader2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import ManagerNavbar from '@/components/layout/manager-navbar';
import Header from '@/components/layout/header';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import pptxgen from 'pptxgenjs';
import type { Season, SeasonGoal, InsertSeasonGoal } from '@shared/schema';

interface TeamData {
  totalSales: number;
  salesByCategory: Record<string, number>;
  salesBySeason: Record<string, number>;
  clientSales: Record<string, number>;
  totalTimacPoints: number;
  gerentesValue: string;
  teamMembers: Array<{
    id: string;
    name: string;
    totalSales: number;
    timacPoints: number;
  }>;
}

export default function ManagerDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { toast } = useToast();

  // Read hash from URL to determine active tab
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash && ['dashboard', 'team', 'action-plans', 'metas'].includes(hash)) {
      setActiveTab(hash);
    } else {
      setActiveTab('dashboard');
    }

    const handleHashChange = () => {
      const newHash = window.location.hash.replace('#', '');
      if (newHash && ['dashboard', 'team', 'action-plans', 'metas'].includes(newHash)) {
        setActiveTab(newHash);
      } else {
        setActiveTab('dashboard');
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const { data: teamData, isLoading } = useQuery<TeamData>({
    queryKey: ['/api/manager/team-data'],
  });

  const exportToPDF = () => {
    if (!teamData) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    
    // Title
    doc.setFontSize(20);
    doc.text('Painel Gerente - Relatório Consolidado', pageWidth / 2, 15, { align: 'center' });
    
    // Date
    doc.setFontSize(10);
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth / 2, 22, { align: 'center' });
    
    // Summary metrics
    doc.setFontSize(12);
    doc.text('Resumo Executivo', 14, 35);
    
    doc.setFontSize(10);
    let yPos = 45;
    doc.text(`Total de Vendas: $${teamData.totalSales.toLocaleString()}`, 14, yPos);
    yPos += 7;
    doc.text(`Pontos Timac: ${teamData.totalTimacPoints.toLocaleString()}`, 14, yPos);
    yPos += 7;
    doc.text(`Membros da Equipe: ${teamData.teamMembers.length}`, 14, yPos);
    yPos += 15;
    
    // Team ranking table
    doc.setFontSize(12);
    doc.text('Ranking da Equipe', 14, yPos);
    yPos += 5;
    
    const sortedMembers = [...teamData.teamMembers].sort((a, b) => b.totalSales - a.totalSales);
    const tableData = sortedMembers.map((member, index) => {
      const percentage = teamData.totalSales > 0 
        ? ((member.totalSales / teamData.totalSales) * 100).toFixed(1)
        : '0.0';
      
      return [
        `${index + 1}º`,
        member.name,
        `$${member.totalSales.toLocaleString()}`,
        `${percentage}%`,
        member.timacPoints.toLocaleString(),
      ];
    });
    
    autoTable(doc, {
      startY: yPos,
      head: [['#', 'Consultor', 'Vendas', '% Total', 'Pontos Timac']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [34, 197, 94] },
    });
    
    // Save PDF
    doc.save(`painel-gerente-${new Date().toISOString().split('T')[0]}.pdf`);
    
    toast({
      title: 'PDF exportado',
      description: 'O relatório foi baixado com sucesso.',
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden" data-testid="manager-dashboard-container">
      <Header />
      <ManagerNavbar activeTab={activeTab} onTabChange={setActiveTab} />
      
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="flex items-center justify-end">
                <Button onClick={exportToPDF} variant="outline" data-testid="button-export-pdf">
                  <Download className="h-4 w-4 mr-2" />
                  Exportar PDF
                </Button>
              </div>
              <DashboardTab teamData={teamData} />
            </div>
          )}

          {activeTab === 'team' && <TeamTab teamData={teamData} />}

          {activeTab === 'action-plans' && <ActionPlansTab />}

          {activeTab === 'metas' && <ManagerGoalsTab />}
        </div>
      </main>
    </div>
  );
}

function DashboardTab({ teamData }: { teamData?: TeamData }) {
  const [season1, setSeason1] = useState<string>('');
  const [season2, setSeason2] = useState<string>('');
  const [season3, setSeason3] = useState<string>('');

  const { data: seasons } = useQuery<any[]>({
    queryKey: ['/api/seasons'],
  });

  const { data: salesEvolution } = useQuery<any[]>({
    queryKey: ['/api/manager/team-sales-evolution'],
  });

  const { data: teamGoals } = useQuery<any[]>({
    queryKey: ['/api/manager/team-goals'],
  });

  if (!teamData) {
    return <div className="text-center py-8 text-muted-foreground">Nenhum dado disponível</div>;
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const topCategories = Object.entries(teamData.salesByCategory)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const topClients = Object.entries(teamData.clientSales)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  const timacValue = teamData.totalTimacPoints * parseFloat(teamData.gerentesValue || '0');
  
  // Helper to get text color for deviation based on performance
  const getDeviationColor = (deviation: number) => {
    if (deviation > 0) return 'text-green-600 font-semibold';
    if (deviation < 0) return 'text-red-600 font-semibold';
    return 'text-yellow-600 font-semibold';
  };

  // Transform sales evolution data for multi-line chart
  const chartData = useMemo(() => {
    if (!salesEvolution || salesEvolution.length === 0) return [];
    
    // Group by month
    const monthlyData: Record<string, any> = {};
    
    salesEvolution.forEach((item: any) => {
      const month = item.month;
      const category = item.category || 'Outros';
      const amount = parseFloat(item.totalAmount || '0');
      
      if (!monthlyData[month]) {
        monthlyData[month] = { month };
      }
      
      monthlyData[month][category] = amount;
    });
    
    return Object.values(monthlyData).sort((a: any, b: any) => a.month.localeCompare(b.month));
  }, [salesEvolution]);

  // Get all unique categories for the legend
  const categories = useMemo(() => {
    const cats = new Set<string>();
    salesEvolution?.forEach((item: any) => {
      const category = item.category || 'Outros';
      cats.add(category);
    });
    return Array.from(cats);
  }, [salesEvolution]);

  // Category color mapping
  const categoryColors: Record<string, string> = {
    'Fertilizantes': '#22c55e',      // Green
    'Especialidades': '#3b82f6',     // Blue
    'Agroquímicos': '#ef4444',       // Red
    'Sementes': '#eab308',           // Yellow
    'Sementes Soja': '#eab308',      // Yellow
    'Sementes Milho': '#f59e0b',     // Amber
    'Sementes Diversas': '#fbbf24',  // Light Yellow
    'Sementes Trigo': '#f97316',     // Orange
    'Corretivos': '#8b5cf6',         // Purple
    'Outros': '#6b7280',             // Gray
  };

  // Calculate goal progress for active season
  const activeSeason = seasons?.find(s => s.isActive);
  const activeSeasonGoal = teamGoals?.find(g => g.seasonId === activeSeason?.id);
  const goalAmount = activeSeasonGoal ? parseFloat(activeSeasonGoal.totalGoal || '0') : 0;
  const goalProgress = goalAmount > 0 ? (teamData.totalSales / goalAmount) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Vendas</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="total-sales">
              {formatCurrency(teamData.totalSales)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Consolidado da equipe</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pontos Timac</CardTitle>
            <Target className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="total-timac-points">
              {teamData.totalTimacPoints.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Valor: {formatCurrency(timacValue)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Membros da Equipe</CardTitle>
            <Users className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="team-size">
              {teamData.teamMembers.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Consultores ativos</p>
          </CardContent>
        </Card>

        <SoybeanPriceCard />
      </div>

      {/* Market Penetration Analysis */}
      <MarketPenetrationTab season1={season1} season2={season2} season3={season3} setSeason1={setSeason1} setSeason2={setSeason2} setSeason3={setSeason3} />

      {/* Captured Targets by Team */}
      <CapturedTargetsCard />

      {/* Sales Evolution Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Evolução de Vendas da Equipe</CardTitle>
          <CardDescription>Vendas mensais por segmento</CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
                {categories.map((category) => (
                  <Line
                    key={category}
                    type="monotone"
                    dataKey={category}
                    stroke={categoryColors[category] || '#6b7280'}
                    strokeWidth={2}
                    name={category}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Dados de evolução disponíveis quando houver vendas
            </div>
          )}
        </CardContent>
      </Card>

      {/* Goal vs Achieved */}
      {goalAmount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Meta vs Realizado</CardTitle>
            <CardDescription>{activeSeason?.name || 'Safra Ativa'}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Meta da Equipe</p>
                  <p className="text-2xl font-bold">{formatCurrency(goalAmount)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Realizado</p>
                  <p className="text-2xl font-bold text-primary">{formatCurrency(teamData.totalSales)}</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Progresso</span>
                  <span className="font-medium">{goalProgress.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
                  <div 
                    className={`h-4 rounded-full transition-all ${goalProgress >= 100 ? 'bg-green-600' : 'bg-primary'}`}
                    style={{ width: `${Math.min(goalProgress, 100)}%` }}
                  ></div>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Falta: {formatCurrency(Math.max(goalAmount - teamData.totalSales, 0))}</span>
                  {goalProgress >= 100 && <span className="text-green-600 font-medium">✓ Meta atingida!</span>}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Categories & Top Clients */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top 5 Categorias</CardTitle>
            <CardDescription>Vendas por categoria</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topCategories.map(([category, amount]) => (
                <div key={category} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{category}</span>
                  <span className="text-sm font-bold">{formatCurrency(amount)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top 10 Clientes</CardTitle>
            <CardDescription>Clientes com maior volume</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topClients.map(([client, amount]) => (
                <div key={client} className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate">{client}</span>
                  <span className="text-sm font-bold">{formatCurrency(amount)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SoybeanPriceCard() {
  const { data: priceData, isLoading } = useQuery<any>({
    queryKey: ['/api/commodity/soybean'],
    refetchInterval: 60000, // Refetch every 60 seconds
  });

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Preço Soja (Bushel)</CardTitle>
        <TrendingUp className="h-4 w-4 text-orange-600" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-2xl font-bold text-muted-foreground">Carregando...</div>
        ) : priceData ? (
          <>
            <div className="text-2xl font-bold" data-testid="soybean-price">
              {formatPrice(priceData.price)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              CME/CBOT • Tempo Real
            </p>
          </>
        ) : (
          <div className="text-sm text-muted-foreground">Dados indisponíveis</div>
        )}
      </CardContent>
    </Card>
  );
}

function MarketPenetrationTab({
  season1,
  season2,
  season3,
  setSeason1,
  setSeason2,
  setSeason3,
}: {
  season1: string;
  season2: string;
  season3: string;
  setSeason1: (value: string) => void;
  setSeason2: (value: string) => void;
  setSeason3: (value: string) => void;
}) {
  const { toast } = useToast();
  
  const { data: seasons } = useQuery<any[]>({
    queryKey: ['/api/seasons'],
  });

  // Build seasonIds parameter based on selected seasons
  const seasonIds = [season1, season2, season3].filter(Boolean).join(',');

  // Get market percentages (for Mercado column) - uses (sales + FECHADAS) / potential
  const { data: marketPercentagesMulti } = useQuery<any>({
    queryKey: seasonIds 
      ? [`/api/manager/team-market-percentages-multi?seasonIds=${seasonIds}`]
      : ['/api/manager/team-market-percentages-multi'],
    enabled: !!seasonIds,
  });

  // Get sales vs goals (for C.Vale column) - uses team sales / manager goal
  const { data: salesVsGoalsMulti } = useQuery<any>({
    queryKey: seasonIds
      ? [`/api/manager/team-sales-vs-goals-multi?seasonIds=${seasonIds}`]
      : ['/api/manager/team-sales-vs-goals-multi'],
    enabled: !!seasonIds,
  });

  const formatPercentage = (value: any) => {
    const numValue = Number(value);
    if (isNaN(numValue) || numValue === 0) return 'NA';
    return `${numValue.toFixed(1)}%`;
  };

  const activeSeason = seasons?.find(s => s.isActive);

  useEffect(() => {
    if (activeSeason && !season1) {
      setSeason1(activeSeason.id);
    }
  }, [activeSeason, season1]);

  const season1Name = seasons?.find(s => s.id === season1)?.name || '';
  const season2Name = seasons?.find(s => s.id === season2)?.name || '';
  const season3Name = seasons?.find(s => s.id === season3)?.name || '';

  // Market percentages (Mercado column) - uses (sales + FECHADAS) / potential
  const marketPercentage1 = season1 ? marketPercentagesMulti?.[season1] : null;
  const marketPercentage2 = season2 ? marketPercentagesMulti?.[season2] : null;
  const marketPercentage3 = season3 ? marketPercentagesMulti?.[season3] : null;

  // Use sales vs goals for C.Vale column - uses team sales / manager goal
  const salesVsGoals1 = season1 ? salesVsGoalsMulti?.[season1] : null;
  const salesVsGoals2 = season2 ? salesVsGoalsMulti?.[season2] : null;
  const salesVsGoals3 = season3 ? salesVsGoalsMulti?.[season3] : null;

  // Define fixed order for categories as per DIPRO image
  const categoryOrder = [
    'Agroquímicos',
    'Especialidades',
    'Fertilizantes',
    'Corretivos',
    'Sementes Soja',
    'Sementes Milho',
    'Sementes Diversas',
    'Sementes Trigo',
    'Outros'
  ];

  // Collect all unique categories
  const categoriesSet = new Set<string>();
  if (salesVsGoals1) Object.keys(salesVsGoals1).forEach(cat => categoriesSet.add(cat));
  if (salesVsGoals2) Object.keys(salesVsGoals2).forEach(cat => categoriesSet.add(cat));
  if (salesVsGoals3) Object.keys(salesVsGoals3).forEach(cat => categoriesSet.add(cat));
  if (marketPercentage1) Object.keys(marketPercentage1).forEach(cat => categoriesSet.add(cat));
  if (marketPercentage2) Object.keys(marketPercentage2).forEach(cat => categoriesSet.add(cat));
  if (marketPercentage3) Object.keys(marketPercentage3).forEach(cat => categoriesSet.add(cat));

  // Sort categories according to predefined order
  const allCategories = Array.from(categoriesSet).sort((a, b) => {
    const indexA = categoryOrder.indexOf(a);
    const indexB = categoryOrder.indexOf(b);
    
    // If both are in the order list, sort by their position
    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    
    // If only A is in the list, it comes first
    if (indexA !== -1) return -1;
    
    // If only B is in the list, it comes first
    if (indexB !== -1) return 1;
    
    // If neither is in the list, sort alphabetically
    return a.localeCompare(b);
  });

  const exportToPowerPoint = async () => {
    const pptx = new pptxgen();
    const slide = pptx.addSlide();

    // Title
    slide.addText('Análise de Penetração de Mercado', {
      x: 0.5,
      y: 0.3,
      w: 9,
      h: 0.6,
      fontSize: 24,
      bold: true,
      color: '2a4a6f',
      align: 'center'
    });

    slide.addText('Comparativo C.Vale vs Mercado', {
      x: 0.5,
      y: 0.9,
      w: 9,
      h: 0.4,
      fontSize: 14,
      color: '666666',
      align: 'center'
    });

    // Get season names
    const seasonName1 = seasons?.find(s => s.id === season1)?.name || '';
    const seasonName2 = seasons?.find(s => s.id === season2)?.name || '';
    const seasonName3 = seasons?.find(s => s.id === season3)?.name || '';

    // Prepare table data without rowspan/colspan (pptxgenjs limitation)
    const tableRows: any[] = [];

    // Header row 1: Season names (centered once per season group)
    const headerRow1: any[] = [
      { text: 'Família', options: { fill: '2a4a6f', color: 'FFFFFF', bold: true, align: 'left' } }
    ];
    
    if (season1) {
      headerRow1.push(
        { text: '', options: { fill: '2a4a6f', color: 'FFFFFF', bold: true, align: 'center' } },
        { text: seasonName1, options: { fill: '2a4a6f', color: 'FFFFFF', bold: true, align: 'center', fontSize: 12 } },
        { text: '', options: { fill: '2a4a6f', color: 'FFFFFF', bold: true, align: 'center' } }
      );
    }
    if (season2) {
      headerRow1.push(
        { text: '', options: { fill: '2a4a6f', color: 'FFFFFF', bold: true, align: 'center' } },
        { text: seasonName2, options: { fill: '2a4a6f', color: 'FFFFFF', bold: true, align: 'center', fontSize: 12 } },
        { text: '', options: { fill: '2a4a6f', color: 'FFFFFF', bold: true, align: 'center' } }
      );
    }
    if (season3) {
      headerRow1.push(
        { text: '', options: { fill: '2a4a6f', color: 'FFFFFF', bold: true, align: 'center' } },
        { text: seasonName3, options: { fill: '2a4a6f', color: 'FFFFFF', bold: true, align: 'center', fontSize: 12 } },
        { text: '', options: { fill: '2a4a6f', color: 'FFFFFF', bold: true, align: 'center' } }
      );
    }

    // Header row 2: C.Vale, Mercado, % Desvio
    const headerRow2: any[] = [
      { text: '', options: { fill: '2a4a6f', color: 'FFFFFF', bold: true } }
    ];
    
    if (season1) {
      headerRow2.push(
        { text: 'C.Vale', options: { fill: '2a4a6f', color: 'FFFFFF', bold: true, align: 'center' } },
        { text: 'Mercado', options: { fill: '2a4a6f', color: 'FFFFFF', bold: true, align: 'center' } },
        { text: '% Desvio', options: { fill: '2a4a6f', color: 'FFFFFF', bold: true, align: 'center' } }
      );
    }
    if (season2) {
      headerRow2.push(
        { text: 'C.Vale', options: { fill: '2a4a6f', color: 'FFFFFF', bold: true, align: 'center' } },
        { text: 'Mercado', options: { fill: '2a4a6f', color: 'FFFFFF', bold: true, align: 'center' } },
        { text: '% Desvio', options: { fill: '2a4a6f', color: 'FFFFFF', bold: true, align: 'center' } }
      );
    }
    if (season3) {
      headerRow2.push(
        { text: 'C.Vale', options: { fill: '2a4a6f', color: 'FFFFFF', bold: true, align: 'center' } },
        { text: 'Mercado', options: { fill: '2a4a6f', color: 'FFFFFF', bold: true, align: 'center' } },
        { text: '% Desvio', options: { fill: '2a4a6f', color: 'FFFFFF', bold: true, align: 'center' } }
      );
    }

    tableRows.push(headerRow1);
    tableRows.push(headerRow2);

    // Data rows
    allCategories.forEach((category) => {
      const cvale1 = season1 ? (salesVsGoals1?.[category] || 0) : null;
      const mercado1 = season1 ? (marketPercentage1?.[category] || 0) : null;
      const desvio1 = (cvale1 !== null && mercado1 !== null) ? (cvale1 - mercado1) : null;

      const cvale2 = season2 ? (salesVsGoals2?.[category] || 0) : null;
      const mercado2 = season2 ? (marketPercentage2?.[category] || 0) : null;
      const desvio2 = (cvale2 !== null && mercado2 !== null) ? (cvale2 - mercado2) : null;

      const cvale3 = season3 ? (salesVsGoals3?.[category] || 0) : null;
      const mercado3 = season3 ? (marketPercentage3?.[category] || 0) : null;
      const desvio3 = (cvale3 !== null && mercado3 !== null) ? (cvale3 - mercado3) : null;

      const desvio1Text = desvio1 !== null ? formatPercentage(desvio1) : '-';
      const desvio2Text = desvio2 !== null ? formatPercentage(desvio2) : '-';
      const desvio3Text = desvio3 !== null ? formatPercentage(desvio3) : '-';

      const getDesvioColor = (text: string, value: number | null) => {
        if (text === 'NA') return { color: 'FFC107', fill: 'FFFFFF' };
        if (value !== null && value >= 0) return { color: '16A34A', fill: 'FFFFFF' };
        if (value !== null) return { color: 'DC2626', fill: 'FFFFFF' };
        return { color: '000000', fill: 'FFFFFF' };
      };

      const row: any[] = [
        { text: category, options: { bold: true, align: 'left' } }
      ];

      if (season1) {
        const desvio1Style = getDesvioColor(desvio1Text, desvio1);
        row.push(
          { text: cvale1 !== null ? formatPercentage(cvale1) : '-', options: { align: 'center' } },
          { text: mercado1 !== null ? formatPercentage(mercado1) : '-', options: { align: 'center' } },
          { text: desvio1Text, options: { align: 'center', bold: true, ...desvio1Style } }
        );
      }
      if (season2) {
        const desvio2Style = getDesvioColor(desvio2Text, desvio2);
        row.push(
          { text: cvale2 !== null ? formatPercentage(cvale2) : '-', options: { align: 'center' } },
          { text: mercado2 !== null ? formatPercentage(mercado2) : '-', options: { align: 'center' } },
          { text: desvio2Text, options: { align: 'center', bold: true, ...desvio2Style } }
        );
      }
      if (season3) {
        const desvio3Style = getDesvioColor(desvio3Text, desvio3);
        row.push(
          { text: cvale3 !== null ? formatPercentage(cvale3) : '-', options: { align: 'center' } },
          { text: mercado3 !== null ? formatPercentage(mercado3) : '-', options: { align: 'center' } },
          { text: desvio3Text, options: { align: 'center', bold: true, ...desvio3Style } }
        );
      }

      tableRows.push(row);
    });

    // Add table to slide
    const colCount = 1 + (season1 ? 3 : 0) + (season2 ? 3 : 0) + (season3 ? 3 : 0);
    const colW = 9 / colCount;

    slide.addTable(tableRows, {
      x: 0.5,
      y: 1.5,
      w: 9,
      h: 4.5,
      colW: Array(colCount).fill(colW),
      border: { type: 'solid', pt: 1, color: 'CCCCCC' },
      fontSize: 10
    });

    // Save file
    await pptx.writeFile({ fileName: 'Penetracao_Mercado.pptx' });
    
    toast({
      title: 'Exportado com sucesso',
      description: 'A apresentação PowerPoint foi gerada.',
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Penetração de Mercado</CardTitle>
          <CardDescription>Comparativo C.Vale vs Mercado por Safra</CardDescription>
        </div>
        {season1 && (
          <Button onClick={exportToPowerPoint} variant="outline" size="sm" data-testid="button-export-pptx">
            <FileDown className="h-4 w-4 mr-2" />
            Exportar PowerPoint
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {season1 ? (
          <div className="rounded-lg overflow-hidden border">
            <div className="relative w-full overflow-auto">
              <table className="w-full caption-bottom text-sm">
                <thead className="border-b transition-colors hover:bg-muted/50 bg-[#2a4a6f]">
                  <tr className="border-b">
                    <th className="h-12 px-4 text-left align-middle font-semibold text-white border-r border-[#2a4a6f] p-2" rowSpan={2}>Família</th>
                    <th className="h-12 align-middle font-semibold text-center border-r border-[#2a4a6f] p-2 text-white" colSpan={3}>
                      <Select value={season1} onValueChange={setSeason1}>
                        <SelectTrigger className="w-full bg-transparent border-none text-white h-8" data-testid="select-season1">
                          <SelectValue placeholder="Selecione safra" />
                        </SelectTrigger>
                        <SelectContent>
                          {seasons?.map((season) => (
                            <SelectItem key={season.id} value={season.id}>
                              {season.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </th>
                    <th className="h-12 align-middle font-semibold text-center border-r border-[#2a4a6f] p-2 text-white" colSpan={3}>
                      <Select value={season2 || undefined} onValueChange={setSeason2}>
                        <SelectTrigger className="w-full bg-transparent border-none text-white h-8" data-testid="select-season2">
                          <SelectValue placeholder="Selecione safra" />
                        </SelectTrigger>
                        <SelectContent>
                          {seasons?.map((season) => (
                            <SelectItem key={season.id} value={season.id}>
                              {season.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </th>
                    <th className="h-12 align-middle font-semibold text-center border-r border-[#2a4a6f] p-2 text-white" colSpan={3}>
                      <Select value={season3 || undefined} onValueChange={setSeason3}>
                        <SelectTrigger className="w-full bg-transparent border-none text-white h-8" data-testid="select-season3">
                          <SelectValue placeholder="Selecione safra" />
                        </SelectTrigger>
                        <SelectContent>
                          {seasons?.map((season) => (
                            <SelectItem key={season.id} value={season.id}>
                              {season.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </th>
                  </tr>
                  <tr className="border-b">
                    <th className="h-12 px-4 text-center align-middle font-semibold text-white border-r border-[#2a4a6f] pr-0">C.Vale</th>
                    <th className="h-12 px-4 text-center align-middle font-semibold text-white border-r border-[#2a4a6f]">Mercado</th>
                    <th className="h-12 px-4 text-center align-middle font-semibold text-white border-r-2 border-gray-400">% Desvio</th>
                    <th className="h-12 px-4 text-center align-middle font-semibold text-white border-r border-[#2a4a6f]">C.Vale</th>
                    <th className="h-12 px-4 text-center align-middle font-semibold text-white border-r border-[#2a4a6f]">Mercado</th>
                    <th className="h-12 px-4 text-center align-middle font-semibold text-white border-r-2 border-gray-400">% Desvio</th>
                    <th className="h-12 px-4 text-center align-middle font-semibold text-white border-r border-[#2a4a6f]">C.Vale</th>
                    <th className="h-12 px-4 text-center align-middle font-semibold text-white border-r border-[#2a4a6f]">Mercado</th>
                    <th className="h-12 px-4 text-center align-middle font-semibold text-white border-r border-[#2a4a6f]">% Desvio</th>
                  </tr>
                </thead>
                <tbody>
                  {allCategories.map((category) => {
                    const cvale1 = season1 ? (salesVsGoals1?.[category] || 0) : null;
                    const mercado1 = season1 ? (marketPercentage1?.[category] || 0) : null;
                    const desvio1 = (cvale1 !== null && mercado1 !== null) ? (cvale1 - mercado1) : null;

                    const cvale2 = season2 ? (salesVsGoals2?.[category] || 0) : null;
                    const mercado2 = season2 ? (marketPercentage2?.[category] || 0) : null;
                    const desvio2 = (cvale2 !== null && mercado2 !== null) ? (cvale2 - mercado2) : null;

                    const cvale3 = season3 ? (salesVsGoals3?.[category] || 0) : null;
                    const mercado3 = season3 ? (marketPercentage3?.[category] || 0) : null;
                    const desvio3 = (cvale3 !== null && mercado3 !== null) ? (cvale3 - mercado3) : null;

                    const desvio1Text = desvio1 !== null ? formatPercentage(desvio1) : '-';
                    const desvio2Text = desvio2 !== null ? formatPercentage(desvio2) : '-';
                    const desvio3Text = desvio3 !== null ? formatPercentage(desvio3) : '-';

                    const getDesvioColor = (text: string, value: number | null) => {
                      if (text === 'NA') return 'text-yellow-600';
                      if (value !== null && value >= 0) return 'text-green-600';
                      if (value !== null) return 'text-red-600';
                      return '';
                    };

                    return (
                      <tr key={category} className="border-b transition-colors hover:bg-muted/50" data-testid={`category-row-${category}`}>
                        <td className="p-4 align-middle font-medium">{category}</td>
                        <td className="p-4 align-middle text-center">{cvale1 !== null ? formatPercentage(cvale1) : '-'}</td>
                        <td className="p-4 align-middle text-center">{mercado1 !== null ? formatPercentage(mercado1) : '-'}</td>
                        <td className={`p-4 align-middle text-center font-semibold border-r-2 border-gray-300 ${getDesvioColor(desvio1Text, desvio1)}`}>
                          {desvio1Text}
                        </td>
                        <td className="p-4 align-middle text-center">{cvale2 !== null ? formatPercentage(cvale2) : '-'}</td>
                        <td className="p-4 align-middle text-center">{mercado2 !== null ? formatPercentage(mercado2) : '-'}</td>
                        <td className={`p-4 align-middle text-center font-semibold border-r-2 border-gray-300 ${getDesvioColor(desvio2Text, desvio2)}`}>
                          {desvio2Text}
                        </td>
                        <td className="p-4 align-middle text-center">{cvale3 !== null ? formatPercentage(cvale3) : '-'}</td>
                        <td className="p-4 align-middle text-center">{mercado3 !== null ? formatPercentage(mercado3) : '-'}</td>
                        <td className={`p-4 align-middle text-center font-semibold ${getDesvioColor(desvio3Text, desvio3)}`}>
                          {desvio3Text}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Selecione ao menos uma safra para ver a análise de penetração de mercado
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TeamTab({ teamData }: { teamData?: TeamData }) {
  if (!teamData) {
    return <div className="text-center py-8 text-muted-foreground">Nenhum dado disponível</div>;
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  // Sort by total sales descending
  const sortedMembers = [...teamData.teamMembers].sort((a, b) => b.totalSales - a.totalSales);
  
  // Calculate max values for percentage bars
  const maxSales = Math.max(...teamData.teamMembers.map(m => m.totalSales), 1);
  const maxTimac = Math.max(...teamData.teamMembers.map(m => m.timacPoints), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ranking da Equipe</CardTitle>
        <CardDescription>Desempenho individual dos consultores</CardDescription>
      </CardHeader>
      <CardContent>
        {teamData.teamMembers.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Consultor</TableHead>
                <TableHead className="text-right">Volume de Vendas</TableHead>
                <TableHead className="text-right">% do Total</TableHead>
                <TableHead className="text-right">Pontos Timac</TableHead>
                <TableHead className="text-right">% Timac</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedMembers.map((member, index) => {
                const salesPercent = (member.totalSales / teamData.totalSales) * 100;
                const timacPercent = (member.timacPoints / teamData.totalTimacPoints) * 100;
                
                return (
                  <TableRow key={member.id} data-testid={`team-member-${member.id}`}>
                    <TableCell className="font-medium">{index + 1}º</TableCell>
                    <TableCell className="font-medium">{member.name}</TableCell>
                    <TableCell className="text-right">{formatCurrency(member.totalSales)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div 
                            className="bg-primary h-2 rounded-full" 
                            style={{ width: `${(member.totalSales / maxSales) * 100}%` }}
                          ></div>
                        </div>
                        <span className="font-medium">{salesPercent.toFixed(1)}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{member.timacPoints.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${(member.timacPoints / maxTimac) * 100}%` }}
                          ></div>
                        </div>
                        <span className="font-medium">{timacPercent.toFixed(1)}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum membro na equipe
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ActionPlansTab() {
  const [showNewPlanDialog, setShowNewPlanDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);

  const { data: actionPlans, isLoading } = useQuery<any[]>({
    queryKey: ['/api/manager/action-plans'],
  });

  if (selectedPlan) {
    return <ActionPlanDetails plan={selectedPlan} onBack={() => setSelectedPlan(null)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Planos de Ação</h2>
          <p className="text-muted-foreground">Gerencie reuniões e ações da equipe</p>
        </div>
        <CreateActionPlanDialog 
          open={showNewPlanDialog} 
          onOpenChange={setShowNewPlanDialog}
        />
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        </div>
      ) : actionPlans && actionPlans.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {actionPlans.map((plan) => (
            <Card 
              key={plan.id} 
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setSelectedPlan(plan)}
              data-testid={`action-plan-card-${plan.id}`}
            >
              <CardHeader>
                <CardTitle className="text-lg">{plan.title}</CardTitle>
                <CardDescription>
                  {new Date(plan.meetingDate).toLocaleDateString('pt-BR')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Ações:</span>
                    <span className="font-medium">{plan.itemCount || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Participantes:</span>
                    <span className="font-medium">{plan.participantCount || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <ListChecks className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">Nenhum plano de ação criado</p>
              <Button onClick={() => setShowNewPlanDialog(true)} data-testid="button-first-action-plan">
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeiro Plano
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CreateActionPlanDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [title, setTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const { toast } = useToast();

  const createPlanMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', '/api/manager/action-plans', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/manager/action-plans'] });
      toast({
        title: 'Plano criado',
        description: 'O plano de ação foi criado com sucesso.',
      });
      onOpenChange(false);
      setTitle('');
      setMeetingDate('');
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Erro ao criar plano de ação.',
        variant: 'destructive',
      });
    },
  });

  const handleCreate = () => {
    if (!title || !meetingDate) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha todos os campos.',
        variant: 'destructive',
      });
      return;
    }

    createPlanMutation.mutate({ title, meetingDate });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button data-testid="button-new-action-plan">
          <Plus className="h-4 w-4 mr-2" />
          Novo Plano de Ação
        </Button>
      </DialogTrigger>
      <DialogContent data-testid="dialog-create-action-plan">
        <DialogHeader>
          <DialogTitle>Novo Plano de Ação</DialogTitle>
          <DialogDescription>
            Crie um novo plano de ação para uma reunião com a equipe
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="plan-title">Título da Reunião</Label>
            <Input
              id="plan-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Reunião de Planejamento Q1"
              data-testid="input-plan-title"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="meeting-date">Data da Reunião</Label>
            <Input
              id="meeting-date"
              type="date"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
              data-testid="input-meeting-date"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-create-plan"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleCreate}
            disabled={createPlanMutation.isPending}
            data-testid="button-save-plan"
          >
            {createPlanMutation.isPending ? 'Criando...' : 'Criar Plano'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ActionPlanDetails({ plan, onBack }: { plan: any; onBack: () => void }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold">{plan.title}</h2>
          <p className="text-sm text-muted-foreground">
            Reunião: {new Date(plan.meetingDate).toLocaleDateString('pt-BR')}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detalhes do Plano</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center py-8 text-muted-foreground">Detalhes em desenvolvimento...</p>
        </CardContent>
      </Card>
    </div>
  );
}

const AGROQUIMICOS_SUBCATEGORIAS = [
  'Tratamento de semente',
  'Dessecação',
  'Inseticidas',
  'Fungicidas'
];

function ManagerGoalsTab() {
  const [showNewGoalModal, setShowNewGoalModal] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState("");
  const [editingGoal, setEditingGoal] = useState<SeasonGoal | null>(null);
  const [goalToDelete, setGoalToDelete] = useState<string | null>(null);
  const { toast } = useToast();

  // Estados para "Incluir Potencial Geral"
  const [showGlobalConfig, setShowGlobalConfig] = useState(false);
  const [globalSeasonId, setGlobalSeasonId] = useState<string>("");
  const [globalRateValues, setGlobalRateValues] = useState<Record<string, string>>({});
  const [globalSubcategoryValues, setGlobalSubcategoryValues] = useState<Record<string, Record<string, string>>>({});
  const [viewSeasonId, setViewSeasonId] = useState<string>("");

  // Estados para "Configurar Manejo"
  const [showManejoDialog, setShowManejoDialog] = useState(false);
  const [showAddApplicationDialog, setShowAddApplicationDialog] = useState(false);
  const [applicationCategory, setApplicationCategory] = useState<"FUNGICIDAS" | "INSETICIDAS">("FUNGICIDAS");
  const [applicationNumber, setApplicationNumber] = useState<number>(1);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [selectedPriceTier, setSelectedPriceTier] = useState<string>("verde");
  const [productsInApplication, setProductsInApplication] = useState<Array<{productId: string; priceTier: string}>>([]);

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

  const { data: priceTableProducts } = useQuery<any[]>({
    queryKey: ["/api/price-table-products"],
  });

  const { data: globalManagementApplications } = useQuery<any[]>({
    queryKey: ["/api/global-management", viewSeasonId],
    queryFn: viewSeasonId 
      ? async () => {
          const res = await fetch(`/api/global-management?seasonId=${viewSeasonId}`);
          if (!res.ok) throw new Error('Failed to fetch global management');
          return res.json();
        }
      : undefined,
    enabled: !!viewSeasonId,
  });

  // Query to fetch existing market rates for selected season
  const { data: existingMarketRates } = useQuery<any[]>({
    queryKey: ["/api/clients/manager-team/market-rates", globalSeasonId],
    queryFn: globalSeasonId
      ? async () => {
          const res = await fetch(`/api/clients/manager-team/market-rates/${globalSeasonId}`);
          if (!res.ok) throw new Error('Failed to fetch market rates');
          const data = await res.json();
          console.log('API Response for market rates:', data);
          return data;
        }
      : undefined,
    enabled: !!globalSeasonId && showGlobalConfig,
  });

  const fungicidasProducts = priceTableProducts?.filter((p: any) => p.categoria === "FUNGICIDAS") || [];
  const inseticidasProducts = priceTableProducts?.filter((p: any) => p.categoria === "INSETICIDAS") || [];

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

  // Mutations para "Incluir Potencial Geral"
  const saveGlobalRatesMutation = useMutation({
    mutationFn: async ({ rates }: { rates: Array<{ clientId: string; categoryId: string; seasonId: string; investmentPerHa: string; subcategories?: any }> }) => {
      // Gerente: o endpoint vai replicar automaticamente para toda a equipe
      return apiRequest("POST", `/api/clients/manager-team/market-rates`, {
        allRates: rates
      });
    },
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/market-analysis"] });
      queryClient.invalidateQueries({ queryKey: ["/api/kanban-metas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients/manager-team/market-rates", globalSeasonId] });
      
      const count = response?.count || 0;
      const categoryCount = response?.categoryCount || 0;
      toast({
        title: "Configuração aplicada!",
        description: `Potencial de ${categoryCount} categoria(s) aplicado a ${count} cliente(s) da equipe.`,
      });
      setShowGlobalConfig(false);
      setGlobalRateValues({});
      setGlobalSubcategoryValues({});
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao aplicar configuração. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  // Mutation to recalculate existing potential for all team clients
  const recalculatePotentialMutation = useMutation({
    mutationFn: async () => {
      if (!globalSeasonId) {
        throw new Error("Safra não selecionada");
      }
      
      // Use existing market rates data to recalculate
      if (!existingMarketRates || existingMarketRates.length === 0) {
        throw new Error("Nenhum valor de potencial salvo para esta safra");
      }
      
      // Build rates array from existing data
      const rates = existingMarketRates.map((rate: any) => ({
        categoryId: rate.categoryId,
        seasonId: globalSeasonId,
        investmentPerHa: rate.investmentPerHa,
        subcategories: rate.subcategories || null
      }));
      
      return apiRequest("POST", `/api/clients/manager-team/market-rates`, {
        allRates: rates
      });
    },
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/market-analysis"] });
      queryClient.invalidateQueries({ queryKey: ["/api/kanban-metas"] });
      
      const count = response?.count || 0;
      const categoryCount = existingMarketRates?.length || 0;
      toast({
        title: "Potencial recalculado!",
        description: `Valores de ${categoryCount} categoria(s) reaplicados para ${count} cliente(s).`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.message || "Erro ao recalcular potencial. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  // Mutations para "Configurar Manejo"
  const createApplicationMutation = useMutation({
    mutationFn: async (data: { categoria: string; applicationNumber: number; productId: string; priceTier: string; seasonId: string }) => {
      return apiRequest("POST", "/api/global-management", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/global-management", viewSeasonId] });
      toast({
        title: "Aplicação adicionada!",
        description: "A aplicação foi adicionada para toda a equipe.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.message || "Não foi possível adicionar a aplicação.",
        variant: "destructive"
      });
    }
  });

  const deleteApplicationMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/global-management/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/global-management", viewSeasonId] });
      toast({
        title: "Aplicação removida!",
        description: "A aplicação foi removida para toda a equipe.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.message || "Não foi possível remover a aplicação.",
        variant: "destructive"
      });
    }
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

  // Handlers para "Incluir Potencial Geral"
  const openGlobalConfigDialog = () => {
    const activeSeason = seasons?.find(s => s.isActive);
    if (activeSeason) {
      setViewSeasonId(activeSeason.id);
      setGlobalSeasonId(activeSeason.id);
    }
    setShowGlobalConfig(true);
  };

  const closeGlobalConfigDialog = () => {
    setShowGlobalConfig(false);
    setGlobalRateValues({});
    setGlobalSubcategoryValues({});
    setGlobalSeasonId("");
  };

  // Load existing market rates when season is selected
  useEffect(() => {
    console.log('useEffect triggered - existingMarketRates:', existingMarketRates);
    if (existingMarketRates && Array.isArray(existingMarketRates)) {
      console.log('existingMarketRates is array with length:', existingMarketRates.length);
      if (existingMarketRates.length > 0) {
        const rateValues: Record<string, string> = {};
        const subValues: Record<string, Record<string, string>> = {};
        
        existingMarketRates.forEach((rate: any) => {
          // Convert investment to string, handling both number and string types
          const investmentValue = rate.investmentPerHa ? String(rate.investmentPerHa) : '';
          console.log(`Setting rate for ${rate.categoryId}:`, investmentValue);
          rateValues[rate.categoryId] = investmentValue;
          
          if (rate.subcategories) {
            subValues[rate.categoryId] = rate.subcategories;
          }
        });
        
        console.log('Final rateValues:', rateValues);
        setGlobalRateValues(rateValues);
        setGlobalSubcategoryValues(subValues);
      } else {
        console.log('existingMarketRates is empty, clearing values');
        // Clear values when no data exists for this season
        setGlobalRateValues({});
        setGlobalSubcategoryValues({});
      }
    } else {
      console.log('existingMarketRates is not an array or is undefined');
    }
  }, [existingMarketRates]);

  const handleSaveGlobalRates = () => {
    if (!globalSeasonId) {
      toast({
        title: "Safra não selecionada",
        description: "Selecione uma safra para aplicar as configurações.",
        variant: "destructive"
      });
      return;
    }

    const rates: Array<{ clientId: string; categoryId: string; seasonId: string; investmentPerHa: string; subcategories?: any }> = [];

    if (categories && Array.isArray(categories)) {
      categories.forEach((category: any) => {
        const categoryId = category.id;
        const investmentPerHa = globalRateValues[categoryId];
        
        if (investmentPerHa) {
          const isAgroquimicos = category.name.toLowerCase().includes('agroqu');
          const subcategories = isAgroquimicos && globalSubcategoryValues[categoryId] 
            ? globalSubcategoryValues[categoryId]
            : undefined;

          rates.push({
            clientId: "manager-team", // Placeholder - backend vai replicar para toda a equipe
            categoryId,
            seasonId: globalSeasonId,
            investmentPerHa,
            subcategories
          });
        }
      });
    }

    if (rates.length > 0) {
      saveGlobalRatesMutation.mutate({ rates });
    } else {
      toast({
        title: "Nenhum valor configurado",
        description: "Configure pelo menos um valor antes de salvar.",
        variant: "destructive"
      });
    }
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
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
                <p className="text-sm text-muted-foreground">Metas Pessoais</p>
                <p className="text-2xl font-bold">{totalGoals}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Goals List */}
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Minhas Metas por Safra</CardTitle>
          <div className="flex gap-2">
            <Button 
              variant="outline"
              onClick={openGlobalConfigDialog}
              data-testid="button-incluir-potencial-geral"
            >
              <Settings className="h-4 w-4 mr-2" />
              Incluir Potencial Geral
            </Button>
            <Button 
              variant="outline"
              onClick={() => {
                const activeSeason = seasons?.find(s => s.isActive);
                if (activeSeason) {
                  setViewSeasonId(activeSeason.id);
                }
                setShowManejoDialog(true);
              }}
              data-testid="button-configurar-manejo"
            >
              <Target className="h-4 w-4 mr-2" />
              Configurar Manejo
            </Button>
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
              <DialogContent data-testid="new-goal-modal" className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
          </div>
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
                      <TableCell className="text-right font-mono font-bold">
                        ${goal.goalAmount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-primary">
                        ${goal.achievedAmount.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Progress value={Math.min(goal.percentage, 100)} className="h-2" />
                          <p className="text-xs font-medium">{goal.percentage.toFixed(1)}%</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={goal.status === "concluida" ? "default" : "secondary"}>
                          {goal.status === "concluida" ? "Concluída" : "Em Andamento"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditClick(goal as any)}
                            data-testid={`button-edit-goal-${goal.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteClick(goal.id)}
                            data-testid={`button-delete-goal-${goal.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!goalToDelete} onOpenChange={(open) => !open && setGoalToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
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

      {/* Global Configuration Dialog */}
      <Dialog open={showGlobalConfig} onOpenChange={(open) => !open && closeGlobalConfigDialog()}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Incluir Potencial Geral</DialogTitle>
          </DialogHeader>
          
          {/* Season Selection */}
          <div className="mt-4">
            <Label htmlFor="global-season-select" className="text-base font-semibold">Safra</Label>
            <Select value={globalSeasonId} onValueChange={setGlobalSeasonId}>
              <SelectTrigger id="global-season-select" data-testid="select-global-season">
                <SelectValue placeholder="Selecione a safra" />
              </SelectTrigger>
              <SelectContent>
                {seasons?.map((season) => (
                  <SelectItem key={season.id} value={season.id} data-testid={`global-season-option-${season.id}`}>
                    {season.name} {season.isActive && "(Ativa)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4 mt-4">
            {(categories && Array.isArray(categories)) ? categories.map((category: any) => {
              const categoryId = category.id;
              const categoryName = category.name;
              const isAgroquimicos = categoryName.toLowerCase().includes('agroqu');
              const hasSubcategoryValues = isAgroquimicos && globalSubcategoryValues[categoryId] 
                && Object.values(globalSubcategoryValues[categoryId]).some(v => v?.trim() !== '');
              
              return (
                <div key={categoryId} className="border rounded-lg p-4 space-y-3">
                  <Label htmlFor={`global-rate-${categoryId}`} className="text-base font-semibold">
                    {categoryName}
                  </Label>
                  <div className="flex-1">
                    <Input
                      id={`global-rate-${categoryId}`}
                      type="number"
                      step="0.01"
                      placeholder="Ex: 150.00"
                      value={globalRateValues[categoryId] || ''}
                      onChange={(e) => setGlobalRateValues({ ...globalRateValues, [categoryId]: e.target.value })}
                      readOnly={hasSubcategoryValues}
                      className={hasSubcategoryValues ? 'bg-muted cursor-not-allowed' : ''}
                      data-testid={`input-global-rate-${categoryId}`}
                    />
                    {hasSubcategoryValues ? (
                      <p className="text-xs text-primary mt-1 font-medium">
                        ✓ Calculado automaticamente pela soma das subcategorias
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-1">
                        USD por hectare (total geral)
                      </p>
                    )}
                  </div>
                  
                  {/* Subcategories for Agroquímicos */}
                  {isAgroquimicos && (
                    <div className="mt-4 pl-4 border-l-2 border-primary/20 space-y-3">
                      <p className="text-sm font-medium text-muted-foreground">
                        Detalhamento por subcategoria (opcional):
                      </p>
                      {AGROQUIMICOS_SUBCATEGORIAS.map((subcat) => (
                        <div key={subcat} className="flex items-center gap-2">
                          <Label htmlFor={`global-subcat-${categoryId}-${subcat}`} className="text-sm w-28">
                            {subcat}:
                          </Label>
                          <Input
                            id={`global-subcat-${categoryId}-${subcat}`}
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={globalSubcategoryValues[categoryId]?.[subcat] || ''}
                            onChange={(e) => setGlobalSubcategoryValues({
                              ...globalSubcategoryValues,
                              [categoryId]: {
                                ...globalSubcategoryValues[categoryId],
                                [subcat]: e.target.value
                              }
                            })}
                            className="flex-1"
                            data-testid={`input-global-subcat-${categoryId}-${subcat}`}
                          />
                          <span className="text-xs text-muted-foreground w-16">$/ha</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            }) : null}
          </div>

          <div className="mt-6 space-y-4">
            {/* Recalculate button */}
            {existingMarketRates && existingMarketRates.length > 0 && (
              <div className="border border-primary/20 rounded-lg p-4 bg-primary/5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold mb-1">Reaplicar valores salvos</h4>
                    <p className="text-xs text-muted-foreground">
                      Clique aqui para reaplicar os valores já configurados para todos os clientes da equipe (incluindo novos clientes adicionados após a última configuração).
                    </p>
                  </div>
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => recalculatePotentialMutation.mutate()}
                    disabled={recalculatePotentialMutation.isPending}
                    data-testid="button-recalculate-potential"
                  >
                    {recalculatePotentialMutation.isPending ? "Recalculando..." : "Recalcular Potencial"}
                  </Button>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Os valores serão aplicados para todos os clientes marcados com badge amarelo (Mercado)
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={closeGlobalConfigDialog} data-testid="button-cancel-global">
                  Cancelar
                </Button>
                <Button 
                  onClick={handleSaveGlobalRates} 
                  disabled={saveGlobalRatesMutation.isPending}
                  data-testid="button-save-global"
                >
                  {saveGlobalRatesMutation.isPending ? "Aplicando..." : "Aplicar a Toda a Equipe"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Configuração de Manejo Global */}
      <Dialog open={showManejoDialog} onOpenChange={setShowManejoDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configurar Manejo Global</DialogTitle>
            <DialogDescription>
              Configure as aplicações de fungicidas e inseticidas que serão usadas para todos os clientes da equipe.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Seleção de Safra */}
            <div className="space-y-2">
              <Label>Safra *</Label>
              <Select value={viewSeasonId} onValueChange={setViewSeasonId}>
                <SelectTrigger data-testid="select-manejo-season">
                  <SelectValue placeholder="Selecione a safra" />
                </SelectTrigger>
                <SelectContent>
                  {seasons?.map((season: any) => (
                    <SelectItem key={season.id} value={season.id}>
                      {season.name} ({season.year})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!viewSeasonId && (
                <p className="text-sm text-muted-foreground">
                  Selecione uma safra para configurar o manejo global
                </p>
              )}
            </div>
            {/* Fungicidas */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Fungicidas</h3>
                  <Button
                    size="sm"
                    disabled={!viewSeasonId}
                    onClick={() => {
                      if (!viewSeasonId) {
                        toast({
                          title: "Safra não selecionada",
                          description: "Selecione uma safra antes de adicionar aplicações.",
                          variant: "destructive"
                        });
                        return;
                      }
                      if (fungicidasProducts.length === 0) {
                        toast({
                          title: "Sem produtos",
                          description: "Cadastre produtos de fungicidas primeiro no painel admin.",
                          variant: "destructive"
                        });
                        return;
                      }
                      setApplicationCategory("FUNGICIDAS");
                      const existingApps = globalManagementApplications?.filter((a: any) => a.categoria === "FUNGICIDAS") || [];
                      const maxNumber = existingApps.length > 0 ? Math.max(...existingApps.map((a: any) => a.applicationNumber)) : 0;
                      setApplicationNumber(maxNumber + 1);
                      setSelectedProductId(fungicidasProducts[0]?.id || "");
                      setSelectedPriceTier("verde");
                      setProductsInApplication([]);
                      setShowAddApplicationDialog(true);
                    }}
                    data-testid="button-add-fungicida"
                  >
                    <Target className="h-4 w-4 mr-1" />
                    Adicionar Aplicação
                  </Button>
                </div>

                <div className="space-y-2">
                  {(() => {
                    const fungicidasApps = globalManagementApplications?.filter((a: any) => a.categoria === "FUNGICIDAS") || [];
                    
                    const groupedApps = fungicidasApps.reduce((acc: any, app: any) => {
                      if (!acc[app.applicationNumber]) {
                        acc[app.applicationNumber] = [];
                      }
                      acc[app.applicationNumber].push(app);
                      return acc;
                    }, {});
                    
                    const appNumbers = Object.keys(groupedApps).sort((a, b) => Number(a) - Number(b));
                    
                    if (appNumbers.length === 0) {
                      return (
                        <p className="text-muted-foreground text-sm text-center py-4">
                          Nenhuma aplicação de fungicida configurada
                        </p>
                      );
                    }
                    
                    return appNumbers.map(appNum => {
                      const apps = groupedApps[appNum];
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
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                      app.priceTier === "verde" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" : 
                                      app.priceTier === "amarela" ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100" : 
                                      "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
                                    }`}>
                                      {app.priceTier === "verde" ? "Verde" : app.priceTier === "amarela" ? "Amarela" : "Vermelha"}
                                    </span>
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
                  })()}
                </div>
              </CardContent>
            </Card>

            {/* Inseticidas */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Inseticidas</h3>
                  <Button
                    size="sm"
                    disabled={!viewSeasonId}
                    onClick={() => {
                      if (!viewSeasonId) {
                        toast({
                          title: "Safra não selecionada",
                          description: "Selecione uma safra antes de adicionar aplicações.",
                          variant: "destructive"
                        });
                        return;
                      }
                      if (inseticidasProducts.length === 0) {
                        toast({
                          title: "Sem produtos",
                          description: "Cadastre produtos de inseticidas primeiro no painel admin.",
                          variant: "destructive"
                        });
                        return;
                      }
                      setApplicationCategory("INSETICIDAS");
                      const existingApps = globalManagementApplications?.filter((a: any) => a.categoria === "INSETICIDAS") || [];
                      const maxNumber = existingApps.length > 0 ? Math.max(...existingApps.map((a: any) => a.applicationNumber)) : 0;
                      setApplicationNumber(maxNumber + 1);
                      setSelectedProductId(inseticidasProducts[0]?.id || "");
                      setSelectedPriceTier("verde");
                      setProductsInApplication([]);
                      setShowAddApplicationDialog(true);
                    }}
                    data-testid="button-add-inseticida"
                  >
                    <Target className="h-4 w-4 mr-1" />
                    Adicionar Aplicação
                  </Button>
                </div>

                <div className="space-y-2">
                  {(() => {
                    const inseticidasApps = globalManagementApplications?.filter((a: any) => a.categoria === "INSETICIDAS") || [];
                    
                    const groupedApps = inseticidasApps.reduce((acc: any, app: any) => {
                      if (!acc[app.applicationNumber]) {
                        acc[app.applicationNumber] = [];
                      }
                      acc[app.applicationNumber].push(app);
                      return acc;
                    }, {});
                    
                    const appNumbers = Object.keys(groupedApps).sort((a, b) => Number(a) - Number(b));
                    
                    if (appNumbers.length === 0) {
                      return (
                        <p className="text-muted-foreground text-sm text-center py-4">
                          Nenhuma aplicação de inseticida configurada
                        </p>
                      );
                    }
                    
                    return appNumbers.map(appNum => {
                      const apps = groupedApps[appNum];
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
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                      app.priceTier === "verde" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" : 
                                      app.priceTier === "amarela" ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100" : 
                                      "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
                                    }`}>
                                      {app.priceTier === "verde" ? "Verde" : app.priceTier === "amarela" ? "Amarela" : "Vermelha"}
                                    </span>
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
                  })()}
                </div>
              </CardContent>
            </Card>
          </div>

          <DialogFooter>
            <Button onClick={() => setShowManejoDialog(false)} data-testid="button-close-manejo">
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Adição de Aplicação */}
      <Dialog open={showAddApplicationDialog} onOpenChange={setShowAddApplicationDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adicionar Aplicação de {applicationCategory === "FUNGICIDAS" ? "Fungicida" : "Inseticida"}</DialogTitle>
            <DialogDescription>
              Escolha o número da aplicação e adicione um ou mais produtos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="application-number">Número da Aplicação</Label>
              <Select 
                value={applicationNumber.toString()} 
                onValueChange={(val) => setApplicationNumber(Number(val))}
              >
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

            {productsInApplication.length > 0 && (
              <Card>
                <CardContent className="p-3">
                  <h4 className="font-semibold mb-2 text-sm">Produtos adicionados:</h4>
                  <div className="space-y-2">
                    {productsInApplication.map((item, idx) => {
                      const product = priceTableProducts?.find((p: any) => p.id === item.productId);
                      return (
                        <div key={idx} className="flex items-center gap-2 p-2 border rounded text-sm">
                          <span className="flex-1">{product?.mercaderia || "Produto"}</span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            item.priceTier === "verde" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" : 
                            item.priceTier === "amarela" ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100" : 
                            "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
                          }`}>
                            {item.priceTier === "verde" ? "Verde" : item.priceTier === "amarela" ? "Amarela" : "Vermelha"}
                          </span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => {
                              setProductsInApplication(prev => prev.filter((_, i) => i !== idx));
                            }}
                            data-testid={`button-remove-product-${idx}`}
                          >
                            <Trash className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="border-t pt-4">
              <h4 className="font-semibold mb-3">Adicionar produto:</h4>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="product-select">Produto</Label>
                  <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                    <SelectTrigger id="product-select" data-testid="select-product">
                      <SelectValue placeholder="Selecione um produto" />
                    </SelectTrigger>
                    <SelectContent>
                      {(applicationCategory === "FUNGICIDAS" ? fungicidasProducts : inseticidasProducts).map((product: any) => (
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

                {selectedProductId && (
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-sm text-muted-foreground">Custo por hectare (preço × dose):</div>
                    <div className="text-xl font-bold">
                      ${(() => {
                        const product = priceTableProducts?.find((p: any) => p.id === selectedProductId);
                        if (!product) return "0.00";
                        
                        let basePrice = 0;
                        if (selectedPriceTier === "verde") basePrice = Number(product.preco_verde || product.precoVerde || 0);
                        else if (selectedPriceTier === "amarela") basePrice = Number(product.preco_amarela || product.precoAmarela || 0);
                        else basePrice = Number(product.preco_vermelha || product.precoVermelha || 0);
                        
                        let dose = 1;
                        if (product.dose) {
                          const doseStr = product.dose.toString().replace(',', '.');
                          const doseMatch = doseStr.match(/[\d.]+/);
                          if (doseMatch) {
                            dose = parseFloat(doseMatch[0]);
                          }
                        }
                        
                        const costPerHa = basePrice * dose;
                        return costPerHa.toFixed(2);
                      })()}/ha
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {(() => {
                        const product = priceTableProducts?.find((p: any) => p.id === selectedProductId);
                        if (!product) return "";
                        
                        let basePrice = 0;
                        if (selectedPriceTier === "verde") basePrice = Number(product.preco_verde || product.precoVerde || 0);
                        else if (selectedPriceTier === "amarela") basePrice = Number(product.preco_amarela || product.precoAmarela || 0);
                        else basePrice = Number(product.preco_vermelha || product.precoVermelha || 0);
                        
                        let doseNumeric = 1;
                        if (product.dose) {
                          const doseStr = product.dose.toString().replace(',', '.');
                          const doseMatch = doseStr.match(/[\d.]+/);
                          if (doseMatch) {
                            doseNumeric = parseFloat(doseMatch[0]);
                          }
                        }
                        
                        const doseDisplay = product.dose || "1";
                        return `$${basePrice.toFixed(2)} × ${doseDisplay} = $${(basePrice * doseNumeric).toFixed(2)}/ha`;
                      })()}
                    </div>
                  </div>
                )}

                <Button 
                  onClick={() => {
                    if (!selectedProductId) {
                      toast({
                        title: "Erro",
                        description: "Selecione um produto primeiro.",
                        variant: "destructive"
                      });
                      return;
                    }
                    setProductsInApplication(prev => [...prev, { productId: selectedProductId, priceTier: selectedPriceTier }]);
                    setSelectedProductId("");
                    setSelectedPriceTier("verde");
                  }}
                  disabled={!selectedProductId}
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
                    variant: "destructive"
                  });
                  return;
                }
                
                for (const item of productsInApplication) {
                  await createApplicationMutation.mutateAsync({
                    categoria: applicationCategory,
                    applicationNumber: applicationNumber,
                    productId: item.productId,
                    priceTier: item.priceTier,
                    seasonId: viewSeasonId
                  });
                }
                
                setShowAddApplicationDialog(false);
                setProductsInApplication([]);
              }}
              disabled={productsInApplication.length === 0 || createApplicationMutation.isPending}
              data-testid="button-confirm-add-application"
            >
              {createApplicationMutation.isPending ? "Salvando..." : "Concluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CapturedTargetsCard() {
  const [selectedSegmento, setSelectedSegmento] = useState<string | null>(null);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
  
  const { data: capturedData, isLoading } = useQuery<any>({
    queryKey: ['/api/manager/team-captured-totals'],
  });

  const { data: clientsData, isLoading: isLoadingClients } = useQuery<any>({
    queryKey: [`/api/manager/team-captured-by-category/${selectedSegmento}?seasonId=${selectedSeasonId}`],
    enabled: !!selectedSegmento && !!selectedSeasonId,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(value);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Metas Capturadas pela Equipe</CardTitle>
          <CardDescription>Valores totais comprometidos por safra</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground" data-testid="captured-targets-loading">
            Carregando...
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalsBySeason = capturedData?.totalsBySeason || {};
  const seasonIds = Object.keys(totalsBySeason);

  if (seasonIds.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Metas Capturadas pela Equipe</CardTitle>
          <CardDescription>Valores totais comprometidos por safra</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground" data-testid="captured-targets-empty">
            Nenhuma meta capturada ainda
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate grand total across all seasons
  const grandTotal = seasonIds.reduce((sum, seasonId) => {
    return sum + totalsBySeason[seasonId].seasonTotal;
  }, 0);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Metas Capturadas pela Equipe</CardTitle>
          <CardDescription>Valores totais comprometidos por safra (clique nas categorias para ver detalhes)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Grand Total */}
            <div className="p-2.5 bg-primary/10 rounded-lg border-2 border-primary">
              <div className="flex items-center justify-between">
                <span className="text-base font-bold">Total Geral</span>
                <span className="text-xl font-bold text-primary" data-testid="captured-grand-total">
                  {formatCurrency(grandTotal)}
                </span>
              </div>
            </div>

            {/* Seasons */}
            {seasonIds.map((seasonId) => {
              const seasonData = totalsBySeason[seasonId];
              const categories = Object.keys(seasonData.categories);

              return (
                <div key={seasonId} className="space-y-1.5">
                  {/* Season Header */}
                  <div className="p-2 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-green-700 dark:text-green-400" data-testid={`season-name-${seasonId}`}>
                        {seasonData.seasonName}
                      </span>
                      <span className="text-base font-bold text-green-600 dark:text-green-400" data-testid={`season-total-${seasonId}`}>
                        {formatCurrency(seasonData.seasonTotal)}
                      </span>
                    </div>
                  </div>

                  {/* Categories within this Season */}
                  <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4 ml-2">
                    {categories.map((segmento) => {
                      const categoryData = seasonData.categories[segmento];
                      const hasSubcategories = categoryData.subcategories && Object.keys(categoryData.subcategories).length > 0;

                      return (
                        <Card 
                          key={segmento} 
                          className="shadow-sm cursor-pointer hover:shadow-md hover:border-primary transition-all"
                          onClick={() => {
                            setSelectedSegmento(segmento);
                            setSelectedSeasonId(seasonId);
                          }}
                          data-testid={`card-category-${seasonId}-${segmento}`}
                        >
                          <CardHeader className="pb-2 pt-2.5 px-3">
                            <CardTitle className="text-sm">{categoryData.categoryName}</CardTitle>
                          </CardHeader>
                          <CardContent className="px-3 pb-2.5">
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-muted-foreground">Total</span>
                                <span 
                                  className="text-base font-bold text-green-600"
                                  data-testid={`captured-total-${seasonId}-${segmento}`}
                                >
                                  {formatCurrency(categoryData.total)}
                                </span>
                              </div>

                              {/* Subcategories for Agroquímicos */}
                              {hasSubcategories && (
                                <div className="mt-1.5 pt-1.5 border-t space-y-1">
                                  <p className="text-xs font-medium text-muted-foreground mb-1">Detalhes:</p>
                                  {Object.entries(categoryData.subcategories).map(([subcatName, subcatValue]) => (
                                    <div key={subcatName} className="flex items-center justify-between pl-2">
                                      <span className="text-xs text-muted-foreground">{subcatName}</span>
                                      <span 
                                        className="text-xs font-semibold"
                                        data-testid={`captured-subcat-${seasonId}-${segmento}-${subcatName.toLowerCase().replace(/\s/g, '-')}`}
                                      >
                                        {formatCurrency(subcatValue as number)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Client Details Dialog */}
      <Dialog open={!!selectedSegmento} onOpenChange={(open) => {
        if (!open) {
          setSelectedSegmento(null);
          setSelectedSeasonId(null);
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Clientes - {selectedSegmento}
            </DialogTitle>
            <DialogDescription>
              Detalhamento dos valores capturados por cliente nesta categoria
            </DialogDescription>
          </DialogHeader>

          {isLoadingClients ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="clients-loading">
              Carregando clientes...
            </div>
          ) : clientsData?.clientTargets?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="clients-empty">
              Nenhum cliente encontrado
            </div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Consultor</TableHead>
                    <TableHead className="text-right">Valor Capturado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientsData?.clientTargets?.map((client: any, index: number) => (
                    <TableRow key={client.clientId} data-testid={`row-client-${index}`}>
                      <TableCell className="font-medium">{client.clientName}</TableCell>
                      <TableCell>{client.consultorName}</TableCell>
                      <TableCell className="text-right font-bold text-green-600">
                        {formatCurrency(client.valorCapturado)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Show subcategory breakdown for individual clients if applicable */}
              {selectedSegmento === 'agroquimicos' && (
                <div className="mt-4">
                  <h4 className="text-sm font-semibold mb-3">Detalhamento por Subcategorias:</h4>
                  {clientsData?.clientTargets?.map((client: any, index: number) => {
                    if (!client.subcategories || Object.keys(client.subcategories).length === 0) return null;
                    
                    return (
                      <Card key={client.clientId} className="mb-3">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm">{client.clientName}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            {Object.entries(client.subcategories).map(([subcatName, subcatValue]) => (
                              <div key={subcatName} className="flex justify-between">
                                <span className="text-muted-foreground">{subcatName}:</span>
                                <span className="font-semibold">{formatCurrency(subcatValue as number)}</span>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedSegmento(null)} data-testid="button-close-dialog">
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
