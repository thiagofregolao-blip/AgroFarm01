import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { calculateCommission } from "@/lib/commissions";
import { classifySeason } from "@/lib/seasons";
import type { Category, Client, Sale, Product } from "@shared/schema";

interface EditSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale | null;
}

export default function EditSaleModal({ isOpen, onClose, sale }: EditSaleModalProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    clientId: "",
    categoryId: "",
    productId: "",
    productName: "",
    totalAmount: "",
    margin: "",
    dueDate: "",
    ivaRate: "10.00",
  });
  
  const [commission, setCommission] = useState({
    tier: "",
    rate: 0,
    amount: 0,
    season: "",
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  useEffect(() => {
    if (sale && isOpen && products) {
      const product = products?.find(p => p.id === sale.productId);
      const dueDate = new Date(sale.dueDate);
      const dueDateString = dueDate.toISOString().split('T')[0];
      
      setFormData({
        clientId: sale.clientId,
        categoryId: sale.categoryId,
        productId: sale.productId,
        productName: product?.name || "Produto manual",
        totalAmount: `${sale.totalAmount}`,
        margin: `${sale.margin}`,
        dueDate: dueDateString,
        ivaRate: `${sale.ivaRate || '10.00'}`,
      });
    }
  }, [sale, isOpen, products]);

  const updateSaleMutation = useMutation({
    mutationFn: async (saleData: any) => {
      return apiRequest("PATCH", `/api/sales/${sale?.id}`, saleData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/sales"] });
      toast({
        title: "Venda atualizada",
        description: "A venda foi atualizada com sucesso.",
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao atualizar a venda. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (formData.categoryId && formData.margin && formData.totalAmount && formData.dueDate) {
      const category = categories?.find(c => c.id === formData.categoryId);
      if (category) {
        const commissionCalc = calculateCommission(category, parseFloat(formData.margin));
        const seasonName = classifySeason(new Date(formData.dueDate));
        const totalAmountNum = parseFloat(formData.totalAmount);
        const ivaRateNum = parseFloat(formData.ivaRate);
        const amountBeforeIva = totalAmountNum / (1 + ivaRateNum / 100);
        const amount = amountBeforeIva * (commissionCalc.rate / 100);
        
        setCommission({
          tier: commissionCalc.tier,
          rate: commissionCalc.rate,
          amount,
          season: seasonName,
        });
      }
    }
  }, [formData.categoryId, formData.margin, formData.totalAmount, formData.dueDate, formData.ivaRate, categories]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.clientId || !formData.categoryId || !formData.totalAmount || 
        !formData.margin || !formData.dueDate) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    const saleData = {
      clientId: formData.clientId,
      categoryId: formData.categoryId,
      productId: sale!.productId,
      seasonId: sale!.seasonId,
      saleDate: sale!.saleDate,
      totalAmount: formData.totalAmount,
      margin: formData.margin,
      dueDate: formData.dueDate,
      ivaRate: formData.ivaRate,
      commissionRate: commission.rate.toString(),
      commissionAmount: commission.amount.toString(),
      commissionTier: commission.tier,
    };

    updateSaleMutation.mutate(saleData);
  };

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

  if (!sale) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="edit-sale-modal">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Editar Venda</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Atualize os dados da venda com recálculo automático de comissão
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="client">Cliente</Label>
              <Select value={formData.clientId} onValueChange={(value) => 
                setFormData(prev => ({ ...prev, clientId: value }))
              }>
                <SelectTrigger data-testid="select-client">
                  <SelectValue placeholder="Selecione o cliente..." />
                </SelectTrigger>
                <SelectContent>
                  {clients?.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="product">Produto</Label>
              <Input 
                value={formData.productName}
                readOnly 
                className="bg-muted text-muted-foreground cursor-not-allowed"
                data-testid="input-product-name"
              />
            </div>
          </div>

          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle className="text-sm">Informações da Venda</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="category">Categoria</Label>
                  <Select value={formData.categoryId} onValueChange={(value) => 
                    setFormData(prev => ({ ...prev, categoryId: value }))
                  }>
                    <SelectTrigger data-testid="select-category">
                      <SelectValue placeholder="Selecione a categoria..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categories?.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="totalAmount">Valor Total (USD)</Label>
                  <Input 
                    type="number" 
                    step="0.01"
                    placeholder="0.00" 
                    value={formData.totalAmount}
                    onChange={(e) => setFormData(prev => ({ ...prev, totalAmount: e.target.value }))}
                    className="font-mono"
                    data-testid="input-total-amount"
                  />
                </div>
                <div>
                  <Label htmlFor="margin">Margem (%)</Label>
                  <Input 
                    type="number" 
                    step="0.01"
                    placeholder="0.00" 
                    value={formData.margin}
                    onChange={(e) => setFormData(prev => ({ ...prev, margin: e.target.value }))}
                    className="font-mono"
                    data-testid="input-margin"
                  />
                </div>
                <div>
                  <Label htmlFor="iva">IVA Paraguai (%)</Label>
                  <Input 
                    type="number" 
                    step="0.01"
                    value={formData.ivaRate}
                    onChange={(e) => setFormData(prev => ({ ...prev, ivaRate: e.target.value }))}
                    className="font-mono"
                    data-testid="input-iva"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="dueDate">Data de Vencimento</Label>
              <Input 
                type="date" 
                value={formData.dueDate}
                onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                data-testid="input-due-date"
              />
            </div>
            <div>
              <Label htmlFor="season">Safra (Auto)</Label>
              <Input 
                value={commission.season}
                readOnly 
                className="bg-muted text-muted-foreground cursor-not-allowed font-mono"
                data-testid="input-season"
              />
            </div>
          </div>

          {commission.tier && (
            <Card className="bg-primary/5">
              <CardHeader>
                <CardTitle className="text-sm">Prévia de Comissão</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Faixa de Comissão</p>
                    <Badge className={`${getTierBadgeClass(commission.tier)} text-sm font-medium capitalize`}>
                      {commission.tier}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Taxa de Comissão</p>
                    <p className="text-lg font-bold text-foreground font-mono">
                      {commission.rate.toFixed(2)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Valor da Comissão (USD)</p>
                    <p className={`text-lg font-bold font-mono ${getTierColor(commission.tier)}`}>
                      ${commission.amount.toFixed(2)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex items-center justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel">
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={updateSaleMutation.isPending}
              data-testid="button-save"
            >
              {updateSaleMutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
