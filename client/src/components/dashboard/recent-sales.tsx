import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { Sale, Client, Product, Category, Region } from "@shared/schema";

export default function RecentSales() {
  const { data: sales, isLoading: salesLoading } = useQuery<Sale[]>({
    queryKey: ["/api/sales"],
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: regions } = useQuery<Region[]>({
    queryKey: ["/api/regions"],
  });

  const getTierBadgeClass = (tier: string) => {
    switch (tier) {
      case 'verde': return 'badge-verde';
      case 'amarela': return 'badge-amarela';
      case 'vermelha': return 'badge-vermelha';
      default: return 'badge-verde';
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'verde': return 'text-verde';
      case 'amarela': return 'text-amarela';
      case 'vermelha': return 'text-vermelha';
      default: return 'text-verde';
    }
  };

  const recentSales = sales
    ?.sort((a, b) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime())
    .slice(0, 5)
    .map(sale => {
      const client = clients?.find(c => c.id === sale.clientId);
      const product = products?.find(p => p.id === sale.productId);
      const category = categories?.find(c => c.id === sale.categoryId);
      const region = regions?.find(r => r.id === client?.regionId);
      
      return {
        id: sale.id,
        client: client?.name || "Cliente desconhecido",
        region: region?.name || "Região desconhecida",
        product: product?.name || "Produto desconhecido",
        category: category?.name || "Categoria desconhecida",
        value: parseFloat(sale.totalAmount),
        commission: parseFloat(sale.commissionAmount),
        tier: sale.commissionTier
      };
    }) || [];

  if (salesLoading) {
    return (
      <Card className="shadow-sm" data-testid="recent-sales">
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold">Vendas Recentes</CardTitle>
          <Link href="/vendas" className="text-sm text-primary hover:underline">
            Ver todas
          </Link>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Carregando vendas...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!recentSales || recentSales.length === 0) {
    return (
      <Card className="shadow-sm" data-testid="recent-sales">
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold">Vendas Recentes</CardTitle>
          <Link href="/vendas" className="text-sm text-primary hover:underline">
            Ver todas
          </Link>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma venda registrada
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm" data-testid="recent-sales">
      <CardHeader className="flex items-center justify-between">
        <CardTitle className="text-lg font-bold">Vendas Recentes</CardTitle>
        <Link href="/vendas" className="text-sm text-primary hover:underline">
          Ver todas
        </Link>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Cliente</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Produto</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Categoria</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Valor (USD)</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Comissão</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Faixa</th>
              </tr>
            </thead>
            <tbody>
              {recentSales.map((sale) => (
                <tr 
                  key={sale.id} 
                  className="border-b border-border hover:bg-muted/50 transition-colors"
                  data-testid={`sale-row-${sale.id}`}
                >
                  <td className="py-3 px-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">{sale.client}</p>
                      <p className="text-xs text-muted-foreground">{sale.region}</p>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm text-foreground">{sale.product}</td>
                  <td className="py-3 px-4 text-sm text-foreground">{sale.category}</td>
                  <td className="py-3 px-4 text-right font-mono font-semibold text-foreground">
                    ${sale.value.toLocaleString()}
                  </td>
                  <td className={`py-3 px-4 text-right font-mono font-semibold ${getTierColor(sale.tier)}`}>
                    ${sale.commission.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Badge className={`${getTierBadgeClass(sale.tier)} text-xs font-medium capitalize`}>
                      {sale.tier}
                    </Badge>
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
