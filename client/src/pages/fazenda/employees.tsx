import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import FarmLayout from "@/components/fazenda/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast, toast } from "@/hooks/use-toast";
import { Plus, Edit2, Trash2, Loader2, Users, Camera, Image, Phone, Search, X, CheckCircle, AlertCircle, ScanFace } from "lucide-react";
import { loadFaceModels, generateFaceEmbedding } from "@/lib/face-recognition";

const ROLES = ["Gerente", "Operador", "Tratorista", "Motorista", "Mecânico", "Auxiliar", "Encarregado", "Outro"];

function EmployeeForm({ initial, onSubmit, isPending }: { initial?: any; onSubmit: (data: any) => void; isPending: boolean }) {
    const [name, setName] = useState(initial?.name || "");
    const [role, setRole] = useState(initial?.role || "Operador");
    const [phone, setPhone] = useState(initial?.phone || "");
    const [photoPreview, setPhotoPreview] = useState<string>(initial?.photoBase64 || "");
    const [signaturePreview, setSignaturePreview] = useState<string>(initial?.signatureBase64 || "");
    const [faceEmbedding, setFaceEmbedding] = useState<number[] | null>(initial?.faceEmbedding ? JSON.parse(initial.faceEmbedding) : null);
    const [embeddingStatus, setEmbeddingStatus] = useState<"idle" | "loading" | "success" | "error">(initial?.faceEmbedding ? "success" : "idle");
    const photoInputRef = useRef<HTMLInputElement>(null);
    const sigInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    // Auto-generate face embedding when photo changes
    const processPhoto = useCallback(async (base64: string) => {
        if (!base64) {
            setFaceEmbedding(null);
            setEmbeddingStatus("idle");
            return;
        }
        setEmbeddingStatus("loading");
        try {
            console.log("[FaceEmbed] Carregando modelos...");
            await loadFaceModels();
            console.log("[FaceEmbed] Modelos carregados. Gerando embedding...");
            const emb = await generateFaceEmbedding(base64);
            if (emb) {
                setFaceEmbedding(emb);
                setEmbeddingStatus("success");
                console.log("[FaceEmbed] Embedding gerado com sucesso:", emb.length, "dimensões");
                toast({ title: "Rosto detectado com sucesso!", description: "Vetor facial de 128 dimensões gerado" });
            } else {
                setFaceEmbedding(null);
                setEmbeddingStatus("error");
                console.warn("[FaceEmbed] Nenhum rosto detectado na imagem");
                toast({ title: "Nenhum rosto detectado", description: "Tente outra foto com o rosto bem visível", variant: "destructive" });
            }
        } catch (err) {
            console.error("[FaceEmbed] Erro ao gerar embedding:", err);
            setFaceEmbedding(null);
            setEmbeddingStatus("error");
            toast({ title: "Erro na detecção facial", description: String(err), variant: "destructive" });
        }
    }, []);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: (v: string) => void, isPhoto = false) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            setter(result);
            if (isPhoto) processPhoto(result);
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = () => {
        if (!name.trim() || !role) return;
        onSubmit({
            name: name.trim(),
            role,
            phone,
            photoBase64: photoPreview || null,
            signatureBase64: signaturePreview || null,
            faceEmbedding: faceEmbedding ? JSON.stringify(faceEmbedding) : null,
        });
    };

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <Label className="text-sm font-medium">Nome *</Label>
                    <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nome completo" className="mt-1" />
                </div>
                <div>
                    <Label className="text-sm font-medium">Cargo *</Label>
                    <select value={role} onChange={e => setRole(e.target.value)} className="mt-1 w-full h-10 px-3 rounded-md border border-gray-200 bg-white text-sm">
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                </div>
            </div>
            <div>
                <Label className="text-sm font-medium">Telefone</Label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(xx) xxxxx-xxxx" className="mt-1" />
            </div>

            {/* Photo */}
            <div>
                <Label className="text-sm font-medium mb-2 block">Foto do Rosto</Label>
                <div className="flex items-center gap-3">
                    {photoPreview ? (
                        <div className="relative">
                            <img src={photoPreview} alt="Foto" className="w-24 h-24 rounded-xl object-cover border-2 border-emerald-200" />
                            <button onClick={() => { setPhotoPreview(""); setFaceEmbedding(null); setEmbeddingStatus("idle"); }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                                <X className="h-3 w-3" />
                            </button>
                            {embeddingStatus === "loading" && (
                                <div className="absolute bottom-0 left-0 right-0 bg-amber-500/90 text-white text-[9px] text-center py-0.5 rounded-b-xl">
                                    <Loader2 className="h-3 w-3 animate-spin inline mr-1" />Detectando...
                                </div>
                            )}
                            {embeddingStatus === "success" && (
                                <div className="absolute bottom-0 left-0 right-0 bg-emerald-600/90 text-white text-[9px] text-center py-0.5 rounded-b-xl flex items-center justify-center gap-1">
                                    <CheckCircle className="h-3 w-3" /> Rosto detectado
                                </div>
                            )}
                            {embeddingStatus === "error" && (
                                <div className="absolute bottom-0 left-0 right-0 bg-red-600/90 text-white text-[9px] text-center py-0.5 rounded-b-xl flex items-center justify-center gap-1">
                                    <AlertCircle className="h-3 w-3" /> Rosto não encontrado
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50">
                            <Users className="h-8 w-8 text-gray-300" />
                        </div>
                    )}
                    <div className="flex flex-col gap-2">
                        <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="user" onChange={e => handleImageUpload(e, setPhotoPreview, true)} />
                        <Button type="button" variant="outline" size="sm" onClick={() => cameraInputRef.current?.click()} className="text-xs">
                            <Camera className="h-3.5 w-3.5 mr-1.5" /> Tirar Foto
                        </Button>
                        <input type="file" ref={photoInputRef} className="hidden" accept="image/*" onChange={e => handleImageUpload(e, setPhotoPreview, true)} />
                        <Button type="button" variant="outline" size="sm" onClick={() => photoInputRef.current?.click()} className="text-xs">
                            <Image className="h-3.5 w-3.5 mr-1.5" /> Galeria
                        </Button>
                    </div>
                </div>
            </div>

            {/* Signature */}
            <div>
                <Label className="text-sm font-medium mb-2 block">Assinatura (foto do papel assinado)</Label>
                <div className="flex items-center gap-3">
                    {signaturePreview ? (
                        <div className="relative">
                            <img src={signaturePreview} alt="Assinatura" className="h-20 max-w-[200px] rounded-lg border-2 border-emerald-200 object-contain bg-white p-1" />
                            <button onClick={() => setSignaturePreview("")} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                                <X className="h-3 w-3" />
                            </button>
                        </div>
                    ) : (
                        <div className="h-20 w-[200px] rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50">
                            <span className="text-gray-300 text-sm italic">Assinatura</span>
                        </div>
                    )}
                    <div className="flex flex-col gap-2">
                        <input type="file" ref={sigInputRef} className="hidden" accept="image/*" capture="environment" onChange={e => handleImageUpload(e, setSignaturePreview)} />
                        <Button type="button" variant="outline" size="sm" onClick={() => sigInputRef.current?.click()} className="text-xs">
                            <Camera className="h-3.5 w-3.5 mr-1.5" /> Fotografar
                        </Button>
                    </div>
                </div>
            </div>

            <Button onClick={handleSubmit} disabled={isPending || !name.trim() || !role} className="w-full bg-emerald-600 hover:bg-emerald-700">
                {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {initial ? "Salvar Alterações" : "Cadastrar Funcionário"}
            </Button>
        </div>
    );
}

export default function FarmEmployees() {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [openNew, setOpenNew] = useState(false);
    const [editItem, setEditItem] = useState<any>(null);
    const [search, setSearch] = useState("");

    const { data: employees = [], isLoading } = useQuery({
        queryKey: ["/api/farm/employees"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/employees"); return r.json(); },
    });

    const createMut = useMutation({
        mutationFn: async (data: any) => { const r = await apiRequest("POST", "/api/farm/employees", data); return r.json(); },
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/farm/employees"] }); setOpenNew(false); toast({ title: "Funcionário cadastrado!" }); },
        onError: () => { toast({ title: "Erro ao cadastrar", variant: "destructive" }); },
    });

    const updateMut = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: any }) => { const r = await apiRequest("PUT", `/api/farm/employees/${id}`, data); return r.json(); },
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/farm/employees"] }); setEditItem(null); toast({ title: "Funcionário atualizado!" }); },
        onError: () => { toast({ title: "Erro ao atualizar", variant: "destructive" }); },
    });

    const deleteMut = useMutation({
        mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/farm/employees/${id}`); },
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/farm/employees"] }); toast({ title: "Funcionário removido" }); },
    });

    const filtered = employees.filter((e: any) =>
        e.name?.toLowerCase().includes(search.toLowerCase()) ||
        e.role?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <FarmLayout>
            <div className="space-y-6 p-4 lg:p-8 max-w-5xl mx-auto">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-emerald-800">Funcionários</h1>
                        <p className="text-emerald-600 text-sm">Cadastro de funcionários para comprovantes de abastecimento</p>
                    </div>
                    <Button onClick={() => setOpenNew(true)} className="bg-emerald-600 hover:bg-emerald-700">
                        <Plus className="mr-2 h-4 w-4" /> Novo Funcionário
                    </Button>
                </div>

                {/* Search */}
                <div className="relative max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input className="pl-10" placeholder="Buscar funcionário..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
                ) : filtered.length === 0 ? (
                    <Card className="border-emerald-100"><CardContent className="py-12 text-center">
                        <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">Nenhum funcionário cadastrado</p>
                    </CardContent></Card>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filtered.map((emp: any) => (
                            <Card key={emp.id} className="border-emerald-100 overflow-hidden hover:shadow-md transition-shadow">
                                <CardContent className="p-0">
                                    <div className="flex items-center gap-4 p-4">
                                        {emp.photoBase64 ? (
                                            <img src={emp.photoBase64} alt={emp.name} className="w-16 h-16 rounded-full object-cover border-2 border-emerald-200 shrink-0" />
                                        ) : (
                                            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                                                <Users className="h-7 w-7 text-emerald-400" />
                                            </div>
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <h3 className="font-semibold text-gray-900 truncate">{emp.name}</h3>
                                            <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 mt-1">{emp.role}</span>
                                            {emp.phone && (
                                                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                                    <Phone className="h-3 w-3" /> {emp.phone}
                                                </p>
                                            )}
                                        </div>
                                        <div className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${emp.status === "Ativo" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                                            {emp.status}
                                        </div>
                                    </div>

                                    {/* Face embedding + Signature */}
                                    <div className="px-4 pb-2 space-y-2">
                                        {/* Face embedding badge */}
                                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${emp.faceEmbedding ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-600"}`}>
                                            <ScanFace className="h-4 w-4" />
                                            {emp.faceEmbedding ? "Vetor facial cadastrado" : "Sem vetor facial — edite e reenvie a foto"}
                                        </div>

                                        {/* Signature preview */}
                                        {emp.signatureBase64 && (
                                            <div className="bg-gray-50 rounded-lg p-2 border border-gray-100">
                                                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Assinatura</p>
                                                <img src={emp.signatureBase64} alt="Assinatura" className="h-12 object-contain" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex border-t border-gray-100">
                                        <button
                                            onClick={() => setEditItem(emp)}
                                            className="flex-1 py-2.5 text-xs font-medium text-amber-600 hover:bg-amber-50 transition-colors flex items-center justify-center gap-1.5"
                                        >
                                            <Edit2 className="h-3.5 w-3.5" /> Editar
                                        </button>
                                        <div className="w-px bg-gray-100" />
                                        <button
                                            onClick={() => { if (confirm(`Remover "${emp.name}"?`)) deleteMut.mutate(emp.id); }}
                                            className="flex-1 py-2.5 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors flex items-center justify-center gap-1.5"
                                            disabled={deleteMut.isPending}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" /> Remover
                                        </button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                {/* New Dialog */}
                <Dialog open={openNew} onOpenChange={setOpenNew}>
                    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Novo Funcionário</DialogTitle>
                        </DialogHeader>
                        <EmployeeForm onSubmit={data => createMut.mutate(data)} isPending={createMut.isPending} />
                    </DialogContent>
                </Dialog>

                {/* Edit Dialog */}
                <Dialog open={!!editItem} onOpenChange={open => { if (!open) setEditItem(null); }}>
                    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Editar Funcionário</DialogTitle>
                        </DialogHeader>
                        {editItem && <EmployeeForm initial={editItem} onSubmit={data => updateMut.mutate({ id: editItem.id, data })} isPending={updateMut.isPending} />}
                    </DialogContent>
                </Dialog>
            </div>
        </FarmLayout>
    );
}
