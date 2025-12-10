import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Filter } from "lucide-react";

interface TopClient {
  clientId: string;
  clientName: string;
  total: number;
  percentage: number;
}

interface TopClientsProps {
  clients: TopClient[];
}

export default function TopClients({ clients }: TopClientsProps) {
  const displayClients = clients.slice(0, 5);

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1: return "bg-primary/10 text-primary";
      case 2: return "bg-secondary/10 text-secondary";
      case 3: return "bg-accent/10 text-accent";
      case 4: return "bg-chart-4/10 text-chart-4";
      case 5: return "bg-chart-5/10 text-chart-5";
      default: return "bg-muted text-muted-foreground";
    }
  };

  if (displayClients.length === 0) {
    return (
      <Card className="shadow-sm" data-testid="top-clients">
        <CardHeader className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold">Top Clientes 80/20</CardTitle>
            <p className="text-sm text-muted-foreground">Principais contribuintes de receita</p>
          </div>
          <Button variant="ghost" size="sm">
            <Filter className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Nenhum cliente com vendas
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm" data-testid="top-clients">
      <CardHeader className="flex items-center justify-between">
        <div>
          <CardTitle className="text-lg font-bold">Top Clientes 80/20</CardTitle>
          <p className="text-sm text-muted-foreground">Principais contribuintes de receita</p>
        </div>
        <Button variant="ghost" size="sm">
          <Filter className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {displayClients.map((client, index) => {
            const rank = index + 1;
            
            return (
              <div 
                key={client.clientId}
                className="flex items-center gap-4 p-3 hover:bg-muted/50 rounded-lg transition-colors"
                data-testid={`client-${client.clientId}`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getRankColor(rank)}`}>
                  <span className="text-sm font-bold">{rank}</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">{client.clientName}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-foreground font-mono">
                    ${client.total.toLocaleString()}
                  </p>
                  <p className="text-xs text-verde">{client.percentage.toFixed(1)}% do total</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
