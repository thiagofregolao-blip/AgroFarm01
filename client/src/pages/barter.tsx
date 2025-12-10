import { useState, useEffect } from "react";
import Navbar from "@/components/layout/navbar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Calculator, Save, FileText } from "lucide-react";
import type { BarterProduct, BarterSettings, UserClientLink } from "@shared/schema";

interface BarterItem {
  productId: string;
  productName: string;
  category: string;
  quantity: number;
  unit: string;
  priceUsd: number;
  totalUsd: number;
}

export default function BarterPage() {
  const [selectedClient, setSelectedClient] = useState("");
  const [areaHa, setAreaHa] = useState("");
  const [items, setItems] = useState<BarterItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState("");
  const { toast } = useToast();

  const { data: clients } = useQuery<UserClientLink[]>({ queryKey: ['/api/clients'] });
  const { data: barterProducts } = useQuery<BarterProduct[]>({ queryKey: ['/api/barter/products'] });
  const { data: barterSettings } = useQuery<BarterSettings[]>({ queryKey: ['/api/barter/settings'] });

  const sackPrice = parseFloat(barterSettings?.find(s => s.key === "sack_price")?.value || "23");
  const bufferPercentage = parseFloat(barterSettings?.find(s => s.key === "buffer_percentage")?.value || "130");

  const categories = Array.from(new Set(barterProducts?.map(p => p.category) || []));
  const filteredProducts = barterProducts?.filter(p => p.category === selectedCategory) || [];

  const addItem = () => {
    const product = barterProducts?.find(p => p.id === selectedProduct);
    if (!product || !quantity || parseFloat(quantity) <= 0) return;

    const newItem: BarterItem = {
      productId: product.id,
      productName: product.name,
      category: product.category,
      quantity: parseFloat(quantity),
      unit: product.unit,
      priceUsd: parseFloat(product.priceUsd),
      totalUsd: parseFloat(quantity) * parseFloat(product.priceUsd),
    };

    setItems([...items, newItem]);
    setSelectedProduct("");
    setQuantity("");
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const totalUsd = items.reduce((sum, item) => sum + item.totalUsd, 0);
  const totalWithBuffer = totalUsd * (bufferPercentage / 100);
  const grainQuantityKg = totalWithBuffer / sackPrice * 60;
  const grainQuantitySacks = grainQuantityKg / 60;

  const minProducts = parseInt(barterSettings?.find((s: any) => s.key === "min_products")?.value || "0");
  const requiredCategoriesStr = barterSettings?.find((s: any) => s.key === "required_categories")?.value || "";
  const requiredCategories = requiredCategoriesStr.split(",").map((c: string) => c.trim()).filter(Boolean);

  const categoriesInItems = Array.from(new Set(items.map(item => item.category)));
  const missingCategories = requiredCategories.filter(cat => !categoriesInItems.includes(cat));
  const isValid = items.length >= minProducts && missingCategories.length === 0;

  const saveSimulationMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/barter/simulations", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/barter/simulations'] });
      toast({
        title: "Simulação salva",
        description: "Simulação barter salva com sucesso.",
      });
      setSelectedClient("");
      setAreaHa("");
      setItems([]);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao salvar simulação.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!selectedClient || !areaHa || items.length === 0) {
      toast({
        title: "Dados incompletos",
        description: "Selecione cliente, área e adicione produtos.",
        variant: "destructive",
      });
      return;
    }

    if (!isValid) {
      toast({
        title: "Validação falhou",
        description: `Adicione pelo menos ${minProducts} produtos das categorias obrigatórias: ${requiredCategories.join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    const client = clients?.find(c => c.id === selectedClient);
    const simulationData = {
      clientId: selectedClient,
      clientName: client?.name || "",
      areaHa: parseFloat(areaHa),
      totalUsd,
      sackPriceUsd: sackPrice,
      bufferPercentage,
      grainQuantityKg,
      grainQuantitySacks,
      items,
    };

    saveSimulationMutation.mutate(simulationData);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header 
        onNewSale={() => {}}
        title="Simulador Barter"
        subtitle="Simule trocas de produtos por grãos"
      />
      <Navbar />
      
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto p-6 space-y-6">

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Dados da Simulação</CardTitle>
            <CardDescription>Configure cliente, área e produtos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Select value={selectedClient} onValueChange={setSelectedClient}>
                  <SelectTrigger data-testid="select-barter-client">
                    <SelectValue placeholder="Selecione o cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients?.map((client: any) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.customName || client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Área (hectares)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={areaHa}
                  onChange={(e) => setAreaHa(e.target.value)}
                  placeholder="120"
                  data-testid="input-barter-area"
                />
              </div>
            </div>

            <div className="border-t pt-4 space-y-4">
              <h3 className="font-semibold">Adicionar Produtos</h3>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger data-testid="select-barter-category">
                      <SelectValue placeholder="Categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat: string) => (
                        <SelectItem key={cat} value={cat}>
                          {cat.charAt(0).toUpperCase() + cat.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Produto</Label>
                  <Select value={selectedProduct} onValueChange={setSelectedProduct} disabled={!selectedCategory}>
                    <SelectTrigger data-testid="select-barter-product">
                      <SelectValue placeholder="Produto" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredProducts.map((product: any) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} - ${product.priceUsd}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Quantidade</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="0"
                    disabled={!selectedProduct}
                    data-testid="input-barter-quantity"
                  />
                </div>

                <div className="flex items-end">
                  <Button onClick={addItem} disabled={!selectedProduct || !quantity} data-testid="button-add-barter-item">
                    <Plus size={16} className="mr-2" />
                    Adicionar
                  </Button>
                </div>
              </div>
            </div>

            {items.length > 0 && (
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-4">Produtos Selecionados</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Quantidade</TableHead>
                      <TableHead>Preço Unit.</TableHead>
                      <TableHead>Total USD</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{item.productName}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.category}</Badge>
                        </TableCell>
                        <TableCell>{item.quantity} {item.unit}</TableCell>
                        <TableCell>${item.priceUsd.toFixed(2)}</TableCell>
                        <TableCell className="font-medium">${item.totalUsd.toFixed(2)}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeItem(index)}
                            data-testid={`button-remove-item-${index}`}
                          >
                            <Trash2 size={16} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator size={20} />
              Resumo do Cálculo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Produtos:</span>
                <span className="font-medium">${totalUsd.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Buffer ({bufferPercentage}%):</span>
                <span className="font-medium">${totalWithBuffer.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Preço Saca:</span>
                <span className="font-medium">${sackPrice.toFixed(2)}</span>
              </div>
              <div className="border-t pt-3">
                <div className="flex justify-between">
                  <span className="font-semibold">Grãos (kg):</span>
                  <span className="text-lg font-bold text-primary">{grainQuantityKg.toFixed(2)} kg</span>
                </div>
                <div className="flex justify-between mt-2">
                  <span className="font-semibold">Sacas (60kg):</span>
                  <span className="text-lg font-bold text-primary">{grainQuantitySacks.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {!isValid && items.length > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-950 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">Validação Pendente:</p>
                {items.length < minProducts && (
                  <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                    • Mínimo {minProducts} produtos (atual: {items.length})
                  </p>
                )}
                {missingCategories.length > 0 && (
                  <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                    • Categorias obrigatórias: {missingCategories.join(", ")}
                  </p>
                )}
              </div>
            )}

            {isValid && items.length > 0 && (
              <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg border border-green-200 dark:border-green-800">
                <p className="text-sm text-green-800 dark:text-green-200 font-medium">✓ Simulação válida</p>
              </div>
            )}

            <div className="space-y-2 pt-4">
              <Button
                className="w-full"
                onClick={handleSave}
                disabled={!selectedClient || !areaHa || items.length === 0 || !isValid || saveSimulationMutation.isPending}
                data-testid="button-save-barter-simulation"
              >
                <Save size={16} className="mr-2" />
                {saveSimulationMutation.isPending ? "Salvando..." : "Salvar Simulação"}
              </Button>
              <Button variant="outline" className="w-full" disabled>
                <FileText size={16} className="mr-2" />
                Gerar Relatório
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
        </div>
      </main>
    </div>
  );
}
