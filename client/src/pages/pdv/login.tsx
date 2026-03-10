import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Sprout, Loader2, BarChart3, Target, TrendingUp, Package, ShieldCheck } from "lucide-react";

// ─── Glassmorphism benefit card (same pattern as auth-page) ────────────────
function GlassCard({ icon: Icon, title, description, metric, metricLabel }: {
    icon: React.ElementType;
    title: string;
    description: string;
    metric?: string;
    metricLabel?: string;
}) {
    return (
        <div className="flex items-start gap-4 p-5 rounded-2xl border border-white/20 bg-white/10 backdrop-blur-md shadow-[0_4px_24px_rgba(0,0,0,0.08)] transition-transform duration-200 hover:-translate-y-0.5">
            <div className="w-11 h-11 bg-[#F7D601] rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
                <Icon className="w-5 h-5 text-green-700" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-white text-sm leading-tight">{title}</h3>
                    {metric && (
                        <span className="text-xs font-bold text-[#F7D601] whitespace-nowrap">{metric}</span>
                    )}
                </div>
                <p className="text-green-100/80 text-xs mt-1 leading-relaxed">{description}</p>
                {metricLabel && (
                    <p className="text-[#F7D601]/70 text-[11px] mt-1">{metricLabel}</p>
                )}
            </div>
        </div>
    );
}

// ─── Stat pill (same pattern as auth-page) ─────────────────────────────────
function StatPill({ value, label }: { value: string; label: string }) {
    return (
        <div className="flex flex-col items-center px-5 py-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/15">
            <span className="text-xl font-bold text-white tracking-tight">{value}</span>
            <span className="text-[11px] text-green-100/70 mt-0.5 whitespace-nowrap">{label}</span>
        </div>
    );
}

