import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Edit, Trash2, Search, Sprout, LogOut, Upload, CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AdminProductsPage() {
    const { user, logoutMutation } = useAuth();

    return (
        <div className="flex flex-col h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="bg-blue-100 p-2 rounded-lg">
                        <Sprout className="h-6 w-6 text-blue-700" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">Catálogo Global de Produtos</h1>
                        <p className="text-xs text-gray-500">Painel Administrativo Exclusivo</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right hidden md:block">
                        <p className="text-sm font-medium">{user?.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{user?.role?.replace('_', ' ')}</p>
                    </div>
                    <Button variant="outline" size="icon" onClick={() => logoutMutation.mutate()}>
                        <LogOut className="h-4 w-4" />
                    </Button>
                </div>
            </header>

            <main className="flex-1 overflow-auto p-6 max-w-7xl mx-auto w-full">
                <ProductsManagement />
            </main>
        </div>
    );
}

export function ProductsManagement() {
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState("");
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<any>(null);
    const [deletingProduct, setDeletingProduct] = useState<any>(null);
    const [approvingProduct, setApprovingProduct] = useState<any>(null);

    // Form fields
    const [name, setName] = useState("");
    const [unit, setUnit] = useState("");
    const [dosePerHa, setDosePerHa] = useState("");
    const [category, setCategory] = useState("");
    const [activeIngredient, setActiveIngredient] = useState("");

    // Import fields
    const [importFile, setImportFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Fetch Products
    const { data: products, isLoading } = useQuery<any[]>({
        queryKey: ['/api/admin/global-products'],
    });

    const createProductMutation = useMutation({
        mutationFn: async (data: any) => {
            return apiRequest("POST", "/api/admin/global-products", data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/admin/global-products'] });
            toast({ title: "Produto cadastrado com sucesso" });
            setIsCreateOpen(false);
            resetForm();
        },
        onError: (error: any) => {
            toast({
                title: "Erro ao cadastrar",
                description: error.message,
                variant: "destructive"
            });
        }
    });

    const updateProductMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: any }) => {
            return apiRequest("PATCH", `/api/admin/global-products/${id}`, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/admin/global-products'] });
            toast({ title: "Produto atualizado com sucesso" });
            setEditingProduct(null);
            setApprovingProduct(null);
            resetForm();
        },
        onError: (error: any) => {
            toast({
                title: "Erro ao atualizar",
                description: error.message,
                variant: "destructive"
            });
        }
    });

    const deleteProductMutation = useMutation({
        mutationFn: async (id: string) => {
            return apiRequest("DELETE", `/api/admin/global-products/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/admin/global-products'] });
            toast({ title: "Produto removido com sucesso" });
            setDeletingProduct(null);
        },
        onError: (error: any) => {
            toast({
                title: "Erro ao remover",
                description: error.message,
                variant: "destructive"
            });
        }
    });

    const importPdfMutation = useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData();
            formData.append('file', file);

            const res = await fetch('/api/admin/global-products/import', {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || "Falha na importação");
            }
            return res.json();
        },
        onSuccess: (data: any) => {
            queryClient.invalidateQueries({ queryKey: ['/api/admin/global-products'] });
            toast({
                title: "Importação concluída",
                description: `Catálogo processado com sucesso.`
            });
            setIsImportOpen(false);
            setImportFile(null);
        },
        onError: (error: any) => {
            toast({
                title: "Erro na importação",
                description: error.message,
                variant: "destructive"
            });
        }
    });

    const resetForm = () => {
        setName("");
        setUnit("");
        setDosePerHa("");
        setCategory("");
        setActiveIngredient("");
    };

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        createProductMutation.mutate({
            name,
            unit,
            dosePerHa: dosePerHa ? parseFloat(dosePerHa) : null,
            category: category || null,
            activeIngredient: activeIngredient || null,
            status: "active",
            isDraft: false
        });
    };

    const startEdit = (product: any) => {
        setEditingProduct(product);
        setName(product.name || "");
        setUnit(product.unit || "");
        setDosePerHa(product.dosePerHa?.toString() || "");
        setCategory(product.category || "");
        setActiveIngredient(product.activeIngredient || "");
    };

    const startApprove = (product: any) => {
        setApprovingProduct(product);
        setName(product.name || "");
        setUnit(product.unit || "");
        setDosePerHa(product.dosePerHa?.toString() || "");
        setCategory(product.category || "");
        setActiveIngredient(product.activeIngredient || "");
    };

    const enrichProductMutation = useMutation({
        mutationFn: async (productId?: string) => {
            return apiRequest("POST", "/api/admin/farmers/products/ai-enrich", { productName: name, productId });
        },
        onSuccess: (data: any) => {
            // Map common agronomic terms to our dropdown values
            if (data.category) {
                const catLower = data.category.toLowerCase();
                if (catLower.includes('herbicida') || catLower.includes('dessecação')) setCategory('Herbicida');
                else if (catLower.includes('fungicida')) setCategory('Fungicida');
                else if (catLower.includes('inseticida')) setCategory('Inseticida');
                else if (catLower.includes('nematicida')) setCategory('Nematicida');
                else if (catLower.includes('adjuvante') || catLower.includes('óleo')) setCategory('Óleo / Espalhante Adesivo');
                else if (catLower.includes('fertilizante') && catLower.includes('foliar')) setCategory('Foliar');
                else if (catLower.includes('fertilizante') && catLower.includes('base')) setCategory('Fertilizante De Base');
                else if (catLower.includes('fertilizante') && catLower.includes('cobertura')) setCategory('Fertilizante De Cobertura');
                else if (catLower.includes('semente')) setCategory('Sementes');
                else if (catLower.includes('inoculante') || catLower.includes('biologico')) setCategory('Inoculante');
            }

            if (data.activeIngredient) setActiveIngredient(data.activeIngredient);
            if (data.unit) {
                const u = data.unit.toUpperCase();
                if (u.includes('L') || u === 'LT') setUnit('LT');
                else if (u.includes('KG')) setUnit('KG');
                else if (u.includes('SC')) setUnit('SC');
                else if (u.includes('TO')) setUnit('TO');
            }
            if (data.dosage && !isNaN(parseFloat(data.dosage))) {
                setDosePerHa(parseFloat(data.dosage).toString());
            }

            toast({ title: "Dados enriquecidos com sucesso", description: "Verifique os dados preenchidos pela IA antes de salvar." });
        },
        onError: (error: any) => {
            toast({ title: "Erro na IA", description: error.message, variant: "destructive" });
        }
    });

    const handleUpdate = (e: React.FormEvent) => {
        e.preventDefault();
        const targetProduct = editingProduct || approvingProduct;
        if (!targetProduct) return;

        updateProductMutation.mutate({
            id: targetProduct.id,
            data: {
                name,
                unit,
                dosePerHa: dosePerHa ? parseFloat(dosePerHa) : null,
                category: category || null,
                activeIngredient: activeIngredient || null,
                status: "active",
                isDraft: false
            }
        });
    };

    const handleImportSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!importFile) {
            toast({ title: "Atenção", description: "Selecione um arquivo PDF", variant: "destructive" });
            return;
        }
        importPdfMutation.mutate(importFile);
    };

    const filteredProducts = products?.filter(p =>
        p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.activeIngredient?.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

    const pendingProducts = filteredProducts.filter(p => p.isDraft || p.status === 'pending_review');
    const activeProducts = filteredProducts.filter(p => !p.isDraft && p.status !== 'pending_review');

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between gap-4 items-center">
                <div className="relative w-full sm:w-96">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por nome, categoria ou princípio ativo..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex w-full sm:w-auto gap-2">
                    <Button onClick={() => setIsImportOpen(true)} variant="outline" className="flex-1 sm:flex-none">
                        <Upload className="mr-2 h-4 w-4" /> Importar PDF
                    </Button>
                    <Button onClick={() => { resetForm(); setIsCreateOpen(true); }} className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700">
                        <Plus className="mr-2 h-4 w-4" /> Novo Produto
                    </Button>
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
            ) : (
                <div className="space-y-8">
                    {/* Alertas de Produtos Pendentes (Auto-criados) */}
                    {pendingProducts.length > 0 && (
                        <Card className="border-orange-200 bg-orange-50/50">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-orange-800 flex items-center gap-2">
                                    <AlertCircle className="h-5 w-5" />
                                    Revisão Pendente ({pendingProducts.length})
                                </CardTitle>
                                <CardDescription className="text-orange-700/80">
                                    Estes produtos foram criados automaticamente a partir da importação de notas fiscais de agricultores e necessitam de revisão e categorização correta.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="rounded-md border border-orange-200 bg-white overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-orange-50/50 hover:bg-orange-50/50">
                                                <TableHead>Nome Extrato</TableHead>
                                                <TableHead>Unidade</TableHead>
                                                <TableHead>Data Criação</TableHead>
                                                <TableHead className="text-right">Ação</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {pendingProducts.map((product) => (
                                                <TableRow key={product.id}>
                                                    <TableCell className="font-medium text-orange-900">{product.name}</TableCell>
                                                    <TableCell>{product.unit}</TableCell>
                                                    <TableCell>{new Date(product.createdAt).toLocaleDateString('pt-BR')}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Button size="sm" variant="default" className="bg-orange-600 hover:bg-orange-700 text-white" onClick={() => startApprove(product)}>
                                                            <CheckCircle2 className="h-4 w-4 mr-1" /> Revisar e Aprovar
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Catálogo Oficial */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle>Catálogo Oficial</CardTitle>
                            <CardDescription>Lista completa de produtos homologados no sistema global.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Produto</TableHead>
                                            <TableHead>Categoria</TableHead>
                                            <TableHead>Princípio Ativo</TableHead>
                                            <TableHead>Dose/Ha</TableHead>
                                            <TableHead>Un</TableHead>
                                            <TableHead className="w-[100px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {activeProducts.map((product) => (
                                            <TableRow key={product.id}>
                                                <TableCell className="font-medium">{product.name}</TableCell>
                                                <TableCell>
                                                    {product.category ? (
                                                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                                            {product.category}
                                                        </Badge>
                                                    ) : <span className="text-muted-foreground text-sm">-</span>}
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground">{product.activeIngredient || '-'}</TableCell>
                                                <TableCell className="text-sm">{product.dosePerHa ? parseFloat(product.dosePerHa).toLocaleString('pt-BR') : '-'}</TableCell>
                                                <TableCell className="text-sm">{product.unit || '-'}</TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(product)}>
                                                            <Edit className="h-4 w-4 text-slate-500" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeletingProduct(product)}>
                                                            <Trash2 className="h-4 w-4 text-red-500" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {activeProducts.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                                    Nenhum produto encontrado.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Create Dialog */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Novo Produto Global</DialogTitle>
                        <DialogDescription>Cadastre um novo defensivo ou produto no catálogo oficial.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreate} className="space-y-4 py-4">
                        <ProductFormFields
                            name={name} setName={setName}
                            unit={unit} setUnit={setUnit}
                            dosePerHa={dosePerHa} setDosePerHa={setDosePerHa}
                            category={category} setCategory={setCategory}
                            activeIngredient={activeIngredient} setActiveIngredient={setActiveIngredient}
                        />
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                            <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={createProductMutation.isPending}>
                                {createProductMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Cadastrar Produto
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Edit/Approve Dialog */}
            <Dialog open={!!editingProduct || !!approvingProduct} onOpenChange={(open) => {
                if (!open) { setEditingProduct(null); setApprovingProduct(null); }
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{approvingProduct ? "Revisar e Aprovar Produto" : "Editar Produto Global"}</DialogTitle>
                        <DialogDescription>
                            {approvingProduct
                                ? "Complete as informações do produto criado automaticamente para aprová-lo para o catálogo global."
                                : "Modifique os dados do produto. As alterações refletirão para novas buscas."}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleUpdate} className="space-y-4 py-4">
                        <ProductFormFields
                            name={name} setName={setName}
                            unit={unit} setUnit={setUnit}
                            dosePerHa={dosePerHa} setDosePerHa={setDosePerHa}
                            category={category} setCategory={setCategory}
                            activeIngredient={activeIngredient} setActiveIngredient={setActiveIngredient}
                        />
                        <div className="flex justify-start w-full mb-4">
                            <Button
                                type="button"
                                variant="secondary"
                                className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 w-full"
                                onClick={() => enrichProductMutation.mutate((editingProduct || approvingProduct)?.id)}
                                disabled={enrichProductMutation.isPending || !name}
                            >
                                {enrichProductMutation.isPending ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <span className="mr-2">✨</span>
                                )}
                                Auto-preencher agronômico com Inteligência Artificial
                            </Button>
                        </div>
                        <DialogFooter className="gap-2 sm:gap-0">
                            <Button type="button" variant="outline" onClick={() => { setEditingProduct(null); setApprovingProduct(null); }}>Cancelar</Button>
                            <Button type="submit" className={approvingProduct ? "bg-orange-600 hover:bg-orange-700 text-white" : "bg-blue-600 hover:bg-blue-700"} disabled={updateProductMutation.isPending}>
                                {updateProductMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {approvingProduct ? "Aprovar no Catálogo" : "Salvar Alterações"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Import PDF Dialog */}
            <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Importar Catálogo via PDF</DialogTitle>
                        <DialogDescription>Faça o upload de um PDF contendo a lista de produtos. A Inteligência Artificial (Gemini) irá extrair e cadastrar os produtos automaticamente.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleImportSubmit} className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Arquivo PDF</Label>
                            <Input
                                type="file"
                                accept="application/pdf"
                                ref={fileInputRef}
                                onChange={(e) => setImportFile(e.target.files && e.target.files.length > 0 ? e.target.files[0] : null)}
                            />
                            {importFile && (
                                <p className="text-sm text-muted-foreground mt-2">Arquivo selecionado: {importFile.name}</p>
                            )}
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsImportOpen(false)}>Cancelar</Button>
                            <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={importPdfMutation.isPending || !importFile}>
                                {importPdfMutation.isPending ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Mágica em andamento...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="mr-2 h-4 w-4" /> Importar e Processar
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <Dialog open={!!deletingProduct} onOpenChange={(open) => !open && setDeletingProduct(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirmar Exclusão</DialogTitle>
                        <DialogDescription>
                            Tem certeza que deseja remover o produto <b>{deletingProduct?.name}</b> do catálogo global?
                            <br /><br />
                            <strong className="text-red-600">Atenção:</strong> Se este produto estiver vinculado a algum estoque ou nota fiscal, a exclusão poderá ser bloqueada.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeletingProduct(null)}>Cancelar</Button>
                        <Button variant="destructive" onClick={() => deleteProductMutation.mutate(deletingProduct.id)} disabled={deleteProductMutation.isPending}>
                            {deleteProductMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Excluir Produto
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// Reusable fields for Create/Edit/Approve Forms
function ProductFormFields({
    name, setName, unit, setUnit, dosePerHa, setDosePerHa, category, setCategory, activeIngredient, setActiveIngredient
}: any) {
    const categories = [
        "Tratamento de Sementes",
        "Herbicida",
        "Fungicida",
        "Inseticida",
        "Nematicida",
        "Óleo / Espalhante Adesivo",
        "Foliar",
        "Sementes",
        "Fertilizante De Base",
        "Fertilizante De Cobertura",
        "Inoculante"
    ];

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>Nome Comercial <span className="text-red-500">*</span></Label>
                <Input value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select value={category} onValueChange={setCategory}>
                        <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                            {categories.map(cat => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>Princípio Ativo</Label>
                    <Input value={activeIngredient} onChange={e => setActiveIngredient(e.target.value)} placeholder="Ex: Glifosato" />
                </div>
                <div className="space-y-2">
                    <Label>Unidade Física <span className="text-red-500">*</span></Label>
                    <Select value={unit} onValueChange={setUnit} required>
                        <SelectTrigger>
                            <SelectValue placeholder="Ex: LT, KG..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="LT">Litros (LT)</SelectItem>
                            <SelectItem value="KG">Quilos (KG)</SelectItem>
                            <SelectItem value="SC">Sacas (SC)</SelectItem>
                            <SelectItem value="TO">Toneladas (TO)</SelectItem>
                            <SelectItem value="UN">Unidade (UN)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>Dose Plena / Hectare</Label>
                    <Input type="number" step="0.001" value={dosePerHa} onChange={e => setDosePerHa(e.target.value)} placeholder="Ex: 2.5" />
                </div>
            </div>
        </div>
    );
}
