import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sprout, Zap, BarChart3, TrendingUp } from "lucide-react";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("consultor");
  const { user, loginMutation, registerMutation } = useAuth();
  const [, setLocation] = useLocation();

  // Query system settings to check if registration is allowed
  const { data: systemSettings, isLoading: isLoadingSettings } = useQuery<{ allowUserRegistration: boolean }>({
    queryKey: ['/api/system-settings'],
  });

  // Only allow registration if explicitly enabled by system settings
  // Default to false (disabled) until we get a definitive response from the API
  const isRegistrationAllowed = systemSettings?.allowUserRegistration === true;

  useEffect(() => {
    if (user) {
      // Redirecionar baseado no role
      if (user.role === 'administrador') {
        setLocation("/admin");
      } else if (user.role === 'gerente') {
        setLocation("/manager");
      } else if (user.role === 'faturista') {
        setLocation("/faturista");
      } else if (user.role === 'agricultor') {
        setLocation("/fazenda");
      } else {
        setLocation("/dashboard");
      }
    }
  }, [user, setLocation]);

  // Se o cadastro for desabilitado enquanto o usuário está na tela de cadastro, redirecionar para login
  useEffect(() => {
    if (!isLogin && !isRegistrationAllowed) {
      setIsLogin(true);
    }
  }, [isRegistrationAllowed, isLogin]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLogin) {
      loginMutation.mutate({ username, password });
    } else {
      registerMutation.mutate({ username, password, name, role });
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2" data-testid="auth-page">
      {/* Left - Form Section */}
      <div className="flex items-center justify-center p-8 bg-background">
        <Card className="w-full max-w-md border-0 shadow-2xl">
          <CardContent className="pt-8 pb-8">
            {/* Logo */}
            <div className="flex items-center justify-center mb-8">
              <div className="w-16 h-16 bg-[#F7D601] rounded-2xl flex items-center justify-center shadow-lg">
                <Sprout className="text-green-600 text-3xl" size={36} />
              </div>
            </div>

            {/* Title */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-green-500 bg-clip-text text-transparent mb-2">
                Agro Farm Digital
              </h1>
              <p className="text-muted-foreground">
                {isLogin ? "Bem-vindo de volta" : "Comece sua jornada digital"}
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="name">Nome Completo</Label>
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome"
                    required
                    data-testid="input-name"
                    className="h-12"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="username">Usuário</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="seu.usuario"
                  required
                  data-testid="input-username"
                  className="h-12"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Senha</Label>
                  {isLogin && (
                    <Link href="/forgot-password">
                      <a className="text-sm text-green-600 hover:text-green-700 transition-colors" data-testid="link-forgot-password">
                        Esqueci minha senha
                      </a>
                    </Link>
                  )}
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  data-testid="input-password"
                  className="h-12"
                />
              </div>

              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="role">Função</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger className="h-12" data-testid="select-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="consultor">Consultor</SelectItem>
                      <SelectItem value="gerente">Gerentes</SelectItem>
                      <SelectItem value="administrador">Administradores</SelectItem>
                      <SelectItem value="faturista">Faturista</SelectItem>
                      <SelectItem value="agricultor">Agricultor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-12 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white font-semibold shadow-lg"
                disabled={loginMutation.isPending || registerMutation.isPending}
                data-testid={isLogin ? "button-login" : "button-register"}
              >
                {(loginMutation.isPending || registerMutation.isPending) ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    Aguarde...
                  </span>
                ) : isLogin ? (
                  "Entrar"
                ) : (
                  "Criar Conta"
                )}
              </Button>
            </form>

            {/* Toggle */}
            {isRegistrationAllowed && (
              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-sm text-muted-foreground hover:text-green-600 transition-colors"
                  data-testid="toggle-auth-mode"
                >
                  {isLogin ? (
                    <>
                      Não tem uma conta? <span className="font-semibold text-green-600">Cadastre-se</span>
                    </>
                  ) : (
                    <>
                      Já tem uma conta? <span className="font-semibold text-green-600">Faça login</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right - Hero Section */}
      <div className="hidden lg:flex flex-col items-center justify-center p-12 bg-gradient-to-br from-green-600 via-green-500 to-emerald-500 text-white relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-lg">
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full mb-6">
              <Zap className="w-4 h-4" />
              <span className="text-sm font-medium">Digital para o Campo</span>
            </div>

            <h2 className="text-5xl font-bold mb-4 leading-tight">
              Transforme suas vendas agrícolas
            </h2>
            <p className="text-lg text-green-50 mb-8">
              Gerencie comissões, acompanhe metas e analise seu desempenho com tecnologia de ponta desenvolvida para o agronegócio.
            </p>
          </div>

          {/* Features */}
          <div className="space-y-4">
            <div className="flex items-start gap-4 p-4 bg-white/10 backdrop-blur-sm rounded-xl">
              <div className="w-10 h-10 bg-[#F7D601] rounded-lg flex items-center justify-center flex-shrink-0">
                <BarChart3 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Análise Inteligente</h3>
                <p className="text-sm text-green-50">
                  Dashboard completo com insights sobre suas vendas e comissões
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 bg-white/10 backdrop-blur-sm rounded-xl">
              <div className="w-10 h-10 bg-[#F7D601] rounded-lg flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Metas & Performance</h3>
                <p className="text-sm text-green-50">
                  Acompanhe metas por safra e categorias de produtos
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 bg-white/10 backdrop-blur-sm rounded-xl">
              <div className="w-10 h-10 bg-[#F7D601] rounded-lg flex items-center justify-center flex-shrink-0">
                <Sprout className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Mercado Agrícola</h3>
                <p className="text-sm text-green-50">
                  Análise de penetração de mercado e oportunidades comerciais
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
