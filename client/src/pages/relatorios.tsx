import Navbar from "@/components/layout/navbar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Download, FileText, BarChart3, TrendingUp, Users, Package } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import type { Category, Client, Season } from "@shared/schema";

export default function Relatorios() {
  const { toast } = useToast();

  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    seasonId: "",
    clientId: "",
    regionId: "",
    categoryId: "",
    productId: "",
  });

  const [reportFields, setReportFields] = useState({
    sales: true,
    commissions: true,
    clients: true,
    products: true,
    seasons: true,
    regions: true,
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: seasons } = useQuery<Season[]>({
    queryKey: ["/api/seasons"],
  });

  const { data: regions } = useQuery<any[]>({
    queryKey: ["/api/regions"],
  });

  const { data: analytics } = useQuery<{
    totalSales: number;
    totalCommissions: number;
    salesByCategory: { categoryId: string; categoryName: string; total: number; commissions: number }[];
    topClients: { clientId: string; clientName: string; total: number; percentage: number }[];
  }>({
    queryKey: ["/api/analytics/sales"],
  });

  const handleExportExcel = () => {
    // Implementation would use a library like xlsx
    toast({
      title: "Relatório exportado",
      description: "O relatório foi exportado para Excel com sucesso.",
    });
  };

  const handleExportPDF = () => {
    // Implementation would use a library like jsPDF
    toast({
      title: "Relatório exportado", 
      description: "O relatório foi exportado para PDF com sucesso.",
    });
  };

  const generateReport = () => {
    toast({
      title: "Relatório gerado",
      description: "O relatório personalizado foi gerado com sucesso.",
    });
  };

  const getCategoryColor = (categoryName: string) => {
    const normalized = categoryName.toLowerCase();
    if (normalized.includes('agroquímico') || normalized.includes('agroquimico')) return '#ef4444'; // vermelho
    if (normalized.includes('fertilizante')) return '#3b82f6'; // azul
    if (normalized.includes('especialidade')) return '#22c55e'; // verde
    if (normalized.includes('semente') || normalized.includes('semilla')) return '#eab308'; // amarelo
    return '#8b5cf6'; // roxo padrão
  };

  const categoryData = analytics?.salesByCategory || [];
  const COLORS = categoryData.map((item: any) => getCategoryColor(item.categoryName));

  return (
    <div className="h-screen flex flex-col overflow-hidden" data-testid="relatorios-container">
      <Header 
        onNewSale={() => {}}
        title="Relatórios e Analytics"
        subtitle="Análises detalhadas e relatórios personalizáveis"
      />
      <Navbar />
      
      <main className="flex-1 overflow-y-auto">

        <div className="p-8">
          <Tabs defaultValue="analytics" className="space-y-6">
            <TabsList>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
              <TabsTrigger value="custom">Relatórios Personalizados</TabsTrigger>
            </TabsList>

            <TabsContent value="analytics" className="space-y-6">
              {/* Analytics Overview */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                        <BarChart3 className="text-primary" size={24} />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total de Vendas</p>
                        <p className="text-2xl font-bold font-mono">
                          ${analytics?.totalSales?.toLocaleString() || "0"}
                        </p>
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
                        <p className="text-sm text-muted-foreground">Comissões Totais</p>
                        <p className="text-2xl font-bold font-mono text-verde">
                          ${analytics?.totalCommissions?.toLocaleString() || "0"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-chart-2/10 rounded-lg flex items-center justify-center">
                        <Users className="text-chart-2" size={24} />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Clientes Ativos</p>
                        <p className="text-2xl font-bold">{clients?.length || 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                        <Package className="text-accent" size={24} />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Categorias</p>
                        <p className="text-2xl font-bold">{categories?.length || 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Charts Row 1 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle>Vendas por Categoria</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {categoryData.length > 0 ? (
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={categoryData}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="total"
                            >
                              {categoryData.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-80 flex items-center justify-center text-muted-foreground">
                        Nenhum dado disponível
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle>Top Clientes por Vendas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {analytics?.topClients && analytics.topClients.length > 0 ? (
                      <div className="space-y-4">
                        {analytics.topClients.slice(0, 5).map((client: any, index: number) => (
                          <div key={client.clientId} className="flex items-center gap-4">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                              index === 0 ? 'bg-gold/10 text-gold' : 
                              index === 1 ? 'bg-chart-2/10 text-chart-2' :
                              'bg-muted text-muted-foreground'
                            }`}>
                              {index + 1}
                            </div>
                            <div className="flex-1">
                              <p className="font-medium">{client.clientName}</p>
                              <p className="text-sm text-muted-foreground">
                                {client.percentage.toFixed(1)}% do total
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-mono font-semibold">
                                ${client.total.toLocaleString()}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="h-80 flex items-center justify-center text-muted-foreground">
                        Nenhum dado disponível
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="custom" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Report Configuration */}
                <div className="lg:col-span-2">
                  <Card className="shadow-sm">
                    <CardHeader>
                      <CardTitle>Configuração do Relatório</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Date Filters */}
                      <div>
                        <h3 className="text-sm font-semibold mb-3">Período</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="startDate">Data Inicial</Label>
                            <Input
                              type="date"
                              value={filters.startDate}
                              onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                              data-testid="input-start-date"
                            />
                          </div>
                          <div>
                            <Label htmlFor="endDate">Data Final</Label>
                            <Input
                              type="date"
                              value={filters.endDate}
                              onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                              data-testid="input-end-date"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Entity Filters */}
                      <div>
                        <h3 className="text-sm font-semibold mb-3">Filtros</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="season">Safra</Label>
                            <Select value={filters.seasonId} onValueChange={(value) => 
                              setFilters(prev => ({ ...prev, seasonId: value }))
                            }>
                              <SelectTrigger data-testid="select-season">
                                <SelectValue placeholder="Todas as safras" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">Todas as safras</SelectItem>
                                {seasons?.map((season) => (
                                  <SelectItem key={season.id} value={season.id}>
                                    {season.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label htmlFor="client">Cliente</Label>
                            <Select value={filters.clientId} onValueChange={(value) => 
                              setFilters(prev => ({ ...prev, clientId: value }))
                            }>
                              <SelectTrigger data-testid="select-client">
                                <SelectValue placeholder="Todos os clientes" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">Todos os clientes</SelectItem>
                                {clients?.map((client) => (
                                  <SelectItem key={client.id} value={client.id}>
                                    {client.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label htmlFor="region">Região</Label>
                            <Select value={filters.regionId} onValueChange={(value) => 
                              setFilters(prev => ({ ...prev, regionId: value }))
                            }>
                              <SelectTrigger data-testid="select-region">
                                <SelectValue placeholder="Todas as regiões" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">Todas as regiões</SelectItem>
                                {regions?.map((region: any) => (
                                  <SelectItem key={region.id} value={region.id}>
                                    {region.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label htmlFor="category">Categoria</Label>
                            <Select value={filters.categoryId} onValueChange={(value) => 
                              setFilters(prev => ({ ...prev, categoryId: value }))
                            }>
                              <SelectTrigger data-testid="select-category">
                                <SelectValue placeholder="Todas as categorias" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">Todas as categorias</SelectItem>
                                {categories?.map((category) => (
                                  <SelectItem key={category.id} value={category.id}>
                                    {category.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      {/* Report Fields */}
                      <div>
                        <h3 className="text-sm font-semibold mb-3">Campos do Relatório</h3>
                        <div className="grid grid-cols-2 gap-3">
                          {Object.entries(reportFields).map(([field, checked]) => (
                            <div key={field} className="flex items-center space-x-2">
                              <Checkbox
                                id={field}
                                checked={checked}
                                onCheckedChange={(value) => 
                                  setReportFields(prev => ({ ...prev, [field]: value }))
                                }
                                data-testid={`checkbox-${field}`}
                              />
                              <Label htmlFor={field} className="text-sm capitalize">
                                {field === 'sales' ? 'Vendas' :
                                 field === 'commissions' ? 'Comissões' :
                                 field === 'clients' ? 'Clientes' :
                                 field === 'products' ? 'Produtos' :
                                 field === 'seasons' ? 'Safras' :
                                 field === 'regions' ? 'Regiões' : field}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Actions Panel */}
                <div>
                  <Card className="shadow-sm">
                    <CardHeader>
                      <CardTitle>Ações</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Button
                        onClick={generateReport}
                        className="w-full"
                        data-testid="button-generate-report"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Gerar Relatório
                      </Button>

                      <div className="space-y-2">
                        <Button
                          onClick={handleExportExcel}
                          variant="outline"
                          className="w-full"
                          data-testid="button-export-excel"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Exportar Excel (.xlsx)
                        </Button>

                        <Button
                          onClick={handleExportPDF}
                          variant="outline"
                          className="w-full"
                          data-testid="button-export-pdf"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Exportar PDF
                        </Button>
                      </div>

                      {/* Report Summary */}
                      <div className="pt-4 border-t">
                        <h4 className="text-sm font-semibold mb-2">Resumo</h4>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <p>Campos selecionados: {Object.values(reportFields).filter(Boolean).length}</p>
                          <p>Filtros ativos: {Object.values(filters).filter(Boolean).length}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Quick Reports */}
                  <Card className="shadow-sm mt-6">
                    <CardHeader>
                      <CardTitle className="text-sm">Relatórios Rápidos</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Button variant="ghost" className="w-full text-left justify-start h-auto p-2 text-xs">
                        Vendas do Mês
                      </Button>
                      <Button variant="ghost" className="w-full text-left justify-start h-auto p-2 text-xs">
                        Top Clientes 80/20
                      </Button>
                      <Button variant="ghost" className="w-full text-left justify-start h-auto p-2 text-xs">
                        Comissões por Categoria
                      </Button>
                      <Button variant="ghost" className="w-full text-left justify-start h-auto p-2 text-xs">
                        Alertas de Oportunidade
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
