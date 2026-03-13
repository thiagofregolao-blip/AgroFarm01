import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sprout, BarChart3, Tractor, LineChart, ShieldCheck, Wifi, AtSign, Lock, Eye, EyeOff, User as UserIcon } from "lucide-react";

// ─── Glassmorphism benefit card (desktop only) ─────────────────────────────
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

// ─── Stat pill (desktop only) ──────────────────────────────────────────────
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
  const [showPassword, setShowPassword] = useState(false);
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

      {/* ══════════════════════════════════════════════════════════════════════
          MOBILE — Full-screen green login (visible < lg)
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="lg:hidden min-h-screen flex flex-col relative overflow-hidden bg-gradient-to-b from-[#0a6e3a] via-[#0d8a48] to-[#0a5e32]">

        {/* Mesh / network pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.12] pointer-events-none"
          style={{
            backgroundImage: `
              radial-gradient(circle at 15% 85%, rgba(255,255,255,0.3) 1px, transparent 1px),
              radial-gradient(circle at 85% 15%, rgba(255,255,255,0.3) 1px, transparent 1px),
              radial-gradient(circle at 50% 50%, rgba(255,255,255,0.15) 1px, transparent 1px),
              linear-gradient(45deg, transparent 48%, rgba(255,255,255,0.05) 49%, rgba(255,255,255,0.05) 51%, transparent 52%),
              linear-gradient(-45deg, transparent 48%, rgba(255,255,255,0.05) 49%, rgba(255,255,255,0.05) 51%, transparent 52%)
            `,
            backgroundSize: "200px 200px, 200px 200px, 100px 100px, 60px 60px, 60px 60px",
          }}
        />

        {/* Glowing orbs */}
        <div className="absolute top-[10%] left-[15%] w-48 h-48 bg-emerald-300/10 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute bottom-[15%] right-[10%] w-64 h-64 bg-teal-400/8 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute top-[60%] left-[50%] w-32 h-32 bg-green-200/5 rounded-full blur-[60px] pointer-events-none" />

        {/* Content */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-8 py-12">

          {/* Logo */}
          <div className="mb-2">
            <div className="w-24 h-24 mx-auto mb-4">
              <img src="/icon-512x512.png" alt="AgroFarm" className="w-full h-full object-contain drop-shadow-2xl" />
            </div>
            <h2 className="text-center">
              <span className="text-3xl font-extrabold text-white tracking-tight">AgroFarm</span>
              <span className="block text-sm font-semibold text-emerald-200 tracking-[0.2em] uppercase mt-0.5">Gestor Rural Digital</span>
            </h2>
          </div>

          {/* Welcome text */}
          <div className="text-center mt-6 mb-8">
            <p className="text-xl font-bold text-white">
              {isLogin ? "Bem-vindo(a) a sua Fazenda Digital" : "Crie sua conta"}
            </p>
            <p className="text-sm text-emerald-200/80 mt-1">
              {isLogin ? "Informe seus dados" : "Preencha os dados abaixo"}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="w-full max-w-sm mb-4 px-4 py-3 rounded-2xl bg-red-500/20 border border-red-400/30 backdrop-blur-sm text-white text-sm text-center">
              {(error as any)?.message || "Credenciais invalidas. Tente novamente."}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">

            {/* Name (register only) */}
            {!isLogin && (
              <div className="relative">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-200/60" />
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Nome Completo"
                  required
                  data-testid="input-name"
                  className="w-full h-14 pl-12 pr-4 rounded-2xl bg-white/10 border border-white/25 text-white placeholder-emerald-200/50 text-base backdrop-blur-sm focus:outline-none focus:border-white/50 focus:bg-white/15 transition-all"
                />
              </div>
            )}

            {/* Email / Username */}
            <div className="relative">
              <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-200/60" />
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="E-mail"
                required
                autoComplete="username"
                data-testid="input-username"
                className="w-full h-14 pl-12 pr-4 rounded-2xl bg-white/10 border border-white/25 text-white placeholder-emerald-200/50 text-base backdrop-blur-sm focus:outline-none focus:border-white/50 focus:bg-white/15 transition-all"
              />
            </div>

            {/* Password */}
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-200/60" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Senha"
                required
                autoComplete="current-password"
                data-testid="input-password"
                className="w-full h-14 pl-12 pr-12 rounded-2xl bg-white/10 border border-white/25 text-white placeholder-emerald-200/50 text-base backdrop-blur-sm focus:outline-none focus:border-white/50 focus:bg-white/15 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-emerald-200/60 hover:text-white transition-colors"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {/* Role (register only) */}
            {!isLogin && (
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="h-14 rounded-2xl bg-white/10 border-white/25 text-white backdrop-blur-sm" data-testid="select-role">
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
            )}

            {/* Forgot password */}
            {isLogin && (
              <div className="text-right">
                <Link href="/forgot-password">
                  <a className="text-sm font-semibold text-white hover:text-emerald-200 transition-colors" data-testid="link-forgot-password">
                    Esqueceu a senha?
                  </a>
                </Link>
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={isPending}
              data-testid={isLogin ? "button-login" : "button-register"}
              className="w-full h-14 rounded-2xl bg-white/20 border border-white/30 backdrop-blur-md text-white font-bold text-lg tracking-wide uppercase shadow-[0_4px_30px_rgba(0,0,0,0.15)] hover:bg-white/30 active:scale-[0.98] transition-all duration-150 disabled:opacity-60"
            >
              {isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                  Aguarde...
                </span>
              ) : isLogin ? "ENTRAR" : "CRIAR CONTA"}
            </button>
          </form>

          {/* Toggle login/register */}
          {isRegistrationAllowed && (
            <p className="mt-8 text-center text-sm text-emerald-100/80">
              {isLogin ? "Ainda nao possui uma conta?" : "Ja tem uma conta?"}
              <br />
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-white font-bold hover:text-emerald-200 transition-colors mt-1"
                data-testid="toggle-auth-mode"
              >
                {isLogin ? "Clique aqui" : "Faca login"}
              </button>
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="relative z-10 pb-6 pt-2">
          <p className="text-center text-xs text-emerald-200/50">
            Powered By AgroFarm - Tecnologia e Gestao
          </p>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          DESKTOP — Left: Form panel (visible >= lg)
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="hidden lg:flex items-center justify-center p-6 sm:p-10 bg-slate-50">
        <div className="w-full max-w-md">

          {/* Card */}
          <div className="bg-white rounded-3xl shadow-[0_2px_8px_rgba(0,0,0,0.04),0_8px_32px_rgba(0,0,0,0.06),0_24px_64px_rgba(0,0,0,0.04)] p-8 sm:p-10">

            {/* Logo */}
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-md flex-shrink-0">
                <img src="/icon-512x512.png" alt="AgroFarm" className="w-full h-full object-contain" />
              </div>
              <div>
                <p className="font-bold text-slate-800 text-base leading-tight tracking-tight">Agro Farm Digital</p>
                <p className="text-slate-400 text-xs">Plataforma do Agronegocio</p>
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
                  : "Preencha os dados para comecar"}
              </p>
            </div>

            {/* Error banner */}
            {error && (
              <div className="mb-5 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">
                {(error as any)?.message || "Credenciais invalidas. Tente novamente."}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="space-y-1.5">
                  <Label htmlFor="name-desktop" className="text-slate-600 text-sm font-medium">Nome Completo</Label>
                  <Input
                    id="name-desktop"
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Seu nome completo"
                    required
                    className="h-12 rounded-xl border-slate-200 bg-slate-50 focus:bg-white focus:border-green-500 focus:ring-green-500/20 transition-all"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="username-desktop" className="text-slate-600 text-sm font-medium">Usuario</Label>
                <Input
                  id="username-desktop"
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="seu.usuario"
                  required
                  autoComplete="username"
                  className="h-12 rounded-xl border-slate-200 bg-slate-50 focus:bg-white focus:border-green-500 focus:ring-green-500/20 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password-desktop" className="text-slate-600 text-sm font-medium">Senha</Label>
                  {isLogin && (
                    <Link href="/forgot-password">
                      <a className="text-xs text-green-600 hover:text-green-700 font-medium transition-colors">
                        Esqueci a senha
                      </a>
                    </Link>
                  )}
                </div>
                <div className="relative">
                  <Input
                    id="password-desktop"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="********"
                    required
                    autoComplete="current-password"
                    className="h-12 rounded-xl border-slate-200 bg-slate-50 focus:bg-white focus:border-green-500 focus:ring-green-500/20 transition-all pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {!isLogin && (
                <div className="space-y-1.5">
                  <Label htmlFor="role-desktop" className="text-slate-600 text-sm font-medium">Funcao</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger className="h-12 rounded-xl border-slate-200 bg-slate-50">
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
                {isLogin ? "Nao tem uma conta? " : "Ja tem uma conta? "}
                <button
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-green-600 font-semibold hover:text-green-700 transition-colors"
                >
                  {isLogin ? "Cadastre-se" : "Faca login"}
                </button>
              </p>
            )}
          </div>

          {/* Footer */}
          <p className="mt-5 text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
            Conexao segura - AgroFarm Digital 2026
          </p>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          DESKTOP — Right: Hero panel (visible >= lg)
          ══════════════════════════════════════════════════════════════════════ */}
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
            <div className="w-1.5 h-1.5 rounded-full bg-[#F7D601]" />
            <span className="text-xs font-medium text-white/90">Plataforma Enterprise do Agronegocio</span>
          </div>

          {/* Headline */}
          <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight tracking-tight mb-4">
            Do Campo a
            <br />
            <span className="text-[#F7D601]">Tomada de Decisao</span>
          </h2>
          <p className="text-green-100/75 text-base leading-relaxed mb-8">
            Conecte consultores, produtores e gestores em uma unica plataforma integrada — da gestao de pedidos ao monitoramento da safra.
          </p>

          {/* Glassmorphism benefit cards */}
          <div className="space-y-3 mb-8">
            <GlassCard
              icon={BarChart3}
              title="Performance Comercial"
              description="Metas, comissoes e pipeline de vendas em tempo real para cada RTV"
              metric="+34% vendas"
              metricLabel="media dos clientes"
            />
            <GlassCard
              icon={Tractor}
              title="Gestao de Estoque & Safra"
              description="Reserva automatica de estoque, controle de custos e rastreabilidade do campo"
              metric="100% rastreado"
              metricLabel="da fazenda ao faturamento"
            />
            <GlassCard
              icon={LineChart}
              title="Inteligencia de Dados"
              description="Dashboards integrados com precos de commodities, NDVI e analise de credito"
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
