import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import MarketManagementPanel from "@/components/MarketManagementPanel";
import Header from "@/components/layout/header";
import Navbar from "@/components/layout/navbar";
import { TrendingUp, DollarSign, Layers } from "lucide-react";

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
  fechadoUsd: number;
  totalCapturedUsd: number;
  penetrationPercent: number;
}

export default function KanbanMetasPage() {
  const [viewSeasonId, setViewSeasonId] = useState<string>("");
  const [showMarketPanel, setShowMarketPanel] = useState(false);
  const [selectedMarketClient, setSelectedMarketClient] = useState<{
    clientId: string;
    clientName: string;
  } | null>(null);

  const { data: seasons } = useQuery<Season[]>({
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

  const { data: categoryCardsData, isLoading: isLoadingCards } = useQuery<{ cards: CategoryCard[] }>({
    queryKey: ["/api/market-opportunity/category-cards", viewSeasonId],
    queryFn: async () => {
      const res = await fetch(`/api/market-opportunity/category-cards/${viewSeasonId}`, { 
        credentials: "include" 
      });
      if (!res.ok) throw new Error("Failed to fetch category cards");
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

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header 
        title="Oportunidades de Negócios"
        subtitle="Gestão de oportunidades de mercado"
        showNewSaleButton={false}
      />
      <Navbar />
      
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold">Oportunidades de Negócios</h1>
            
            {/* Seletor de Safra */}
            <div className="space-y-2 max-w-2xl">
              <Label>Safra</Label>
              <Select value={viewSeasonId} onValueChange={setViewSeasonId}>
                <SelectTrigger data-testid="select-season">
                  <SelectValue placeholder="Selecione uma safra" />
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

            {/* Category Cards - Market Progress */}
            {viewSeasonId && categoryCardsData && categoryCardsData.cards.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Progresso de Mercado por Categoria
                </h2>
                
                {isLoadingCards ? (
                  <div className="text-sm text-muted-foreground">Carregando...</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {categoryCardsData.cards.map((card) => (
                      <Card key={card.categoryId} data-testid={`category-card-${card.categoryType}`}>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg">{card.categoryName}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {/* Potencial */}
                          <div className="flex items-start gap-2">
                            <Layers className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div className="flex-1">
                              <div className="text-xs text-muted-foreground">Potencial de Mercado</div>
                              <div className="font-semibold">
                                ${card.potentialUsd.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {card.potentialHa.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ha
                              </div>
                            </div>
                          </div>
                          
                          {/* C.Vale */}
                          <div className="flex items-start gap-2">
                            <DollarSign className="h-4 w-4 text-green-600 mt-0.5" />
                            <div className="flex-1">
                              <div className="text-xs text-muted-foreground">Vendas C.Vale</div>
                              <div className="font-semibold text-green-600">
                                ${card.cvaleUsd.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                            </div>
                          </div>
                          
                          {/* FECHADO */}
                          <div className="flex items-start gap-2">
                            <DollarSign className="h-4 w-4 text-blue-600 mt-0.5" />
                            <div className="flex-1">
                              <div className="text-xs text-muted-foreground">Aplicações Fechadas</div>
                              <div className="font-semibold text-blue-600">
                                ${card.fechadoUsd.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                            </div>
                          </div>
                          
                          {/* Total Capturado */}
                          <div className="pt-2 border-t">
                            <div className="text-xs text-muted-foreground mb-1">Total Capturado</div>
                            <div className="font-bold text-primary">
                              ${card.totalCapturedUsd.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </div>
                          
                          {/* Barra de Progresso */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-muted-foreground">Penetração de Mercado</span>
                              <span className="font-semibold">
                                {card.penetrationPercent.toFixed(1)}%
                              </span>
                            </div>
                            <Progress 
                              value={card.penetrationPercent} 
                              className="h-2"
                              data-testid={`progress-${card.categoryType}`}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Seletor de Cliente (só aparece se safra selecionada) */}
            {viewSeasonId && clients && clients.length > 0 && (
              <div className="space-y-2 max-w-2xl">
                <Label>Cliente</Label>
                <Select 
                  value={selectedMarketClient?.clientId || ""} 
                  onValueChange={(clientId) => {
                    const client = clients.find(c => c.id === clientId);
                    if (client) {
                      setSelectedMarketClient({ 
                        clientId: client.id, 
                        clientName: client.name 
                      });
                      setShowMarketPanel(true);
                    }
                  }}
                >
                  <SelectTrigger data-testid="select-client">
                    <SelectValue placeholder="Selecione um cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map(client => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>
      </main>

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
      )}
    </div>
  );
}
