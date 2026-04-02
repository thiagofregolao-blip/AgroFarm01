import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, EyeOff } from "lucide-react";

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
    queryKey: ["/api/system-settings"],
  });
  const isRegistrationAllowed = systemSettings?.allowUserRegistration === true;

  useEffect(() => {
    if (user) {
      if (user.role === "administrador") setLocation("/admin");
      else if (user.role === "gerente") setLocation("/manager");
      else if (user.role === "admin_agricultor") setLocation("/admin-farmers");
      else if (user.role === "faturista") setLocation("/faturista");
      else if (user.role === "agricultor") setLocation("/fazenda");
      else if (user.role === "funcionario_fazenda") setLocation("/fazenda");
      else if (["rtv", "director", "financeiro", "admin_empresa"].includes(user.role)) setLocation("/empresa");
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
    <div
      className="min-h-screen flex items-center justify-center p-4 relative"
      data-testid="auth-page"
      style={{ fontFamily: "'Manrope', sans-serif" }}
    >
      {/* ── Background ── */}
      <div className="fixed inset-0 z-0">
        <img
          src="/auth-bg.jpg"
          alt=""
          className="w-full h-full object-cover"
          aria-hidden="true"
        />
        {/* dark overlay */}
        <div className="absolute inset-0 bg-[#003527]/30 backdrop-blur-[2px]" />
      </div>

      {/* ── Card ── */}
      <div
        className="relative z-10 w-full max-w-4xl grid md:grid-cols-2 overflow-hidden shadow-2xl"
        style={{ borderRadius: "0.5rem" }}
      >

        {/* ══ LEFT — Identity panel ══ */}
        <div className="bg-white flex flex-col items-center justify-center px-12 py-14 relative overflow-hidden">
          {/* Decorative blobs */}
          <div className="absolute -top-20 -left-20 w-56 h-56 rounded-full blur-3xl"
            style={{ background: "rgba(176,240,214,0.25)" }} />
          <div className="absolute -bottom-20 -right-20 w-56 h-56 rounded-full blur-3xl"
            style={{ background: "rgba(206,229,255,0.25)" }} />

          <div className="relative z-10 flex flex-col items-center text-center gap-6">
            {/* Logo */}
            <img
              src="/icon-datagrow.png"
              alt="AgroFarm Digital"
              className="w-32 h-32 object-contain drop-shadow-md"
            />

            {/* Tagline */}
            <div>
              <p
                className="text-xs uppercase tracking-widest font-bold italic mb-2"
                style={{ color: "#003527" }}
              >
                Onde a referência termina,<br />nossa inteligência agrícola começa
              </p>
              <p className="text-sm" style={{ color: "#707974", fontFamily: "'Newsreader', serif" }}>
                AgroFarm Digital: A Inteligência<br />que dita o futuro do Agro.
              </p>
            </div>
          </div>
        </div>

        {/* ══ RIGHT — Login form ══ */}
        <div
          className="flex flex-col justify-center px-8 md:px-12 py-12"
          style={{ backgroundColor: "#064e3b", borderLeft: "1px solid rgba(255,255,255,0.05)" }}
        >
          {/* Heading */}
          <div className="mb-8">
            <h1
              className="font-bold text-white mb-3 leading-tight"
              style={{ fontFamily: "'Newsreader', serif", fontSize: "2.5rem" }}
            >
              {isLogin ? "Acesse sua conta" : "Crie sua conta"}
            </h1>
            <p className="text-sm" style={{ color: "rgba(167,243,208,0.6)" }}>
              {isLogin
                ? "Bem-vindo de volta. Insira suas credenciais para continuar."
                : "Preencha os dados para começar."}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 px-4 py-3 rounded-lg text-sm text-red-200 bg-red-900/40 border border-red-700/40">
              {(error as any)?.message || "Credenciais inválidas. Tente novamente."}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Name (register only) */}
            {!isLogin && (
              <div className="space-y-1.5">
                <label
                  htmlFor="name-field"
                  className="block text-[10px] uppercase tracking-widest font-semibold"
                  style={{ color: "rgba(167,243,208,0.7)" }}
                >
                  Nome Completo
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-400 text-lg select-none">
                    ✦
                  </span>
                  <input
                    id="name-field"
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Seu nome completo"
                    required
                    data-testid="input-name"
                    className="w-full py-4 pl-12 pr-4 rounded-lg text-white placeholder:text-emerald-500/50 focus:outline-none focus:ring-2 transition-all duration-200 text-sm"
                    style={{
                      background: "rgba(255,255,255,0.08)",
                      border: "none",
                      fontFamily: "'Manrope', sans-serif",
                    }}
                    onFocus={e => (e.currentTarget.style.background = "rgba(255,255,255,0.13)")}
                    onBlur={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                  />
                </div>
              </div>
            )}

            {/* Username */}
            <div className="space-y-1.5">
              <label
                htmlFor="username-field"
                className="block text-[10px] uppercase tracking-widest font-semibold"
                style={{ color: "rgba(167,243,208,0.7)" }}
              >
                Usuário
              </label>
              <div className="relative">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-400" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                </svg>
                <input
                  id="username-field"
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="seu.usuario"
                  required
                  autoComplete="username"
                  data-testid="input-username"
                  className="w-full py-4 pl-12 pr-4 rounded-lg text-white placeholder:text-emerald-500/50 focus:outline-none transition-all duration-200 text-sm"
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    border: "none",
                    fontFamily: "'Manrope', sans-serif",
                  }}
                  onFocus={e => (e.currentTarget.style.background = "rgba(255,255,255,0.13)")}
                  onBlur={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password-field"
                  className="block text-[10px] uppercase tracking-widest font-semibold"
                  style={{ color: "rgba(167,243,208,0.7)" }}
                >
                  Senha de Acesso
                </label>
                {isLogin && (
                  <Link href="/forgot-password">
                    <a
                      className="text-[10px] uppercase tracking-widest font-semibold transition-colors hover:text-white"
                      style={{ color: "#ffe088" }}
                      data-testid="link-forgot-password"
                    >
                      Esqueceu?
                    </a>
                  </Link>
                )}
              </div>
              <div className="relative">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-400" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <input
                  id="password-field"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  data-testid="input-password"
                  className="w-full py-4 pl-12 pr-12 rounded-lg text-white placeholder:text-emerald-500/50 focus:outline-none transition-all duration-200 text-sm"
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    border: "none",
                    fontFamily: "'Manrope', sans-serif",
                  }}
                  onFocus={e => (e.currentTarget.style.background = "rgba(255,255,255,0.13)")}
                  onBlur={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-400 hover:text-white transition-colors"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {/* Role (register only) */}
            {!isLogin && (
              <div className="space-y-1.5">
                <label
                  className="block text-[10px] uppercase tracking-widest font-semibold"
                  style={{ color: "rgba(167,243,208,0.7)" }}
                >
                  Função
                </label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger
                    className="h-12 rounded-lg text-white border-none text-sm"
                    style={{ background: "rgba(255,255,255,0.08)", fontFamily: "'Manrope', sans-serif" }}
                    data-testid="select-role"
                  >
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

            {/* CTA Button */}
            <button
              type="submit"
              disabled={isPending}
              data-testid={isLogin ? "button-login" : "button-register"}
              className="w-full py-4 rounded-lg font-bold uppercase tracking-widest text-sm flex items-center justify-center gap-2 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg"
              style={{
                backgroundColor: "#ffe088",
                color: "#241a00",
                fontFamily: "'Manrope', sans-serif",
                boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
              }}
            >
              {isPending ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-[#241a00] border-t-transparent rounded-full" />
                  Aguarde...
                </>
              ) : (
                <>
                  {isLogin ? "Entrar no Sistema" : "Criar Conta"}
                  {isLogin && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  )}
                </>
              )}
            </button>
          </form>

          {/* Toggle login/register */}
          {isRegistrationAllowed && (
            <p className="mt-6 text-center text-xs" style={{ color: "rgba(167,243,208,0.5)" }}>
              {isLogin ? "Não tem uma conta? " : "Já tem uma conta? "}
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="font-semibold transition-colors hover:text-white"
                style={{ color: "#ffe088" }}
                data-testid="toggle-auth-mode"
              >
                {isLogin ? "Cadastre-se" : "Faça login"}
              </button>
            </p>
          )}

          {/* Footer note */}
          <p className="mt-8 text-center text-sm" style={{ color: "rgba(167,243,208,0.4)" }}>
            Não possui acesso?{" "}
            <a
              href="https://agrofarmdigital.com/#contato"
              className="font-semibold transition-colors hover:text-white"
              style={{ color: "#ffe088" }}
            >
              Solicite uma demonstração
            </a>
          </p>
        </div>
      </div>

      {/* ── Footer ── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-20 flex justify-between items-center px-8 py-4 text-[11px] uppercase tracking-widest"
        style={{ color: "rgba(255,255,255,0.35)", fontFamily: "'Manrope', sans-serif" }}
      >
        <span>© 2026 AgroFarm Digital. Todos os direitos reservados.</span>
        <div className="hidden md:flex gap-6">
          <a href="#" className="hover:text-white transition-colors">Privacidade</a>
          <a href="#" className="hover:text-white transition-colors">Termos</a>
          <a href="#" className="hover:text-white transition-colors">Suporte</a>
        </div>
      </div>
    </div>
  );
}
