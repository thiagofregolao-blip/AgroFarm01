import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, FileX, Trash2, AlertTriangle, X, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// ── Types ─────────────────────────────────────────────────────────────────────
type TaxRegime = "exenta" | "iva5" | "iva10";
type NoteType = "discount" | "return";

interface Supplier { id: string; name: string; ruc?: string; }

interface CreditNoteItem {
    productId?: string;
    description: string;
    quantity: number;
    unitPrice: number;
    taxRegime: TaxRegime;
    subtotal: number;
}

interface LinkedInvoice {
    invoiceId: string;
    invoiceType: "payable";
    supplier: string;
    invoiceNumber?: string;
    remainingAmount: number;
    allocatedAmount: number;
}

interface CreditNote {
    id: string;
    noteType: string;
    supplier: string;
    timbrado: string;
    noteNumber: string;
    issueDate: string;
    totalAmount: number;
    status: string;
    currency: string;
}

interface AvailableInvoice {
    id: string;
    supplier: string;
    invoiceNumber?: string;
    totalAmount: number;
    remainingAmount: number;
    dueDate: string;
    status: string;
}

interface InvoiceItem {
    id: string;
    productId?: string;
    productName: string;
    unit?: string;
    quantity: number;
    unitPrice: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
    new Intl.NumberFormat("es-PY", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);

// ── Main Component ────────────────────────────────────────────────────────────
export default function CreditNotesProvider() {
    const { toast } = useToast();
    const qc = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [annulId, setAnnulId] = useState<string | null>(null);

    // Form state
    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
    const [supplierSearch, setSupplierSearch] = useState("");
    const [showSupplierDrop, setShowSupplierDrop] = useState(false);
    const [timbrado, setTimbrado] = useState("");
    const [noteNumber, setNoteNumber] = useState("");
    const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [noteType, setNoteType] = useState<NoteType>("discount");
    const [items, setItems] = useState<CreditNoteItem[]>([
        { description: "Desconto concedido", quantity: 1, unitPrice: 0, taxRegime: "exenta", subtotal: 0 },
    ]);
    const [linkedInvoices, setLinkedInvoices] = useState<LinkedInvoice[]>([]);
    const [invoiceSearch, setInvoiceSearch] = useState("");

    // ── Queries ───────────────────────────────────────────────────────────────
    const { data: creditNotes = [] } = useQuery<CreditNote[]>({
        queryKey: ["/api/farm/credit-notes", "provider"],
        queryFn: () => fetch("/api/farm/credit-notes?type=provider").then(r => r.json()),
    });

    const { data: suppliers = [] } = useQuery<Supplier[]>({
        queryKey: ["/api/farm/suppliers"],
        queryFn: () => fetch("/api/farm/suppliers").then(r => r.json()),
        enabled: showForm,
    });

    // Faturas filtradas pelo fornecedor selecionado
    const { data: availableInvoices = [] } = useQuery<AvailableInvoice[]>({
        queryKey: ["/api/farm/credit-notes/invoices/available", "payable", selectedSupplier?.id],
        queryFn: () =>
            fetch(`/api/farm/credit-notes/invoices/available?invoiceType=payable&supplierId=${selectedSupplier!.id}`)
                .then(r => r.json()),
        enabled: showForm && !!selectedSupplier,
    });

    // Itens de cada fatura vinculada (para devolução)
    const linkedIds = linkedInvoices.map(x => x.invoiceId);
    const { data: invoiceItemsMap = {} } = useQuery<Record<string, InvoiceItem[]>>({
        queryKey: ["/api/farm/credit-notes/invoice-items-multi", ...linkedIds],
        queryFn: async () => {
            const map: Record<string, InvoiceItem[]> = {};
            await Promise.all(
                linkedIds.map(async (apId) => {
                    const data = await fetch(`/api/farm/credit-notes/invoice-items/${apId}`).then(r => r.json());
                    map[apId] = data;
                })
            );
            return map;
        },
        enabled: noteType === "return" && linkedIds.length > 0,
    });

    // Todos os itens de todas as faturas vinculadas (sem duplicatas por productId)
    const allInvoiceItems: InvoiceItem[] = Object.values(invoiceItemsMap).flat();

    // ── Mutations ─────────────────────────────────────────────────────────────
    const createMutation = useMutation({
        mutationFn: (body: any) => apiRequest("POST", "/api/farm/credit-notes", body),
        onSuccess: () => {
            toast({ title: "Nota de crédito lançada com sucesso" });
            qc.invalidateQueries({ queryKey: ["/api/farm/credit-notes"] });
            qc.invalidateQueries({ queryKey: ["/api/farm/accounts-payable"] });
            resetForm();
        },
        onError: async (err: any) => {
            const msg = await err?.response?.json?.().then((d: any) => d.error).catch(() => err.message);
            toast({ title: "Erro", description: msg, variant: "destructive" });
        },
    });

    const annulMutation = useMutation({
        mutationFn: (id: string) => apiRequest("DELETE", `/api/farm/credit-notes/${id}`),
        onSuccess: () => {
            toast({ title: "Nota anulada" });
            qc.invalidateQueries({ queryKey: ["/api/farm/credit-notes"] });
            qc.invalidateQueries({ queryKey: ["/api/farm/accounts-payable"] });
            setAnnulId(null);
        },
        onError: async (err: any) => {
            const msg = await err?.response?.json?.().then((d: any) => d.error).catch(() => err.message);
            toast({ title: "Erro", description: msg, variant: "destructive" });
        },
    });

    // ── Helpers ───────────────────────────────────────────────────────────────
    function resetForm() {
        setShowForm(false);
        setSelectedSupplier(null); setSupplierSearch(""); setShowSupplierDrop(false);
        setTimbrado(""); setNoteNumber("");
        setIssueDate(new Date().toISOString().slice(0, 10));
        setNoteType("discount");
        setItems([{ description: "Desconto concedido", quantity: 1, unitPrice: 0, taxRegime: "exenta", subtotal: 0 }]);
        setLinkedInvoices([]);
        setInvoiceSearch("");
    }

    function selectSupplier(s: Supplier) {
        setSelectedSupplier(s);
        setSupplierSearch(s.name);
        setShowSupplierDrop(false);
        // Limpa faturas vinculadas ao trocar fornecedor
        setLinkedInvoices([]);
    }

    function updateItem(idx: number, field: keyof CreditNoteItem, value: any) {
        setItems(prev => {
            const next = [...prev];
            next[idx] = { ...next[idx], [field]: value };
            const qty = field === "quantity" ? parseFloat(value) || 0 : parseFloat(String(next[idx].quantity)) || 0;
            const price = field === "unitPrice" ? parseFloat(value) || 0 : parseFloat(String(next[idx].unitPrice)) || 0;
            next[idx].subtotal = parseFloat((qty * price).toFixed(2));
            return next;
        });
    }

    function addReturnItem(inv: InvoiceItem) {
        // Evita duplicata pelo productId
        if (inv.productId && items.some(i => i.productId === inv.productId)) {
            toast({ title: "Item já adicionado", variant: "destructive" });
            return;
        }
        setItems(prev => [
            ...prev,
            {
                productId: inv.productId,
                description: inv.productName,
                quantity: 0,
                unitPrice: inv.unitPrice,
                taxRegime: "exenta",
                subtotal: 0,
            },
        ]);
    }

    function toggleInvoice(inv: AvailableInvoice) {
        setLinkedInvoices(prev => {
            const exists = prev.find(x => x.invoiceId === inv.id);
            if (exists) return prev.filter(x => x.invoiceId !== inv.id);
            return [
                ...prev,
                {
                    invoiceId: inv.id,
                    invoiceType: "payable",
                    supplier: inv.supplier,
                    invoiceNumber: inv.invoiceNumber,
                    remainingAmount: parseFloat(String(inv.remainingAmount)),
                    allocatedAmount: 0,
                },
            ];
        });
        // Limpa itens de devolução ao mudar faturas
        if (noteType === "return") setItems([]);
    }

    function updateAllocated(invoiceId: string, value: number) {
        setLinkedInvoices(prev =>
            prev.map(x => x.invoiceId === invoiceId ? { ...x, allocatedAmount: value } : x)
        );
    }

    const totalItems = items.reduce((s, i) => s + (i.subtotal || 0), 0);
    const totalAllocated = linkedInvoices.reduce((s, i) => s + (i.allocatedAmount || 0), 0);
    const balanced = Math.abs(totalItems - totalAllocated) <= 0.02;

    const filteredSuppliers = suppliers.filter(s =>
        s.name.toLowerCase().includes(supplierSearch.toLowerCase())
    );

    const filteredInvoices = availableInvoices.filter(inv =>
        inv.supplier?.toLowerCase().includes(invoiceSearch.toLowerCase()) ||
        inv.invoiceNumber?.toLowerCase().includes(invoiceSearch.toLowerCase())
    );

    function handleSubmit() {
        if (!selectedSupplier) return toast({ title: "Selecione um provedor cadastrado", variant: "destructive" });
        if (!timbrado.trim() || !noteNumber.trim()) return toast({ title: "Informe timbrado e número", variant: "destructive" });
        if (items.length === 0) return toast({ title: "Adicione ao menos um item", variant: "destructive" });
        if (linkedInvoices.length === 0) return toast({ title: "Vincule ao menos uma fatura", variant: "destructive" });
        if (!balanced) return toast({ title: "Total dos itens deve ser igual ao total alocado nas faturas", variant: "destructive" });

        createMutation.mutate({
            type: "provider",
            noteType,
            supplier: selectedSupplier.name,
            supplierId: selectedSupplier.id,
            timbrado,
            noteNumber,
            issueDate,
            items: items.map(it => ({
                productId: it.productId,
                description: it.description,
                quantity: it.quantity,
                unitPrice: it.unitPrice,
                taxRegime: it.taxRegime,
                subtotal: it.subtotal,
            })),
            invoices: linkedInvoices.map(inv => ({
                invoiceId: inv.invoiceId,
                invoiceType: inv.invoiceType,
                allocatedAmount: inv.allocatedAmount,
            })),
        });
    }

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="p-4 md:p-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Notas de Crédito — Provedores</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Notas de crédito recebidas de fornecedores</p>
                </div>
                <Button onClick={() => setShowForm(true)} className="gap-2">
                    <Plus size={16} /> Nova Nota
                </Button>
            </div>

            {/* List */}
            {creditNotes.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                    <FileX size={40} className="mx-auto mb-3 opacity-40" />
                    <p className="text-sm">Nenhuma nota de crédito lançada</p>
                </div>
            ) : (
                <div className="rounded-xl border overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-600 uppercase text-[11px] tracking-wide">
                            <tr>
                                <th className="px-4 py-3 text-left">Data</th>
                                <th className="px-4 py-3 text-left">Provedor</th>
                                <th className="px-4 py-3 text-left">Timbrado / Nº</th>
                                <th className="px-4 py-3 text-left">Tipo</th>
                                <th className="px-4 py-3 text-right">Valor</th>
                                <th className="px-4 py-3 text-center">Status</th>
                                <th className="px-4 py-3" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {creditNotes.map(cn => (
                                <tr key={cn.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-gray-700">{new Date(cn.issueDate).toLocaleDateString("pt-BR")}</td>
                                    <td className="px-4 py-3 font-medium">{cn.supplier}</td>
                                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{cn.timbrado} / {cn.noteNumber}</td>
                                    <td className="px-4 py-3">
                                        <Badge variant={cn.noteType === "discount" ? "secondary" : "outline"}>
                                            {cn.noteType === "discount" ? "Desconto" : "Devolução"}
                                        </Badge>
                                    </td>
                                    <td className="px-4 py-3 text-right font-semibold">{fmt(parseFloat(String(cn.totalAmount)))}</td>
                                    <td className="px-4 py-3 text-center">
                                        <Badge variant={cn.status === "annulled" ? "destructive" : "default"}>
                                            {cn.status === "annulled" ? "Anulada" : "Ativa"}
                                        </Badge>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {cn.status !== "annulled" && (
                                            <button onClick={() => setAnnulId(cn.id)} className="text-red-500 hover:text-red-700 p-1 rounded" aria-label="Anular">
                                                <Trash2 size={15} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Annul confirm */}
            {annulId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <AlertTriangle className="text-amber-500" size={24} />
                            <h2 className="font-bold text-gray-900">Anular nota de crédito?</h2>
                        </div>
                        <p className="text-sm text-gray-600 mb-6">
                            Os saldos das faturas vinculadas serão restaurados. Este número não poderá ser reutilizado.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <Button variant="outline" onClick={() => setAnnulId(null)}>Cancelar</Button>
                            <Button variant="destructive" onClick={() => annulMutation.mutate(annulId!)} disabled={annulMutation.isPending}>
                                Anular
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create form modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-8 px-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
                        {/* Modal header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b">
                            <h2 className="font-bold text-gray-900">Nova Nota de Crédito — Provedor</h2>
                            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="px-6 py-5 space-y-6">

                            {/* ── 1. Dados da Nota ────────────────────────── */}
                            <section>
                                <h3 className="text-xs font-semibold uppercase text-gray-400 mb-3">Dados da Nota</h3>
                                <div className="grid grid-cols-2 gap-3">

                                    {/* Provedor — dropdown de cadastrados */}
                                    <div className="col-span-2 relative">
                                        <Label>Provedor *</Label>
                                        <div className="relative">
                                            <Input
                                                value={supplierSearch}
                                                onChange={e => {
                                                    setSupplierSearch(e.target.value);
                                                    setSelectedSupplier(null);
                                                    setShowSupplierDrop(true);
                                                }}
                                                onFocus={() => setShowSupplierDrop(true)}
                                                placeholder="Buscar provedor cadastrado..."
                                                className={selectedSupplier ? "border-green-500 bg-green-50" : ""}
                                            />
                                            <ChevronDown size={16} className="absolute right-3 top-3 text-gray-400 pointer-events-none" />
                                        </div>
                                        {showSupplierDrop && filteredSuppliers.length > 0 && (
                                            <div className="absolute z-20 left-0 right-0 mt-1 bg-white border rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                                {filteredSuppliers.map(s => (
                                                    <div
                                                        key={s.id}
                                                        onMouseDown={() => selectSupplier(s)}
                                                        className="px-4 py-2.5 hover:bg-blue-50 cursor-pointer text-sm flex items-center justify-between"
                                                    >
                                                        <span className="font-medium">{s.name}</span>
                                                        {s.ruc && <span className="text-gray-400 text-xs">RUC {s.ruc}</span>}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {showSupplierDrop && supplierSearch && filteredSuppliers.length === 0 && (
                                            <div className="absolute z-20 left-0 right-0 mt-1 bg-white border rounded-xl shadow-lg px-4 py-3 text-sm text-gray-400">
                                                Nenhum provedor encontrado. Cadastre em <strong>Empresas e Pessoas</strong>.
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <Label>Timbrado *</Label>
                                        <Input value={timbrado} onChange={e => setTimbrado(e.target.value)} placeholder="Ex: 12345678" />
                                    </div>
                                    <div>
                                        <Label>Número da Nota *</Label>
                                        <Input value={noteNumber} onChange={e => setNoteNumber(e.target.value)} placeholder="001-001-0000000" />
                                    </div>
                                    <div>
                                        <Label>Data de Emissão *</Label>
                                        <Input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} />
                                    </div>
                                    <div>
                                        <Label>Tipo de Nota *</Label>
                                        <select
                                            value={noteType}
                                            onChange={e => {
                                                const t = e.target.value as NoteType;
                                                setNoteType(t);
                                                setItems(t === "discount"
                                                    ? [{ description: "Desconto concedido", quantity: 1, unitPrice: 0, taxRegime: "exenta", subtotal: 0 }]
                                                    : []
                                                );
                                            }}
                                            className="w-full border rounded-md px-3 py-2 text-sm"
                                        >
                                            <option value="discount">Desconto</option>
                                            <option value="return">Devolução de Itens</option>
                                        </select>
                                    </div>
                                </div>
                            </section>

                            {/* ── 2. Faturas Vinculadas ────────────────────── */}
                            <section>
                                <h3 className="text-xs font-semibold uppercase text-gray-400 mb-3">Faturas Vinculadas *</h3>

                                {!selectedSupplier ? (
                                    <p className="text-sm text-gray-400 border rounded-lg px-4 py-3 bg-gray-50">
                                        Selecione um provedor para ver as faturas disponíveis.
                                    </p>
                                ) : (
                                    <>
                                        <Input
                                            placeholder="Buscar por número da fatura..."
                                            value={invoiceSearch}
                                            onChange={e => setInvoiceSearch(e.target.value)}
                                            className="mb-2"
                                        />
                                        <div className="max-h-44 overflow-y-auto border rounded-lg divide-y text-sm">
                                            {filteredInvoices.length === 0 ? (
                                                <p className="px-3 py-3 text-gray-400">
                                                    Nenhuma fatura com saldo em aberto para {selectedSupplier.name}
                                                </p>
                                            ) : filteredInvoices.map(inv => {
                                                const selected = linkedInvoices.find(x => x.invoiceId === inv.id);
                                                return (
                                                    <div
                                                        key={inv.id}
                                                        onClick={() => toggleInvoice(inv)}
                                                        className={`flex items-center justify-between px-3 py-2.5 cursor-pointer hover:bg-blue-50 transition-colors ${selected ? "bg-blue-50" : ""}`}
                                                    >
                                                        <div>
                                                            {inv.invoiceNumber && (
                                                                <span className="font-mono text-xs text-gray-600 font-medium">{inv.invoiceNumber}</span>
                                                            )}
                                                            <span className="ml-2 text-xs text-gray-400">
                                                                venc. {new Date(inv.dueDate).toLocaleDateString("pt-BR")}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-gray-600 font-medium text-xs">
                                                                Saldo: {fmt(parseFloat(String(inv.remainingAmount)))}
                                                            </span>
                                                            {selected && <Check size={14} className="text-blue-600" />}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Allocation inputs */}
                                        {linkedInvoices.length > 0 && (
                                            <div className="mt-3 space-y-2">
                                                <p className="text-xs text-gray-500 font-medium">Valor a alocar por fatura:</p>
                                                {linkedInvoices.map(inv => (
                                                    <div key={inv.invoiceId} className="flex items-center gap-3">
                                                        <span className="flex-1 text-sm truncate font-mono text-gray-600">{inv.invoiceNumber || inv.invoiceId.slice(0, 8)}</span>
                                                        <span className="text-xs text-gray-400 shrink-0">máx {fmt(inv.remainingAmount)}</span>
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            max={inv.remainingAmount}
                                                            className="w-36"
                                                            value={inv.allocatedAmount || ""}
                                                            onChange={e => updateAllocated(inv.invoiceId, parseFloat(e.target.value) || 0)}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}
                            </section>

                            {/* ── 3. Itens ─────────────────────────────────── */}
                            <section>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-xs font-semibold uppercase text-gray-400">Itens</h3>
                                </div>

                                {/* Painel de itens da fatura para devolução */}
                                {noteType === "return" && (
                                    <div className="mb-3">
                                        {linkedInvoices.length === 0 ? (
                                            <p className="text-sm text-gray-400 border rounded-lg px-4 py-3 bg-gray-50">
                                                Vincule ao menos uma fatura para ver os itens disponíveis.
                                            </p>
                                        ) : allInvoiceItems.length === 0 ? (
                                            <p className="text-sm text-gray-400 border rounded-lg px-4 py-3 bg-gray-50">
                                                Nenhum item encontrado nas faturas selecionadas.
                                            </p>
                                        ) : (
                                            <div className="border rounded-lg overflow-hidden">
                                                <div className="bg-gray-50 px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase">
                                                    Itens das faturas — clique para adicionar à devolução
                                                </div>
                                                {allInvoiceItems.map(inv => {
                                                    const alreadyAdded = items.some(i => i.productId === inv.productId && inv.productId);
                                                    return (
                                                        <div
                                                            key={inv.id}
                                                            onClick={() => !alreadyAdded && addReturnItem(inv)}
                                                            className={`flex items-center justify-between px-3 py-2.5 border-t text-sm transition-colors
                                                                ${alreadyAdded ? "bg-green-50 cursor-default" : "cursor-pointer hover:bg-blue-50"}`}
                                                        >
                                                            <span className={alreadyAdded ? "text-green-700 font-medium" : ""}>{inv.productName}</span>
                                                            <div className="flex items-center gap-3">
                                                                <span className="text-gray-400 text-xs">
                                                                    {fmt(inv.unitPrice)}/{inv.unit || "un"} · estoque {inv.quantity}
                                                                </span>
                                                                {alreadyAdded && <Check size={13} className="text-green-600" />}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Linhas de itens adicionados */}
                                <div className="space-y-2">
                                    {items.map((item, idx) => (
                                        <div key={idx} className="border rounded-lg p-3 space-y-2">
                                            <div className="flex gap-2 items-center">
                                                <span className="flex-1 text-sm font-medium text-gray-700 truncate">{item.description}</span>
                                                <button onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 p-1 shrink-0">
                                                    <X size={14} />
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-4 gap-2">
                                                <div>
                                                    <Label className="text-xs">Qtd *</Label>
                                                    <Input
                                                        type="number"
                                                        step="0.001"
                                                        min="0"
                                                        value={item.quantity || ""}
                                                        onChange={e => updateItem(idx, "quantity", e.target.value)}
                                                    />
                                                </div>
                                                <div>
                                                    <Label className="text-xs">Preço Unit.</Label>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        value={item.unitPrice || ""}
                                                        onChange={e => updateItem(idx, "unitPrice", e.target.value)}
                                                    />
                                                </div>
                                                <div>
                                                    <Label className="text-xs">Regime *</Label>
                                                    <select
                                                        value={item.taxRegime}
                                                        onChange={e => updateItem(idx, "taxRegime", e.target.value as TaxRegime)}
                                                        className="w-full border rounded-md px-2 py-2 text-sm"
                                                    >
                                                        <option value="exenta">Exenta</option>
                                                        <option value="iva5">IVA 5%</option>
                                                        <option value="iva10">IVA 10%</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <Label className="text-xs">Subtotal</Label>
                                                    <Input readOnly value={fmt(item.subtotal)} className="bg-gray-50 font-medium" />
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {noteType === "discount" && (
                                        <button
                                            onClick={() => setItems(prev => [
                                                ...prev,
                                                { description: "Desconto concedido", quantity: 1, unitPrice: 0, taxRegime: "exenta", subtotal: 0 }
                                            ])}
                                            className="text-sm text-blue-600 hover:underline flex items-center gap-1 mt-1"
                                        >
                                            <Plus size={13} /> Adicionar linha
                                        </button>
                                    )}

                                    {items.length === 0 && noteType === "return" && (
                                        <p className="text-sm text-gray-400 text-center py-3">
                                            Clique nos itens acima para adicioná-los à devolução
                                        </p>
                                    )}
                                </div>
                            </section>

                            {/* ── Totais ──────────────────────────────────── */}
                            <section className="border rounded-xl p-4 bg-gray-50 space-y-1.5 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Total da nota (itens)</span>
                                    <span className="font-semibold">{fmt(totalItems)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Total alocado nas faturas</span>
                                    <span className={`font-semibold ${balanced && totalItems > 0 ? "text-green-600" : totalItems === 0 ? "text-gray-400" : "text-red-500"}`}>
                                        {fmt(totalAllocated)}
                                    </span>
                                </div>
                                {!balanced && totalItems > 0 && (
                                    <p className="text-xs text-red-500 pt-1">
                                        Diferença: {fmt(Math.abs(totalItems - totalAllocated))} — ajuste os valores alocados
                                    </p>
                                )}
                            </section>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t flex justify-end gap-3">
                            <Button variant="outline" onClick={resetForm}>Cancelar</Button>
                            <Button
                                onClick={handleSubmit}
                                disabled={createMutation.isPending || !balanced || totalItems === 0}
                            >
                                {createMutation.isPending ? "Salvando..." : "Lançar Nota de Crédito"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
