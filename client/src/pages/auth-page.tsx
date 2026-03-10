import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sprout, BarChart3, Tractor, LineChart, ShieldCheck, Wifi } from "lucide-react";

// ─── Glassmorphism benefit card ────────────────────────────────────────────
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

// ─── Stat pill ─────────────────────────────────────────────────────────────
function StatPill({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center px-5 py-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/15">
      <span className="text-xl font-bold text-white tracking-tight">{value}</span>
      <span className="text-[11px] text-green-100/70 mt-0.5 whitespace-nowrap">{label}</span>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────
export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("consultor");
  const { user, loginMutation, registerMutation } = useAuth();
  const [, setLocation] = useLocation();

  const { data: systemSettings } = useQuery<{ allowUserRegistration: boolean }>({
    queryKey: ['/api/system-settings'],
  });
  const isRegistrationAllowed = systemSettings?.allowUserRegistration === true;

  useEffect(() => {
    if (user) {
      if (user.role === 'administrador') setLocation("/admin");
      else if (user.role === 'gerente') setLocation("/manager");
      else if (user.role === 'admin_agricultor') setLocation("/admin-farmers");
      else if (user.role === 'faturista') setLocation("/faturista");
      else if (user.role === 'agricultor') setLocation("/fazenda");
      else if (['rtv', 'director', 'financeiro', 'admin_empresa'].includes(user.role)) setLocation("/empresa");
      else setLocation("/dashboard");
    }
  }, [user, setLocation]);

  useEffect(() => {
    if (!isLogin && !isRegistrationAllowed) setIsLogin(true);
  }, [isRegistrationAllowed, isLogin]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLogin) loginMutation.mutate({ username, password });
    else registerMutation.mutate({ username, password, name, role });
  };

  const isPending = loginMutation.isPending || registerMutation.isPending;
  const error = loginMutation.error || registerMutation.error;

  return (
    <div className="min-h-screen flex flex-col lg:grid lg:grid-cols-2" data-testid="auth-page">

      {/* ── Mobile top bar (visible only on mobile) ─────────────────────── */}
      <div className="lg:hidden bg-gradient-to-r from-green-700 to-emerald-600 px-6 py-5 flex items-center gap-3">
        <div className="w-10 h-10 bg-[#F7D601] rounded-xl flex items-center justify-center shadow-md flex-shrink-0">
          <Sprout className="w-5 h-5 text-green-700" />
        </div>
        <div>
          <p className="text-white font-bold text-base leading-tight">Agro Farm Digital</p>
          <p className="text-green-100/80 text-xs">Plataforma do Agronegócio</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1">
          <Wifi className="w-3 h-3 text-green-100" />
          <span className="text-[11px] text-green-100 font-medium">Campo Digital</span>
        </div>
      </div>

      {/* ── Left — Form panel ───────────────────────────────────────────── */}
      <div className="flex items-center justify-center p-6 sm:p-10 bg-slate-50">
        <div className="w-full max-w-md">

          {/* Card */}
          <div className="bg-white rounded-3xl shadow-[0_2px_8px_rgba(0,0,0,0.04),0_8px_32px_rgba(0,0,0,0.06),0_24px_64px_rgba(0,0,0,0.04)] p-8 sm:p-10">

            {/* Logo — hidden on mobile (shown in top bar instead) */}
            <div className="hidden lg:flex items-center gap-3 mb-8">
              <div className="w-12 h-12 bg-[#F7D601] rounded-2xl flex items-center justify-center shadow-md flex-shrink-0">
                <Sprout className="w-6 h-6 text-green-700" />
              </div>
              <div>
                <p className="font-bold text-slate-800 text-base leading-tight tracking-tight">Agro Farm Digital</p>
                <p className="text-slate-400 text-xs">Plataforma do Agronegócio</p>
              </div>
            </div>

            {/* Heading */}
            <div className="mb-7">
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
                {isLogin ? "Bem-vindo de volta" : "Crie sua conta"}
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                {isLogin
                  ? "Acesse seu painel com suas credenciais"
                  : "Preencha os dados para começar"}
              </p>
            </div>

            {/* Error banner */}
            {error && (
              <div className="mb-5 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">
                {(error as any)?.message || "Credenciais inválidas. Tente novamente."}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-slate-600 text-sm font-medium">Nome Completo</Label>
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Seu nome completo"
                    required
                    data-testid="input-name"
                    className="h-12 rounded-xl border-slate-200 bg-slate-50 focus:bg-white focus:border-green-500 focus:ring-green-500/20 transition-all"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-slate-600 text-sm font-medium">Usuário</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="seu.usuario"
                  required
                  autoComplete="username"
                  data-testid="input-username"
                  className="h-12 rounded-xl border-slate-200 bg-slate-50 focus:bg-white focus:border-green-500 focus:ring-green-500/20 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-slate-600 text-sm font-medium">Senha</Label>
                  {isLogin && (
                    <Link href="/forgot-password">
                      <a className="text-xs text-green-600 hover:text-green-700 font-medium transition-colors" data-testid="link-forgot-password">
                        Esqueci a senha
                      </a>
                    </Link>
                  )}
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  data-testid="input-password"
                  className="h-12 rounded-xl border-slate-200 bg-slate-50 focus:bg-white focus:border-green-500 focus:ring-green-500/20 transition-all"
                />
              </div>

              {!isLogin && (
                <div className="space-y-1.5">
                  <Label htmlFor="role" className="text-slate-600 text-sm font-medium">Função</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger className="h-12 rounded-xl border-slate-200 bg-slate-50" data-testid="select-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="consultor">Consultor</SelectItem>
                      <SelectItem value="gerente">Gerente</SelectItem>
                      <SelectItem value="administrador">Administrador</SelectItem>
                      <SelectItem value="admin_agricultor">Admin Agricultor</SelectItem>
                      <SelectItem value="faturista">Faturista</SelectItem>
                      <SelectItem value="agricultor">Agricultor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-12 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold text-sm shadow-md shadow-green-200 transition-all duration-150 mt-2"
                disabled={isPending}
                data-testid={isLogin ? "button-login" : "button-register"}
              >
                {isPending ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    Aguarde...
                  </span>
                ) : isLogin ? "Entrar na Plataforma" : "Criar Conta"}
              </Button>
            </form>

            {/* Toggle */}
            {isRegistrationAllowed && (
              <p className="mt-6 text-center text-sm text-slate-400">
                {isLogin ? "Não tem uma conta? " : "Já tem uma conta? "}
                <button
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-green-600 font-semibold hover:text-green-700 transition-colors"
                  data-testid="toggle-auth-mode"
                >
                  {isLogin ? "Cadastre-se" : "Faça login"}
                </button>
              </p>
            )}
          </div>

          {/* Footer */}
          <p className="mt-5 text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
            Conexão segura · AgroFarm Digital © 2026
          </p>
        </div>
      </div>

      {/* ── Right — Hero / Glassmorphism panel ─────────────────────────── */}
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
            <span className="text-xs font-medium text-white/90">Plataforma Enterprise do Agronegócio</span>
          </div>

          {/* Headline */}
          <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight tracking-tight mb-4">
            Do Campo à
            <br />
            <span className="text-[#F7D601]">Tomada de Decisão</span>
          </h2>
          <p className="text-green-100/75 text-base leading-relaxed mb-8">
            Conecte consultores, produtores e gestores em uma única plataforma integrada — da gestão de pedidos ao monitoramento da safra.
          </p>

          {/* Glassmorphism benefit cards */}
          <div className="space-y-3 mb-8">
            <GlassCard
              icon={BarChart3}
              title="Performance Comercial"
              description="Metas, comissões e pipeline de vendas em tempo real para cada RTV"
              metric="+34% vendas"
              metricLabel="média dos clientes"
            />
            <GlassCard
              icon={Tractor}
              title="Gestão de Estoque & Safra"
              description="Reserva automática de estoque, controle de custos e rastreabilidade do campo"
              metric="100% rastreado"
              metricLabel="da fazenda ao faturamento"
            />
            <GlassCard
              icon={LineChart}
              title="Inteligência de Dados"
              description="Dashboards integrados com preços de commodities, NDVI e análise de crédito"
              metric="Tempo real"
              metricLabel="via n8n + IA"
            />
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            <StatPill value="1.2k+" label="Produtores" />
            <StatPill value="98%" label="Disponibilidade" />
            <StatPill value="24/7" label="Suporte Campo" />
          </div>
        </div>
      </div>
    </div>
  );
}
