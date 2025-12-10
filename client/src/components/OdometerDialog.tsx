import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Gauge } from "lucide-react";

type OdometerDialogProps = {
  open: boolean;
  onConfirm: (odometer: number) => void;
  onCancel?: () => void;
  title?: string;
  description?: string;
};

export function OdometerDialog({ 
  open, 
  onConfirm, 
  onCancel,
  title = "Quilometragem do Veículo",
  description = "Digite a quilometragem atual do veículo para iniciar a viagem"
}: OdometerDialogProps) {
  const [odometer, setOdometer] = useState("");

  const handleConfirm = () => {
    const value = parseFloat(odometer);
    if (!isNaN(value) && value > 0) {
      onConfirm(value);
      setOdometer("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen && onCancel) onCancel();
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gauge className="w-5 h-5" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {description}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Input
              type="number"
              placeholder="Ex: 15234"
              value={odometer}
              onChange={(e) => setOdometer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirm();
              }}
              autoFocus
              data-testid="input-odometer"
            />
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Quilometragem em km
            </p>
          </div>

          <div className="flex gap-2">
            {onCancel && (
              <Button 
                variant="outline" 
                onClick={onCancel} 
                className="flex-1"
                data-testid="button-cancel-odometer"
              >
                Cancelar
              </Button>
            )}
            <Button 
              onClick={handleConfirm}
              disabled={!odometer || parseFloat(odometer) <= 0}
              className="flex-1"
              data-testid="button-confirm-odometer"
            >
              Confirmar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
