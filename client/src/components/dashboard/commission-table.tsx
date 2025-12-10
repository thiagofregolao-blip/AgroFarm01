import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Category } from "@shared/schema";

export default function CommissionTable() {
  const { data: categories, isLoading } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const getBadgeClass = (tier: string) => {
    switch (tier) {
      case 'verde': return 'badge-verde';
      case 'amarela': return 'badge-amarela';
      case 'vermelha': return 'badge-vermelha';
      default: return 'badge-verde';
    }
  };

  if (isLoading) {
    return (
      <Card className="shadow-sm">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="space-y-2">
              {[...Array(7)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm" data-testid="commission-table">
      <CardHeader className="flex items-center justify-between">
        <CardTitle className="text-lg font-bold">Tabela de Comissões</CardTitle>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-2" />
          Configurar
        </Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-2 text-xs font-semibold text-muted-foreground uppercase">Categoria</th>
                <th className="text-center py-3 px-2 text-xs font-semibold text-muted-foreground uppercase">Verde</th>
                <th className="text-center py-3 px-2 text-xs font-semibold text-muted-foreground uppercase">Margem</th>
                <th className="text-center py-3 px-2 text-xs font-semibold text-muted-foreground uppercase">Amarela</th>
                <th className="text-center py-3 px-2 text-xs font-semibold text-muted-foreground uppercase">Margem</th>
                <th className="text-center py-3 px-2 text-xs font-semibold text-muted-foreground uppercase">Vermelha</th>
                <th className="text-center py-3 px-2 text-xs font-semibold text-muted-foreground uppercase">Margem</th>
              </tr>
            </thead>
            <tbody>
              {categories?.map((category) => (
                <tr 
                  key={category.id} 
                  className="border-b border-border hover:bg-muted/30 transition-colors"
                  data-testid={`commission-row-${category.id}`}
                >
                  <td className="py-3 px-2 font-medium text-foreground">{category.name}</td>
                  <td className="py-3 px-2 text-center">
                    <Badge className="badge-verde text-xs font-mono">
                      {parseFloat(category.greenCommission).toFixed(2)}%
                    </Badge>
                  </td>
                  <td className="py-3 px-2 text-center text-xs text-muted-foreground">
                    &gt;{parseFloat(category.greenMarginMin).toFixed(0)}%
                  </td>
                  <td className="py-3 px-2 text-center">
                    <Badge className="badge-amarela text-xs font-mono">
                      {parseFloat(category.yellowCommission).toFixed(2)}%
                    </Badge>
                  </td>
                  <td className="py-3 px-2 text-center text-xs text-muted-foreground">
                    {parseFloat(category.yellowMarginMin).toFixed(0)}-{parseFloat(category.yellowMarginMax).toFixed(2)}%
                  </td>
                  <td className="py-3 px-2 text-center">
                    <Badge className="badge-vermelha text-xs font-mono">
                      {parseFloat(category.redCommission).toFixed(2)}%
                    </Badge>
                  </td>
                  <td className="py-3 px-2 text-center text-xs text-muted-foreground">
                    {parseFloat(category.redMarginMin).toFixed(0)}-{parseFloat(category.redMarginMax).toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
