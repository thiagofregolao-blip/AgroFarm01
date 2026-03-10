import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import EmpresaLayout from "@/components/empresa/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { UserCircle, Building2, Loader2, Save, Mail, Eye, Edit3 } from "lucide-react";

const DEFAULT_EMAIL_BODY = `Olá,

O pedido {{numero_pedido}} do cliente {{cliente}} foi aprovado por {{diretor}} e está pronto para faturamento.

Valor total: {{moeda}} {{valor_total}}

Segue o PDF do pedido em anexo.

AgroFarm Digital`;

const VARIABLES = [
    { label: "Nº Pedido", value: "{{numero_pedido}}" },
    { label: "Cliente", value: "{{cliente}}" },
    { label: "Diretor", value: "{{diretor}}" },
    { label: "Valor Total", value: "{{valor_total}}" },
    { label: "Moeda", value: "{{moeda}}" },
];

function renderPreview(template: string) {
    return template
        .replace(/\{\{numero_pedido\}\}/g, "ORD-2026-0042")
        .replace(/\{\{cliente\}\}/g, "João da Silva Agricultura")
        .replace(/\{\{diretor\}\}/g, "Carlos Mendes")
        .replace(/\{\{valor_total\}\}/g, "12.500,00")
        .replace(/\{\{moeda\}\}/g, "U$");
}