// ─── Main component ─────────────────────────────────────────────────────────
export default function PdvLogin() {
    const [, setLocation] = useLocation();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
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
        setError("");
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
            setTimeout(() => {
                enterFullscreen();
                setLocation("/pdv");
            }, 200);
        } catch {
            setError("Credenciais inválidas. Verifique usuário e senha.");
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
                        localStorage.removeItem("pdvToken");
                        localStorage.removeItem("pdvTerminalId");
                    }
                } catch {
                    // Offline — terminal.tsx handles gracefully
                    setLocation("/pdv");
                } finally {
                    setLoading(false);
                }
            }
        };
        checkAutoLogin();
    }, []);

    return (
        <div className="min-h-screen flex flex-col lg:grid lg:grid-cols-2">

            {/* ── Mobile top bar ───────────────────────────────────────── */}
            <div className="lg:hidden bg-gradient-to-r from-green-800 to-emerald-700 px-6 py-5 flex items-center gap-3">
                <div className="w-10 h-10 bg-[#F7D601] rounded-xl flex items-center justify-center shadow-md flex-shrink-0">
                    <Package className="w-5 h-5 text-green-700" />
                </div>
                <div>
                    <p className="text-white font-bold text-base leading-tight">PDV Depósito</p>
                    <p className="text-green-100/80 text-xs">Controle de saída de produtos</p>
                </div>
            </div>

            {/* ── Left — Form panel ─────────────────────────────────────── */}
            <div className="flex items-center justify-center p-6 sm:p-10 bg-slate-50">
                <div className="w-full max-w-md">

                    {/* Card */}
                    <div className="bg-white rounded-3xl shadow-[0_2px_8px_rgba(0,0,0,0.04),0_8px_32px_rgba(0,0,0,0.06),0_24px_64px_rgba(0,0,0,0.04)] p-8 sm:p-10">

                        {/* Logo — desktop only */}
                        <div className="hidden lg:flex items-center gap-3 mb-8">
                            <div className="w-12 h-12 bg-[#F7D601] rounded-2xl flex items-center justify-center shadow-md flex-shrink-0">
                                <Sprout className="w-6 h-6 text-green-700" />
                            </div>
                            <div>
                                <p className="font-bold text-slate-800 text-base leading-tight tracking-tight">PDV Depósito</p>
                                <p className="text-slate-400 text-xs">Agro Farm Digital</p>
                            </div>
                        </div>

                        {/* Heading */}
                        <div className="mb-7">
                            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
                                Acesso ao Terminal
                            </h1>
                            <p className="text-slate-400 text-sm mt-1">
                                Controle de saída de produtos e estoque
                            </p>
                        </div>

                        {/* Error banner */}
                        {error && (
                            <div className="mb-5 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">
                                {error}
                            </div>
                        )}

                        {/* Form */}
                        <form onSubmit={handleLogin} className="space-y-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="username" className="text-slate-600 text-sm font-medium">Usuário</Label>
                                <Input
                                    id="username"
                                    value={username}
                                    onChange={e => setUsername(e.target.value)}
                                    placeholder="seu.usuario"
                                    required
                                    autoFocus
                                    autoComplete="username"
                                    className="h-12 rounded-xl border-slate-200 bg-slate-50 focus:bg-white focus:border-green-500 focus:ring-green-500/20 transition-all"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="password" className="text-slate-600 text-sm font-medium">Senha</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    autoComplete="current-password"
                                    className="h-12 rounded-xl border-slate-200 bg-slate-50 focus:bg-white focus:border-green-500 focus:ring-green-500/20 transition-all"
                                />
                            </div>

                            <Button
                                type="submit"
                                className="w-full h-12 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold text-sm shadow-md shadow-green-200 transition-all duration-150 mt-2"
                                disabled={loading}
                            >
                                {loading ? (
                                    <span className="flex items-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Conectando terminal...
                                    </span>
                                ) : "Entrar no PDV"}
                            </Button>
                        </form>
                    </div>

                    {/* Footer */}
                    <p className="mt-5 text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
                        Conexão segura · AgroFarm Digital © 2026
                    </p>
                </div>
            </div>

            {/* ── Right — Hero / Glassmorphism panel ───────────────────── */}
            <div className="hidden lg:flex flex-col justify-center p-12 xl:p-16 bg-gradient-to-br from-green-800 via-green-700 to-emerald-600 relative overflow-hidden">

                {/* Background decorative blobs */}
                <div className="absolute -top-24 -right-24 w-96 h-96 bg-emerald-400/20 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-green-900/40 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-yellow-400/5 rounded-full blur-2xl pointer-events-none" />

                {/* Dot grid pattern */}
                <div
                    className="absolute inset-0 opacity-[0.07] pointer-events-none"
                    style={{
                        backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
                        backgroundSize: "28px 28px",
                    }}
                />

                {/* Content */}
                <div className="relative z-10 max-w-lg">

                    {/* Badge */}
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full mb-6">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#F7D601] animate-pulse" />
                        <span className="text-xs font-medium text-white/90">Terminal de Controle de Estoque</span>
                    </div>

                    {/* Headline */}
                    <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight tracking-tight mb-4">
                        Controle Total
                        <br />
                        <span className="text-[#F7D601]">do seu Depósito</span>
                    </h2>
                    <p className="text-green-100/75 text-base leading-relaxed mb-8">
                        Gerencie saídas de produtos, acompanhe estoque em tempo real e distribua insumos com rastreabilidade completa por talhão.
                    </p>

                    {/* Glassmorphism cards */}
                    <div className="space-y-3 mb-8">
                        <GlassCard
                            icon={BarChart3}
                            title="Estoque em Tempo Real"
                            description="Acompanhe entradas e saídas automaticamente com sincronização instantânea"
                            metric="Sync 100%"
                            metricLabel="atualizado a cada operação"
                        />
                        <GlassCard
                            icon={Target}
                            title="Distribuição Inteligente"
                            description="Calcule dose por hectare automaticamente, sem erros manuais"
                            metric="Zero erro"
                            metricLabel="no cálculo de doses"
                        />
                        <GlassCard
                            icon={TrendingUp}
                            title="Rastreabilidade Completa"
                            description="Histórico completo de aplicações por talhão, safra e produtor"
                            metric="100% rastreado"
                            metricLabel="da saída ao campo"
                        />
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-3">
                        <StatPill value="∞" label="Operações" />
                        <StatPill value="<1s" label="Sincronização" />
                        <StatPill value="Offline" label="Compatível" />
                    </div>
                </div>
            </div>
        </div>
    );
}
