import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Upload, UserPlus, Download, Lightbulb } from "lucide-react";

interface QuickActionsProps {
  onNewSale: () => void;
  onImportPDF: () => void;
}

export default function QuickActions({ onNewSale, onImportPDF }: QuickActionsProps) {
  return (
    <div className="space-y-4">
      <Card className="shadow-sm" data-testid="quick-actions">
        <CardHeader>
          <CardTitle className="text-lg font-bold">Ações Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Button 
              onClick={onNewSale}
              className="w-full justify-center gap-2"
              data-testid="button-new-sale"
            >
              <PlusCircle className="h-4 w-4" />
              Lançar Venda Manual
            </Button>
            
            <Button 
              variant="outline"
              onClick={onImportPDF}
              className="w-full justify-center gap-2"
              data-testid="button-import-pdf"
            >
              <Upload className="h-4 w-4" />
              Importar PDF
            </Button>
            
            <Button 
              variant="outline"
              className="w-full justify-center gap-2"
              data-testid="button-new-client"
            >
              <UserPlus className="h-4 w-4" />
              Novo Cliente
            </Button>
            
            <Button 
              variant="outline"
              className="w-full justify-center gap-2"
              data-testid="button-export-report"
            >
              <Download className="h-4 w-4" />
              Exportar Relatório
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-primary to-secondary text-primary-foreground shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <Lightbulb className="text-xl" size={20} />
            </div>
            <div>
              <h4 className="font-bold mb-1">Dica do Dia</h4>
              <p className="text-sm opacity-90">
                Revise os alertas de oportunidade para maximizar vendas com clientes existentes.
              </p>
            </div>
          </div>
          <Button variant="link" className="text-primary-foreground p-0 h-auto underline hover:no-underline">
            Saiba mais
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
