import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";

export default function PdvLogin() {
    const [, setLocation] = useLocation();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await apiRequest("POST", "/api/pdv/login", { username, password });
            const data = await res.json();
            // Store PDV data in sessionStorage for offline use
            sessionStorage.setItem("pdvData", JSON.stringify(data));
            toast({ title: `Terminal ${data.terminal.name} conectado` });
            setLocation("/pdv");
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

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-4xl shadow-xl mx-auto mb-4">
                        🏪
                    </div>
                    <h1 className="text-3xl font-bold text-white">PDV Depósito</h1>
                    <p className="text-slate-400 mt-1">AgroFarm — Saída de Produtos</p>
                </div>

                <Card className="shadow-xl border-slate-700 bg-slate-800/80">
                    <CardHeader>
                        <CardTitle className="text-white">Login do Terminal</CardTitle>
                        <CardDescription className="text-slate-400">Use as credenciais cadastradas pelo agricultor</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleLogin} className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-slate-300">Usuário</Label>
                                <Input
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="deposito1"
                                    required
                                    autoFocus
                                    className="bg-slate-700 border-slate-600 text-white"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-slate-300">Senha</Label>
                                <Input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    className="bg-slate-700 border-slate-600 text-white"
                                />
                            </div>
                            <Button
                                type="submit"
                                className="w-full bg-orange-600 hover:bg-orange-700 text-lg py-6"
                                disabled={loading}
                            >
                                {loading ? (
                                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Conectando...</>
                                ) : (
                                    "Entrar no PDV"
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
