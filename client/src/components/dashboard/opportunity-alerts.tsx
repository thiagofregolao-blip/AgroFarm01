import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function OpportunityAlerts() {
  return (
    <Card className="shadow-sm" data-testid="opportunity-alerts">
      <CardHeader className="flex items-center justify-between">
        <div>
          <CardTitle className="text-lg font-bold">Alertas de Oportunidade</CardTitle>
          <p className="text-sm text-muted-foreground">Produtos não vendidos vs safra anterior</p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8 text-muted-foreground">
          Nenhum alerta de oportunidade
        </div>
      </CardContent>
    </Card>
  );
}
