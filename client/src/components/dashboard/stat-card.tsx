import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  trend?: string;
  trendColor?: "verde" | "amarela" | "vermelha";
  subtitle: string;
  color?: "primary" | "secondary" | "accent" | "chart-4";
  showProgress?: boolean;
  progressValue?: number;
}

export default function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  trendColor, 
  subtitle, 
  color = "primary",
  showProgress = false,
  progressValue = 0
}: StatCardProps) {
  const iconColorClass = {
    primary: "bg-primary/10 text-primary",
    secondary: "bg-secondary/10 text-secondary",
    accent: "bg-accent/10 text-accent",
    "chart-4": "bg-chart-4/10 text-chart-4",
  }[color];

  const trendColorClass = trendColor ? {
    verde: "text-verde bg-verde/10",
    amarela: "text-amarela bg-amarela/10",
    vermelha: "text-vermelha bg-vermelha/10",
  }[trendColor] : "";

  return (
    <Card className="stat-card shadow-sm" data-testid={`stat-card-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
          {trend && trendColor && (
            <span className={`text-xs font-medium px-2 py-1 rounded ${trendColorClass}`}>
              {trend}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <div className={`rounded-lg flex items-center justify-center ${iconColorClass}`}>
            <Icon size={28} />
          </div>
          <p className="text-3xl font-bold text-foreground font-mono break-words overflow-hidden">{value}</p>
        </div>
        
        {showProgress && (
          <div className="mt-3 bg-muted rounded-full h-2 overflow-hidden">
            <div 
              className="progress-bar-fill bg-accent h-full transition-all duration-300" 
              style={{ width: `${progressValue}%` }}
            />
          </div>
        )}
        
        {subtitle && <p className="text-xs text-muted-foreground mt-2">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}