export default function EmpresaPerfil() {
    const { user } = useAuth();
    const { toast } = useToast();

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    // Director email settings
    const [faturistaEmail, setFaturistaEmail] = useState("");
    const [emailBodyTemplate, setEmailBodyTemplate] = useState(DEFAULT_EMAIL_BODY);
    const [previewMode, setPreviewMode] = useState(false);

    const { data: company } = useQuery<any>({
        queryKey: ["/api/company/me"],
        queryFn: () => fetch("/api/company/me", { credentials: "include" }).then(r => r.json()),
        enabled: !!user,
    });

    const isDirector = company?.role === "director" || company?.role === "admin_empresa";

    const { data: directorSettings } = useQuery<any>({
        queryKey: ["/api/company/profile/director-settings"],
        queryFn: () => fetch("/api/company/profile/director-settings", { credentials: "include" }).then(r => r.json()),
        enabled: !!user && isDirector,
    });

    useEffect(() => {
        if (user) {
            setName(user.name ?? "");
            setEmail((user as any).email ?? "");
        }
    }, [user]);

    useEffect(() => {
        if (directorSettings) {
            setFaturistaEmail(directorSettings.faturistaEmail ?? "");
            setEmailBodyTemplate(directorSettings.emailBodyTemplate || DEFAULT_EMAIL_BODY);
        }
    }, [directorSettings]);

    const updateProfile = useMutation({
        mutationFn: async () => {
            if (password && password !== confirmPassword) {
                throw new Error("As senhas não coincidem");
            }
            const body: any = { name, email };
            if (password) body.password = password;
            const r = await fetch("/api/company/profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(body),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Erro ao atualizar perfil");
            return data;
        },
        onSuccess: () => {
            setPassword("");
            setConfirmPassword("");
            toast({ title: "Perfil atualizado com sucesso" });
        },
        onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
    });

    const saveDirectorSettings = useMutation({
        mutationFn: async () => {
            const r = await fetch("/api/company/profile/director-settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ faturistaEmail, emailBodyTemplate }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Erro ao salvar configurações");
            return data;
        },
        onSuccess: () => toast({ title: "Configurações de email salvas" }),
        onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
    });

    const ROLE_LABELS: Record<string, string> = {
        rtv: "RTV",
        director: "Diretor",
        faturista: "Faturista",
        financeiro: "Financeiro",
        admin_empresa: "Admin Empresa",
    };

    const insertVariable = (v: string) => {
        setEmailBodyTemplate(prev => prev + v);
    };

    return (
        <EmpresaLayout>
            <div className="p-6 max-w-2xl space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Meu Perfil</h1>
                    <p className="text-slate-500 text-sm">Gerencie seus dados pessoais e senha de acesso.</p>
                </div>

                {/* Info da empresa */}
                {company && (
                    <Card className="bg-blue-50 border-blue-200">
                        <CardContent className="p-4 flex items-center gap-3">
                            <Building2 className="h-8 w-8 text-blue-600 flex-shrink-0" />
                            <div>
                                <p className="font-semibold text-blue-900">{company.name}</p>
                                <p className="text-blue-600 text-sm">
                                    Cargo: <strong>{ROLE_LABELS[company.role] ?? company.role}</strong>
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Dados pessoais */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <UserCircle className="h-5 w-5" /> Dados Pessoais
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label>Usuário (login)</Label>
                            <Input value={user?.username ?? ""} disabled className="bg-slate-50 text-slate-500" />
                            <p className="text-xs text-slate-400 mt-1">O nome de usuário não pode ser alterado.</p>
                        </div>
                        <div>
                            <Label>Nome completo</Label>
                            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome completo" />
                        </div>
                        <div>
                            <Label>E-mail</Label>
                            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" />
                        </div>
                    </CardContent>
                </Card>

                {/* Alterar senha */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Alterar Senha</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label>Nova senha</Label>
                            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Deixe em branco para não alterar" />
                        </div>
                        <div>
                            <Label>Confirmar nova senha</Label>
                            <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repita a nova senha" />
                        </div>
                    </CardContent>
                </Card>

                <Button
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    disabled={!name || updateProfile.isPending}
                    onClick={() => updateProfile.mutate()}
                >
                    {updateProfile.isPending
                        ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        : <Save className="h-4 w-4 mr-2" />
                    }
                    Salvar Alterações
                </Button>

                {/* ── Seção Diretor: configurações de email ── */}
                {isDirector && (
                    <>
                        <div className="border-t pt-6">
                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <Mail className="h-5 w-5 text-blue-600" />
                                Configurações de Email — Aprovação de Pedidos
                            </h2>
                            <p className="text-slate-500 text-sm mt-1">
                                Quando você aprovar um pedido, o sistema enviará automaticamente um PDF para o faturista.
                            </p>
                        </div>

                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Mail className="h-4 w-4" /> Email do Faturista
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Label>Endereço de email</Label>
                                <Input
                                    type="email"
                                    value={faturistaEmail}
                                    onChange={e => setFaturistaEmail(e.target.value)}
                                    placeholder="faturista@empresa.com"
                                    className="mt-1"
                                />
                                <p className="text-xs text-slate-400 mt-1">
                                    O PDF do pedido aprovado será enviado para este endereço.
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Edit3 className="h-4 w-4" /> Mensagem do Email
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Variable chips */}
                                <div>
                                    <p className="text-xs font-medium text-slate-600 mb-2">Clique para inserir variável no texto:</p>
                                    <div className="flex flex-wrap gap-2">
                                        {VARIABLES.map(v => (
                                            <Badge
                                                key={v.value}
                                                variant="secondary"
                                                className="cursor-pointer hover:bg-blue-100 hover:text-blue-800 transition-colors select-none"
                                                onClick={() => insertVariable(v.value)}
                                            >
                                                {v.label}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>

                                {/* Toggle edit / preview */}
                                <div className="flex gap-2">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant={!previewMode ? "default" : "outline"}
                                        onClick={() => setPreviewMode(false)}
                                        className="flex items-center gap-1"
                                    >
                                        <Edit3 className="h-3.5 w-3.5" /> Editar
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant={previewMode ? "default" : "outline"}
                                        onClick={() => setPreviewMode(true)}
                                        className="flex items-center gap-1"
                                    >
                                        <Eye className="h-3.5 w-3.5" /> Preview
                                    </Button>
                                </div>

                                {!previewMode ? (
                                    <Textarea
                                        value={emailBodyTemplate}
                                        onChange={e => setEmailBodyTemplate(e.target.value)}
                                        rows={10}
                                        className="font-mono text-sm"
                                        placeholder="Digite o corpo do email..."
                                    />
                                ) : (
                                    <div className="border rounded-md bg-slate-50 p-4 min-h-[200px]">
                                        <div className="text-xs text-slate-400 mb-3 pb-2 border-b">
                                            Preview com dados de exemplo
                                        </div>
                                        <pre className="text-sm text-slate-800 whitespace-pre-wrap font-sans">
                                            {renderPreview(emailBodyTemplate)}
                                        </pre>
                                        <div className="mt-4 pt-3 border-t border-dashed">
                                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                                <div className="w-8 h-8 bg-red-100 rounded flex items-center justify-center text-red-600 font-bold text-xs">PDF</div>
                                                <span>Pedido-ORD-2026-0042.pdf <span className="text-slate-400">(anexo gerado automaticamente)</span></span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <Button
                                    className="w-full bg-blue-600 hover:bg-blue-700"
                                    disabled={saveDirectorSettings.isPending}
                                    onClick={() => saveDirectorSettings.mutate()}
                                >
                                    {saveDirectorSettings.isPending
                                        ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        : <Save className="h-4 w-4 mr-2" />
                                    }
                                    Salvar Configurações de Email
                                </Button>
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>
        </EmpresaLayout>
    );
}
