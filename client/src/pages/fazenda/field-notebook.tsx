import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import FarmLayout from "@/components/fazenda/layout";
import { BookOpen, Calendar, Sprout, MapPin, Clock, Package, Pencil, Trash2, X, Check, Download, AlertTriangle } from "lucide-react";
import { generateReceituarioPDF, downloadPDF } from "@/lib/pdf-receituario";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Entry {
    id: string;
    date: string;
    productId: string;
    productName: string;
    productCategory: string;
    productUnit: string;
    quantity: string;
    dosePerHa?: string;
    plotId?: string;
    plotName?: string;
    plotArea?: string;
    plotCrop?: string;
    propertyId?: string;
    propertyName?: string;
    equipmentId?: string;
    appliedBy?: string;
    notes?: string;
    seasonId?: string;
}

interface Group {
    key: string;
    date: string;
    plotName: string;
    plotArea: string;
    propertyName: string;
    appliedBy: string;
    products: Entry[];
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────
function EditModal({
    entry,
    onClose,
    onSaved,
}: {
    entry: Entry;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [quantity, setQuantity] = useState(parseFloat(entry.quantity).toString());
    const [appliedBy, setAppliedBy] = useState(entry.appliedBy || "");
    const [notes, setNotes] = useState(entry.notes || "");
    const [appliedAt, setAppliedAt] = useState(
        entry.date ? new Date(entry.date).toISOString().slice(0, 16) : ""
    );
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);

    async function handleSave() {
        const qty = parseFloat(quantity);
        if (!qty || qty <= 0) { setError("Quantidade inválida"); return; }
        setSaving(true);
        setError("");
        try {
            const res = await fetch(`/api/farm/field-notebook/${entry.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    quantity: qty,
                    appliedBy: appliedBy || undefined,
                    notes: notes || undefined,
                    appliedAt: appliedAt || undefined,
                }),
            });
            if (!res.ok) {
                const d = await res.json();
                throw new Error(d.error || "Erro ao salvar");
            }
            onSaved();
            onClose();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
            zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16,
        }}>
            <div style={{
                background: "#fff", borderRadius: 16, padding: 28, width: "100%",
                maxWidth: 480, boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
            }}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: 17, color: "#111827" }}>Editar Aplicação</div>
                        <div style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>{entry.productName}</div>
                    </div>
                    <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", padding: 4 }}>
                        <X size={20} />
                    </button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {/* Quantity */}
                    <div>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                            Quantidade ({entry.productUnit || "un"})
                        </label>
                        <input
                            type="number"
                            step="0.001"
                            min="0.001"
                            value={quantity}
                            onChange={e => setQuantity(e.target.value)}
                            style={{
                                width: "100%", padding: "10px 12px", borderRadius: 8,
                                border: "1.5px solid #D1D5DB", fontSize: 15, boxSizing: "border-box",
                            }}
                        />
                    </div>

                    {/* Applied by */}
                    <div>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                            Aplicado por
                        </label>
                        <input
                            type="text"
                            value={appliedBy}
                            onChange={e => setAppliedBy(e.target.value)}
                            style={{
                                width: "100%", padding: "10px 12px", borderRadius: 8,
                                border: "1.5px solid #D1D5DB", fontSize: 15, boxSizing: "border-box",
                            }}
                        />
                    </div>

                    {/* Date/time */}
                    <div>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                            Data e hora
                        </label>
                        <input
                            type="datetime-local"
                            value={appliedAt}
                            onChange={e => setAppliedAt(e.target.value)}
                            style={{
                                width: "100%", padding: "10px 12px", borderRadius: 8,
                                border: "1.5px solid #D1D5DB", fontSize: 15, boxSizing: "border-box",
                            }}
                        />
                    </div>

                    {/* Notes */}
                    <div>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                            Observações
                        </label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            rows={3}
                            style={{
                                width: "100%", padding: "10px 12px", borderRadius: 8,
                                border: "1.5px solid #D1D5DB", fontSize: 14,
                                resize: "vertical", boxSizing: "border-box",
                            }}
                        />
                    </div>

                    {error && (
                        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", color: "#DC2626", fontSize: 13 }}>
                            {error}
                        </div>
                    )}

                    {/* Info about stock adjustment */}
                    <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#1D4ED8", display: "flex", gap: 8, alignItems: "flex-start" }}>
                        <AlertTriangle size={14} style={{ marginTop: 1, flexShrink: 0 }} />
                        <span>A diferença de quantidade será automaticamente ajustada no estoque.</span>
                    </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
                    <button
                        onClick={onClose}
                        disabled={saving}
                        style={{
                            flex: 1, padding: "11px 0", borderRadius: 8, border: "1.5px solid #E5E7EB",
                            background: "#fff", color: "#374151", fontSize: 14, fontWeight: 600, cursor: "pointer",
                        }}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        style={{
                            flex: 2, padding: "11px 0", borderRadius: 8, border: "none",
                            background: saving ? "#9CA3AF" : "#367C2B", color: "#fff",
                            fontSize: 14, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        }}
                    >
                        <Check size={16} />
                        {saving ? "Salvando..." : "Salvar alterações"}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Delete Confirm ────────────────────────────────────────────────────────────
function DeleteConfirm({
    entry,
    onClose,
    onDeleted,
}: {
    entry: Entry;
    onClose: () => void;
    onDeleted: () => void;
}) {
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState("");

    async function handleDelete() {
        setDeleting(true);
        setError("");
        try {
            const res = await fetch(`/api/farm/field-notebook/${entry.id}`, {
                method: "DELETE",
                credentials: "include",
            });
            if (!res.ok) {
                const d = await res.json();
                throw new Error(d.error || "Erro ao excluir");
            }
            onDeleted();
            onClose();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setDeleting(false);
        }
    }

    return (
        <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
            zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16,
        }}>
            <div style={{
                background: "#fff", borderRadius: 16, padding: 28, width: "100%",
                maxWidth: 420, boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
            }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <div style={{ background: "#FEF2F2", borderRadius: 10, padding: 10 }}>
                            <Trash2 size={20} color="#DC2626" />
                        </div>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 16, color: "#111827" }}>Excluir aplicação?</div>
                            <div style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>{entry.productName}</div>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", padding: 4 }}>
                        <X size={20} />
                    </button>
                </div>

                <div style={{ background: "#FEF9F0", border: "1px solid #FCD34D", borderRadius: 8, padding: "12px 14px", fontSize: 13, color: "#92400E", marginBottom: 18 }}>
                    <strong>{parseFloat(entry.quantity).toFixed(2)} {entry.productUnit}</strong> de <strong>{entry.productName}</strong> será devolvida ao estoque.
                    Esta ação não pode ser desfeita.
                </div>

                {error && (
                    <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", color: "#DC2626", fontSize: 13, marginBottom: 14 }}>
                        {error}
                    </div>
                )}

                <div style={{ display: "flex", gap: 10 }}>
                    <button
                        onClick={onClose}
                        disabled={deleting}
                        style={{
                            flex: 1, padding: "11px 0", borderRadius: 8, border: "1.5px solid #E5E7EB",
                            background: "#fff", color: "#374151", fontSize: 14, fontWeight: 600, cursor: "pointer",
                        }}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleDelete}
                        disabled={deleting}
                        style={{
                            flex: 2, padding: "11px 0", borderRadius: 8, border: "none",
                            background: deleting ? "#9CA3AF" : "#DC2626", color: "#fff",
                            fontSize: 14, fontWeight: 600, cursor: deleting ? "not-allowed" : "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        }}
                    >
                        <Trash2 size={15} />
                        {deleting ? "Excluindo..." : "Confirmar exclusão"}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function FieldNotebook() {
    const [seasonId, setSeasonId] = useState<string>("");
    const [plotFilter, setPlotFilter] = useState<string>("");
    const [editEntry, setEditEntry] = useState<Entry | null>(null);
    const [deleteEntry, setDeleteEntry] = useState<Entry | null>(null);
    // After edit/delete on a group, offer PDF regeneration
    const [pendingPdfGroup, setPendingPdfGroup] = useState<Group | null>(null);

    const queryClient = useQueryClient();
    const queryUrl = `/api/farm/field-notebook${seasonId ? `?seasonId=${seasonId}` : ""}`;

    const { data, isLoading } = useQuery({
        queryKey: ["/api/farm/field-notebook", seasonId],
        queryFn: async () => {
            const res = await fetch(queryUrl, { credentials: "include" });
            if (!res.ok) throw new Error("Failed");
            return res.json();
        },
    });

    const entries: Entry[] = data?.entries || [];
    const summary = data?.summary || {};
    const seasons = data?.seasons || [];

    // Unique plot names for filter
    const uniquePlots = useMemo(() => {
        const names: string[] = [];
        for (const e of entries) {
            const name = e.plotName || "";
            if (name && names.indexOf(name) === -1) names.push(name);
        }
        return names.sort();
    }, [entries]);

    // Filter by plot
    const filteredEntries = useMemo(() => {
        if (!plotFilter) return entries;
        return entries.filter((e: Entry) => e.plotName === plotFilter);
    }, [entries, plotFilter]);

    // Group applications that happened together (same plot, within 5 min)
    const groupedEntries = useMemo<Group[]>(() => {
        if (!filteredEntries.length) return [];
        const groups: Group[] = [];
        const BATCH_WINDOW = 5 * 60 * 1000;

        for (const entry of filteredEntries) {
            const entryTime = entry.date ? new Date(entry.date).getTime() : 0;
            const existing = groups.find(g => {
                if (g.plotName !== (entry.plotName || "")) return false;
                const groupTime = new Date(g.date).getTime();
                return Math.abs(entryTime - groupTime) <= BATCH_WINDOW;
            });

            if (existing) {
                existing.products.push(entry);
            } else {
                groups.push({
                    key: `${entryTime}-${entry.plotName || "__none__"}`,
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
    }, [filteredEntries]);

    function handleAfterChange(group: Group) {
        queryClient.invalidateQueries({ queryKey: ["/api/farm/field-notebook"] });
        // Find updated group in current data to offer PDF
        setPendingPdfGroup(group);
    }

    function downloadGroupPDF(group: Group) {
        // Build PDF data from group products (same logic as PDV)
        const productsByProduct = new Map<string, any>();
        for (const p of group.products) {
            const key = p.productName || p.productId;
            if (!productsByProduct.has(key)) {
                productsByProduct.set(key, {
                    productName: p.productName || "Produto",
                    dosePerHa: p.dosePerHa ? parseFloat(p.dosePerHa) : undefined,
                    unit: p.productUnit || "un",
                    plots: [],
                });
            }
            productsByProduct.get(key)!.plots.push({
                plotName: group.plotName || "Talhão",
                quantity: parseFloat(p.quantity),
            });
        }

        const pdfData = {
            propertyName: group.propertyName || "Propriedade",
            appliedAt: new Date(group.date),
            products: Array.from(productsByProduct.values()),
            plots: group.plotArea
                ? [{ plotName: group.plotName, areaHa: parseFloat(group.plotArea), crop: group.products[0]?.plotCrop || "" }]
                : [],
        };

        const blob = generateReceituarioPDF(pdfData);
        const dateStr = new Date(group.date).toLocaleDateString("pt-BR").replace(/\//g, "-");
        downloadPDF(blob, `receituario-${dateStr}.pdf`);
        setPendingPdfGroup(null);
    }

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
                                    border: "1px solid #D1D5DB", fontSize: 14, background: "#fff",
                                }}
                            >
                                <option value="">Todas as safras</option>
                                {seasons.map((s: any) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        )}
                        {uniquePlots.length > 0 && (
                            <select
                                value={plotFilter}
                                onChange={e => setPlotFilter(e.target.value)}
                                style={{
                                    padding: "8px 12px", borderRadius: 8,
                                    border: "1px solid #D1D5DB", fontSize: 14, background: "#fff",
                                }}
                            >
                                <option value="">Todos os talhões</option>
                                {uniquePlots.map((name: string) => (
                                    <option key={name} value={name}>{name}</option>
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

                {/* PDF regeneration banner */}
                {pendingPdfGroup && (
                    <div style={{
                        background: "#EFF6FF", border: "1px solid #93C5FD", borderRadius: 10,
                        padding: "14px 18px", marginBottom: 20,
                        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
                    }}>
                        <div style={{ fontSize: 14, color: "#1E40AF" }}>
                            Aplicação alterada. Deseja baixar o receituário atualizado?
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                            <button
                                onClick={() => downloadGroupPDF(pendingPdfGroup)}
                                style={{
                                    padding: "8px 16px", borderRadius: 8, border: "none",
                                    background: "#1D4ED8", color: "#fff", fontSize: 13, fontWeight: 600,
                                    cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                                }}
                            >
                                <Download size={14} /> Baixar PDF
                            </button>
                            <button
                                onClick={() => setPendingPdfGroup(null)}
                                style={{
                                    padding: "8px 12px", borderRadius: 8, border: "1px solid #BFDBFE",
                                    background: "#fff", color: "#6B7280", fontSize: 13, cursor: "pointer",
                                }}
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                )}

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

                        {groupedEntries.map((group) => {
                            const date = group.date ? new Date(group.date) : null;
                            return (
                                <div key={group.key} style={{ position: "relative", marginBottom: 20 }}>
                                    {/* Timeline dot */}
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
                                        {/* Header */}
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                                            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 13, color: "#374151" }}>
                                                {group.plotName && (
                                                    <span style={{ fontWeight: 600 }}>
                                                        📍 {group.plotName} {group.plotArea ? `(${group.plotArea} ha)` : ""}
                                                    </span>
                                                )}
                                                {group.propertyName && <span>🏡 {group.propertyName}</span>}
                                                {group.appliedBy && <span>👤 {group.appliedBy}</span>}
                                            </div>
                                            <div style={{ fontSize: 12, color: "#6B7280", display: "flex", alignItems: "center", gap: 4 }}>
                                                <Clock size={12} />
                                                {date ? date.toLocaleDateString("pt-BR") : "-"}
                                                {date && ` ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
                                            </div>
                                        </div>

                                        {/* Products */}
                                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                            {group.products.map((p) => (
                                                <div key={p.id} style={{
                                                    display: "flex", alignItems: "center",
                                                    background: "#F9FAFB", borderRadius: 8, padding: "8px 12px",
                                                    gap: 8,
                                                }}>
                                                    {/* Product info */}
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
                                                        {p.notes && (
                                                            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>{p.notes}</div>
                                                        )}
                                                    </div>

                                                    {/* Quantity */}
                                                    {p.quantity && (
                                                        <div style={{ fontSize: 14, fontWeight: 700, color: "#367C2B", whiteSpace: "nowrap" }}>
                                                            {parseFloat(p.quantity).toFixed(2)} {p.productUnit || ""}
                                                        </div>
                                                    )}

                                                    {/* Actions */}
                                                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                                                        <button
                                                            onClick={() => setEditEntry(p)}
                                                            title="Editar aplicação"
                                                            aria-label="Editar aplicação"
                                                            style={{
                                                                width: 32, height: 32, borderRadius: 8,
                                                                border: "1px solid #E5E7EB", background: "#fff",
                                                                cursor: "pointer", display: "flex", alignItems: "center",
                                                                justifyContent: "center", color: "#2563EB",
                                                            }}
                                                        >
                                                            <Pencil size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => setDeleteEntry(p)}
                                                            title="Excluir aplicação"
                                                            aria-label="Excluir aplicação"
                                                            style={{
                                                                width: 32, height: 32, borderRadius: 8,
                                                                border: "1px solid #FCA5A5", background: "#FEF2F2",
                                                                cursor: "pointer", display: "flex", alignItems: "center",
                                                                justifyContent: "center", color: "#DC2626",
                                                            }}
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Footer */}
                                        <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "#9CA3AF" }}>
                                            <span>{group.products.length} produto{group.products.length > 1 ? "s" : ""}</span>
                                            <button
                                                onClick={() => downloadGroupPDF(group)}
                                                title="Baixar receituário"
                                                style={{
                                                    background: "none", border: "none", cursor: "pointer",
                                                    color: "#6B7280", display: "flex", alignItems: "center",
                                                    gap: 4, fontSize: 12, padding: "2px 6px", borderRadius: 6,
                                                }}
                                            >
                                                <Download size={12} /> Receituário
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            {editEntry && (
                <EditModal
                    entry={editEntry}
                    onClose={() => setEditEntry(null)}
                    onSaved={() => {
                        // Find the group that contained this entry to offer PDF
                        const group = groupedEntries.find(g => g.products.some(p => p.id === editEntry.id));
                        handleAfterChange(group || { ...editEntry, key: editEntry.id, products: [editEntry], plotName: editEntry.plotName || "", plotArea: editEntry.plotArea || "", propertyName: editEntry.propertyName || "", appliedBy: editEntry.appliedBy || "" });
                        setEditEntry(null);
                    }}
                />
            )}

            {/* Delete Confirm */}
            {deleteEntry && (
                <DeleteConfirm
                    entry={deleteEntry}
                    onClose={() => setDeleteEntry(null)}
                    onDeleted={() => {
                        queryClient.invalidateQueries({ queryKey: ["/api/farm/field-notebook"] });
                        setDeleteEntry(null);
                    }}
                />
            )}
        </FarmLayout>
    );
}
