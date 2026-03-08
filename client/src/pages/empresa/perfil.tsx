import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import EmpresaLayout from "@/components/empresa/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { UserCircle, Building2, Loader2, Save } from "lucide-react";

export default function EmpresaPerfil() {
    const { user } = useAuth();
    const { toast } = useToast();

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const { data: company } = useQuery<any>({
        queryKey: ["/api/company/me"],
        queryFn: () => fetch("/api/company/me", { credentials: "include" }).then(r => r.json()),
        enabled: !!user,
    });

    useEffect(() => {
        if (user) {
            setName(user.name ?? "");
            setEmail((user as any).email ?? "");
        }
    }, [user]);

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

    const ROLE_LABELS: Record<string, string> = {
        rtv: "RTV",
        director: "Diretor",
        faturista: "Faturista",
        financeiro: "Financeiro",
        admin_empresa: "Admin Empresa",
    };

    return (
        <EmpresaLayout>
            <div className="p-6 max-w-xl space-y-6">
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
            </div>
        </EmpresaLayout>
    );
}
