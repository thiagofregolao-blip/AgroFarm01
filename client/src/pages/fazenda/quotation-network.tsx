import { useQuery } from "@tanstack/react-query";
import FarmLayout from "@/components/fazenda/layout";
import { TrendingUp, TrendingDown, Minus, ArrowDownUp, Package, Users } from "lucide-react";

export default function QuotationNetwork() {
    const { data, isLoading } = useQuery({
        queryKey: ["/api/farm/quotation-network"],
        queryFn: async () => {
            const res = await fetch("/api/farm/quotation-network", { credentials: "include" });
            if (!res.ok) throw new Error("Failed");
            return res.json();
        },
    });

    const comparisons = data?.comparisons || [];
    const summary = data?.summary || {};

    const getStatusIcon = (status: string) => {
        if (status === "above") return <TrendingUp size={16} color="#DC2626" />;
        if (status === "below") return <TrendingDown size={16} color="#16A34A" />;
        return <Minus size={16} color="#D97706" />;
    };

    const getStatusColor = (status: string) => {
        if (status === "above") return "#DC2626";
        if (status === "below") return "#16A34A";
        return "#D97706";
    };

    const getStatusLabel = (status: string, diff: number) => {
        if (status === "above") return `${Math.abs(diff)}% acima`;
        if (status === "below") return `${Math.abs(diff)}% abaixo`;
        return "Na média";
    };

    return (
        <FarmLayout>
            <div style={{ padding: 24 }}>
                {/* Header */}
                <div style={{ marginBottom: 24 }}>
                    <h1 style={{ fontSize: 24, fontWeight: 700, display: "flex", alignItems: "center", gap: 10, margin: 0 }}>
                        <ArrowDownUp size={28} color="#367C2B" />
                        Rede de Cotação
                    </h1>
                    <p style={{ color: "#6B7280", margin: "4px 0 0", fontSize: 14 }}>
                        Compare anonimamente seus preços com outros agricultores do sistema
                    </p>
                </div>

                {/* Summary Cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
                    {[
                        { icon: Package, label: "Produtos Comparados", value: summary.totalProducts || 0, color: "#367C2B" },
                        { icon: TrendingUp, label: "Acima da Média", value: summary.aboveAverage || 0, color: "#DC2626" },
                        { icon: TrendingDown, label: "Abaixo da Média", value: summary.belowAverage || 0, color: "#16A34A" },
                        { icon: Users, label: "Na Média", value: summary.atAverage || 0, color: "#D97706" },
                    ].map((card, i) => {
                        const Icon = card.icon;
                        return (
                            <div key={i} style={{
                                background: "#fff", borderRadius: 12, padding: 20,
                                border: "1px solid #E5E7EB",
                                display: "flex", alignItems: "center", gap: 16,
                            }}>
                                <div style={{ background: `${card.color}15`, borderRadius: 10, padding: 10 }}>
                                    <Icon size={22} color={card.color} />
                                </div>
                                <div>
                                    <div style={{ fontSize: 24, fontWeight: 700, color: "#111827" }}>{card.value}</div>
                                    <div style={{ fontSize: 12, color: "#6B7280" }}>{card.label}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Comparison Table */}
                {isLoading ? (
                    <div style={{ textAlign: "center", padding: 60, color: "#6B7280" }}>Carregando comparativos...</div>
                ) : comparisons.length === 0 ? (
                    <div style={{ textAlign: "center", padding: 60, color: "#6B7280" }}>
                        <ArrowDownUp size={48} color="#D1D5DB" style={{ marginBottom: 12 }} />
                        <div style={{ fontSize: 16, fontWeight: 600 }}>Dados insuficientes</div>
                        <div style={{ fontSize: 13, marginTop: 4 }}>
                            É necessário pelo menos 3 agricultores com o mesmo produto para gerar comparativos
                        </div>
                    </div>
                ) : (
                    <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E5E7EB", overflow: "hidden" }}>
                        {/* Table Header */}
                        <div style={{
                            display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr",
                            padding: "12px 16px", background: "#F9FAFB",
                            fontSize: 12, fontWeight: 600, color: "#6B7280",
                            borderBottom: "1px solid #E5E7EB",
                        }}>
                            <div>Produto</div>
                            <div style={{ textAlign: "right" }}>Seu Preço</div>
                            <div style={{ textAlign: "right" }}>Média</div>
                            <div style={{ textAlign: "right" }}>Menor</div>
                            <div style={{ textAlign: "right" }}>Maior</div>
                            <div style={{ textAlign: "center" }}>Status</div>
                        </div>

                        {/* Table Rows */}
                        {comparisons.map((comp: any, i: number) => (
                            <div key={i} style={{
                                display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr",
                                padding: "14px 16px", alignItems: "center",
                                borderBottom: i < comparisons.length - 1 ? "1px solid #F3F4F6" : "none",
                                fontSize: 14,
                            }}>
                                <div>
                                    <div style={{ fontWeight: 600, color: "#111827" }}>{comp.productName}</div>
                                    <div style={{ fontSize: 11, color: "#9CA3AF" }}>{comp.totalFarmers} agricultores • {comp.totalSamples} amostras</div>
                                </div>
                                <div style={{ textAlign: "right", fontWeight: 700, color: getStatusColor(comp.status) }}>
                                    {comp.myPrice.toFixed(2)}
                                </div>
                                <div style={{ textAlign: "right", color: "#374151" }}>{comp.averagePrice.toFixed(2)}</div>
                                <div style={{ textAlign: "right", color: "#16A34A" }}>{comp.minPrice.toFixed(2)}</div>
                                <div style={{ textAlign: "right", color: "#DC2626" }}>{comp.maxPrice.toFixed(2)}</div>
                                <div style={{ textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                                    {getStatusIcon(comp.status)}
                                    <span style={{
                                        fontSize: 12, fontWeight: 600,
                                        color: getStatusColor(comp.status),
                                        background: `${getStatusColor(comp.status)}10`,
                                        padding: "2px 8px", borderRadius: 12,
                                    }}>
                                        {getStatusLabel(comp.status, comp.diffPercentage)}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Privacy notice */}
                <div style={{
                    marginTop: 24, padding: 16, background: "#F3F4F6", borderRadius: 12,
                    fontSize: 13, color: "#6B7280", display: "flex", alignItems: "flex-start", gap: 10,
                }}>
                    <span style={{ fontSize: 18 }}>🔒</span>
                    <div>
                        <strong>Privacidade garantida:</strong> Todos os dados são anônimos. Nenhum nome de agricultor é revelado.
                        O comparativo só é exibido quando pelo menos 3 agricultores possuem dados do mesmo produto.
                    </div>
                </div>
            </div>
        </FarmLayout>
    );
}
