import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import FarmLayout from "@/components/fazenda/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useToast, toast } from "@/hooks/use-toast";
import { Plus, Edit2, Trash2, Loader2, Users, Camera, Image, Phone, Search, X, CheckCircle, AlertCircle, ScanFace, Shield, Eye, Pencil, KeyRound } from "lucide-react";
import { loadFaceModels, generateFaceEmbedding } from "@/lib/face-recognition";
import { useAccessLevel } from "@/hooks/use-access-level";
import { useAuth } from "@/hooks/use-auth";

const ROLES = ["Gerente", "Operador", "Tratorista", "Motorista", "Mecânico", "Auxiliar", "Encarregado", "Outro"];
const FORM_STORAGE_KEY = "employee_form_state";

const AVAILABLE_MODULES = [
    { key: "dashboard", label: "Inicio/Dashboard" },
    { key: "properties", label: "Propriedades" },
    { key: "seasons", label: "Safras" },
    { key: "invoices", label: "Faturas" },
    { key: "stock", label: "Estoque" },
    { key: "fleet", label: "Frota" },
    { key: "applications", label: "Aplicacoes" },
    { key: "plot_costs", label: "Custo/Talhao" },
    { key: "expenses", label: "Despesas" },
    { key: "cash_flow", label: "Fluxo de Caixa" },
    { key: "terminals", label: "Terminais PDV" },
    { key: "field_notebook", label: "Caderno de Campo" },
    { key: "quotations", label: "Cotacoes" },
    { key: "ndvi", label: "NDVI Satelite" },
    { key: "weather", label: "Clima" },
    { key: "reports", label: "Relatorios" },
    { key: "romaneios", label: "Romaneios" },
    { key: "accounts_payable", label: "Contas a Pagar" },
    { key: "accounts_receivable", label: "Contas a Receber" },
    { key: "loans", label: "Préstamos" },
    { key: "dre", label: "DRE / Resultado" },
    { key: "budget", label: "Orcamento por Safra" },
    { key: "reconciliation", label: "Conciliacao Bancaria" },
    { key: "employees", label: "Funcionarios" },
    { key: "suppliers", label: "Empresas e Pessoas" },
    { key: "productivity", label: "Produtividade" },
];

