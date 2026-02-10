import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import FarmLayout from "@/components/fazenda/layout";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Calendar } from "lucide-react";

export default function FarmApplications() {
    const [, setLocation] = useLocation();
    const { user } = useAuth();

    const { data: applications = [], isLoading } = useQuery({
        queryKey: ["/api/farm/applications"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/applications"); return r.json(); },
        enabled: !!user,
    });

    return (
        <FarmLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-emerald-800">Aplicações</h1>
                    <p className="text-emerald-600 text-sm">Registro de aplicações de insumos por talhão</p>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
                ) : applications.length === 0 ? (
                    <Card className="border-emerald-100"><CardContent className="py-12 text-center">
                        <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">Nenhuma aplicação registrada</p>
                        <p className="text-gray-400 text-sm mt-1">Aplicações são registradas pelo PDV do depósito</p>
                    </CardContent></Card>
                ) : (
                    <div className="bg-white rounded-xl border border-emerald-100 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-emerald-50">
                                <tr>
                                    <th className="text-left p-3 font-semibold text-emerald-800">Data</th>
                                    <th className="text-left p-3 font-semibold text-emerald-800">Produto</th>
                                    <th className="text-left p-3 font-semibold text-emerald-800">Talhão</th>
                                    <th className="text-left p-3 font-semibold text-emerald-800">Propriedade</th>
                                    <th className="text-right p-3 font-semibold text-emerald-800">Quantidade</th>
                                    <th className="text-left p-3 font-semibold text-emerald-800">Responsável</th>
                                </tr>
                            </thead>
                            <tbody>
                                {applications.map((a: any) => (
                                    <tr key={a.id} className="border-t border-gray-100 hover:bg-emerald-50/30">
                                        <td className="p-3 text-sm">{new Date(a.appliedAt).toLocaleDateString("pt-BR")}</td>
                                        <td className="p-3 font-medium">{a.productName}</td>
                                        <td className="p-3">{a.plotName}</td>
                                        <td className="p-3 text-gray-500">{a.propertyName}</td>
                                        <td className="text-right p-3 font-mono">{parseFloat(a.quantity).toFixed(2)}</td>
                                        <td className="p-3 text-gray-500">{a.appliedBy || "—"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </FarmLayout>
    );
}
