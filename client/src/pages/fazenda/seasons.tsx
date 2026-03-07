import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import FarmLayout from "@/components/fazenda/layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit2, Trash2, Calendar, Sprout, DollarSign } from "lucide-react";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose
} from "@/components/ui/dialog";

interface Season {
    id: string;
    farmerId: string;
    name: string;
    crop: string | null;
    startDate: string | null;
    endDate: string | null;
    paymentStartDate: string | null;
    paymentEndDate: string | null;
    isActive: boolean;
    createdAt: string;
}

const CROP_OPTIONS = [
    { value: "", label: "Selecione..." },
    { value: "soja", label: "🌱 Soja" },
    { value: "milho", label: "🌽 Milho" },
    { value: "trigo", label: "🌾 Trigo" },
    { value: "arroz", label: "🍚 Arroz" },
    { value: "algodão", label: "🧵 Algodão" },
    { value: "café", label: "☕ Café" },
    { value: "cana", label: "🎋 Cana-de-açúcar" },
    { value: "outro", label: "📦 Outro" },
];

export default function FarmSeasons() {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<Season | null>(null);
    const [form, setForm] = useState({
        name: "", crop: "", startDate: "", endDate: "",
        paymentStartDate: "", paymentEndDate: "", isActive: true
    });

    const { data: seasons = [], isLoading } = useQuery<Season[]>({
        queryKey: ["/api/farm/seasons"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/seasons"); return r.json(); },
    });

    const createMut = useMutation({
        mutationFn: async (data: any) => {
            const r = await apiRequest("POST", "/api/farm/seasons", data);
            return r.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/seasons"] });
            toast({ title: "Safra criada com sucesso!" });
            closeDialog();
        },
    });

    const updateMut = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: any }) => {
            const r = await apiRequest("PATCH", `/api/farm/seasons/${id}`, data);
            return r.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/seasons"] });
            toast({ title: "Safra atualizada!" });
            closeDialog();
        },
    });

    const deleteMut = useMutation({
        mutationFn: async (id: string) => {
            await apiRequest("DELETE", `/api/farm/seasons/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/seasons"] });
            toast({ title: "Safra excluída" });
        },
    });

    function openCreate() {
        setEditing(null);
        setForm({ name: "", crop: "", startDate: "", endDate: "", paymentStartDate: "", paymentEndDate: "", isActive: true });
        setDialogOpen(true);
    }

    function openEdit(s: Season) {
        setEditing(s);
        setForm({
            name: s.name,
            crop: s.crop || "",
            startDate: s.startDate ? s.startDate.substring(0, 10) : "",
            endDate: s.endDate ? s.endDate.substring(0, 10) : "",
            paymentStartDate: s.paymentStartDate ? s.paymentStartDate.substring(0, 10) : "",
            paymentEndDate: s.paymentEndDate ? s.paymentEndDate.substring(0, 10) : "",
            isActive: s.isActive,
        });
        setDialogOpen(true);
    }

    function closeDialog() {
        setDialogOpen(false);
        setEditing(null);
    }

    function handleSubmit() {
        if (!form.name.trim()) {
            toast({ title: "Nome da safra é obrigatório", variant: "destructive" });
            return;
        }
        const payload = {
            name: form.name.trim(),
            crop: form.crop || null,
            startDate: form.startDate || null,
            endDate: form.endDate || null,
            paymentStartDate: form.paymentStartDate || null,
            paymentEndDate: form.paymentEndDate || null,
            isActive: form.isActive,
        };
        if (editing) {
            updateMut.mutate({ id: editing.id, data: payload });
        } else {
            createMut.mutate(payload);
        }
    }

    function formatDate(d: string | null) {
        if (!d) return "—";
        try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return d; }
    }

    function getCropEmoji(crop: string | null) {
        if (!crop) return "🌿";
        const found = CROP_OPTIONS.find(o => o.value === crop);
        return found ? found.label.split(" ")[0] : "🌿";
    }

    return (
        <FarmLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-emerald-800">Safras</h1>
                        <p className="text-sm text-gray-500">Gerencie as safras e seus períodos de pagamento</p>
                    </div>
                    <Button onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-700">
                        <Plus className="mr-2 h-4 w-4" /> Nova Safra
                    </Button>
                </div>

                {isLoading ? (
                    <p className="text-gray-400 text-center py-10">Carregando...</p>
                ) : seasons.length === 0 ? (
                    <Card className="p-10 text-center">
                        <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                        <h3 className="text-lg font-semibold text-gray-600">Nenhuma safra cadastrada</h3>
                        <p className="text-sm text-gray-400 mb-4">Crie sua primeira safra para vincular faturas automaticamente.</p>
                        <Button onClick={openCreate} variant="outline">
                            <Plus className="mr-2 h-4 w-4" /> Criar Safra
                        </Button>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {seasons.map((s) => (
                            <Card key={s.id} className="p-5 border-emerald-100 hover:shadow-md transition-shadow">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">{getCropEmoji(s.crop)}</span>
                                        <div>
                                            <h3 className="font-semibold text-emerald-800">{s.name}</h3>
                                            {s.crop && (
                                                <span className="text-xs text-gray-500 capitalize">{s.crop}</span>
                                            )}
                                        </div>
                                    </div>
                                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${s.isActive
                                        ? "bg-emerald-100 text-emerald-700"
                                        : "bg-gray-100 text-gray-500"
                                        }`}>
                                        {s.isActive ? "Ativa" : "Encerrada"}
                                    </span>
                                </div>

                                <div className="text-sm text-gray-500 space-y-1 mb-2">
                                    <div className="flex items-center gap-1">
                                        <Sprout className="h-3.5 w-3.5" />
                                        <span>Safra: {formatDate(s.startDate)} → {formatDate(s.endDate)}</span>
                                    </div>
                                </div>

                                {(s.paymentStartDate || s.paymentEndDate) && (
                                    <div className="text-sm text-amber-600 space-y-1 mb-2 bg-amber-50 rounded px-2 py-1.5">
                                        <div className="flex items-center gap-1">
                                            <DollarSign className="h-3.5 w-3.5" />
                                            <span className="font-medium">Pagamento: {formatDate(s.paymentStartDate)} → {formatDate(s.paymentEndDate)}</span>
                                        </div>
                                    </div>
                                )}

                                <div className="flex gap-2 pt-3 border-t border-gray-100">
                                    <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>
                                        <Edit2 className="h-3.5 w-3.5 mr-1" /> Editar
                                    </Button>
                                    <Button
                                        variant="ghost" size="sm"
                                        className="text-red-500 hover:text-red-700"
                                        onClick={() => {
                                            if (window.confirm(`Excluir safra "${s.name}"?`)) {
                                                deleteMut.mutate(s.id);
                                            }
                                        }}
                                    >
                                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
                                    </Button>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* Create/Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editing ? "Editar Safra" : "Nova Safra"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="name">Nome da Safra *</Label>
                                <Input
                                    id="name"
                                    placeholder="Ex: Soja 2025/2026"
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label htmlFor="crop">Cultura</Label>
                                <select
                                    id="crop"
                                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    value={form.crop}
                                    onChange={(e) => setForm({ ...form, crop: e.target.value })}
                                >
                                    {CROP_OPTIONS.map((opt) => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="border rounded-lg p-3 space-y-3">
                            <h4 className="text-sm font-medium text-gray-700 flex items-center gap-1">
                                <Sprout className="h-4 w-4 text-emerald-500" /> Período da Safra
                            </h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="startDate">Início</Label>
                                    <Input
                                        id="startDate"
                                        type="date"
                                        value={form.startDate}
                                        onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="endDate">Fim</Label>
                                    <Input
                                        id="endDate"
                                        type="date"
                                        value={form.endDate}
                                        onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="border border-amber-200 rounded-lg p-3 space-y-3 bg-amber-50/50">
                            <h4 className="text-sm font-medium text-amber-700 flex items-center gap-1">
                                <DollarSign className="h-4 w-4 text-amber-500" /> Período de Pagamento
                                <span className="text-xs font-normal text-gray-400 ml-1">(para vincular faturas automaticamente)</span>
                            </h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="paymentStartDate">Início Pgto</Label>
                                    <Input
                                        id="paymentStartDate"
                                        type="date"
                                        value={form.paymentStartDate}
                                        onChange={(e) => setForm({ ...form, paymentStartDate: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="paymentEndDate">Fim Pgto</Label>
                                    <Input
                                        id="paymentEndDate"
                                        type="date"
                                        value={form.paymentEndDate}
                                        onChange={(e) => setForm({ ...form, paymentEndDate: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => setForm({ ...form, isActive: !form.isActive })}
                                className={`w-10 h-6 rounded-full transition-colors ${form.isActive ? "bg-emerald-500" : "bg-gray-300"}`}
                            >
                                <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isActive ? "translate-x-5" : "translate-x-1"}`} />
                            </button>
                            <Label>Safra ativa</Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline">Cancelar</Button>
                        </DialogClose>
                        <Button
                            className="bg-emerald-600 hover:bg-emerald-700"
                            onClick={handleSubmit}
                            disabled={createMut.isPending || updateMut.isPending}
                        >
                            {createMut.isPending || updateMut.isPending ? "Salvando..." : editing ? "Salvar" : "Criar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </FarmLayout>
    );
}
