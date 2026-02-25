import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import FarmLayout from "@/components/fazenda/layout";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Tractor, Plus, Trash2, Settings2, ShieldCheck, Wrench } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const EQUIPMENT_TYPES = ["Trator", "Colheitadeira", "Caminhão", "Implemento", "Pulverizador", "Outros"];
const STATUS_OPTIONS = [
    { value: "Ativo", label: "Ativo", icon: ShieldCheck, color: "text-emerald-600 bg-emerald-100" },
    { value: "Manutenção", label: "Em Manutenção", icon: Wrench, color: "text-amber-600 bg-amber-100" },
    { value: "Inativo", label: "Inativo", icon: Settings2, color: "text-gray-600 bg-gray-100" }
];

export default function FarmEquipment() {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { user } = useAuth();

    const { data: equipment = [], isLoading } = useQuery({
        queryKey: ["/api/farm/equipment"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/equipment"); return r.json(); },
        enabled: !!user,
    });

    const deleteEquipment = useMutation({
        mutationFn: async (id: string) => {
            await apiRequest("DELETE", `/api/farm/equipment/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/equipment"] });
            toast({ title: "Máquina excluída", description: "O equipamento foi removido da frota." });
        }
    });

    const handleDelete = (id: string, name: string) => {
        if (confirm(`Tem certeza que deseja excluir '${name}' da frota?`)) {
            deleteEquipment.mutate(id);
        }
    };

    return (
        <FarmLayout>
            <div className="space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-emerald-800">Frota e Maquinário</h1>
                        <p className="text-emerald-600 text-sm">
                            {equipment.length} equipamentos cadastrados
                        </p>
                    </div>
                    <CreateEquipmentDialog onSuccess={() => queryClient.invalidateQueries({ queryKey: ["/api/farm/equipment"] })} />
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
                ) : equipment.length === 0 ? (
                    <Card className="border-emerald-100">
                        <CardContent className="py-12 text-center">
                            <Tractor className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                            <p className="text-gray-500 mb-2">Sua frota está vazia</p>
                            <p className="text-sm text-gray-400">Cadastre tratores, caminhões e implementos para habilitar o abastecimento via PDV Diesel.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {equipment.map((e: any) => {
                            const statusConfig = STATUS_OPTIONS.find(s => s.value === e.status) || STATUS_OPTIONS[0];
                            const StatusIcon = statusConfig.icon;

                            return (
                                <Card key={e.id} className="overflow-hidden border-emerald-100 hover:shadow-md transition-shadow relative group">
                                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(e.id, e.name)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <CardContent className="p-6">
                                        <div className="flex items-start gap-4">
                                            <div className="h-12 w-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                                                <Tractor className="h-6 w-6" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-semibold text-gray-900 truncate">{e.name}</h3>
                                                <p className="text-sm text-gray-500 mb-3">{e.type}</p>

                                                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
                                                    <StatusIcon className="h-3.5 w-3.5" />
                                                    {statusConfig.label}
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>
        </FarmLayout>
    );
}

function CreateEquipmentDialog({ onSuccess }: { onSuccess: () => void }) {
    const [open, setOpen] = useState(false);
    const { toast } = useToast();

    const [name, setName] = useState("");
    const [type, setType] = useState("");
    const [status, setStatus] = useState("Ativo");

    const saveMachine = useMutation({
        mutationFn: async () => {
            return apiRequest("POST", "/api/farm/equipment", { name, type, status });
        },
        onSuccess: () => {
            toast({ title: "Equipamento adicionado!" });
            setOpen(false);
            onSuccess();
        },
        onError: (e: any) => {
            toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
        }
    });

    return (
        <Dialog open={open} onOpenChange={(o) => {
            setOpen(o);
            if (!o) {
                setName(""); setType(""); setStatus("Ativo");
            }
        }}>
            <DialogTrigger asChild>
                <Button className="bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="mr-2 h-4 w-4" /> Nova Máquina
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Cadastro de Frota / Maquinário</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div>
                        <Label>Nome ou Placa *</Label>
                        <Input
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Ex: Trator John Deere 6100J"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Tipo de Veículo *</Label>
                            <Select value={type} onValueChange={setType}>
                                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                <SelectContent>
                                    {EQUIPMENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label>Status</Label>
                            <Select value={status} onValueChange={setStatus}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <Button
                        className="w-full bg-emerald-600 hover:bg-emerald-700 mt-2"
                        onClick={() => saveMachine.mutate()}
                        disabled={saveMachine.isPending || !name || !type}
                    >
                        {saveMachine.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Salvar Cadastro"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
