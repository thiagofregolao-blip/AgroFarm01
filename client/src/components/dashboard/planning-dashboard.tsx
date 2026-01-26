
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingUp, Calendar, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PlanningDashboardProps {
    seasonId: string;
    onSelectClient: (clientId: string) => void;
}

interface PlanningSummaryItem {
    clientId: string;
    clientName: string;
    totalValue: number;
    updatedAt: string; // JSON date string
}

export default function PlanningDashboard({ seasonId, onSelectClient }: PlanningDashboardProps) {
    const { data: summary, isLoading } = useQuery<PlanningSummaryItem[]>({
        queryKey: ["/api/planning/summary", seasonId],
        queryFn: async () => {
            const res = await apiRequest("GET", `/api/planning/summary?seasonId=${seasonId}`);
            return res.json();
        },
        enabled: !!seasonId,
    });

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!summary || summary.length === 0) {
        return (
            <Card>
                <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="bg-muted/50 p-4 rounded-full mb-4">
                        <TrendingUp className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium text-muted-foreground">Nenhum planejamento encontrado</h3>
                    <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                        Comece selecionando um cliente acima para criar o primeiro planejamento de vendas desta safra.
                    </p>
                </CardContent>
            </Card>
        );
    }

    const grandTotal = summary.reduce((acc, item) => acc + Number(item.totalValue), 0);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Summary Card */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card className="bg-primary/5 border-primary/20">
                    <CardHeader className="pb-2">
                        <CardDescription>Total em Planejamento</CardDescription>
                        <CardTitle className="text-4xl text-primary">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(grandTotal)}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            <span>{summary.length} clientes com planejamento ativo</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Clients List */}
            <Card>
                <CardHeader>
                    <CardTitle>Visão Geral por Cliente</CardTitle>
                    <CardDescription>
                        Acompanhe o progresso do planejamento de vendas por cliente.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead>Última Atualização</TableHead>
                                    <TableHead className="text-right">Valor Total</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {summary.map((item) => (
                                    <TableRow
                                        key={item.clientId}
                                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                                        onClick={() => onSelectClient(item.clientId)}
                                    >
                                        <TableCell className="font-medium">
                                            {item.clientName || "Cliente Sem Nome"}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="h-3 w-3" />
                                                {item.updatedAt ? format(new Date(item.updatedAt), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "-"}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(item.totalValue))}
                                        </TableCell>
                                        <TableCell>
                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                <ChevronRight className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
