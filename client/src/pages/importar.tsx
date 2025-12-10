import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { FileText, Upload, CheckCircle, XCircle, AlertCircle, Download, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { useDropzone } from "react-dropzone";

interface ImportedFile {
  id: string;
  fileName: string;
  fileSize: number;
  uploadDate: Date;
  status: "processing" | "completed" | "error";
  extractedData?: {
    client: string;
    productsCount: number;
    totalValue: number;
    dueDate: string;
    season: string;
  };
  errorMessage?: string;
}

export default function Importar() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);
  const [importHistory, setImportHistory] = useState<ImportedFile[]>([]);
  const { toast } = useToast();

  const { data: clients } = useQuery({
    queryKey: ["/api/clients"],
  });

  const { data: seasons } = useQuery({
    queryKey: ["/api/seasons"],
  });

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const pdfFiles = acceptedFiles.filter(file => file.type === "application/pdf");
    
    if (pdfFiles.length !== acceptedFiles.length) {
      toast({
        title: "Arquivos rejeitados",
        description: "Apenas arquivos PDF são aceitos.",
        variant: "destructive",
      });
    }

    if (pdfFiles.length === 0) return;

    setUploadingFiles(pdfFiles);

    // Simulate PDF processing
    pdfFiles.forEach((file, index) => {
      const importedFile: ImportedFile = {
        id: `import-${Date.now()}-${index}`,
        fileName: file.name,
        fileSize: file.size,
        uploadDate: new Date(),
        status: "processing",
      };

      setImportHistory(prev => [importedFile, ...prev]);

      // Simulate processing delay
      setTimeout(() => {
        const isSuccess = Math.random() > 0.2; // 80% success rate for demo
        
        if (isSuccess) {
          const extractedData = {
            client: "Agro Santa Rita",
            productsCount: Math.floor(Math.random() * 10) + 1,
            totalValue: Math.random() * 100000 + 10000,
            dueDate: "30/03/2026",
            season: "Soja 25/26",
          };

          setImportHistory(prev => 
            prev.map(item => 
              item.id === importedFile.id 
                ? { ...item, status: "completed" as const, extractedData }
                : item
            )
          );

          toast({
            title: "PDF processado",
            description: `${file.name} foi processado com sucesso.`,
          });
        } else {
          setImportHistory(prev => 
            prev.map(item => 
              item.id === importedFile.id 
                ? { ...item, status: "error" as const, errorMessage: "Erro ao extrair dados do PDF" }
                : item
            )
          );

          toast({
            title: "Erro no processamento",
            description: `Falha ao processar ${file.name}.`,
            variant: "destructive",
          });
        }
      }, 2000 + index * 1000);
    });

    setUploadingFiles([]);
  }, [toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: true
  });

  const getStatusIcon = (status: ImportedFile["status"]) => {
    switch (status) {
      case "processing":
        return <RefreshCw className="h-4 w-4 text-chart-2 animate-spin" />;
      case "completed":
        return <CheckCircle className="h-4 w-4 text-verde" />;
      case "error":
        return <XCircle className="h-4 w-4 text-vermelha" />;
    }
  };

  const getStatusBadge = (status: ImportedFile["status"]) => {
    switch (status) {
      case "processing":
        return <Badge className="bg-chart-2/10 text-chart-2">Processando</Badge>;
      case "completed":
        return <Badge className="badge-verde">Concluído</Badge>;
      case "error":
        return <Badge className="badge-vermelha">Erro</Badge>;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const completedImports = importHistory.filter(item => item.status === "completed").length;
  const failedImports = importHistory.filter(item => item.status === "error").length;
  const processingImports = importHistory.filter(item => item.status === "processing").length;

  return (
    <div className="flex h-screen overflow-hidden" data-testid="importar-container">
      <Sidebar collapsed={sidebarCollapsed} />
      
      <main className="flex-1 overflow-y-auto">
        <Header 
          onToggleSidebar={toggleSidebar}
          onNewSale={() => {}}
          title="Importação de PDFs"
          subtitle="Extração automática de dados de vendas"
        />

        <div className="p-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <FileText className="text-primary" size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total de Importações</p>
                    <p className="text-2xl font-bold">{importHistory.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-verde/10 rounded-lg flex items-center justify-center">
                    <CheckCircle className="text-verde" size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Concluídas</p>
                    <p className="text-2xl font-bold">{completedImports}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-chart-2/10 rounded-lg flex items-center justify-center">
                    <RefreshCw className="text-chart-2" size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Processando</p>
                    <p className="text-2xl font-bold">{processingImports}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-vermelha/10 rounded-lg flex items-center justify-center">
                    <AlertCircle className="text-vermelha" size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Com Erro</p>
                    <p className="text-2xl font-bold">{failedImports}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Upload Area */}
          <Card className="shadow-sm mb-8">
            <CardHeader>
              <CardTitle>Upload de PDFs</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer ${
                  isDragActive 
                    ? "border-primary bg-primary/5" 
                    : "border-border hover:border-primary hover:bg-muted/50"
                }`}
                data-testid="pdf-upload-zone"
              >
                <input {...getInputProps()} data-testid="pdf-file-input" />
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                    {uploadingFiles.length > 0 ? (
                      <RefreshCw className="text-primary animate-spin" size={32} />
                    ) : (
                      <Upload className="text-primary" size={32} />
                    )}
                  </div>
                  
                  {uploadingFiles.length > 0 ? (
                    <div>
                      <p className="text-lg font-semibold text-foreground">
                        Enviando {uploadingFiles.length} arquivo(s)...
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Aguarde o processamento
                      </p>
                    </div>
                  ) : isDragActive ? (
                    <div>
                      <p className="text-lg font-semibold text-foreground">
                        Solte os arquivos PDF aqui
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Para começar o processamento
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-lg font-semibold text-foreground">
                        Arraste PDFs aqui ou clique para selecionar
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Suporta: Relación de Pedidos, Facturas, Notas de Venta
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Máximo 10MB por arquivo • Apenas arquivos PDF
                      </p>
                    </div>
                  )}
                  
                  {uploadingFiles.length === 0 && (
                    <Button className="mt-2">
                      <Upload className="h-4 w-4 mr-2" />
                      Selecionar Arquivos
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Import History */}
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Histórico de Importações</CardTitle>
              <Button variant="outline" size="sm" data-testid="button-export-history">
                <Download className="h-4 w-4 mr-2" />
                Exportar Histórico
              </Button>
            </CardHeader>
            <CardContent>
              {importHistory.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">Nenhum arquivo foi importado ainda</p>
                  <p className="text-sm text-muted-foreground">
                    Use a área de upload acima para começar a processar PDFs
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Arquivo</TableHead>
                        <TableHead>Tamanho</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Produtos</TableHead>
                        <TableHead className="text-right">Valor (USD)</TableHead>
                        <TableHead>Safra</TableHead>
                        <TableHead className="text-center">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importHistory.map((item) => (
                        <TableRow key={item.id} data-testid={`import-row-${item.id}`}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getStatusIcon(item.status)}
                              <div>
                                <p className="font-medium truncate max-w-48" title={item.fileName}>
                                  {item.fileName}
                                </p>
                                {item.errorMessage && (
                                  <p className="text-xs text-vermelha">{item.errorMessage}</p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatFileSize(item.fileSize)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {format(item.uploadDate, "dd/MM/yyyy HH:mm")}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(item.status)}
                          </TableCell>
                          <TableCell>
                            {item.extractedData?.client || "-"}
                          </TableCell>
                          <TableCell className="text-center">
                            {item.extractedData?.productsCount || "-"}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {item.extractedData?.totalValue 
                              ? `$${item.extractedData.totalValue.toLocaleString()}`
                              : "-"
                            }
                          </TableCell>
                          <TableCell>
                            {item.extractedData?.season || "-"}
                          </TableCell>
                          <TableCell className="text-center">
                            {item.status === "completed" && (
                              <div className="flex gap-1 justify-center">
                                <Button variant="ghost" size="sm" title="Ver detalhes">
                                  <FileText className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" title="Reimportar">
                                  <RefreshCw className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                            {item.status === "error" && (
                              <Button variant="ghost" size="sm" title="Tentar novamente">
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
