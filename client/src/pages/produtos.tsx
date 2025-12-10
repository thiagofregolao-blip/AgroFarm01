import Navbar from "@/components/layout/navbar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, Package, Tag, Boxes, TrendingUp, Pencil, Wand2 } from "lucide-react";
import type { Product, Category, InsertProduct, Subcategory } from "@shared/schema";

export default function Produtos() {
  const [showNewProductModal, setShowNewProductModal] = useState(false);
  const [showEditProductModal, setShowEditProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    categoryId: "",
    description: "",
  });

  const [editFormData, setEditFormData] = useState({
    name: "",
    categoryId: "",
    subcategoryId: "",
    description: "",
    segment: "",
  });

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: categories, isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: subcategories } = useQuery<Subcategory[]>({
    queryKey: ["/api/subcategories"],
  });

  const createProductMutation = useMutation({
    mutationFn: async (productData: InsertProduct) => {
      return apiRequest("POST", "/api/products", productData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Produto cadastrado",
        description: "O produto foi cadastrado com sucesso.",
      });
      setShowNewProductModal(false);
      resetForm();
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao cadastrar produto. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Product> }) => {
      return apiRequest("PATCH", `/api/products/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Produto atualizado",
        description: "O produto foi atualizado com sucesso.",
      });
      setShowEditProductModal(false);
      setEditingProduct(null);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao atualizar produto. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const autoPopulateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/products/auto-populate-segments", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Segmentos atualizados",
        description: "Os segmentos dos produtos agroquímicos foram atualizados com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao atualizar segmentos. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const processSojaSpreadsheetMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/products/process-soja-spreadsheet", {});
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Planilha processada",
        description: `${data.updated} produtos atualizados. ${data.notFound > 0 ? `${data.notFound} não encontrados.` : ''}`,
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao processar planilha. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      categoryId: "",
      description: "",
    });
  };

  const openEditModal = (product: Product) => {
    if (categoriesLoading) {
      toast({
        title: "Carregando",
        description: "Aguarde o carregamento das categorias.",
        variant: "destructive",
      });
      return;
    }

    setEditingProduct(product);
    setEditFormData({
      name: product.name,
      categoryId: product.categoryId,
      subcategoryId: product.subcategoryId || "",
      description: product.description || "",
      segment: product.segment || "",
    });
    setShowEditProductModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.categoryId) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    const productData: InsertProduct = {
      name: formData.name,
      categoryId: formData.categoryId,
      description: formData.description || null,
      isActive: true,
    };

    createProductMutation.mutate(productData);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingProduct || !editFormData.name || !editFormData.categoryId) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    const categoryType = getCategoryType(editFormData.categoryId);
    if (categoryType === "agroquimicos" && !editFormData.segment) {
      toast({
        title: "Segmento obrigatório",
        description: "Selecione um segmento para produtos agroquímicos.",
        variant: "destructive",
      });
      return;
    }

    const updateData: Partial<Product> = {
      name: editFormData.name,
      categoryId: editFormData.categoryId,
      subcategoryId: editFormData.subcategoryId || null,
      description: editFormData.description || null,
    };

    if (categoryType === "agroquimicos" && editFormData.segment) {
      updateData.segment = editFormData.segment;
    }

    updateProductMutation.mutate({ id: editingProduct.id, data: updateData });
  };

  const getCategoryName = (categoryId: string) => {
    return categories?.find(c => c.id === categoryId)?.name || "Categoria não encontrada";
  };

  const getCategoryType = (categoryId: string) => {
    return categories?.find(c => c.id === categoryId)?.type || "";
  };

  const getCategoryBadgeClass = (type: string) => {
    switch (type) {
      case "fertilizantes": return "bg-chart-1/10 text-chart-1 border-chart-1/20";
      case "sementes": return "bg-chart-2/10 text-chart-2 border-chart-2/20";
      case "especialidades": return "bg-chart-3/10 text-chart-3 border-chart-3/20";
      case "agroquimicos": return "bg-chart-4/10 text-chart-4 border-chart-4/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getSubcategoryName = (subcategoryId: string | null) => {
    if (!subcategoryId) return null;
    return subcategories?.find(s => s.id === subcategoryId)?.name || null;
  };

  const filteredProducts = products?.filter(product => {
    const nameMatch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const categoryMatch = !selectedCategory || selectedCategory === "all" || product.categoryId === selectedCategory;
    return nameMatch && categoryMatch && product.isActive;
  }) || [];

  const groupedByCategory = filteredProducts.reduce((acc, product) => {
    const categoryName = getCategoryName(product.categoryId);
    if (!acc[categoryName]) {
      acc[categoryName] = [];
    }
    acc[categoryName].push(product);
    return acc;
  }, {} as Record<string, Product[]>);

  const totalProducts = products?.filter(p => p.isActive).length || 0;
  const totalCategories = categories?.length || 0;

  const agroquimicosCategory = categories?.find(c => c.type === "agroquimicos");
  const hasAgroquimicosWithoutSegment = products?.some(
    p => p.categoryId === agroquimicosCategory?.id && p.isActive && !p.segment
  ) || false;

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" data-testid="produtos-container">
      <Header 
        onNewSale={() => {}}
        title="Gestão de Produtos"
        subtitle="Catálogo de produtos por categoria"
      />
      <Navbar />
      
      <main className="flex-1 overflow-y-auto">

        <div className="p-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Package className="text-primary" size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total de Produtos</p>
                    <p className="text-2xl font-bold">{totalProducts}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-chart-2/10 rounded-lg flex items-center justify-center">
                    <Tag className="text-chart-2" size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Categorias</p>
                    <p className="text-2xl font-bold">{totalCategories}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-chart-1/10 rounded-lg flex items-center justify-center">
                    <Boxes className="text-chart-1" size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Fertilizantes</p>
                    <p className="text-2xl font-bold">
                      {products?.filter(p => getCategoryType(p.categoryId) === "fertilizantes" && p.isActive).length || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-verde/10 rounded-lg flex items-center justify-center">
                    <TrendingUp className="text-verde" size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Sementes</p>
                    <p className="text-2xl font-bold">
                      {products?.filter(p => getCategoryType(p.categoryId) === "sementes" && p.isActive).length || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters and Actions */}
          <Card className="shadow-sm mb-8">
            <CardHeader>
              <CardTitle>Filtros e Ações</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-64">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome do produto..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                      data-testid="search-products"
                    />
                  </div>
                </div>

                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-48" data-testid="filter-category">
                    <SelectValue placeholder="Filtrar por categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as categorias</SelectItem>
                    {categories?.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {hasAgroquimicosWithoutSegment && (
                  <Button
                    variant="outline"
                    onClick={() => autoPopulateMutation.mutate()}
                    disabled={autoPopulateMutation.isPending}
                    data-testid="button-auto-populate-segments"
                  >
                    <Wand2 className="h-4 w-4 mr-2" />
                    {autoPopulateMutation.isPending ? "Processando..." : "Auto-popular Segmentos"}
                  </Button>
                )}

                <Button
                  variant="outline"
                  onClick={() => processSojaSpreadsheetMutation.mutate()}
                  disabled={processSojaSpreadsheetMutation.isPending}
                  data-testid="button-process-soja-spreadsheet"
                >
                  <Package className="h-4 w-4 mr-2" />
                  {processSojaSpreadsheetMutation.isPending ? "Processando..." : "Processar SOJA 25-26"}
                </Button>

                <Dialog open={showNewProductModal} onOpenChange={setShowNewProductModal}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-new-product">
                      <Plus className="h-4 w-4 mr-2" />
                      Novo Produto
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl" data-testid="new-product-modal">
                    <DialogHeader>
                      <DialogTitle>Novo Produto</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <Label htmlFor="name">Nome do Produto *</Label>
                        <Input
                          value={formData.name}
                          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Ex: NPK 20-20-20, Semente Soja Premium"
                          data-testid="input-product-name"
                        />
                      </div>

                      <div>
                        <Label htmlFor="category">Categoria *</Label>
                        <Select value={formData.categoryId} onValueChange={(value) => 
                          setFormData(prev => ({ ...prev, categoryId: value }))
                        }>
                          <SelectTrigger data-testid="select-category">
                            <SelectValue placeholder="Selecione a categoria" />
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
                        <Label htmlFor="description">Descrição</Label>
                        <Textarea
                          value={formData.description}
                          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Descrição detalhada do produto (opcional)"
                          rows={3}
                          data-testid="input-description"
                        />
                      </div>

                      <div className="flex justify-end gap-3 pt-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowNewProductModal(false)}
                          data-testid="button-cancel"
                        >
                          Cancelar
                        </Button>
                        <Button
                          type="submit"
                          disabled={createProductMutation.isPending}
                          data-testid="button-save"
                        >
                          {createProductMutation.isPending ? "Salvando..." : "Salvar Produto"}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>

          {/* Products by Category */}
          {Object.keys(groupedByCategory).length === 0 ? (
            <Card className="shadow-sm">
              <CardContent className="p-12 text-center">
                <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">Nenhum produto encontrado</p>
                <Button 
                  onClick={() => setShowNewProductModal(true)}
                  data-testid="button-first-product"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Cadastrar primeiro produto
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-8">
              {Object.entries(groupedByCategory).map(([categoryName, categoryProducts]) => {
                const categoryData = categories?.find(c => c.name === categoryName);
                
                return (
                  <Card key={categoryName} className="shadow-sm">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <CardTitle className="text-lg">{categoryName}</CardTitle>
                          <Badge className={getCategoryBadgeClass(categoryData?.type || "")}>
                            {categoryProducts.length} produtos
                            {categoryData && (
                              <span className="ml-2">
                                | Comissões: {parseFloat(categoryData.greenCommission).toFixed(2)}% {parseFloat(categoryData.yellowCommission).toFixed(2)}% {parseFloat(categoryData.redCommission).toFixed(2)}%
                              </span>
                            )}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Produto</TableHead>
                              <TableHead>Descrição</TableHead>
                              <TableHead>Subcategorias</TableHead>
                              <TableHead className="text-center">Status</TableHead>
                              <TableHead className="text-center">Ações</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {categoryProducts.map((product) => (
                              <TableRow key={product.id} data-testid={`product-row-${product.id}`}>
                                <TableCell className="font-medium">{product.name}</TableCell>
                                <TableCell className="max-w-md truncate">
                                  {product.description || "Sem descrição"}
                                </TableCell>
                                <TableCell>
                                  {product.subcategoryId ? (
                                    <Badge variant="outline" className="text-xs">
                                      {getSubcategoryName(product.subcategoryId) || "Subcategoria"}
                                    </Badge>
                                  ) : (
                                    <span className="text-muted-foreground text-sm">-</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge variant={product.isActive ? "default" : "secondary"}>
                                    {product.isActive ? "Ativo" : "Inativo"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openEditModal(product)}
                                    data-testid={`button-edit-product-${product.id}`}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Edit Product Modal */}
          <Dialog open={showEditProductModal} onOpenChange={setShowEditProductModal}>
            <DialogContent className="max-w-2xl" data-testid="edit-product-modal">
              <DialogHeader>
                <DialogTitle>Editar Produto</DialogTitle>
              </DialogHeader>
              {categoriesLoading ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="edit-name">Nome do Produto *</Label>
                  <Input
                    id="edit-name"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: NPK 20-20-20, Semente Soja Premium"
                    data-testid="input-edit-product-name"
                  />
                </div>

                <div>
                  <Label htmlFor="edit-category">Categoria *</Label>
                  <Select 
                    value={editFormData.categoryId} 
                    onValueChange={(value) => setEditFormData(prev => ({ ...prev, categoryId: value, subcategoryId: "" }))}
                  >
                    <SelectTrigger data-testid="select-edit-category">
                      <SelectValue placeholder="Selecione a categoria" />
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

                {editFormData.categoryId && (subcategories?.filter(s => s.categoryId === editFormData.categoryId).length ?? 0) > 0 && (
                  <div>
                    <Label htmlFor="edit-subcategory">Subcategoria</Label>
                    <Select 
                      value={editFormData.subcategoryId} 
                      onValueChange={(value) => setEditFormData(prev => ({ ...prev, subcategoryId: value }))}
                    >
                      <SelectTrigger data-testid="select-edit-subcategory">
                        <SelectValue placeholder="Selecione a subcategoria (opcional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Nenhuma</SelectItem>
                        {subcategories
                          ?.filter(s => s.categoryId === editFormData.categoryId)
                          .map((subcategory) => (
                            <SelectItem key={subcategory.id} value={subcategory.id}>
                              {subcategory.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {getCategoryType(editFormData.categoryId) === "agroquimicos" && (
                  <div>
                    <Label htmlFor="edit-segment">Segmento *</Label>
                    <Select 
                      value={editFormData.segment} 
                      onValueChange={(value) => setEditFormData(prev => ({ ...prev, segment: value }))}
                    >
                      <SelectTrigger data-testid="select-edit-segment">
                        <SelectValue placeholder="Selecione o segmento" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fungicida">Fungicida</SelectItem>
                        <SelectItem value="inseticida">Inseticida</SelectItem>
                        <SelectItem value="herbicida">Herbicida</SelectItem>
                        <SelectItem value="ts">TS</SelectItem>
                        <SelectItem value="outros">Outros</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <Label htmlFor="edit-description">Descrição</Label>
                  <Textarea
                    id="edit-description"
                    value={editFormData.description}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Descrição detalhada do produto (opcional)"
                    rows={3}
                    data-testid="input-edit-description"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowEditProductModal(false)}
                    data-testid="button-edit-cancel"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={updateProductMutation.isPending || categoriesLoading}
                    data-testid="button-edit-save"
                  >
                    {updateProductMutation.isPending ? "Salvando..." : "Salvar Alterações"}
                  </Button>
                </div>
              </form>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </main>
    </div>
  );
}
