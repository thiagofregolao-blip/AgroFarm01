import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Upload, Loader2 } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface ImportPDFModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ImportPDFModal({ isOpen, onClose }: ImportPDFModalProps) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>("");

  const { data: seasons } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/seasons"],
  });

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!selectedSeasonId) {
      toast({
        title: "Safra não selecionada",
        description: "Por favor, selecione uma safra antes de fazer o upload.",
        variant: "destructive",
      });
      event.target.value = '';
      return;
    }

    if (file.type !== "application/pdf") {
      toast({
        title: "Tipo de arquivo inválido",
        description: "Por favor, selecione um arquivo PDF.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    // Simulate PDF processing
    setTimeout(() => {
      setExtractedData({
        client: "Agro Santa Rita",
        productsFound: 5,
        totalValue: 48250.00,
        dueDate: "30/03/2026",
        seasonDetected: "Soja 25/26",
      });
      setIsProcessing(false);
    }, 3000);
  };

  const handleImport = async () => {
    if (!extractedData) return;

    // Here you would normally send the extracted data to your backend
    toast({
      title: "Dados importados",
      description: "Os dados do PDF foram importados com sucesso.",
    });
    
    onClose();
    setExtractedData(null);
  };

  const handleClose = () => {
    onClose();
    setExtractedData(null);
    setIsProcessing(false);
    setSelectedSeasonId("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl" data-testid="import-pdf-modal">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Importar PDF de Vendas</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Extraia automaticamente dados de cliente, produtos e valores
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Season Selection */}
          <div className="space-y-2">
            <label htmlFor="season-select-pdf" className="text-sm font-medium text-foreground">
              Safra <span className="text-red-500">*</span>
            </label>
            <Select value={selectedSeasonId} onValueChange={setSelectedSeasonId}>
              <SelectTrigger id="season-select-pdf" data-testid="select-season-pdf">
                <SelectValue placeholder="Selecione a safra..." />
              </SelectTrigger>
              <SelectContent>
                {seasons?.map((season) => (
                  <SelectItem key={season.id} value={season.id}>
                    {season.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Todas as vendas extraídas do PDF serão atribuídas à safra selecionada.
            </p>
          </div>

          {/* File Upload Area */}
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-colors">
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <FileText className="text-primary text-2xl" size={32} />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground mb-1">
                  Arraste o PDF aqui ou clique para selecionar
                </p>
                <p className="text-xs text-muted-foreground">
                  Suporta: Relación de Pedidos, Facturas, etc.
                </p>
              </div>
              <div>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="pdf-upload"
                  data-testid="file-input"
                />
                <label htmlFor="pdf-upload">
                  <Button asChild data-testid="button-select-file">
                    <span className="cursor-pointer">
                      <Upload className="h-4 w-4 mr-2" />
                      Selecionar Arquivo
                    </span>
                  </Button>
                </label>
              </div>
            </div>
          </div>

          {/* Processing Status */}
          {isProcessing && (
            <Card className="bg-muted">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="animate-spin text-primary" size={20} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Processando PDF...</p>
                    <p className="text-xs text-muted-foreground">Extraindo informações de vendas</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Extracted Data Preview */}
          {extractedData && (
            <Card data-testid="extracted-data">
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3">Dados Extraídos</h3>
                <div className="border border-border rounded-lg p-4 bg-muted/30 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cliente:</span>
                    <span className="font-medium text-foreground">{extractedData.client}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Produtos encontrados:</span>
                    <span className="font-medium text-foreground">{extractedData.productsFound} itens</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Valor Total (USD):</span>
                    <span className="font-medium text-foreground font-mono">
                      ${extractedData.totalValue.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Data Vencimento:</span>
                    <span className="font-medium text-foreground">{extractedData.dueDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Safra Detectada:</span>
                    <span className="font-medium text-foreground font-mono">{extractedData.seasonDetected}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={handleClose} data-testid="button-cancel">
              Cancelar
            </Button>
            <Button 
              onClick={handleImport}
              disabled={!extractedData}
              data-testid="button-import"
            >
              Importar Dados
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
