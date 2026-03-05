import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import FarmLayout from "@/components/fazenda/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, TrendingUp, TrendingDown, DollarSign, BarChart3 } from "lucide-react";

export default function DrePage() {
    const { user } = useAuth();

    const { data: dre, isLoading } = useQuery({
        queryKey: ["/api/farm/dre"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/dre"); return r.json(); },
        enabled: !!user,
    });

    const fmt = (v: number) => `$ ${Math.abs(v).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const color = (v: number) => v >= 0 ? "text-green-700" : "text-red-600";

    return (
        <FarmLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-emerald-800">📊 DRE — Estado de Resultados</h1>
                    <p className="text-emerald-600 text-sm">Demonstração de Resultado do Exercício (consolidado)</p>
                </div>

                {isLoading || !dre ? (
                    <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
                ) : (
                    <>
                        {/* Summary Cards */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <Card className="border-emerald-100"><CardContent className="p-4">
                                <p className="text-xs text-gray-500 flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Receitas</p>
                                <p className="text-xl font-bold text-green-700">{fmt(dre.receitas)}</p>
                            </CardContent></Card>
                            <Card className="border-emerald-100"><CardContent className="p-4">
                                <p className="text-xs text-gray-500 flex items-center gap-1"><TrendingDown className="h-3 w-3" /> Custos</p>
                                <p className="text-xl font-bold text-red-600">{fmt(dre.custoProducao)}</p>
                            </CardContent></Card>
                            <Card className="border-emerald-100"><CardContent className="p-4">
                                <p className="text-xs text-gray-500 flex items-center gap-1"><DollarSign className="h-3 w-3" /> Lucro Bruto</p>
                                <p className={`text-xl font-bold ${color(dre.lucroBruto)}`}>{dre.lucroBruto >= 0 ? "" : "-"}{fmt(dre.lucroBruto)}</p>
                            </CardContent></Card>
                            <Card className="border-emerald-100"><CardContent className="p-4">
                                <p className="text-xs text-gray-500 flex items-center gap-1"><BarChart3 className="h-3 w-3" /> Resultado</p>
                                <p className={`text-xl font-bold ${color(dre.resultadoLiquido)}`}>{dre.resultadoLiquido >= 0 ? "" : "-"}{fmt(dre.resultadoLiquido)}</p>
                            </CardContent></Card>
                        </div>

                        {/* DRE Table */}
                        <Card className="border-emerald-100">
                            <CardContent className="p-0">
                                <table className="w-full text-sm">
                                    <thead className="bg-emerald-50"><tr>
                                        <th className="text-left p-4 font-semibold text-emerald-800">Descrição</th>
                                        <th className="text-right p-4 font-semibold text-emerald-800">Valor</th>
                                    </tr></thead>
                                    <tbody>
                                        <Row label="(+) Receitas Recebidas" value={dre.detail.receitasRecebidas} positive />
                                        <Row label="(-) Custo de Insumos Aplicados" value={dre.detail.custoInsumos} />
                                        <Row label="(-) Despesas de Talhão" value={dre.detail.despesasTalhao} />
                                        <TotalRow label="= LUCRO BRUTO" value={dre.lucroBruto} />
                                        <Row label="(-) Despesas Operacionais (gerais)" value={dre.despesasOperacionais} />
                                        <TotalRow label="= RESULTADO OPERACIONAL" value={dre.resultadoOperacional} />
                                        <TotalRow label="= RESULTADO LÍQUIDO" value={dre.resultadoLiquido} highlight />
                                    </tbody>
                                </table>
                            </CardContent>
                        </Card>

                        {dre.resultadoLiquido === 0 && dre.receitas === 0 && (
                            <Card className="border-amber-200 bg-amber-50"><CardContent className="p-4 text-amber-800 text-sm">
                                <p className="font-semibold">Sem dados suficientes</p>
                                <p>Registre romaneios e contas a receber para gerar o DRE. As despesas já existentes serão incorporadas automaticamente.</p>
                            </CardContent></Card>
                        )}
                    </>
                )}
            </div>
        </FarmLayout>
    );
}

function Row({ label, value, positive }: { label: string; value: number; positive?: boolean }) {
    return (
        <tr className="border-t border-gray-100">
            <td className="p-4 text-gray-700">{label}</td>
            <td className={`text-right p-4 font-mono ${positive ? "text-green-700" : "text-red-600"}`}>
                {positive ? "" : "-"} $ {Math.abs(value).toLocaleString("en", { minimumFractionDigits: 2 })}
            </td>
        </tr>
    );
}

function TotalRow({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
    const c = value >= 0 ? "text-green-700" : "text-red-600";
    return (
        <tr className={`border-t-2 border-emerald-200 ${highlight ? "bg-emerald-50" : "bg-gray-50"}`}>
            <td className={`p-4 font-bold ${highlight ? "text-emerald-900 text-base" : "text-gray-800"}`}>{label}</td>
            <td className={`text-right p-4 font-mono font-bold ${highlight ? `text-lg ${c}` : c}`}>
                {value >= 0 ? "" : "-"} $ {Math.abs(value).toLocaleString("en", { minimumFractionDigits: 2 })}
            </td>
        </tr>
    );
}
