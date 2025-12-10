import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Package, AlertTriangle, CheckCircle, Upload, FileText, Trash2, Clock, Search, Users } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import FaturistaNavbar from '@/components/layout/faturista-navbar';
import Header from '@/components/layout/header';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import type { UploadSession, StockAnalysisResult } from '@shared/schema';

interface SessionWithAnalysis extends UploadSession {
  analysisCount?: number;
  availableCount?: number;
  partialCount?: number;
  unavailableCount?: number;
}

export default function FaturistaPanel() {
  const [activeTab, setActiveTab] = useState('sessions');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Upload state
  const [sessionName, setSessionName] = useState('');
  const [inventoryFile, setInventoryFile] = useState<File | null>(null);
  const [orderFiles, setOrderFiles] = useState<File[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [uploadStep, setUploadStep] = useState<'name' | 'inventory' | 'orders' | 'analyze'>('name');

  const { toast } = useToast();

  const { data: sessions, isLoading: loadingSessions } = useQuery<SessionWithAnalysis[]>({
    queryKey: ['/api/faturista/sessions'],
  });

  const { data: analysisResults, isLoading: loadingAnalysis} = useQuery<StockAnalysisResult[]>({
    queryKey: ['/api/faturista/analysis', selectedSession],
    enabled: !!selectedSession,
  });

  const createSessionMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch('/api/faturista/upload-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionName: name }),
        credentials: 'include',
      });
      
      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || res.statusText);
      }
      
      return res.json();
    },
    onSuccess: (data) => {
      setCurrentSessionId(data.id);
      setUploadStep('inventory');
      queryClient.invalidateQueries({ queryKey: ['/api/faturista/sessions'] });
      toast({
        title: "Sessão criada",
        description: "Agora faça upload do PDF de estoque",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao criar sessão",
        variant: "destructive",
      });
    },
  });

  const uploadInventoryMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sessionId', currentSessionId!);

      const res = await fetch('/api/faturista/upload-inventory', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(errorData.error || res.statusText);
      }
      
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Estoque importado",
        description: `${data.itemsCount} produtos processados`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/faturista/sessions'] });
      setUploadStep('orders');
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao importar estoque",
        description: error.message || "Falha ao importar estoque",
        variant: "destructive",
      });
    },
  });

  const uploadOrdersMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();
      files.forEach(file => formData.append('files', file));
      formData.append('sessionId', currentSessionId!);

      const res = await fetch('/api/faturista/upload-orders', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(errorData.error || res.statusText);
      }
      
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Pedidos importados",
        description: `${data.ordersCount} pedidos processados de ${data.filesProcessed} arquivo(s)`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/faturista/sessions'] });
      setUploadStep('analyze');
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao importar pedidos",
        description: error.message || "Falha ao importar pedidos",
        variant: "destructive",
      });
    },
  });

  const analyzeStockMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/faturista/analyze-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: currentSessionId }),
        credentials: 'include',
      });
      
      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || res.statusText);
      }
      
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Análise concluída",
        description: `${data.resultsCount} produtos analisados`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/faturista/sessions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/faturista/analysis', currentSessionId] });
      setIsAnalyzing(false);
      setIsUploadDialogOpen(false);
      resetUploadForm();
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao analisar estoque",
        variant: "destructive",
      });
      setIsAnalyzing(false);
    },
  });

  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await fetch(`/api/faturista/session/${sessionId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || res.statusText);
      }
      
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Sessão excluída",
        description: "A sessão foi removida com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/faturista/sessions'] });
      if (selectedSession === sessionToDelete) {
        setSelectedSession(null);
      }
      setSessionToDelete(null);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao excluir sessão",
        variant: "destructive",
      });
    },
  });

  const resetUploadForm = () => {
    setSessionName('');
    setInventoryFile(null);
    setOrderFiles([]);
    setCurrentSessionId(null);
    setUploadStep('name');
  };

  const handleCreateSession = () => {
    if (!sessionName.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Digite um nome para a sessão",
        variant: "destructive",
      });
      return;
    }
    createSessionMutation.mutate(sessionName);
  };

  const handleUploadInventory = () => {
    if (!inventoryFile) {
      toast({
        title: "Arquivo obrigatório",
        description: "Selecione o PDF de estoque",
        variant: "destructive",
      });
      return;
    }
    uploadInventoryMutation.mutate(inventoryFile);
  };

  const handleUploadOrders = () => {
    if (orderFiles.length === 0) {
      toast({
        title: "Arquivo obrigatório",
        description: "Selecione pelo menos um PDF de pedido",
        variant: "destructive",
      });
      return;
    }
    uploadOrdersMutation.mutate(orderFiles);
  };

  const handleAnalyze = () => {
    setIsAnalyzing(true);
    analyzeStockMutation.mutate();
  };

  const getStatusBadge = (status: string) => {
    if (status === 'DISPONÍVEL') {
      return <Badge className="bg-green-500" data-testid={`badge-disponivel`}><CheckCircle className="h-3 w-3 mr-1" />Disponível</Badge>;
    } else if (status === 'PARCIAL') {
      return <Badge className="bg-yellow-500" data-testid={`badge-parcial`}><AlertTriangle className="h-3 w-3 mr-1" />Parcial</Badge>;
    } else if (status === 'CRÍTICO') {
      return <Badge className="bg-orange-500" data-testid={`badge-critico`}><AlertTriangle className="h-3 w-3 mr-1" />Crítico</Badge>;
    } else {
      return <Badge className="bg-red-500" data-testid={`badge-indisponivel`}><AlertTriangle className="h-3 w-3 mr-1" />Indisponível</Badge>;
    }
  };

  const filteredResults = analysisResults?.filter(result => 
    result.productCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    result.productName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Header />
      <FaturistaNavbar activeTab={activeTab} onTabChange={setActiveTab} selectedSession={selectedSession} />
        
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-4">
          {activeTab === 'sessions' && (
            <>
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Sessões de Upload</CardTitle>
                        <CardDescription>Histórico de importações de estoque e pedidos</CardDescription>
                      </div>
                      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
                        <DialogTrigger asChild>
                          <Button data-testid="button-new-session">
                            <Upload className="h-4 w-4 mr-2" />
                            Nova Importação
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Importar Estoque e Pedidos</DialogTitle>
                            <DialogDescription>
                              {uploadStep === 'name' && 'Passo 1: Nome da sessão'}
                              {uploadStep === 'inventory' && 'Passo 2: Upload do estoque (PDF)'}
                              {uploadStep === 'orders' && 'Passo 3: Upload dos pedidos (PDFs)'}
                              {uploadStep === 'analyze' && 'Passo 4: Analisar disponibilidade'}
                            </DialogDescription>
                          </DialogHeader>

                          {uploadStep === 'name' && (
                            <div className="space-y-4">
                              <div>
                                <Label>Nome da Sessão</Label>
                                <Input
                                  value={sessionName}
                                  onChange={(e) => setSessionName(e.target.value)}
                                  placeholder="Ex: Estoque Janeiro 2024"
                                  data-testid="input-session-name"
                                />
                              </div>
                              <DialogFooter>
                                <Button onClick={handleCreateSession} disabled={createSessionMutation.isPending} data-testid="button-create-session">
                                  Criar Sessão
                                </Button>
                              </DialogFooter>
                            </div>
                          )}

                          {uploadStep === 'inventory' && (
                            <div className="space-y-4">
                              <div>
                                <Label>PDF de Estoque</Label>
                                <Input
                                  type="file"
                                  accept=".pdf"
                                  onChange={(e) => setInventoryFile(e.target.files?.[0] || null)}
                                  data-testid="input-inventory-file"
                                />
                                <p className="text-sm text-muted-foreground mt-1">
                                  Arquivo contendo Cód.Int, Mercadería, Embalaje e Cantidad
                                </p>
                              </div>
                              <DialogFooter>
                                <Button onClick={handleUploadInventory} disabled={uploadInventoryMutation.isPending} data-testid="button-upload-inventory">
                                  Importar Estoque
                                </Button>
                              </DialogFooter>
                            </div>
                          )}

                          {uploadStep === 'orders' && (
                            <div className="space-y-4">
                              <div>
                                <Label>PDFs de Pedidos (múltiplos)</Label>
                                <Input
                                  type="file"
                                  accept=".pdf"
                                  multiple
                                  onChange={(e) => setOrderFiles(Array.from(e.target.files || []))}
                                  data-testid="input-order-files"
                                />
                                <p className="text-sm text-muted-foreground mt-1">
                                  Arquivos contendo (Cód), Descripción, Cant. Falta e Entidad
                                </p>
                              </div>
                              <DialogFooter>
                                <Button onClick={handleUploadOrders} disabled={uploadOrdersMutation.isPending} data-testid="button-upload-orders">
                                  Importar Pedidos
                                </Button>
                              </DialogFooter>
                            </div>
                          )}

                          {uploadStep === 'analyze' && (
                            <div className="space-y-4">
                              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                <p className="text-sm">
                                  ✅ Estoque importado<br />
                                  ✅ Pedidos importados<br /><br />
                                  Clique em "Analisar" para calcular a disponibilidade dos produtos.
                                </p>
                              </div>
                              <DialogFooter>
                                <Button onClick={handleAnalyze} disabled={analyzeStockMutation.isPending || isAnalyzing} data-testid="button-analyze-stock">
                                  {analyzeStockMutation.isPending || isAnalyzing ? 'Analisando...' : 'Analisar Disponibilidade'}
                                </Button>
                              </DialogFooter>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {loadingSessions ? (
                      <div className="text-center py-8" data-testid="loading-sessions">Carregando...</div>
                    ) : sessions && sessions.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nome da Sessão</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Arquivo de Estoque</TableHead>
                            <TableHead>Arquivos de Pedidos</TableHead>
                            <TableHead>Data</TableHead>
                            <TableHead>Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sessions.map((session) => (
                            <TableRow key={session.id} data-testid={`row-session-${session.id}`}>
                              <TableCell className="font-medium" data-testid={`text-session-name-${session.id}`}>{session.sessionName}</TableCell>
                              <TableCell>
                                {session.status === 'completed' ? (
                                  <Badge className="bg-green-500" data-testid={`badge-status-${session.id}`}>Concluída</Badge>
                                ) : (
                                  <Badge variant="secondary" data-testid={`badge-status-${session.id}`}>Processando</Badge>
                                )}
                              </TableCell>
                              <TableCell data-testid={`text-inventory-file-${session.id}`}>{session.inventoryFileName || '-'}</TableCell>
                              <TableCell data-testid={`text-order-count-${session.id}`}>{session.orderFilesCount || 0}</TableCell>
                              <TableCell data-testid={`text-created-at-${session.id}`}>
                                {new Date(session.createdAt).toLocaleDateString('pt-BR')}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedSession(session.id);
                                      setActiveTab('analysis');
                                    }}
                                    data-testid={`button-view-analysis-${session.id}`}
                                  >
                                    Ver Análise
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => setSessionToDelete(session.id)}
                                    data-testid={`button-delete-session-${session.id}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground" data-testid="empty-sessions">
                        Nenhuma sessão de importação encontrada
                      </div>
                    )}
                  </CardContent>
                </Card>
            </>
          )}

          {activeTab === 'analysis' && (
            <>
                {selectedSession && (
                  <>
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle>Análise de Disponibilidade</CardTitle>
                            <CardDescription>Status de estoque vs pedidos em carteira</CardDescription>
                          </div>
                          <div className="flex items-center gap-2">
                            <Search className="h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="Buscar produto..."
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              className="w-64"
                              data-testid="input-search-products"
                            />
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {loadingAnalysis ? (
                          <div className="text-center py-8" data-testid="loading-analysis">Carregando análise...</div>
                        ) : filteredResults && filteredResults.length > 0 ? (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Código</TableHead>
                                <TableHead>Produto</TableHead>
                                <TableHead>Estoque</TableHead>
                                <TableHead>Pedidos</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Cobertura</TableHead>
                                <TableHead>Clientes</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredResults.map((result) => {
                                const clientsList = result.clientsList as Array<{clientName: string; quantity: number}>;
                                return (
                                  <TableRow key={result.id} data-testid={`row-analysis-${result.productCode}`}>
                                    <TableCell className="font-mono" data-testid={`text-product-code-${result.productCode}`}>{result.productCode}</TableCell>
                                    <TableCell data-testid={`text-product-name-${result.productCode}`}>{result.productName}</TableCell>
                                    <TableCell data-testid={`text-stock-qty-${result.productCode}`}>{parseFloat(result.stockQuantity).toLocaleString()}</TableCell>
                                    <TableCell data-testid={`text-orders-qty-${result.productCode}`}>{parseFloat(result.ordersQuantity).toLocaleString()}</TableCell>
                                    <TableCell>{getStatusBadge(result.status)}</TableCell>
                                    <TableCell data-testid={`text-percentage-${result.productCode}`}>
                                      <div className="flex items-center gap-2">
                                        <Progress value={parseFloat(result.percentage || '0')} className="w-20" />
                                        <span className="text-sm">{parseFloat(result.percentage || '0').toFixed(0)}%</span>
                                      </div>
                                    </TableCell>
                                    <TableCell data-testid={`text-clients-count-${result.productCode}`}>
                                      {clientsList && clientsList.length > 0 ? (
                                        <Popover>
                                          <PopoverTrigger asChild>
                                            <Button variant="outline" size="sm" className="gap-2">
                                              <Users className="h-4 w-4" />
                                              {clientsList.length} cliente(s)
                                            </Button>
                                          </PopoverTrigger>
                                          <PopoverContent className="w-80" align="start">
                                            <div className="space-y-2">
                                              <h4 className="font-semibold text-sm">Clientes com pedidos:</h4>
                                              <div className="max-h-60 overflow-y-auto space-y-1">
                                                {clientsList.map((client, idx) => (
                                                  <div key={idx} className="flex items-center justify-between py-1 px-2 bg-muted rounded text-sm">
                                                    <span className="truncate flex-1" title={client.clientName}>
                                                      {client.clientName}
                                                    </span>
                                                    <Badge variant="secondary" className="ml-2">
                                                      {client.quantity} un.
                                                    </Badge>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          </PopoverContent>
                                        </Popover>
                                      ) : (
                                        <span className="text-muted-foreground">0 cliente(s)</span>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        ) : (
                          <div className="text-center py-8 text-muted-foreground" data-testid="empty-analysis">
                            Nenhum resultado encontrado
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </>
                )}
            </>
          )}
        </div>

        <AlertDialog open={!!sessionToDelete} onOpenChange={() => setSessionToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Sessão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir esta sessão? Todos os dados de estoque, pedidos e análise serão removidos permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete">Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => sessionToDelete && deleteSessionMutation.mutate(sessionToDelete)}
                data-testid="button-confirm-delete"
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
