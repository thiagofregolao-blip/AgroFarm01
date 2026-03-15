import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import FarmLayout from "@/components/fazenda/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, TrendingUp, TrendingDown, Minus, DollarSign, BarChart3 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const MONTH_NAMES = [
    "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

interface DayPrice {
    day: number;
    priceBushel: number;
    priceSaca: number;
}

interface YearSummary {
    avg: number;
    avgSaca: number;
    min: number;
    max: number;
    count: number;
}

interface CotacaoData {
    month: number;
    year: number;
    years: number[];
    data: Record<number, DayPrice[]>;
    summaries: Record<number, YearSummary>;
    bushelToSacaFactor: number;
}

export default function CotacaoSoja() {
    const now = new Date();
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());
    const [premio, setPremio] = useState<string>("");
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data, isLoading } = useQuery<CotacaoData>({
        queryKey: ["/api/farm/soja-cotacao", selectedMonth, selectedYear],
        queryFn: async () => {
            const res = await fetch(`/api/farm/soja-cotacao?month=${selectedMonth}&year=${selectedYear}`, {
                credentials: "include",
            });
            if (!res.ok) throw new Error("Erro ao carregar cotacoes");
            return res.json();
        },
    });

    const refreshMutation = useMutation({
        mutationFn: async () => {
            const res = await apiRequest("POST", "/api/farm/soja-cotacao/refresh", {
                month: selectedMonth,
                year: selectedYear,
            });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/soja-cotacao"] });
            toast({ title: "Cotacoes atualizadas", description: "Dados recarregados da bolsa" });
        },
        onError: () => {
            toast({ title: "Erro", description: "Falha ao atualizar cotacoes", variant: "destructive" });
        },
    });

    const premioValue = parseFloat(premio) || 0;
    const years = data?.years || [];
    const currentYear = selectedYear;

    // Build day-indexed data for the table
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const dayRows: number[] = [];
    for (let d = 1; d <= daysInMonth; d++) dayRows.push(d);

    // Helper: get price for a specific year/day
    const getPrice = (year: number, day: number): DayPrice | undefined => {
        const yearData = data?.data?.[year] || [];
        return yearData.find(p => p.day === day);
    };

    // Calculate today's price for comparison
    const todayDay = now.getDate();
    const todayPrice = data?.data?.[currentYear]?.find(p => p.day === todayDay);
    const latestPrice = data?.data?.[currentYear]?.slice(-1)?.[0];
    const referencePrice = todayPrice || latestPrice;

    // Year comparison helper
    const getVariation = (yearAvg: number, refPrice: number): number => {
        if (!refPrice) return 0;
        return ((refPrice - yearAvg) / yearAvg) * 100;
    };

    return (
        <FarmLayout>
            <div className="p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">Cotacao Soja - CBOT</h1>
                        <p className="text-sm text-gray-500">Historico de precos diarios em USD/bushel e USD/saca 60kg</p>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refreshMutation.mutate()}
                        disabled={refreshMutation.isPending}
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
                        Atualizar
                    </Button>
                </div>

                {/* Filters */}
                <Card>
                    <CardContent className="pt-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <Label className="text-xs font-medium text-gray-600 mb-1 block">Mes</Label>
                                <Select
                                    value={selectedMonth.toString()}
                                    onValueChange={(v) => setSelectedMonth(parseInt(v))}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {MONTH_NAMES.map((name, i) => (
                                            <SelectItem key={i} value={(i + 1).toString()}>{name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-xs font-medium text-gray-600 mb-1 block">Ano referencia</Label>
                                <Select
                                    value={selectedYear.toString()}
                                    onValueChange={(v) => setSelectedYear(parseInt(v))}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {[2026, 2025, 2024, 2023, 2022, 2021].map((y) => (
                                            <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-xs font-medium text-gray-600 mb-1 block">
                                    Premio (USD/bushel)
                                </Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    placeholder="Ex: -1.50"
                                    value={premio}
                                    onChange={(e) => setPremio(e.target.value)}
                                    className="font-mono"
                                />
                                <p className="text-[10px] text-gray-400 mt-1">
                                    Frete + silo + porto informado pela trading
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Summary Cards */}
                {referencePrice && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <Card>
                            <CardContent className="pt-4 pb-3">
                                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Ultimo Preco</p>
                                <p className="text-lg font-bold text-gray-900 font-mono">
                                    ${referencePrice.priceBushel.toFixed(2)}
                                    <span className="text-xs text-gray-400 ml-1">/bu</span>
                                </p>
                                <p className="text-xs text-gray-500 font-mono">
                                    ${referencePrice.priceSaca.toFixed(2)}/saca
                                </p>
                            </CardContent>
                        </Card>
                        {premioValue !== 0 && (
                            <Card>
                                <CardContent className="pt-4 pb-3">
                                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Com Premio</p>
                                    <p className="text-lg font-bold text-blue-700 font-mono">
                                        ${(referencePrice.priceBushel + premioValue).toFixed(2)}
                                        <span className="text-xs text-gray-400 ml-1">/bu</span>
                                    </p>
                                    <p className="text-xs text-blue-500 font-mono">
                                        ${((referencePrice.priceBushel + premioValue) * (data?.bushelToSacaFactor || 2.2046)).toFixed(2)}/saca
                                    </p>
                                </CardContent>
                            </Card>
                        )}
                        {data?.summaries?.[currentYear] && (
                            <>
                                <Card>
                                    <CardContent className="pt-4 pb-3">
                                        <p className="text-[10px] text-gray-500 uppercase tracking-wider">Media {MONTH_NAMES[selectedMonth - 1]}/{currentYear}</p>
                                        <p className="text-lg font-bold text-gray-900 font-mono">
                                            ${data.summaries[currentYear].avg.toFixed(2)}
                                            <span className="text-xs text-gray-400 ml-1">/bu</span>
                                        </p>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="pt-4 pb-3">
                                        <p className="text-[10px] text-gray-500 uppercase tracking-wider">Min / Max</p>
                                        <p className="text-sm font-bold text-gray-900 font-mono">
                                            ${data.summaries[currentYear].min.toFixed(2)} — ${data.summaries[currentYear].max.toFixed(2)}
                                        </p>
                                    </CardContent>
                                </Card>
                            </>
                        )}
                    </div>
                )}

                {/* Comparison Summary */}
                {data?.summaries && Object.keys(data.summaries).length > 1 && referencePrice && (
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                <BarChart3 className="h-4 w-4" />
                                Comparativo entre safras - {MONTH_NAMES[selectedMonth - 1]}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                                {years.map(y => {
                                    const summary = data.summaries?.[y];
                                    if (!summary) return null;
                                    const variation = getVariation(summary.avg, referencePrice.priceBushel);
                                    const isPositive = variation > 0;
                                    return (
                                        <div key={y} className="border rounded-lg p-3 text-center">
                                            <p className="text-xs font-semibold text-gray-600">{y}</p>
                                            <p className="text-sm font-bold font-mono">${summary.avg.toFixed(2)}</p>
                                            <p className="text-[10px] text-gray-400">{summary.count} dias</p>
                                            {y !== currentYear && (
                                                <div className={`flex items-center justify-center gap-1 mt-1 text-xs font-medium ${isPositive ? "text-green-600" : "text-red-600"}`}>
                                                    {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                                    {isPositive ? "+" : ""}{variation.toFixed(1)}%
                                                </div>
                                            )}
                                            {y === currentYear && (
                                                <div className="flex items-center justify-center gap-1 mt-1 text-xs font-medium text-gray-400">
                                                    <Minus className="h-3 w-3" /> atual
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Daily Price Table */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <DollarSign className="h-4 w-4" />
                            Precos diarios - {MONTH_NAMES[selectedMonth - 1]}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {isLoading ? (
                            <div className="p-8 text-center text-gray-400">Carregando cotacoes...</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="border-b bg-gray-50">
                                            <th className="px-3 py-2 text-left font-semibold text-gray-600 sticky left-0 bg-gray-50 z-10">Dia</th>
                                            {years.map(y => (
                                                <th key={y} className="px-2 py-2 text-center font-semibold text-gray-600 min-w-[120px]" colSpan={1}>
                                                    <div>{y}</div>
                                                    <div className="text-[9px] font-normal text-gray-400">USD/bu | USD/saca</div>
                                                </th>
                                            ))}
                                            {premioValue !== 0 && (
                                                <th className="px-2 py-2 text-center font-semibold text-blue-600 min-w-[100px]">
                                                    <div>{currentYear}</div>
                                                    <div className="text-[9px] font-normal text-blue-400">+ Premio</div>
                                                </th>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {dayRows.map(day => {
                                            const hasAnyData = years.some(y => getPrice(y, day));
                                            if (!hasAnyData) return null;

                                            const currentPrice = getPrice(currentYear, day);

                                            return (
                                                <tr key={day} className="border-b hover:bg-gray-50/50">
                                                    <td className="px-3 py-1.5 font-medium text-gray-700 sticky left-0 bg-white z-10">
                                                        {String(day).padStart(2, "0")}/{String(selectedMonth).padStart(2, "0")}
                                                    </td>
                                                    {years.map(y => {
                                                        const price = getPrice(y, day);
                                                        if (!price) {
                                                            return (
                                                                <td key={y} className="px-2 py-1.5 text-center text-gray-300">—</td>
                                                            );
                                                        }

                                                        // Color coding: compare with previous year same day
                                                        const prevYear = y - 1;
                                                        const prevPrice = getPrice(prevYear, day);
                                                        let cellColor = "text-gray-800";
                                                        if (prevPrice) {
                                                            if (price.priceBushel > prevPrice.priceBushel) cellColor = "text-green-700";
                                                            else if (price.priceBushel < prevPrice.priceBushel) cellColor = "text-red-600";
                                                        }

                                                        return (
                                                            <td key={y} className={`px-2 py-1.5 text-center font-mono ${cellColor}`}>
                                                                <span className="font-semibold">{price.priceBushel.toFixed(2)}</span>
                                                                <span className="text-gray-400 mx-0.5">|</span>
                                                                <span className="text-gray-600">{price.priceSaca.toFixed(2)}</span>
                                                            </td>
                                                        );
                                                    })}
                                                    {premioValue !== 0 && (
                                                        <td className="px-2 py-1.5 text-center font-mono text-blue-700 font-semibold">
                                                            {currentPrice ? (
                                                                <>
                                                                    {(currentPrice.priceBushel + premioValue).toFixed(2)}
                                                                    <span className="text-blue-400 mx-0.5">|</span>
                                                                    <span className="text-blue-500">
                                                                        {((currentPrice.priceBushel + premioValue) * (data?.bushelToSacaFactor || 2.2046)).toFixed(2)}
                                                                    </span>
                                                                </>
                                                            ) : "—"}
                                                        </td>
                                                    )}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    {/* Summary row */}
                                    <tfoot>
                                        <tr className="border-t-2 bg-gray-50 font-semibold">
                                            <td className="px-3 py-2 text-gray-700 sticky left-0 bg-gray-50 z-10">Media</td>
                                            {years.map(y => {
                                                const summary = data?.summaries?.[y];
                                                return (
                                                    <td key={y} className="px-2 py-2 text-center font-mono text-gray-800">
                                                        {summary ? (
                                                            <>
                                                                <span>{summary.avg.toFixed(2)}</span>
                                                                <span className="text-gray-400 mx-0.5">|</span>
                                                                <span className="text-gray-600">{summary.avgSaca.toFixed(2)}</span>
                                                            </>
                                                        ) : "—"}
                                                    </td>
                                                );
                                            })}
                                            {premioValue !== 0 && (
                                                <td className="px-2 py-2 text-center font-mono text-blue-700">
                                                    {data?.summaries?.[currentYear] ? (
                                                        <>
                                                            {(data.summaries[currentYear].avg + premioValue).toFixed(2)}
                                                            <span className="text-blue-400 mx-0.5">|</span>
                                                            <span className="text-blue-500">
                                                                {((data.summaries[currentYear].avg + premioValue) * (data?.bushelToSacaFactor || 2.2046)).toFixed(2)}
                                                            </span>
                                                        </>
                                                    ) : "—"}
                                                </td>
                                            )}
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <p className="text-[10px] text-gray-400 text-center">
                    Fonte: CBOT Soybean Futures (ZS=F) via Yahoo Finance. 1 saca 60kg = 2.2046 bushels.
                    Premio = frete + silo + porto informado pela trading.
                </p>
            </div>
        </FarmLayout>
    );
}
