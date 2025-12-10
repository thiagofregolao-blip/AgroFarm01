import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import type { SeasonGoal, Sale, Season } from "@shared/schema";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, isWithinInterval } from "date-fns";

export default function GoalEvolutionChart() {
  const [selectedGoalId, setSelectedGoalId] = useState<string>("");

  const { data: goals, isLoading: goalsLoading } = useQuery<SeasonGoal[]>({
    queryKey: ["/api/season-goals"],
  });

  const { data: sales, isLoading: salesLoading } = useQuery<Sale[]>({
    queryKey: ["/api/sales"],
  });

  const { data: seasons, isLoading: seasonsLoading } = useQuery<Season[]>({
    queryKey: ["/api/seasons"],
  });

  const selectedGoal = goals?.find(g => g.id === selectedGoalId) || goals?.[0];

  const chartData = useMemo(() => {
    if (!selectedGoal || !sales || !seasons) return [];

    const season = seasons.find(s => s.id === selectedGoal.seasonId);
    if (!season) return [];

    const seasonSales = sales.filter(s => s.seasonId === selectedGoal.seasonId);
    
    if (seasonSales.length === 0) return [];
    
    const saleDates = seasonSales.map(s => new Date(s.saleDate));
    const minDate = new Date(Math.min(...saleDates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...saleDates.map(d => d.getTime())));
    
    const months = eachMonthOfInterval({
      start: startOfMonth(minDate),
      end: endOfMonth(maxDate),
    });

    return months.map(month => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);

      const monthSales = seasonSales.filter(sale => {
        const saleDate = new Date(sale.saleDate);
        return isWithinInterval(saleDate, { start: monthStart, end: monthEnd });
      });

      const totalSales = monthSales.reduce((sum, sale) => sum + parseFloat(sale.totalAmount), 0);

      const cumulativeSales = seasonSales
        .filter(sale => new Date(sale.saleDate) <= monthEnd)
        .reduce((sum, sale) => sum + parseFloat(sale.totalAmount), 0);

      const goalAmount = parseFloat(selectedGoal.goalAmount);
      const monthlyGoal = goalAmount / months.length;
      const cumulativeGoal = monthlyGoal * (months.indexOf(month) + 1);

      return {
        month: format(month, "MMM"),
        achievement: Math.round((cumulativeSales / goalAmount) * 100),
        goal: Math.round((cumulativeGoal / goalAmount) * 100),
        sales: Math.round(cumulativeSales),
      };
    });
  }, [selectedGoal, sales, seasons]);

  if (goalsLoading || salesLoading || seasonsLoading) {
    return (
      <Card className="shadow-sm" data-testid="goal-evolution-chart">
        <CardHeader>
          <CardTitle className="text-lg font-bold">Evolução de Atingimento</CardTitle>
          <p className="text-sm text-muted-foreground">Meta vs Realizado</p>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Carregando dados...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!goals || goals.length === 0) {
    return (
      <Card className="shadow-sm" data-testid="goal-evolution-chart">
        <CardHeader>
          <CardTitle className="text-lg font-bold">Evolução de Atingimento</CardTitle>
          <p className="text-sm text-muted-foreground">Meta vs Realizado</p>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma meta configurada
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm" data-testid="goal-evolution-chart">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg font-bold">Evolução de Atingimento</CardTitle>
          <p className="text-sm text-muted-foreground">Meta vs Realizado</p>
        </div>
        <Select 
          value={selectedGoal?.id} 
          onValueChange={setSelectedGoalId}
        >
          <SelectTrigger className="w-40">
            <SelectValue>
              {selectedGoal && seasons?.find(s => s.id === selectedGoal.seasonId)?.name || "Selecione"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {goals.map((goal) => {
              const season = seasons?.find(s => s.id === goal.seasonId);
              return (
                <SelectItem key={goal.id} value={goal.id}>
                  {season?.name || `Meta ${goal.id.substring(0, 8)}`}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis label={{ value: '% Atingimento', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="achievement" 
                stroke="hsl(var(--verde))" 
                name="Realizado"
                strokeWidth={2}
              />
              <Line 
                type="monotone" 
                dataKey="goal" 
                stroke="hsl(var(--muted-foreground))" 
                strokeDasharray="5 5"
                name="Meta"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma venda registrada para esta meta
          </div>
        )}
      </CardContent>
    </Card>
  );
}
