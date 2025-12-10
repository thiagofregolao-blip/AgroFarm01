import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { SeasonGoal, Sale, Category } from "@shared/schema";

interface CommissionsChartProps {
  seasonGoal: SeasonGoal | undefined;
  salesData: Sale[] | undefined;
  categories: Category[] | undefined;
}

const getCategoryGoalField = (category: Category): keyof SeasonGoal | null => {
  const type = category.type.toLowerCase();
  const name = category.name.toLowerCase();
  
  if (type.includes('agroquimic') || name.includes('agroquímic')) return 'metaAgroquimicos';
  if (type.includes('especialidad') || name.includes('especialidad')) return 'metaEspecialidades';
  if (type.includes('fertilizante') || name.includes('fertilizante')) return 'metaFertilizantes';
  if (type.includes('corretivo') || name.includes('corretivo')) return 'metaCorretivos';
  
  if (type.includes('semente') || name.includes('semente')) {
    if (name.includes('milho')) return 'metaSementesMilho';
    if (name.includes('soja')) return 'metaSementesSoja';
    if (name.includes('trigo')) return 'metaSementesTrigo';
    if (name.includes('diversas')) return 'metaSementesDiversas';
  }
  
  return null;
};

const getDisplayName = (goalField: keyof SeasonGoal): string => {
  const nameMap: Record<string, string> = {
    'metaAgroquimicos': 'Agroquímicos',
    'metaEspecialidades': 'Especialidades',
    'metaFertilizantes': 'Fertilizantes',
    'metaCorretivos': 'Corretivos',
    'metaSementesMilho': 'Sementes Milho',
    'metaSementesSoja': 'Sementes Soja',
    'metaSementesTrigo': 'Sementes Trigo',
    'metaSementesDiversas': 'Sementes Diversas',
  };
  return nameMap[goalField] || goalField;
};

export default function CommissionsChart({ seasonGoal, salesData, categories }: CommissionsChartProps) {
  if (!salesData || !categories) {
    return (
      <Card className="shadow-sm" data-testid="commissions-chart">
        <CardHeader className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold">Metas por Categoria</CardTitle>
            <p className="text-sm text-muted-foreground">Meta vs Realizado</p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[400px] text-muted-foreground">
            <p>Carregando dados...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!seasonGoal) {
    return (
      <Card className="shadow-sm" data-testid="commissions-chart">
        <CardHeader className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold">Metas por Categoria</CardTitle>
            <p className="text-sm text-muted-foreground">Meta vs Realizado</p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[400px] text-muted-foreground">
            <p>Configure uma meta para ver o progresso</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const categoryIdToCategory = categories.reduce((acc, cat) => {
    acc[cat.id] = cat;
    return acc;
  }, {} as Record<string, Category>);

  const categoryIdToGoalField = categories.reduce((acc, cat) => {
    const goalField = getCategoryGoalField(cat);
    if (goalField) {
      acc[cat.id] = goalField;
    }
    return acc;
  }, {} as Record<string, keyof SeasonGoal>);

  const realizadoPorGoalField = salesData.reduce((acc, sale) => {
    const goalField = categoryIdToGoalField[sale.categoryId];
    if (goalField) {
      if (!acc[goalField]) {
        acc[goalField] = 0;
      }
      acc[goalField] += Number(sale.totalAmount);
    }
    return acc;
  }, {} as Record<keyof SeasonGoal, number>);

  const allGoalFields: Array<keyof SeasonGoal> = [
    'metaAgroquimicos',
    'metaEspecialidades',
    'metaFertilizantes',
    'metaCorretivos',
    'metaSementesMilho',
    'metaSementesSoja',
    'metaSementesTrigo',
    'metaSementesDiversas',
  ];

  const chartData = allGoalFields
    .map(goalField => ({
      name: getDisplayName(goalField),
      Meta: Number(seasonGoal[goalField] || "0"),
      Realizado: realizadoPorGoalField[goalField] || 0,
    }))
    .filter(item => item.Meta > 0 || item.Realizado > 0);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const meta = payload.find((p: any) => p.dataKey === "Meta")?.value || 0;
      const realizado = payload.find((p: any) => p.dataKey === "Realizado")?.value || 0;
      const percentual = meta > 0 ? ((realizado / meta) * 100).toFixed(1) : "0.0";

      return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 rounded shadow-lg">
          <p className="font-semibold mb-2">{label}</p>
          <p className="text-sm text-blue-600 dark:text-blue-400">
            Meta: ${meta.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-sm text-green-600 dark:text-green-400">
            Realizado: ${realizado.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Atingimento: {percentual}%
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="shadow-sm" data-testid="commissions-chart">
      <CardHeader className="flex items-center justify-between">
        <div>
          <CardTitle className="text-lg font-bold">Metas por Categoria</CardTitle>
          <p className="text-sm text-muted-foreground">Meta vs Realizado</p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={100}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="rect"
              />
              <Bar 
                dataKey="Meta" 
                fill="#3b82f6"
                radius={[4, 4, 0, 0]}
              />
              <Bar 
                dataKey="Realizado" 
                fill="#22c55e"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