function EmployeeForm({ initial, onSubmit, isPending, restoredState }: { initial?: any; onSubmit: (data: any) => void; isPending: boolean; restoredState?: { name: string; role: string; phone: string } | null }) {
    const [name, setName] = useState(restoredState?.name || initial?.name || "");
    const [role, setRole] = useState(restoredState?.role || initial?.role || "Operador");
    const [phone, setPhone] = useState(restoredState?.phone || initial?.phone || "");
    const [photoPreview, setPhotoPreview] = useState<string>(initial?.photoBase64 || "");
    const [signaturePreview, setSignaturePreview] = useState<string>(initial?.signatureBase64 || "");
    const [faceEmbedding, setFaceEmbedding] = useState<number[] | null>(initial?.faceEmbedding ? JSON.parse(initial.faceEmbedding) : null);
    const [embeddingStatus, setEmbeddingStatus] = useState<"idle" | "loading" | "success" | "error">(initial?.faceEmbedding ? "success" : "idle");
    const photoInputRef = useRef<HTMLInputElement>(null);
    const sigInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    // Save form state to sessionStorage before camera opens (Android kills tab)
    const saveFormBeforeCamera = useCallback(() => {
        try {
            sessionStorage.setItem(FORM_STORAGE_KEY, JSON.stringify({
                name, role, phone,
                editId: initial?.id || null,
                timestamp: Date.now()
            }));
        } catch {}
    }, [name, role, phone, initial?.id]);

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
                console.log("[FaceEmbed] Embedding gerado com sucesso:", emb.length, "dimensoes");
                toast({ title: "Rosto detectado com sucesso!", description: "Vetor facial de 128 dimensoes gerado" });
            } else {
                setFaceEmbedding(null);
                setEmbeddingStatus("error");
                console.warn("[FaceEmbed] Nenhum rosto detectado na imagem");
                toast({ title: "Nenhum rosto detectado", description: "Tente outra foto com o rosto bem visivel", variant: "destructive" });
            }
        } catch (err) {
            console.error("[FaceEmbed] Erro ao gerar embedding:", err);
            setFaceEmbedding(null);
            setEmbeddingStatus("error");
            toast({ title: "Erro na deteccao facial", description: String(err), variant: "destructive" });
        }
    }, []);

    // Auto-generate embedding for existing employees with photo but no embedding
    useEffect(() => {
        if (initial?.photoBase64 && !initial?.faceEmbedding && photoPreview && embeddingStatus === "idle") {
            processPhoto(photoPreview);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
                                    <AlertCircle className="h-3 w-3" /> Rosto nao encontrado
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
                        <Button type="button" variant="outline" size="sm" onClick={() => { saveFormBeforeCamera(); cameraInputRef.current?.click(); }} className="text-xs">
                            <Camera className="h-3.5 w-3.5 mr-1.5" /> Tirar Foto
                        </Button>
                        <input type="file" ref={photoInputRef} className="hidden" accept="image/*" onChange={e => handleImageUpload(e, setPhotoPreview, true)} />
                        <Button type="button" variant="outline" size="sm" onClick={() => { saveFormBeforeCamera(); photoInputRef.current?.click(); }} className="text-xs">
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
                        <Button type="button" variant="outline" size="sm" onClick={() => { saveFormBeforeCamera(); sigInputRef.current?.click(); }} className="text-xs">
                            <Camera className="h-3.5 w-3.5 mr-1.5" /> Fotografar
                        </Button>
                    </div>
                </div>
            </div>

            <Button onClick={handleSubmit} disabled={isPending || !name.trim() || !role} className="w-full bg-emerald-600 hover:bg-emerald-700">
                {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {initial ? "Salvar Alteracoes" : "Cadastrar Funcionario"}
            </Button>
        </div>
    );
}

// ==================== ACCESS MANAGEMENT SECTION ====================
function EmployeeAccessSection({ employee, onClose }: { employee: any; onClose: () => void }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [accessEnabled, setAccessEnabled] = useState(!!employee.userId);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [moduleSettings, setModuleSettings] = useState<Record<string, { enabled: boolean; accessLevel: string }>>({});

    // Fetch existing user data if employee has access
    const { data: existingUser } = useQuery({
        queryKey: [`/api/farm/employees/${employee.id}/user-info`],
        queryFn: async () => {
            // We don't have a dedicated endpoint; if userId exists, we know access is enabled
            return employee.userId ? { hasAccess: true } : { hasAccess: false };
        },
        enabled: !!employee.userId,
    });

    // Fetch employee modules
    const { data: employeeModules = [], isLoading: modulesLoading } = useQuery<any[]>({
        queryKey: [`/api/farm/employees/${employee.id}/modules`],
        queryFn: async () => {
            const r = await apiRequest("GET", `/api/farm/employees/${employee.id}/modules`);
            return r.json();
        },
        enabled: !!employee.userId,
    });

    // Initialize module settings from fetched data
    useEffect(() => {
        if (employeeModules.length > 0) {
            const settings: Record<string, { enabled: boolean; accessLevel: string }> = {};
            employeeModules.forEach((m: any) => {
                settings[m.moduleKey] = { enabled: m.enabled, accessLevel: m.accessLevel || 'view' };
            });
            setModuleSettings(settings);
        }
    }, [employeeModules]);

    const enableAccessMut = useMutation({
        mutationFn: async () => {
            const r = await apiRequest("POST", `/api/farm/employees/${employee.id}/enable-access`, { username, password });
            if (!r.ok) {
                const err = await r.json();
                throw new Error(err.error || "Falha ao habilitar acesso");
            }
            return r.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/employees"] });
            toast({ title: "Acesso habilitado com sucesso!" });
        },
        onError: (err: Error) => {
            toast({ title: err.message, variant: "destructive" });
        },
    });

    const disableAccessMut = useMutation({
        mutationFn: async () => {
            const r = await apiRequest("POST", `/api/farm/employees/${employee.id}/disable-access`);
            if (!r.ok) throw new Error("Falha ao desabilitar acesso");
            return r.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/employees"] });
            setAccessEnabled(false);
            toast({ title: "Acesso desabilitado" });
        },
        onError: () => {
            toast({ title: "Erro ao desabilitar acesso", variant: "destructive" });
        },
    });

    const updateModulesMut = useMutation({
        mutationFn: async () => {
            const modules = AVAILABLE_MODULES.map(mod => ({
                moduleKey: mod.key,
                enabled: moduleSettings[mod.key]?.enabled ?? false,
                accessLevel: moduleSettings[mod.key]?.accessLevel ?? 'view',
            }));
            const r = await apiRequest("PUT", `/api/farm/employees/${employee.id}/modules`, { modules });
            if (!r.ok) throw new Error("Falha ao salvar modulos");
            return r.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`/api/farm/employees/${employee.id}/modules`] });
            toast({ title: "Modulos atualizados com sucesso!" });
        },
        onError: () => {
            toast({ title: "Erro ao salvar modulos", variant: "destructive" });
        },
    });

    const toggleModule = (key: string) => {
        setModuleSettings(prev => ({
            ...prev,
            [key]: {
                enabled: !(prev[key]?.enabled ?? false),
                accessLevel: prev[key]?.accessLevel || 'view',
            },
        }));
    };

    const setAccessLevel = (key: string, level: string) => {
        setModuleSettings(prev => ({
            ...prev,
            [key]: {
                enabled: prev[key]?.enabled ?? true,
                accessLevel: level,
            },
        }));
    };

    const selectAll = () => {
        const allSettings: Record<string, { enabled: boolean; accessLevel: string }> = {};
        AVAILABLE_MODULES.forEach(mod => {
            allSettings[mod.key] = { enabled: true, accessLevel: moduleSettings[mod.key]?.accessLevel || 'view' };
        });
        setModuleSettings(allSettings);
    };

    const deselectAll = () => {
        const allSettings: Record<string, { enabled: boolean; accessLevel: string }> = {};
        AVAILABLE_MODULES.forEach(mod => {
            allSettings[mod.key] = { enabled: false, accessLevel: moduleSettings[mod.key]?.accessLevel || 'view' };
        });
        setModuleSettings(allSettings);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                    <h3 className="font-semibold text-gray-900">{employee.name}</h3>
                    <p className="text-sm text-gray-500">Gerenciar acesso ao sistema</p>
                </div>
            </div>

            {/* Access Toggle */}
            {!employee.userId && !accessEnabled ? (
                /* First time enable */
                <div className="space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                        <p className="text-sm text-blue-800 font-medium mb-1">Habilitar acesso ao sistema</p>
                        <p className="text-xs text-blue-600">
                            Crie um login para que este funcionario acesse os modulos da fazenda com permissoes controladas.
                        </p>
                    </div>

                    <div>
                        <Label htmlFor="emp-username" className="text-sm font-medium">Nome de usuario *</Label>
                        <Input
                            id="emp-username"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            placeholder="ex: joao.silva"
                            className="mt-1"
                            autoComplete="off"
                        />
                    </div>
                    <div>
                        <Label htmlFor="emp-password" className="text-sm font-medium">Senha *</Label>
                        <div className="relative mt-1">
                            <Input
                                id="emp-password"
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="Minimo 4 caracteres"
                                autoComplete="new-password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                            >
                                {showPassword ? <X className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                    </div>

                    <Button
                        onClick={() => enableAccessMut.mutate()}
                        disabled={enableAccessMut.isPending || !username.trim() || password.length < 4}
                        className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                        {enableAccessMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <KeyRound className="h-4 w-4 mr-2" />}
                        Criar Acesso
                    </Button>
                </div>
            ) : (
                /* Access already enabled */
                <div className="space-y-5">
                    {/* Status + disable */}
                    <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                        <div className="flex items-center gap-2">
                            <CheckCircle className="h-5 w-5 text-emerald-600" />
                            <span className="text-sm font-medium text-emerald-800">Acesso habilitado</span>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { if (confirm("Deseja desabilitar o acesso deste funcionario ao sistema?")) disableAccessMut.mutate(); }}
                            disabled={disableAccessMut.isPending}
                            className="text-red-600 border-red-200 hover:bg-red-50 cursor-pointer"
                        >
                            {disableAccessMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Desabilitar"}
                        </Button>
                    </div>

                    {/* Update credentials */}
                    <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                        <p className="text-sm font-medium text-gray-700">Alterar credenciais</p>
                        <div>
                            <Label htmlFor="emp-username-edit" className="text-xs text-gray-500">Nome de usuario</Label>
                            <Input
                                id="emp-username-edit"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                placeholder="Novo username (deixe vazio para manter)"
                                className="mt-1"
                                autoComplete="off"
                            />
                        </div>
                        <div>
                            <Label htmlFor="emp-password-edit" className="text-xs text-gray-500">Nova senha</Label>
                            <Input
                                id="emp-password-edit"
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="Nova senha (deixe vazio para manter)"
                                autoComplete="new-password"
                                className="mt-1"
                            />
                        </div>
                        {(username.trim() || password) && (
                            <Button
                                size="sm"
                                onClick={() => enableAccessMut.mutate()}
                                disabled={enableAccessMut.isPending || (password.length > 0 && password.length < 4)}
                                className="bg-blue-600 hover:bg-blue-700"
                            >
                                {enableAccessMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                                Atualizar Credenciais
                            </Button>
                        )}
                    </div>

                    {/* Module Permissions */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-gray-800">Modulos permitidos</p>
                            <div className="flex gap-2">
                                <button onClick={selectAll} className="text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer">
                                    Todos
                                </button>
                                <span className="text-gray-300">|</span>
                                <button onClick={deselectAll} className="text-xs text-gray-500 hover:text-gray-700 font-medium cursor-pointer">
                                    Nenhum
                                </button>
                            </div>
                        </div>

                        {modulesLoading ? (
                            <div className="flex justify-center py-6">
                                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                            </div>
                        ) : (
                            <div className="space-y-1 max-h-[40vh] overflow-y-auto border border-gray-200 rounded-xl">
                                {AVAILABLE_MODULES.map(mod => {
                                    const isChecked = moduleSettings[mod.key]?.enabled ?? false;
                                    const level = moduleSettings[mod.key]?.accessLevel || 'view';
                                    return (
                                        <div
                                            key={mod.key}
                                            className={`flex items-center justify-between px-4 py-3 border-b border-gray-100 last:border-b-0 transition-colors ${isChecked ? "bg-blue-50/50" : ""}`}
                                        >
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <Switch
                                                    checked={isChecked}
                                                    onCheckedChange={() => toggleModule(mod.key)}
                                                    aria-label={`Habilitar modulo ${mod.label}`}
                                                />
                                                <span className={`text-sm truncate ${isChecked ? "text-gray-900 font-medium" : "text-gray-500"}`}>
                                                    {mod.label}
                                                </span>
                                            </div>
                                            {isChecked && (
                                                <select
                                                    value={level}
                                                    onChange={e => setAccessLevel(mod.key, e.target.value)}
                                                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 ml-2 cursor-pointer min-h-[36px]"
                                                    aria-label={`Nivel de acesso para ${mod.label}`}
                                                >
                                                    <option value="view">Visualizar</option>
                                                    <option value="edit">Visualizar + Editar</option>
                                                </select>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        <Button
                            onClick={() => updateModulesMut.mutate()}
                            disabled={updateModulesMut.isPending}
                            className="w-full bg-emerald-600 hover:bg-emerald-700"
                        >
                            {updateModulesMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                            Salvar Modulos
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function FarmEmployees() {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { user } = useAuth();
    const { canEdit } = useAccessLevel("employees");
    const [openNew, setOpenNew] = useState(false);
    const [editItem, setEditItem] = useState<any>(null);
    const [accessItem, setAccessItem] = useState<any>(null);
    const [search, setSearch] = useState("");
    const [restoredFormState, setRestoredFormState] = useState<{ name: string; role: string; phone: string; editId: string | null } | null>(null);

    // Only farmers/admins can manage employee access (not other employees)
    const canManageAccess = user?.role === 'agricultor' || user?.role === 'administrador' || user?.role === 'admin_agricultor';

    // Restore form state after Android camera kills the browser tab
    useEffect(() => {
        try {
            const saved = sessionStorage.getItem(FORM_STORAGE_KEY);
            if (!saved) return;
            const state = JSON.parse(saved);
            // Only restore if saved less than 5 minutes ago
            if (state.timestamp && Date.now() - state.timestamp < 5 * 60 * 1000) {
                setRestoredFormState({ name: state.name, role: state.role, phone: state.phone, editId: state.editId });
                if (state.editId) {
                    // Will set editItem once employees load
                } else {
                    setOpenNew(true);
                }
                toast({ title: "Formulario restaurado", description: "Continue de onde parou" });
            }
            sessionStorage.removeItem(FORM_STORAGE_KEY);
        } catch {}
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const { data: employees = [], isLoading } = useQuery({
        queryKey: ["/api/farm/employees"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/employees"); return r.json(); },
    });

    // Restore edit mode once employees load
    useEffect(() => {
        if (restoredFormState?.editId && employees.length > 0 && !editItem) {
            const emp = employees.find((e: any) => e.id === restoredFormState.editId);
            if (emp) setEditItem(emp);
        }
    }, [employees, restoredFormState]); // eslint-disable-line react-hooks/exhaustive-deps

    const clearRestoredState = useCallback(() => {
        setRestoredFormState(null);
        try { sessionStorage.removeItem(FORM_STORAGE_KEY); } catch {}
    }, []);

    const createMut = useMutation({
        mutationFn: async (data: any) => { const r = await apiRequest("POST", "/api/farm/employees", data); return r.json(); },
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/farm/employees"] }); setOpenNew(false); clearRestoredState(); toast({ title: "Funcionario cadastrado!" }); },
        onError: () => { toast({ title: "Erro ao cadastrar", variant: "destructive" }); },
    });

    const updateMut = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: any }) => { const r = await apiRequest("PUT", `/api/farm/employees/${id}`, data); return r.json(); },
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/farm/employees"] }); setEditItem(null); clearRestoredState(); toast({ title: "Funcionario atualizado!" }); },
        onError: () => { toast({ title: "Erro ao atualizar", variant: "destructive" }); },
    });

    const deleteMut = useMutation({
        mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/farm/employees/${id}`); },
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/farm/employees"] }); toast({ title: "Funcionario removido" }); },
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
                        <h1 className="text-2xl font-bold text-emerald-800">Funcionarios</h1>
                        <p className="text-emerald-600 text-sm">Cadastro de funcionarios para comprovantes de abastecimento</p>
                    </div>
                    {canEdit && (
                        <Button onClick={() => setOpenNew(true)} className="bg-emerald-600 hover:bg-emerald-700">
                            <Plus className="mr-2 h-4 w-4" /> Novo Funcionario
                        </Button>
                    )}
                </div>

                {/* Search */}
                <div className="relative max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input className="pl-10" placeholder="Buscar funcionario..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
                ) : filtered.length === 0 ? (
                    <Card className="border-emerald-100"><CardContent className="py-12 text-center">
                        <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">Nenhum funcionario cadastrado</p>
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

                                    {/* Face embedding + Signature + Access badge */}
                                    <div className="px-4 pb-2 space-y-2">
                                        {/* Face embedding badge */}
                                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${emp.faceEmbedding ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-600"}`}>
                                            <ScanFace className="h-4 w-4" />
                                            {emp.faceEmbedding ? "Vetor facial cadastrado" : "Sem vetor facial"}
                                        </div>

                                        {/* Access badge */}
                                        {emp.userId && (
                                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-blue-50 border-blue-200 text-xs font-medium text-blue-700">
                                                <Shield className="h-4 w-4" />
                                                Acesso ao sistema habilitado
                                            </div>
                                        )}

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
                                        {canEdit && (
                                            <>
                                                <button
                                                    onClick={() => setEditItem(emp)}
                                                    className="flex-1 py-2.5 text-xs font-medium text-amber-600 hover:bg-amber-50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px]"
                                                >
                                                    <Edit2 className="h-3.5 w-3.5" /> Editar
                                                </button>
                                                <div className="w-px bg-gray-100" />
                                            </>
                                        )}
                                        {canManageAccess && (
                                            <>
                                                <button
                                                    onClick={() => setAccessItem(emp)}
                                                    className="flex-1 py-2.5 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px]"
                                                >
                                                    <Shield className="h-3.5 w-3.5" /> Acesso
                                                </button>
                                                <div className="w-px bg-gray-100" />
                                            </>
                                        )}
                                        {canEdit && (
                                            <button
                                                onClick={() => { if (confirm(`Remover "${emp.name}"?`)) deleteMut.mutate(emp.id); }}
                                                className="flex-1 py-2.5 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px]"
                                                disabled={deleteMut.isPending}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" /> Remover
                                            </button>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                {/* New Dialog */}
                <Dialog open={openNew} onOpenChange={open => { setOpenNew(open); if (!open) clearRestoredState(); }}>
                    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Novo Funcionario</DialogTitle>
                        </DialogHeader>
                        <EmployeeForm onSubmit={data => createMut.mutate(data)} isPending={createMut.isPending} restoredState={!restoredFormState?.editId ? restoredFormState : null} />
                    </DialogContent>
                </Dialog>

                {/* Edit Dialog */}
                <Dialog open={!!editItem} onOpenChange={open => { if (!open) { setEditItem(null); clearRestoredState(); } }}>
                    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Editar Funcionario</DialogTitle>
                        </DialogHeader>
                        {editItem && <EmployeeForm initial={editItem} onSubmit={data => updateMut.mutate({ id: editItem.id, data })} isPending={updateMut.isPending} restoredState={restoredFormState?.editId ? restoredFormState : null} />}
                    </DialogContent>
                </Dialog>

                {/* Access Management Dialog */}
                <Dialog open={!!accessItem} onOpenChange={open => { if (!open) setAccessItem(null); }}>
                    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Acesso ao Sistema</DialogTitle>
                        </DialogHeader>
                        {accessItem && <EmployeeAccessSection employee={accessItem} onClose={() => setAccessItem(null)} />}
                    </DialogContent>
                </Dialog>
            </div>
        </FarmLayout>
    );
}
