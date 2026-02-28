import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, BarChart3, Target, TrendingUp } from "lucide-react";

export default function PdvLogin() {
    const [, setLocation] = useLocation();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const enterFullscreen = () => {
        try {
            const el = document.documentElement;
            if (el.requestFullscreen) {
                el.requestFullscreen().catch(() => { });
            } else if ((el as any).webkitRequestFullscreen) {
                (el as any).webkitRequestFullscreen();
            }
        } catch { }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await apiRequest("POST", "/api/pdv/login", { username, password });
            const data = await res.json();
            localStorage.setItem("pdvData", JSON.stringify(data));
            if (data.token) {
                localStorage.setItem("pdvToken", data.token);
                localStorage.setItem("pdvTerminalId", data.terminal.id);
            }
            toast({ title: `Terminal ${data.terminal.name} conectado` });
            // Small delay to let the session persist before navigating
            setTimeout(() => {
                enterFullscreen();
                setLocation("/pdv");
            }, 200);
        } catch (err) {
            toast({
                title: "Erro no login",
                description: "Credenciais inválidas",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const checkAutoLogin = async () => {
            const token = localStorage.getItem("pdvToken");
            const terminalId = localStorage.getItem("pdvTerminalId");
            if (token && terminalId) {
                setLoading(true);
                try {
                    const res = await apiRequest("POST", "/api/pdv/auto-login", { token, terminalId });
                    if (res.ok) {
                        const data = await res.json();
                        localStorage.setItem("pdvData", JSON.stringify(data));
                        toast({ title: `Sessão restaurada: ${data.terminal.name}` });
                        setTimeout(() => {
                            enterFullscreen();
                            setLocation("/pdv");
                        }, 200);
                    } else {
                        // Token invalid/expired, clear it
                        localStorage.removeItem("pdvToken");
                        localStorage.removeItem("pdvTerminalId");
                    }
                } catch (e) {
                    // Could be completely offline, fallback to cached data in terminal.tsx
                    // terminal.tsx handles offline gracefully
                    setLocation("/pdv");
                } finally {
                    setLoading(false);
                }
            }
        };

        checkAutoLogin();
    }, []);

    return (
        <div className="min-h-screen flex">
            {/* Left side — Login form */}
            <div className="flex-1 flex items-center justify-center bg-white p-8">
                <div className="w-full max-w-sm">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 rounded-2xl bg-amber-400 flex items-center justify-center text-3xl mx-auto mb-4 shadow-md">
                            🌿
                        </div>
                        <h1 className="text-2xl font-bold text-gray-800">PDV Depósito</h1>
                        <p className="text-gray-400 text-sm mt-1">Controle de saída de produtos</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-5">
                        <div className="space-y-1.5">
                            <Label className="text-gray-700 text-sm font-medium">Usuário</Label>
                            <Input
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="seu.usuario"
                                required
                                autoFocus
                                className="h-11 bg-white border-gray-200 text-gray-800 placeholder:text-gray-300 rounded-lg"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-gray-700 text-sm font-medium">Senha</Label>
                            <Input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                className="h-11 bg-white border-gray-200 text-gray-800 placeholder:text-gray-300 rounded-lg"
                            />
                        </div>
                        <Button
                            type="submit"
                            className="w-full h-11 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg text-base"
                            disabled={loading}
                        >
                            {loading ? (
                                <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Conectando...</>
                            ) : (
                                "Entrar"
                            )}
                        </Button>
                    </form>
                </div>
            </div>

            {/* Right side — Green gradient banner */}
            <div className="hidden lg:flex flex-1 bg-gradient-to-br from-emerald-400 via-emerald-500 to-green-600 p-12 flex-col justify-center text-white relative overflow-hidden">
                {/* Decorative circles */}
                <div className="absolute top-[-80px] right-[-80px] w-64 h-64 rounded-full bg-white/10" />
                <div className="absolute bottom-[-60px] left-[-40px] w-48 h-48 rounded-full bg-white/5" />

                <div className="relative z-10 max-w-md">
                    <span className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm text-white text-xs font-medium px-3 py-1.5 rounded-full mb-6">
                        ✨ Digital para o Campo
                    </span>
                    <h2 className="text-4xl font-bold leading-tight mb-4">
                        Controle total do seu depósito
                    </h2>
                    <p className="text-emerald-100 text-base leading-relaxed mb-8">
                        Gerencie saída de produtos, acompanhe estoque em tempo real e distribua insumos com tecnologia de ponta.
                    </p>

                    <div className="space-y-3">
                        {[
                            { icon: BarChart3, title: "Estoque em Tempo Real", desc: "Acompanhe entradas e saídas automaticamente" },
                            { icon: Target, title: "Distribuição Inteligente", desc: "Calcule dose por hectare automaticamente" },
                            { icon: TrendingUp, title: "Rastreabilidade", desc: "Histórico completo de aplicações por talhão" },
                        ].map(({ icon: Icon, title, desc }) => (
                            <div key={title} className="flex items-start gap-3 bg-white/15 backdrop-blur-sm rounded-xl p-3">
                                <div className="w-9 h-9 rounded-lg bg-amber-400 flex items-center justify-center shrink-0">
                                    <Icon className="h-4 w-4 text-white" />
                                </div>
                                <div>
                                    <p className="font-semibold text-sm">{title}</p>
                                    <p className="text-emerald-100 text-xs">{desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
