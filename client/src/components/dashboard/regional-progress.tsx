import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const regionData = [
  { name: "Alto Paraná", progress: 78, hectares: "12,450 ha plantados", color: "verde" },
  { name: "Itapúa", progress: 65, hectares: "8,920 ha plantados", color: "amarela" },
  { name: "Canindeyú", progress: 52, hectares: "6,340 ha plantados", color: "vermelha" },
  { name: "Caaguazú", progress: 71, hectares: "9,180 ha plantados", color: "amarela" },
];

export default function RegionalProgress() {
  return (
    <Card className="shadow-sm" data-testid="regional-progress">
      <CardHeader>
        <CardTitle className="text-lg font-bold">Avanço de Plantio por Região</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {regionData.map((region) => (
            <div key={region.name}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">{region.name}</span>
                <span className="text-sm font-bold text-foreground font-mono">{region.progress}%</span>
              </div>
              <Progress 
                value={region.progress} 
                className="h-2"
                data-testid={`progress-${region.name.toLowerCase().replace(/\s+/g, '-')}`}
              />
              <p className="text-xs text-muted-foreground mt-1">{region.hectares}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
