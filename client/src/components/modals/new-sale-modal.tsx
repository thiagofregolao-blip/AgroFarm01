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
import type { Category, Client } from "@shared/schema";

interface NewSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NewSaleModal({ isOpen, onClose }: NewSaleModalProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    clientId: "",
    categoryId: "",
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

  const createSaleMutation = useMutation({
    mutationFn: async (saleData: any) => {
      return apiRequest("POST", "/api/sales", saleData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/sales"] });
      toast({
        title: "Venda cadastrada",
        description: "A venda foi cadastrada com sucesso.",
      });
      onClose();
      resetForm();
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao cadastrar a venda. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      clientId: "",
      categoryId: "",
      productName: "",
      totalAmount: "",
      margin: "",
      dueDate: "",
      ivaRate: "10.00",
    });
    setCommission({
      tier: "",
      rate: 0,
      amount: 0,
      season: "",
    });
  };

  useEffect(() => {
    if (formData.categoryId && formData.margin && formData.totalAmount && formData.dueDate) {
      const category = categories?.find(c => c.id === formData.categoryId);
      if (category) {
        const commissionCalc = calculateCommission(category, parseFloat(formData.margin));
        const seasonName = classifySeason(new Date(formData.dueDate));
        const amount = parseFloat(formData.totalAmount) * (commissionCalc.rate / 100);
        
        setCommission({
          tier: commissionCalc.tier,
          rate: commissionCalc.rate,
          amount,
          season: seasonName,
        });
      }
    }
  }, [formData.categoryId, formData.margin, formData.totalAmount, formData.dueDate, categories]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.clientId || !formData.categoryId || !formData.productName || 
        !formData.totalAmount || !formData.margin || !formData.dueDate) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    const saleData = {
      clientId: formData.clientId,
      productId: "manual-product", // For manual entries, we use a placeholder
      categoryId: formData.categoryId,
      seasonId: "season-placeholder", // This would be determined by the season classification
      userId: "user-placeholder", // This would come from authentication
      saleDate: new Date(),
      dueDate: new Date(formData.dueDate),
      totalAmount: formData.totalAmount,
      margin: formData.margin,
      ivaRate: formData.ivaRate,
      commissionRate: commission.rate.toString(),
      commissionAmount: commission.amount.toString(),
      commissionTier: commission.tier,
      isManual: true,
    };

    createSaleMutation.mutate(saleData);
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="new-sale-modal">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Nova Venda Manual</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Registre uma venda casual com cálculo automático de comissão
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Client & Date Section */}
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
              <Label htmlFor="saleDate">Data da Venda</Label>
              <Input 
                type="date" 
                defaultValue={new Date().toISOString().split('T')[0]}
                data-testid="input-sale-date"
              />
            </div>
          </div>

          {/* Product Section */}
          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle className="text-sm">Informações do Produto</CardTitle>
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
                  <Label htmlFor="product">Produto</Label>
                  <Input 
                    placeholder="Nome do produto" 
                    value={formData.productName}
                    onChange={(e) => setFormData(prev => ({ ...prev, productName: e.target.value }))}
                    data-testid="input-product-name"
                  />
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
              </div>
            </CardContent>
          </Card>

          {/* IVA & Season Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

          {/* Commission Preview */}
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

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel">
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={createSaleMutation.isPending}
              data-testid="button-save"
            >
              {createSaleMutation.isPending ? "Salvando..." : "Salvar Venda"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
