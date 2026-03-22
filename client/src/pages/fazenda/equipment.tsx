import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import FarmLayout from "@/components/fazenda/layout";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Tractor, Plus, Trash2, Settings2, ShieldCheck, Wrench, DollarSign, Eye, FileText } from "lucide-react";
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
    const [selectedEquipId, setSelectedEquipId] = useState<string | null>(null);
    const [expenseDetailId, setExpenseDetailId] = useState<string | null>(null);

    const { data: equipment = [], isLoading } = useQuery({
        queryKey: ["/api/farm/equipment"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/equipment"); return r.json(); },
        enabled: !!user,
    });

    const { data: expenses = [] } = useQuery({
        queryKey: ["/api/farm/expenses"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/expenses"); return r.json(); },
        enabled: !!user,
    });

    const { data: expenseDetail } = useQuery({
        queryKey: ["/api/farm/expenses", expenseDetailId],
        queryFn: async () => { const r = await apiRequest("GET", `/api/farm/expenses/${expenseDetailId}`); return r.json(); },
        enabled: !!expenseDetailId,
    });

    const selectedEquip = (equipment as any[]).find((e: any) => e.id === selectedEquipId);
    const equipExpenses = (expenses as any[]).filter((e: any) => e.equipmentId === selectedEquipId);
    const totalEquipExpenses = equipExpenses.reduce((sum: number, e: any) => sum + (parseFloat(e.amount) || 0), 0);

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

                            const eqExpenses = (expenses as any[]).filter((ex: any) => ex.equipmentId === e.id);
                            const eqTotal = eqExpenses.reduce((sum: number, ex: any) => sum + (parseFloat(ex.amount) || 0), 0);

                            return (
                                <Card
                                    key={e.id}
                                    className="overflow-hidden border-emerald-100 hover:shadow-md transition-shadow relative group cursor-pointer"
                                    onClick={() => setSelectedEquipId(e.id)}
                                >
                                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={(ev) => { ev.stopPropagation(); handleDelete(e.id, e.name); }}>
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
                                                <p className="text-sm text-gray-500 mb-2">{e.type}</p>

                                                <div className="flex items-center gap-3 flex-wrap">
                                                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
                                                        <StatusIcon className="h-3.5 w-3.5" />
                                                        {statusConfig.label}
                                                    </div>
                                                    {eqExpenses.length > 0 && (
                                                        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                                                            <DollarSign className="h-3 w-3" />
                                                            {eqExpenses.length} despesa{eqExpenses.length > 1 ? 's' : ''} · ${eqTotal.toFixed(2)}
                                                        </div>
                                                    )}
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

            <Dialog open={!!selectedEquipId} onOpenChange={(open) => { if (!open) { setSelectedEquipId(null); setExpenseDetailId(null); } }}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-emerald-800">
                            <Tractor className="h-5 w-5" />
                            {selectedEquip?.name || "Equipamento"}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                                <span className="text-gray-500">Tipo:</span>
                                <p className="font-semibold">{selectedEquip?.type}</p>
                            </div>
                            <div>
                                <span className="text-gray-500">Status:</span>
                                <p className="font-semibold">{selectedEquip?.status}</p>
                            </div>
                            <div>
                                <span className="text-gray-500">Total em Despesas:</span>
                                <p className="font-semibold text-lg text-emerald-700">${totalEquipExpenses.toFixed(2)}</p>
                            </div>
                        </div>

                        <h4 className="font-semibold text-gray-800">
                            Despesas ({equipExpenses.length})
                        </h4>

                        {equipExpenses.length === 0 ? (
                            <div className="py-6 text-center">
                                <FileText className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                                <p className="text-gray-500 text-sm">Nenhuma despesa registrada para este equipamento</p>
                            </div>
                        ) : (
                            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="text-left p-3 font-semibold text-gray-600">Data</th>
                                            <th className="text-left p-3 font-semibold text-gray-600">Fornecedor</th>
                                            <th className="text-left p-3 font-semibold text-gray-600">Categoria</th>
                                            <th className="text-left p-3 font-semibold text-gray-600">Descrição</th>
                                            <th className="text-right p-3 font-semibold text-gray-600">Valor</th>
                                            <th className="text-center p-3 font-semibold text-gray-600">Status</th>
                                            <th className="text-center p-3 font-semibold text-gray-600">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {equipExpenses.map((ex: any) => {
                                            const supplierMatch = ex.description?.match(/\[Via WhatsApp\]\s*\[([^\]]+)\]/);
                                            const supplier = ex.supplier || (supplierMatch ? supplierMatch[1] : "—");
                                            const cleanDesc = ex.description?.replace(/\[Via WhatsApp\]\s*(\[[^\]]*\]\s*)?/, "").trim() || "—";

                                            return (
                                                <tr key={ex.id} className="border-t border-gray-100">
                                                    <td className="p-3">{new Date(ex.expenseDate).toLocaleDateString("pt-BR")}</td>
                                                    <td className="p-3 text-gray-700">{supplier}</td>
                                                    <td className="p-3">
                                                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                                                            {ex.category}
                                                        </span>
                                                    </td>
                                                    <td className="p-3">{cleanDesc}</td>
                                                    <td className="text-right p-3 font-mono font-semibold">${parseFloat(ex.amount).toFixed(2)}</td>
                                                    <td className="text-center p-3">
                                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ex.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                                            {ex.status === 'confirmed' ? 'Aprovado' : 'Pendente'}
                                                        </span>
                                                    </td>
                                                    <td className="text-center p-3">
                                                        {ex.hasImage && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="text-gray-600 border-gray-200"
                                                                onClick={() => setExpenseDetailId(ex.id)}
                                                            >
                                                                <Eye className="mr-1 h-3 w-3" />
                                                                Ver
                                                            </Button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {expenseDetail && expenseDetailId && (
                            <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-semibold text-emerald-800">Detalhe do Recibo</h4>
                                    <Button size="sm" variant="ghost" onClick={() => setExpenseDetailId(null)}>Fechar</Button>
                                </div>

                                {expenseDetail.items && expenseDetail.items.length > 0 && (
                                    <div className="bg-white rounded-lg border border-emerald-100 overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead className="bg-emerald-50">
                                                <tr>
                                                    <th className="text-left p-2 font-semibold text-emerald-800">Item</th>
                                                    <th className="text-center p-2 font-semibold text-emerald-800">Qtd</th>
                                                    <th className="text-center p-2 font-semibold text-emerald-800">Unid</th>
                                                    <th className="text-right p-2 font-semibold text-emerald-800">Preço Unit.</th>
                                                    <th className="text-right p-2 font-semibold text-emerald-800">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {expenseDetail.items.map((item: any) => (
                                                    <tr key={item.id} className="border-t border-gray-100">
                                                        <td className="p-2 font-medium">{item.itemName}</td>
                                                        <td className="text-center p-2">{parseFloat(item.quantity)}</td>
                                                        <td className="text-center p-2 text-gray-500">{item.unit}</td>
                                                        <td className="text-right p-2 font-mono">${parseFloat(item.unitPrice).toFixed(2)}</td>
                                                        <td className="text-right p-2 font-mono font-semibold">${parseFloat(item.totalPrice).toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {expenseDetail.hasImage && (
                                    <div>
                                        <p className="text-sm font-semibold text-gray-600 mb-1">Imagem do Recibo</p>
                                        <img
                                            src={`/api/farm/expenses/${expenseDetailId}/image`}
                                            alt="Recibo"
                                            className="rounded-lg border border-gray-200 max-w-full max-h-96"
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </FarmLayout>
    );
}

function CreateEquipmentDialog({ onSuccess }: { onSuccess: () => void }) {
    const [open, setOpen] = useState(false);
    const { toast } = useToast();

    const [name, setName] = useState("");
    const [type, setType] = useState("");
    const [status, setStatus] = useState("Ativo");
    const [tankCapacityL, setTankCapacityL] = useState("");

    const saveMachine = useMutation({
        mutationFn: async () => {
            return apiRequest("POST", "/api/farm/equipment", {
                name, type, status,
                tankCapacityL: tankCapacityL ? parseFloat(tankCapacityL) : null,
            });
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
                setName(""); setType(""); setStatus("Ativo"); setTankCapacityL("");
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

                    {type === "Pulverizador" && (
                        <div>
                            <Label>Capacidade do Tanque (Litros)</Label>
                            <Input
                                type="number"
                                step="any"
                                value={tankCapacityL}
                                onChange={e => setTankCapacityL(e.target.value)}
                                placeholder="Ex: 3000"
                            />
                        </div>
                    )}

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
