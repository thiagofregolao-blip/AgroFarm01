import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import FarmLayout from "@/components/fazenda/layout";
import { BookOpen, Calendar, Sprout, MapPin, Filter, FileDown, Clock, Package } from "lucide-react";

export default function FieldNotebook() {
    const [seasonId, setSeasonId] = useState<string>("");

    const queryUrl = `/api/farm/field-notebook${seasonId ? `?seasonId=${seasonId}` : ""}`;

    const { data, isLoading } = useQuery({
        queryKey: ["/api/farm/field-notebook", seasonId],
        queryFn: async () => {
            const res = await fetch(queryUrl, { credentials: "include" });
            if (!res.ok) throw new Error("Failed");
            return res.json();
        },
    });

    const entries = data?.entries || [];
    const summary = data?.summary || {};
    const seasons = data?.seasons || [];

    // Agrupar aplicações que aconteceram juntas (mesmo talhão, dentro de 5 min)
    const groupedEntries = useMemo(() => {
        if (!entries.length) return [];
        const groups: { key: string; date: string; plotName: string; plotArea: string; propertyName: string; appliedBy: string; products: any[] }[] = [];
        const BATCH_WINDOW = 5 * 60 * 1000; // 5 minutos

        for (const entry of entries) {
            const entryTime = entry.date ? new Date(entry.date).getTime() : 0;
            const plotKey = entry.plotName || "__none__";

            // Tentar encontrar grupo existente compatível
            const existing = groups.find(g => {
                if (g.plotName !== (entry.plotName || "")) return false;
                const groupTime = new Date(g.date).getTime();
                return Math.abs(entryTime - groupTime) <= BATCH_WINDOW;
            });

            if (existing) {
                existing.products.push(entry);
            } else {
                groups.push({
                    key: `${entryTime}-${plotKey}`,
                    date: entry.date,
                    plotName: entry.plotName || "",
                    plotArea: entry.plotArea || "",
                    propertyName: entry.propertyName || "",
                    appliedBy: entry.appliedBy || "",
                    products: [entry],
                });
            }
        }
        return groups;
    }, [entries]);

    return (
        <FarmLayout>
            <div style={{ padding: 24 }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
                    <div>
                        <h1 style={{ fontSize: 24, fontWeight: 700, display: "flex", alignItems: "center", gap: 10, margin: 0 }}>
                            <BookOpen size={28} color="#367C2B" />
                            Caderno de Campo
                        </h1>
                        <p style={{ color: "#6B7280", margin: "4px 0 0", fontSize: 14 }}>
                            Registro automático das aplicações realizadas
                        </p>
                    </div>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        {seasons.length > 0 && (
                            <select
                                value={seasonId}
                                onChange={e => setSeasonId(e.target.value)}
                                style={{
                                    padding: "8px 12px", borderRadius: 8,
                                    border: "1px solid #D1D5DB", fontSize: 14,
                                    background: "#fff",
                                }}
                            >
                                <option value="">Todas as safras</option>
                                {seasons.map((s: any) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        )}
                    </div>
                </div>

                {/* Summary Cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
                    {[
                        { icon: Sprout, label: "Aplicações", value: summary.totalApplications || 0, color: "#367C2B" },
                        { icon: BookOpen, label: "Produtos Usados", value: summary.uniqueProducts || 0, color: "#2563EB" },
                        { icon: MapPin, label: "Talhões", value: summary.uniquePlots || 0, color: "#D97706" },
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

                {/* Timeline */}
                {isLoading ? (
                    <div style={{ textAlign: "center", padding: 60, color: "#6B7280" }}>Carregando caderno de campo...</div>
                ) : entries.length === 0 ? (
                    <div style={{ textAlign: "center", padding: 60, color: "#6B7280" }}>
                        <BookOpen size={48} color="#D1D5DB" style={{ marginBottom: 12 }} />
                        <div>Nenhuma aplicação registrada ainda</div>
                    </div>
                ) : (
                    <div style={{ position: "relative", paddingLeft: 30 }}>
                        {/* Vertical line */}
                        <div style={{ position: "absolute", left: 14, top: 0, bottom: 0, width: 2, background: "#E5E7EB" }} />

                        {groupedEntries.map((group, i) => {
                            const date = group.date ? new Date(group.date) : null;
                            return (
                                <div key={group.key} style={{ position: "relative", marginBottom: 20 }}>
                                    {/* Dot */}
                                    <div style={{
                                        position: "absolute", left: -23, top: 8,
                                        width: 12, height: 12, borderRadius: "50%",
                                        background: "#367C2B", border: "2px solid #fff",
                                        boxShadow: "0 0 0 2px #367C2B",
                                    }} />

                                    {/* Card */}
                                    <div style={{
                                        background: "#fff", borderRadius: 12, padding: 16,
                                        border: "1px solid #E5E7EB",
                                    }}>
                                        {/* Header: data + local */}
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                                            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 13, color: "#374151" }}>
                                                {group.plotName && (
                                                    <span style={{ fontWeight: 600 }}>📍 {group.plotName} {group.plotArea ? `(${group.plotArea} ha)` : ""}</span>
                                                )}
                                                {group.propertyName && (
                                                    <span>🏡 {group.propertyName}</span>
                                                )}
                                                {group.appliedBy && (
                                                    <span>👤 {group.appliedBy}</span>
                                                )}
                                            </div>
                                            <div style={{ fontSize: 12, color: "#6B7280", display: "flex", alignItems: "center", gap: 4 }}>
                                                <Clock size={12} />
                                                {date ? date.toLocaleDateString("pt-BR") : "-"}
                                            </div>
                                        </div>

                                        {/* Produtos da aplicação */}
                                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                            {group.products.map((p: any) => (
                                                <div key={p.id} style={{
                                                    display: "flex", alignItems: "center", justifyContent: "space-between",
                                                    background: "#F9FAFB", borderRadius: 8, padding: "8px 12px",
                                                }}>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>
                                                            {p.productName || "Produto"}
                                                        </div>
                                                        {p.productCategory && (
                                                            <span style={{
                                                                display: "inline-block", marginTop: 4,
                                                                background: "#367C2B15", color: "#367C2B",
                                                                padding: "1px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600,
                                                            }}>
                                                                {p.productCategory}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {p.quantity && (
                                                        <div style={{ fontSize: 14, fontWeight: 700, color: "#367C2B", whiteSpace: "nowrap", marginLeft: 12 }}>
                                                            {parseFloat(p.quantity).toFixed(2)} {p.productUnit || ""}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>

                                        {/* Rodapé: total de produtos */}
                                        <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", fontSize: 12, color: "#9CA3AF" }}>
                                            <span>{group.products.length} produto{group.products.length > 1 ? "s" : ""}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </FarmLayout>
    );
}
