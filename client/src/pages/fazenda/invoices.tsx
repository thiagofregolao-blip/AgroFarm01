import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/format-currency";
import { useAuth } from "@/hooks/use-auth";
import FarmLayout from "@/components/fazenda/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, Check, AlertTriangle, Loader2, Eye, Package, Trash2, Sprout, Info, Download, Wallet, Pencil, Save, X, ReceiptText, Search, Warehouse, Plus, DollarSign, Wheat, RefreshCw, Cloud, Mail, ChevronLeft, ChevronRight, Filter, ArrowDownToLine, Clock } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAccessLevel } from "@/hooks/use-access-level";

/**
 * Detecta tamanho de embalagem no nome do produto.
 * Regex unificada baseada no documento técnico — captura padrões como:
 * "20LT", "5LTS", "15KG", "20 LITROS", "- 20LT", "10L", "25 KILOS"
 */
function detectPackageSize(productName: string): number | null {
    if (!productName) return null;
    const match = productName.match(/(\d+(?:[.,]\d+)?)\s*(?:LTS?|KGS?|LITROS?|KILOS?|L)\b/i);
    if (!match) return null;
    const size = parseFloat(match[1].replace(",", "."));
    return size > 1 ? size : null;
}

/** Detecta se a unidade extraída é kg (vs litros) */
function detectUnitType(productName: string): "kg" | "litro" {
    if (!productName) return "litro";
    if (/\d+(?:[.,]\d+)?\s*(?:KGS?|KILOS?)\b/i.test(productName)) return "kg";
    return "litro";
}

const PRICE_THRESHOLD = 1.90;

/**
 * Regra de conversão embalagem → litros/kg (baseada no documento técnico):
 *
 * Camada 1: detectPackageSize() — extrai capacidade da descrição via regex.
 *           Se NÃO detecta → busca packageSize no catálogo do produto.
 *           Se nenhum → NÃO converte (status: ALERTA_VALIDACAO_MANUAL).
 *
 * Camada 2: preço ÷ capacidade < $1.90 → preço já é por unidade base, NÃO converte.
 *           Protege contra faturas que já vêm em litros/kg.
 *
 * Validação: |Qf × Pf - Total| ≤ 0.01 (total deve permanecer inalterado).
 */
function shouldConvertPackage(
    item: { productName: string; quantity: string | number; unitPrice: string | number; totalPrice: string | number; productId?: string },
    stockData?: any[],
    catalogData?: any[]
): number | null {
    const qty = parseFloat(String(item.quantity));
    if (!qty || qty <= 0) return null;
    const price = parseFloat(String(item.unitPrice));
    if (!price || price <= 0) return null;
    const total = parseFloat(String(item.totalPrice));

    // Camada 1a: detectar capacidade no nome do produto
    let pkgSize = detectPackageSize(item.productName);

    // Camada 1b: fallback — buscar packageSize no catálogo do produto
    if (!pkgSize && catalogData && item.productId) {
        const catMatch = catalogData.find((c: any) => c.id === item.productId);
        if (catMatch && catMatch.packageSize && parseFloat(catMatch.packageSize) > 1) {
            pkgSize = parseFloat(catMatch.packageSize);
        }
    }

    // Sem capacidade detectada → não converter
    if (!pkgSize) return null;

    // Camada 2: threshold de preço — se preço/capacidade < $1.90, já é preço por unidade
    const pricePerUnit = price / pkgSize;
    if (pricePerUnit < PRICE_THRESHOLD) return null;

    // Validação pós-conversão: verificar que total permanece consistente
    const convertedQty = qty * pkgSize;
    const convertedPrice = price / pkgSize;
    const recalcTotal = convertedQty * convertedPrice;
    if (total > 0 && Math.abs(recalcTotal - total) > 0.01) {
        console.warn(`[CONV_VALIDATION] Inconsistência: ${item.productName} — total=${total}, recalc=${recalcTotal.toFixed(2)}`);
    }

    return pkgSize;
}

export default function FarmInvoices() {
    const [, setLocation] = useLocation();
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);
    const [selectedExpense, setSelectedExpense] = useState<string | null>(null);
    const [approveExpenseId, setApproveExpenseId] = useState<string | null>(null);
    const [approveDueDate, setApproveDueDate] = useState<string>("");
    const [approveSeasonId, setApproveSeasonId] = useState<string>("");
    const [selectedSeasonId, setSelectedSeasonId] = useState<string>("");
    const [skipStockEntry, setSkipStockEntry] = useState(false);
    const [importDialogOpen, setImportDialogOpen] = useState(false);
    const [editingInvoice, setEditingInvoice] = useState(false);
    const [editInvData, setEditInvData] = useState<any>({});
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [editItemData, setEditItemData] = useState<any>({});
    const [editingExpense, setEditingExpense] = useState(false);
    const [editExpData, setEditExpData] = useState<any>({});
    const [editingExpItemId, setEditingExpItemId] = useState<string | null>(null);
    const [editExpItemData, setEditExpItemData] = useState<any>({});
    const { canEdit } = useAccessLevel("invoices");
    const [isRemission, setIsRemission] = useState(false);
    const [remissionMatch, setRemissionMatch] = useState<any>(null);
    const [matchedRemissionId, setMatchedRemissionId] = useState<string | null>(null);
    const [filterSupplier, setFilterSupplier] = useState("");
    const [filterNumber, setFilterNumber] = useState("");
    const [filterDate, setFilterDate] = useState("");
    const [confirmSkipStock, setConfirmSkipStock] = useState(false);
    const [confirmWarehouseId, setConfirmWarehouseId] = useState<string>("");
    const [skipConversion, setSkipConversion] = useState<Set<string>>(new Set());
    const [confirmSeasonId, setConfirmSeasonId] = useState<string>("");
    // confirmFrotaAmount removed — field no longer needed
    const [confirmEquipmentId, setConfirmEquipmentId] = useState<string>("");
    // Multi-deposito: quando ON, cada item escolhe seu deposito individualmente.
    // itemDeposits mapeia item.id -> depositId.
    const [multiDeposit, setMultiDeposit] = useState(false);
    const [itemDeposits, setItemDeposits] = useState<Record<string, string>>({});

    // Nova Despesa dialog state
    const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
    const [expCategory, setExpCategory] = useState("");
    const [expDescription, setExpDescription] = useState("");
    const [expAmount, setExpAmount] = useState("");
    const [expCurrency, setExpCurrency] = useState("USD");
    const [expSupplier, setExpSupplier] = useState("");
    const [expDate, setExpDate] = useState(new Date().toISOString().substring(0, 10));
    const [expPropertyId, setExpPropertyId] = useState("");
    const [expSeasonId, setExpSeasonId] = useState("");
    const [expDocumentNumber, setExpDocumentNumber] = useState("");
    const [supplierSearchOpen, setSupplierSearchOpen] = useState(false);
    const [supplierSearchTerm, setSupplierSearchTerm] = useState("");

    // Despesas sem Fatura: selecao multipla + modal Promover a Fatura + campo veiculo no aprovar
    const [selectedExpenseIds, setSelectedExpenseIds] = useState<Set<string>>(new Set());
    const [promoteOpen, setPromoteOpen] = useState(false);
    const [promoteInvoiceId, setPromoteInvoiceId] = useState("");
    const [approveEquipmentId, setApproveEquipmentId] = useState<string>("__none__");

    const { user } = useAuth();

    const { data: seasons = [] } = useQuery<any[]>({
        queryKey: ["/api/farm/seasons"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/seasons"); return r.json(); },
        enabled: !!user,
    });

    const { data: invoices = [], isLoading } = useQuery({
        queryKey: ["/api/farm/invoices", "factura"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/invoices?documentType=factura"); return r.json(); },
        enabled: !!user,
    });

    const { data: products = [] } = useQuery({
        queryKey: ["/api/farm/products"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/products"); return r.json(); },
        enabled: !!user,
    });

    const { data: stockData = [] } = useQuery<any[]>({
        queryKey: ["/api/farm/stock"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/stock"); return r.json(); },
        enabled: !!user,
    });

    const { data: invoiceDetail } = useQuery({
        queryKey: ["/api/farm/invoices", selectedInvoice],
        queryFn: async () => { const r = await apiRequest("GET", `/api/farm/invoices/${selectedInvoice}`); return r.json(); },
        enabled: !!selectedInvoice,
    });

    const { data: expenses = [], isLoading: isLoadingExpenses } = useQuery({
        queryKey: ["/api/farm/expenses"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/expenses"); return r.json(); },
        enabled: !!user,
    });

    const { data: expenseDetail } = useQuery({
        queryKey: ["/api/farm/expenses", selectedExpense],
        queryFn: async () => { const r = await apiRequest("GET", `/api/farm/expenses/${selectedExpense}`); return r.json(); },
        enabled: !!selectedExpense,
    });

    const { data: equipment = [] } = useQuery({
        queryKey: ["/api/farm/equipment"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/equipment"); return r.json(); },
        enabled: !!user,
    });

    const { data: suppliers = [] } = useQuery<any[]>({
        queryKey: ["/api/farm/suppliers"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/suppliers"); return r.json(); },
        enabled: !!user,
    });

    const { data: expenseCategories = [] } = useQuery<any[]>({
        queryKey: ["/api/farm/expense-categories"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/expense-categories"); return r.json(); },
        enabled: !!user,
    });

    const { data: remissions = [], isLoading: isLoadingRemissions } = useQuery<any[]>({
        queryKey: ["/api/farm/invoices", "remision"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/invoices?documentType=remision"); return r.json(); },
        enabled: !!user,
    });

    const { data: properties = [] } = useQuery<any[]>({
        queryKey: ["/api/farm/properties"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/properties"); return r.json(); },
        enabled: !!user,
    });

    const { data: deposits = [] } = useQuery<any[]>({
        queryKey: ["/api/farm/deposits"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/deposits"); return r.json(); },
        enabled: !!user,
    });



    const isWhatsappFleetReceipt = (e: any) =>
        e.equipmentId &&
        (e.description?.startsWith("[Via WhatsApp]") ?? false);

    const whatsappExpenses = (expenses as any[]).filter(isWhatsappFleetReceipt);
    const pendingFleetReceipts = whatsappExpenses.filter((e) => e.status === "pending");
    const confirmedFleetReceipts = whatsappExpenses.filter((e) => e.status === "confirmed");

    const extractSupplier = (desc: string) => {
        const match = desc?.match(/\[Via WhatsApp\]\s*\[([^\]]+)\]/);
        return match ? match[1] : "—";
    };
    const cleanDescription = (desc: string) => {
        return desc?.replace(/\[Via WhatsApp\]\s*(\[[^\]]*\]\s*)?/, "").trim() || "—";
    };

    const confirmMutation = useMutation({
        mutationFn: ({ id, skipStockEntry, warehouseId, seasonId, itemConversions, equipmentId, itemDeposits }: { id: string; skipStockEntry?: boolean; warehouseId?: string; seasonId?: string; itemConversions?: Record<string, number>; equipmentId?: string; itemDeposits?: Record<string, string> }) =>
            apiRequest("POST", `/api/farm/invoices/${id}/confirm`, {
                ...(skipStockEntry ? { skipStockEntry: true } : {}),
                ...(warehouseId ? { warehouseId } : {}),
                ...(seasonId ? { seasonId } : {}),
                ...(itemConversions && Object.keys(itemConversions).length > 0 ? { itemConversions } : {}),
                ...(equipmentId ? { equipmentId } : {}),
                ...(itemDeposits && Object.keys(itemDeposits).length > 0 ? { itemDeposits } : {}),
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/invoices"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/stock"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/expenses"] });
            toast({ title: confirmEquipmentId && confirmEquipmentId !== "__none__"
                ? "Fatura confirmada. Despesa vinculada ao veiculo."
                : confirmSkipStock ? "Fatura confirmada (somente valor, sem estoque)."
                : "Confirmado! Estoque atualizado."
            });
            setSelectedInvoice(null); setSkipConversion(new Set());
            setConfirmSkipStock(false);
            setConfirmWarehouseId("");
            setConfirmSeasonId("");
            setConfirmEquipmentId("");
            setMultiDeposit(false);
            setItemDeposits({});
        },
        onError: (err: any) => toast({ title: `Erro ao confirmar: ${err?.message || "Falha desconhecida"}`, variant: "destructive" }),
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => { const r = await apiRequest("DELETE", `/api/farm/invoices/${id}`); return r.json(); },
        onSuccess: (data: any) => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/invoices"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/invoices", "remision"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/stock"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/expenses"] });
            toast({ title: data?.message || "Excluido com sucesso." });
            setSelectedInvoice(null); setSkipConversion(new Set());
        },
        onError: () => toast({ title: "Erro ao excluir", variant: "destructive" }),
    });

    const conciliateMutation = useMutation({
        mutationFn: ({ invoiceId, remisionId }: { invoiceId: string; remisionId: string }) =>
            apiRequest("POST", `/api/farm/invoices/${invoiceId}/conciliate`, { remisionId }),
        onSuccess: async (res) => {
            const data = await res.json();
            queryClient.invalidateQueries({ queryKey: ["/api/farm/invoices"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/stock"] });
            toast({ title: data.message || "Conciliacao realizada com sucesso!" });
        },
        onError: (err: any) => toast({ title: `Erro na conciliacao: ${err?.message || "Falha"}`, variant: "destructive" }),
    });

    const confirmExpenseMutation = useMutation({
        mutationFn: ({ id, equipmentId, dueDate, seasonId }: { id: string; equipmentId?: string; dueDate: string; seasonId: string }) =>
            apiRequest("POST", `/api/farm/expenses/${id}/confirm`, {
                dueDate,
                seasonId,
                equipmentId,
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/expenses"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/accounts-payable"] });
            toast({ title: "✅ Despesa aprovada no Contas a Pagar!" });
            setApproveExpenseId(null);
            setApproveSeasonId("");
            setApproveDueDate("");
            setApproveEquipmentId("__none__");
        },
        onError: () => toast({ title: "Erro ao aprovar recibo", variant: "destructive" }),
    });

    const deleteExpenseMutation = useMutation({
        mutationFn: (id: string) => apiRequest("DELETE", `/api/farm/expenses/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/expenses"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/accounts-payable"] });
            toast({ title: "Recibo removido." });
        },
        onError: () => toast({ title: "Erro ao remover recibo", variant: "destructive" }),
    });

    const linkProductMutation = useMutation({
        mutationFn: ({ invoiceId, itemId, productId }: { invoiceId: string; itemId: string; productId: string }) =>
            apiRequest("PATCH", `/api/farm/invoices/${invoiceId}/items/${itemId}`, { productId }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/invoices", selectedInvoice] });
            toast({ title: "Produto vinculado" });
        },
    });

    const updateInvoiceMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) =>
            apiRequest("PUT", `/api/farm/invoices/${id}`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/invoices"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/invoices", selectedInvoice] });
            setEditingInvoice(false);
            toast({ title: "Fatura atualizada com sucesso!" });
        },
        onError: () => toast({ title: "Erro ao atualizar fatura", variant: "destructive" }),
    });

    const updateInvoiceItemMutation = useMutation({
        mutationFn: ({ invoiceId, itemId, data }: { invoiceId: string; itemId: string; data: any }) =>
            apiRequest("PATCH", `/api/farm/invoices/${invoiceId}/items/${itemId}`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/invoices", selectedInvoice] });
            setEditingItemId(null);
            toast({ title: "Item atualizado!" });
        },
        onError: () => toast({ title: "Erro ao atualizar item", variant: "destructive" }),
    });

    const updateExpenseMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) =>
            apiRequest("PUT", `/api/farm/expenses/${id}`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/expenses"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/expenses", selectedExpense] });
            setEditingExpense(false);
            toast({ title: "Recibo atualizado com sucesso!" });
        },
        onError: () => toast({ title: "Erro ao atualizar recibo", variant: "destructive" }),
    });

    const updateExpenseItemMutation = useMutation({
        mutationFn: ({ expenseId, itemId, data }: { expenseId: string; itemId: string; data: any }) =>
            apiRequest("PATCH", `/api/farm/expenses/${expenseId}/items/${itemId}`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/expenses", selectedExpense] });
            setEditingExpItemId(null);
            toast({ title: "Item atualizado!" });
        },
        onError: () => toast({ title: "Erro ao atualizar item", variant: "destructive" }),
    });

    const EXPENSE_CATEGORIES = [
        { value: "diesel", label: "Diesel / Combustivel" },
        { value: "frete", label: "Frete / Transporte" },
        { value: "mao_de_obra", label: "Mao de Obra" },
        { value: "manutencao", label: "Manutencao de Equipamentos" },
        { value: "arrendamento", label: "Arrendamento" },
        { value: "energia", label: "Energia / Agua" },
        { value: "financiamento", label: "Parcela de Financiamento" },
        { value: "insumos", label: "Insumos Agricolas" },
        { value: "impostos", label: "Impostos e Taxas" },
        { value: "salario", label: "Salario / Pro-Labore" },
        { value: "outro", label: "Outro" },
    ];

    // Stitch AgriIntel: status filter for invoice tab pills
    const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<"all" | "confirmed" | "pending">("all");
    const [invoiceSearch, setInvoiceSearch] = useState("");
    const [invoicePage, setInvoicePage] = useState(1);
    const INVOICES_PER_PAGE = 15;

    // KPI calculations
    const kpiData = useMemo(() => {
        const invArr = invoices as any[];
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const thisMonthInvoices = invArr.filter((inv: any) => {
            if (!inv.createdAt) return false;
            const d = new Date(inv.createdAt);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        });
        const totalCount = thisMonthInvoices.length;
        const totalAmount = invArr.reduce((acc: number, inv: any) => acc + parseFloat(inv.totalAmount || "0"), 0);
        const pendingCount = invArr.filter((inv: any) => inv.status === "pending" || inv.status === "pendente").length;
        return { totalCount, totalAmount, pendingCount };
    }, [invoices]);

    // Filtered invoices for Stitch table
    const filteredStitchInvoices = useMemo(() => {
        let arr = invoices as any[];
        // Status filter
        if (invoiceStatusFilter === "confirmed") arr = arr.filter((inv: any) => inv.status === "confirmed");
        else if (invoiceStatusFilter === "pending") arr = arr.filter((inv: any) => inv.status === "pending" || inv.status === "pendente");
        // Search filter
        if (invoiceSearch.trim()) {
            const term = invoiceSearch.toLowerCase().trim();
            arr = arr.filter((inv: any) =>
                (inv.supplier || "").toLowerCase().includes(term) ||
                (inv.invoiceNumber || "").toLowerCase().includes(term)
            );
        }
        return arr;
    }, [invoices, invoiceStatusFilter, invoiceSearch]);

    const paginatedInvoices = useMemo(() => {
        const start = (invoicePage - 1) * INVOICES_PER_PAGE;
        return filteredStitchInvoices.slice(start, start + INVOICES_PER_PAGE);
    }, [filteredStitchInvoices, invoicePage]);

    const totalPages = Math.max(1, Math.ceil(filteredStitchInvoices.length / INVOICES_PER_PAGE));

    const createExpenseMutation = useMutation({
        mutationFn: (data: any) => apiRequest("POST", "/api/farm/expenses", data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/expenses"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/accounts-payable"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/cash-summary"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/cash-transactions"] });
            toast({ title: "Despesa lancada com sucesso!" });
            setExpenseDialogOpen(false);
            setExpCategory(""); setExpDescription(""); setExpAmount(""); setExpCurrency("USD"); setExpSupplier("");
            setExpDate(new Date().toISOString().substring(0, 10));
            setExpPropertyId(""); setExpSeasonId("");
        },
        onError: () => toast({ title: "Erro ao lancar despesa", variant: "destructive" }),
    });

    function handleExpenseSubmit() {
        if (!expCategory || !expAmount || !expSupplier) {
            toast({ title: "Preencha categoria, fornecedor e valor", variant: "destructive" });
            return;
        }
        createExpenseMutation.mutate({
            category: expCategory,
            description: expDescription,
            amount: expAmount,
            currency: expCurrency,
            supplier: expSupplier,
            expenseDate: expDate,
            paymentType: "a_prazo",
            invoiceId: null,
            dueDate: null,
            installments: 1,
            propertyId: expPropertyId || null,
            seasonId: expSeasonId || null,
            documentNumber: expDocumentNumber || null,
        });
    }

    // Promover despesas a fatura (vincula via invoice_id; despesas continuam aparecendo
    // na lista com badge "Vinculada", per opcao C confirmada pelo usuario).
    const promoteToInvoiceMutation = useMutation({
        mutationFn: async ({ expenseIds, invoiceId }: { expenseIds: string[]; invoiceId: string }) =>
            apiRequest("POST", "/api/farm/expenses/promote-to-invoice", { expenseIds, invoiceId }),
        onSuccess: (_, vars) => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/expenses"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/invoices"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/accounts-payable"] });
            toast({ title: `${vars.expenseIds.length} despesa(s) vinculada(s) a fatura` });
            setPromoteOpen(false);
            setPromoteInvoiceId("");
            setSelectedExpenseIds(new Set());
        },
        onError: (err: any) => toast({ title: `Erro ao vincular: ${err?.message || "falha"}`, variant: "destructive" }),
    });

    function toggleExpenseSelected(id: string) {
        setSelectedExpenseIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }

    // Expenses/receipts managed from "Despesas s/ Fatura". Linked ones stay visible
    // for traceability, but only unlinked expenses can be selected/promoted.
    const expensesWithoutInvoice = expenses as any[];
    const selectableExpensesWithoutInvoice = expensesWithoutInvoice.filter((e: any) => !e.invoiceId);
    const findLinkedInvoice = (invoiceId?: string | null) =>
        invoiceId ? (invoices as any[]).find((inv: any) => String(inv.id) === String(invoiceId)) : null;

    const autoRegisterSupplier = async (supplierName: string, ruc: string) => {
        try {
            const existing = (suppliers as any[]).find((s: any) => s.ruc === ruc);
            if (!existing) {
                await apiRequest("POST", "/api/farm/suppliers", { name: supplierName, ruc });
                queryClient.invalidateQueries({ queryKey: ["/api/farm/suppliers"] });
                toast({ title: `Fornecedor ${supplierName} cadastrado automaticamente` });
            }
        } catch {
            // Supplier auto-register is best-effort
        }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        setRemissionMatch(null);
        setMatchedRemissionId(null);

        try {
            const formData = new FormData();
            formData.append("file", file);
            if (selectedSeasonId) {
                formData.append("seasonId", selectedSeasonId);
            }

            // If remission mode, send to same endpoint with isRemision flag
            if (isRemission) {
                formData.append("isRemision", "true");
            }

            if (skipStockEntry) {
                formData.append("skipStockEntry", "true");
            }

            const res = await fetch("/api/farm/invoices/import", {
                method: "POST",
                body: formData,
                credentials: "include",
            });

            const data = await res.json();
            if (res.status === 409) {
                toast({
                    title: "Fatura possivelmente duplicada!",
                    description: data.message,
                    variant: "destructive",
                    duration: 10000,
                });
                return;
            }
            if (!res.ok) throw new Error("Upload failed");

            // #18 Auto-register supplier from RUC
            if (data.ruc && data.supplier) {
                await autoRegisterSupplier(data.supplier, data.ruc);
            }

            queryClient.invalidateQueries({ queryKey: ["/api/farm/invoices"] });
            setSelectedInvoice(data.invoice?.id || null);
            setImportDialogOpen(false);
            setIsRemission(false);

            // Show import success + remission match notification
            if (data.isRemision) {
                toast({ title: "Remissao importada com sucesso" });
            } else if (data.matchingRemissions && data.matchingRemissions.length > 0) {
                toast({
                    title: "Fatura importada - Remissao encontrada!",
                    description: `${data.matchingRemissions.length} remissao(oes) do mesmo fornecedor. Abra o card da fatura para conciliar.`,
                    duration: 10000,
                });
            } else {
                toast({ title: skipStockEntry ? `${data.message} (sem entrada no estoque)` : `${data.message}` });
            }
        } catch (err) {
            toast({ title: "Erro ao importar fatura", variant: "destructive" });
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    return (
        <FarmLayout>
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');`}</style>
            <div className="space-y-6" style={{ fontFamily: "'Manrope', sans-serif" }}>
                {/* PAGE HEADER + KPI — grid 12 cols */}
                <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Left: Title */}
                    <div className="lg:col-span-4">
                        <p className="text-[10px] uppercase font-bold tracking-widest text-emerald-700 mb-1">FINANCEIRO &gt; FATURAS</p>
                        <h1 className="text-4xl font-extrabold tracking-tight text-gray-900" style={{ fontFamily: "'Manrope', sans-serif" }}>Importacao de Faturas</h1>
                        <p className="text-gray-500 text-sm mt-3 leading-relaxed max-w-sm">Gerencie e processe seus documentos fiscais com inteligencia agronomica.</p>
                    </div>
                    {/* Right: KPI Cards */}
                    <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-white rounded-xl shadow-sm border-l-4 border-emerald-600 p-5">
                            <div className="flex items-center gap-2 mb-2">
                                <FileText className="h-4 w-4 text-emerald-700" />
                                <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Total Faturas</span>
                            </div>
                            <p className="text-2xl font-extrabold text-gray-900" style={{ fontFamily: "'Manrope', sans-serif" }}>{kpiData.totalCount}</p>
                            <p className="text-xs text-gray-400 mt-1">no periodo atual</p>
                        </div>
                        <div className="bg-white rounded-xl shadow-sm border-l-4 border-emerald-800 p-5">
                            <div className="flex items-center gap-2 mb-2">
                                <DollarSign className="h-4 w-4 text-emerald-700" />
                                <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Valor Total</span>
                            </div>
                            <p className="text-2xl font-extrabold text-gray-900" style={{ fontFamily: "'Manrope', sans-serif" }}>{formatCurrency(kpiData.totalAmount, "USD")}</p>
                            <p className="text-xs text-gray-400 mt-1">auditado</p>
                        </div>
                        <div className="bg-white rounded-xl shadow-sm border-l-4 border-red-500 p-5">
                            <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle className="h-4 w-4 text-red-500" />
                                <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Pendentes</span>
                            </div>
                            <p className="text-2xl font-extrabold text-gray-900" style={{ fontFamily: "'Manrope', sans-serif" }}>{kpiData.pendingCount}</p>
                            <p className="text-xs text-red-400 mt-1">acao necessaria</p>
                        </div>
                    </div>
                </section>

                {/* Action buttons */}
                {canEdit && (
                <div className="flex gap-3 items-center">
                    <button
                        className="bg-emerald-100 text-emerald-800 font-bold rounded-lg px-6 py-3 text-sm hover:bg-emerald-200 transition-colors cursor-pointer inline-flex items-center gap-2"
                        onClick={() => setExpenseDialogOpen(true)}
                    >
                        <Plus className="h-4 w-4" />
                        Nova Despesa
                    </button>
                    <button
                        className="bg-gradient-to-br from-emerald-900 to-emerald-800 text-white font-bold rounded-lg px-6 py-3 text-sm shadow-lg hover:shadow-xl transition-all cursor-pointer inline-flex items-center gap-2"
                        onClick={() => setImportDialogOpen(true)}
                    >
                        <Upload className="h-4 w-4" />
                        Importar PDF
                    </button>
                </div>
                )}

                {/* Import Modal */}
                <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Importar Fatura (PDF ou Foto)</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-5 py-4">
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                    <Sprout className="h-4 w-4 text-emerald-500" />
                                    Safra
                                </label>
                                <select
                                    className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    value={selectedSeasonId}
                                    onChange={(e) => setSelectedSeasonId(e.target.value)}
                                >
                                    <option value="">Sem safra vinculada</option>
                                    {seasons.filter((s: any) => s.isActive).map((s: any) => (
                                        <option key={s.id} value={s.id}>🟢 {s.name}</option>
                                    ))}
                                    {seasons.filter((s: any) => !s.isActive).length > 0 && (
                                        <optgroup label="Encerradas">
                                            {seasons.filter((s: any) => !s.isActive).map((s: any) => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </optgroup>
                                    )}
                                </select>
                            </div>
                            {/* Toggle: Importar sem dar entrada no estoque */}
                            <div
                                className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${skipStockEntry
                                    ? 'border-amber-400 bg-amber-50'
                                    : 'border-gray-200 bg-white hover:border-gray-300'
                                    }`}
                                onClick={() => setSkipStockEntry(!skipStockEntry)}
                            >
                                <div className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-colors ${skipStockEntry ? 'bg-amber-500 text-white' : 'border-2 border-gray-300'
                                    }`}>
                                    {skipStockEntry && <Check className="h-3.5 w-3.5" />}
                                </div>
                                <div className="flex-1">
                                    <span className={`text-sm font-medium ${skipStockEntry ? 'text-amber-800' : 'text-gray-700'}`}>
                                        Importar apenas financeiro
                                    </span>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        Registra a fatura e valores no sistema, mas <strong>não dá entrada no estoque</strong>.
                                        Use para faturas antigas cujos produtos já foram utilizados.
                                    </p>
                                </div>
                                <Info className={`h-4 w-4 mt-0.5 flex-shrink-0 ${skipStockEntry ? 'text-amber-500' : 'text-gray-400'}`} />
                            </div>
                            {/* Toggle: Remissao (sem valor) */}
                            <div
                                className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${isRemission
                                    ? 'border-blue-400 bg-blue-50'
                                    : 'border-gray-200 bg-white hover:border-gray-300'
                                    }`}
                                onClick={() => setIsRemission(!isRemission)}
                            >
                                <div className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-colors ${isRemission ? 'bg-blue-500 text-white' : 'border-2 border-gray-300'
                                    }`}>
                                    {isRemission && <Check className="h-3.5 w-3.5" />}
                                </div>
                                <div className="flex-1">
                                    <span className={`text-sm font-medium ${isRemission ? 'text-blue-800' : 'text-gray-700'}`}>
                                        Esta e uma Remissao (sem valor)
                                    </span>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        Importa apenas os produtos sem precos. Usado para registrar entrada de mercadoria antes da fatura.
                                    </p>
                                </div>
                                <ReceiptText className={`h-4 w-4 mt-0.5 flex-shrink-0 ${isRemission ? 'text-blue-500' : 'text-gray-400'}`} />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-2 block">Arquivo PDF</label>
                                <input ref={fileInputRef} type="file" accept=".pdf, .jpg, .jpeg, .png, .webp" onChange={handleUpload} className="hidden" />
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploading}
                                    className="w-full border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-emerald-400 hover:bg-emerald-50/50 transition-colors cursor-pointer disabled:opacity-50"
                                >
                                    {uploading ? (
                                        <div className="flex flex-col items-center gap-2">
                                            <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
                                            <span className="text-sm text-emerald-600 font-medium">Processando fatura...</span>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-2">
                                            <Upload className="h-8 w-8 text-gray-400" />
                                            <span className="text-sm text-gray-500">Clique para selecionar o arquivo (PDF ou Foto)</span>
                                            <span className="text-xs text-gray-400">Formatos: PDF, JPG, PNG</span>
                                        </div>
                                    )}
                                </button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Nova Despesa Dialog */}
                <Dialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen}>
                    <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0">
                        <DialogHeader className="px-6 pt-5 pb-3 border-b">
                            <DialogTitle>Nova Despesa</DialogTitle>
                        </DialogHeader>
                        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                            {/* Linha 1: Categoria + Fornecedor + Descricao */}
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <Label className="text-xs text-gray-500">Categoria *</Label>
                                    <Select value={expCategory} onValueChange={setExpCategory}>
                                        <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                        <SelectContent>
                                            {EXPENSE_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label className="text-xs text-gray-500">Fornecedor *</Label>
                                    <button
                                        type="button"
                                        onClick={() => { setSupplierSearchOpen(true); setSupplierSearchTerm(""); }}
                                        className={`w-full flex items-center justify-between px-3 py-2 border rounded-md text-sm text-left transition-colors hover:bg-gray-50 cursor-pointer h-10 ${expSupplier ? "border-gray-300 text-gray-900" : "border-gray-300 text-gray-500"}`}
                                    >
                                        <span className="truncate">{expSupplier || "Buscar..."}</span>
                                        <Search className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                    </button>
                                </div>
                                <div>
                                    <Label className="text-xs text-gray-500">Descricao</Label>
                                    <Input value={expDescription} onChange={e => setExpDescription(e.target.value)} placeholder="Descricao..." />
                                </div>
                            </div>

                            {/* Numero do documento (opcional) */}
                            <div>
                                <Label className="text-xs text-gray-500">Numero do documento <span className="text-gray-400 font-normal">(opcional)</span></Label>
                                <Input value={expDocumentNumber} onChange={e => setExpDocumentNumber(e.target.value)} placeholder="Ex: 001-001-0000123" />
                            </div>

                            {/* Linha 3: Valor + Moeda + Data + Propriedade + Safra */}
                            <div className="grid grid-cols-5 gap-3">
                                <div>
                                    <Label className="text-xs text-gray-500">Valor *</Label>
                                    <CurrencyInput value={expAmount} onValueChange={setExpAmount} />
                                </div>
                                <div>
                                    <Label className="text-xs text-gray-500">Moeda *</Label>
                                    <Select value={expCurrency} onValueChange={setExpCurrency}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="USD">Dolar (USD)</SelectItem>
                                            <SelectItem value="PYG">Guarani (PYG)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label className="text-xs text-gray-500">Data</Label>
                                    <Input type="date" value={expDate} onChange={e => setExpDate(e.target.value)} />
                                </div>
                                <div>
                                    <Label className="text-xs text-gray-500">Propriedade</Label>
                                    <Select value={expPropertyId} onValueChange={setExpPropertyId}>
                                        <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__none__">Todas</SelectItem>
                                            {(properties as any[]).map((p: any) => (
                                                <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label className="text-xs text-gray-500">Safra</Label>
                                    <Select value={expSeasonId} onValueChange={setExpSeasonId}>
                                        <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__none__">Nenhuma</SelectItem>
                                            {(seasons as any[]).map((s: any) => (
                                                <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        {/* Footer fixo */}
                        <div className="px-6 py-3 border-t bg-gray-50 flex items-center justify-end gap-3">
                            <Button
                                variant="outline"
                                onClick={() => setExpenseDialogOpen(false)}
                            >
                                Cancelar
                            </Button>
                            <Button
                                className="bg-emerald-600 hover:bg-emerald-700"
                                onClick={handleExpenseSubmit}
                                disabled={createExpenseMutation.isPending || !expCategory || !expAmount || !expSupplier}
                            >
                                {createExpenseMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DollarSign className="mr-2 h-4 w-4" />}
                                Lancar Despesa
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>

                <Tabs defaultValue="invoices" className="space-y-4">
                    <TabsList className="bg-gray-100 border border-gray-200 p-1 h-10 rounded-lg">
                        <TabsTrigger value="invoices" className="text-[13px] font-bold data-[state=active]:bg-emerald-600 data-[state=active]:text-white px-5 rounded-md transition-all">Faturas</TabsTrigger>
                        <TabsTrigger value="remissions" className="text-[13px] font-bold data-[state=active]:bg-emerald-600 data-[state=active]:text-white px-5 rounded-md transition-all">Remissoes</TabsTrigger>
                        <TabsTrigger value="receipts" className="text-[13px] font-bold data-[state=active]:bg-emerald-600 data-[state=active]:text-white px-5 rounded-md transition-all">Recibos de Frota</TabsTrigger>
                        <TabsTrigger value="expenses-nofatura" className="text-[13px] font-bold data-[state=active]:bg-emerald-600 data-[state=active]:text-white px-5 rounded-md transition-all">Despesas s/ Fatura</TabsTrigger>
                    </TabsList>

                    <TabsContent value="invoices">
                        {/* Selected invoice detail — Modal */}
                        <Dialog open={!!selectedInvoice && !!invoiceDetail} onOpenChange={(open) => { if (!open) { setSelectedInvoice(null); setSkipConversion(new Set()); setEditingInvoice(false); } }}>
                            <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto p-0 gap-0">
                                {invoiceDetail && (<><div className="p-6 pb-3">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                        <DialogTitle className="text-emerald-800 flex items-center gap-2 text-lg">
                                            {editingInvoice ? "Editando Fatura" : `Fatura #${invoiceDetail.invoiceNumber || "—"}`}
                                            <Badge className="ml-2" variant={invoiceDetail.status === "confirmed" ? "default" : "secondary"}>
                                                {invoiceDetail.status === "confirmed" ? "Confirmada" : "Pendente"}
                                            </Badge>
                                            <Badge variant="outline" className={`ml-1 text-[10px] ${
                                                invoiceDetail.source === "whatsapp" ? "border-green-400 text-green-700 bg-green-50" :
                                                invoiceDetail.source === "email_import" ? "border-blue-400 text-blue-700 bg-blue-50" :
                                                "border-gray-300 text-gray-600 bg-gray-50"
                                            }`}>
                                                {invoiceDetail.source === "whatsapp" ? "WhatsApp" :
                                                 invoiceDetail.source === "email_import" ? "Email" : "Import"}
                                            </Badge>
                                        </DialogTitle>
                                        <div className="flex items-center gap-2">
                                            {canEdit && !editingInvoice && (
                                                <Button variant="outline" size="sm" onClick={() => {
                                                    setEditingInvoice(true);
                                                    setEditInvData({
                                                        invoiceNumber: invoiceDetail.invoiceNumber || "",
                                                        supplier: invoiceDetail.supplier || "",
                                                        issueDate: invoiceDetail.issueDate ? new Date(invoiceDetail.issueDate).toISOString().split("T")[0] : "",
                                                        dueDate: invoiceDetail.dueDate ? new Date(invoiceDetail.dueDate).toISOString().split("T")[0] : "",
                                                        totalAmount: invoiceDetail.totalAmount || "",
                                                        currency: invoiceDetail.currency || "USD",
                                                        expenseCategory: invoiceDetail.expenseCategory || "",
                                                    });
                                                }}>
                                                    <Pencil className="mr-1 h-3 w-3" /> Editar
                                                </Button>
                                            )}
                                            {editingInvoice && (
                                                <>
                                                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700"
                                                        disabled={updateInvoiceMutation.isPending}
                                                        onClick={() => updateInvoiceMutation.mutate({ id: selectedInvoice!, data: editInvData })}>
                                                        {updateInvoiceMutation.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />} Salvar
                                                    </Button>
                                                    <Button variant="ghost" size="sm" onClick={() => setEditingInvoice(false)}>
                                                        <X className="mr-1 h-3 w-3" /> Cancelar
                                                    </Button>
                                                </>
                                            )}
                                            {invoiceDetail.hasFile && (
                                                <Button variant="outline" size="sm" onClick={(e) => {
                                                    e.stopPropagation();
                                                    window.open(`/api/farm/invoices/${selectedInvoice}/file`, '_blank');
                                                }}>
                                                    <Eye className="mr-1 h-3 w-3" /> Ver Original
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                    {editingInvoice ? (
                                        <div className="space-y-3 mt-3">
                                        {invoiceDetail.status === "confirmed" && (
                                            <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                                                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                                                <p className="text-sm text-amber-800">Atencao: esta fatura ja foi aprovada. Alteracoes podem afetar o estoque e financeiro.</p>
                                            </div>
                                        )}
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                            <div>
                                                <Label className="text-xs text-gray-500">Nº Fatura</Label>
                                                <Input className="h-8 text-sm" value={editInvData.invoiceNumber}
                                                    onChange={e => setEditInvData({ ...editInvData, invoiceNumber: e.target.value })} />
                                            </div>
                                            <div>
                                                <Label className="text-xs text-gray-500">Fornecedor</Label>
                                                <Select value={editInvData.supplier || ""} onValueChange={(v) => setEditInvData({ ...editInvData, supplier: v })}>
                                                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                                    <SelectContent>
                                                        {(suppliers as any[]).map((s: any) => (
                                                            <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                                                        ))}
                                                        {editInvData.supplier && !(suppliers as any[]).find((s: any) => s.name === editInvData.supplier) && (
                                                            <SelectItem value={editInvData.supplier}>{editInvData.supplier}</SelectItem>
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div>
                                                <Label className="text-xs text-gray-500">Data Emissão</Label>
                                                <Input type="date" className="h-8 text-sm" value={editInvData.issueDate}
                                                    onChange={e => setEditInvData({ ...editInvData, issueDate: e.target.value })} />
                                            </div>
                                            <div>
                                                <Label className="text-xs text-gray-500">Vencimento</Label>
                                                <Input type="date" className="h-8 text-sm" value={editInvData.dueDate || ""}
                                                    onChange={e => setEditInvData({ ...editInvData, dueDate: e.target.value })} />
                                            </div>
                                            <div>
                                                <Label className="text-xs text-gray-500">Valor Total ($)</Label>
                                                <CurrencyInput className="h-8 text-sm" value={editInvData.totalAmount}
                                                    onValueChange={v => setEditInvData({ ...editInvData, totalAmount: v })} />
                                            </div>
                                            <div>
                                                <Label className="text-xs text-gray-500">Moeda</Label>
                                                <Select value={editInvData.currency || "USD"} onValueChange={(v) => setEditInvData({ ...editInvData, currency: v })}>
                                                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="USD">USD</SelectItem>
                                                        <SelectItem value="PYG">PYG</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div>
                                                <Label className="text-xs text-gray-500">Categoria</Label>
                                                <Select value={editInvData.expenseCategory || ""} onValueChange={(v) => setEditInvData({ ...editInvData, expenseCategory: v })}>
                                                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                                    <SelectContent>
                                                        {(expenseCategories as any[]).map((cat: any) => (
                                                            <SelectItem key={cat.id || cat.name} value={cat.name || cat.id}>{cat.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        </div>
                                    ) : (
                                        <div className="flex gap-4 text-sm text-gray-600 mt-1 flex-wrap">
                                            <span>Fornecedor: <strong>{invoiceDetail.supplier || "—"}</strong></span>
                                            <span>Emissao: <strong>{invoiceDetail.issueDate ? new Date(invoiceDetail.issueDate).toLocaleDateString("pt-BR") : "—"}</strong></span>
                                            <span>Vencimento: <strong>{invoiceDetail.dueDate ? new Date(invoiceDetail.dueDate).toLocaleDateString("pt-BR") : "—"}</strong></span>
                                            <span>Total: <strong>${invoiceDetail.totalAmount}</strong></span>
                                            {invoiceDetail.seasonId && (() => {
                                                const season = (seasons as any[]).find((s: any) => s.id === invoiceDetail.seasonId);
                                                return season ? <span>Safra: <strong>{season.name}</strong></span> : null;
                                            })()}
                                        </div>
                                    )}
                                </div>
                                <div className="px-6 pb-6 space-y-4">
                                    {/* Banner: matching remissions found */}
                                    {invoiceDetail.matchingRemissions && invoiceDetail.matchingRemissions.length > 0 && !invoiceDetail.linkedRemisionId && (
                                        <div className="mb-4 p-3 rounded-lg border-2 border-amber-400 bg-amber-50">
                                            <div className="flex items-center gap-2 mb-2">
                                                <AlertTriangle className="h-5 w-5 text-amber-600" />
                                                <span className="font-bold text-amber-800">
                                                    {invoiceDetail.matchingRemissions.length} Remissao(oes) encontrada(s) deste fornecedor!
                                                </span>
                                            </div>
                                            {invoiceDetail.matchingRemissions.map((match: any) => (
                                                <div key={match.remissionId} className="flex items-center justify-between p-2 rounded bg-white border border-amber-200 mb-1">
                                                    <div className="text-sm">
                                                        <span className="font-medium">Remissao #{match.remissionNumber || match.remissionId.slice(0, 8)}</span>
                                                        <span className="text-gray-500 ml-2">({match.matchScore}% compativel - {match.matchedProducts}/{match.totalProducts} produtos)</span>
                                                        <Badge className="ml-2 bg-purple-100 text-purple-700 text-xs">{match.status === "confirmed" ? "Confirmada" : "Pendente"}</Badge>
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        className="bg-blue-600 hover:bg-blue-700 text-white"
                                                        onClick={() => conciliateMutation.mutate({ invoiceId: selectedInvoice!, remisionId: match.remissionId })}
                                                        disabled={conciliateMutation.isPending}
                                                    >
                                                        {conciliateMutation.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Package className="mr-1 h-3 w-3" />}
                                                        Conciliar
                                                    </Button>
                                                </div>
                                            ))}
                                            <p className="text-xs text-amber-700 mt-1">
                                                Ao conciliar, os precos da fatura serao aplicados aos produtos da remissao e o custo do estoque sera atualizado.
                                            </p>
                                        </div>
                                    )}

                                    {/* Banner: already conciliated */}
                                    {invoiceDetail.linkedRemission && (
                                        <div className="mb-4 p-3 rounded-lg border border-blue-300 bg-blue-50">
                                            <div className="flex items-center gap-2">
                                                <Package className="h-4 w-4 text-blue-600" />
                                                <span className="text-sm font-medium text-blue-800">
                                                    Fatura conciliada com Remissao #{invoiceDetail.linkedRemission.invoiceNumber || invoiceDetail.linkedRemission.id.slice(0, 8)}
                                                </span>
                                                <Badge className="bg-blue-100 text-blue-700 text-xs">Conciliada</Badge>
                                            </div>
                                        </div>
                                    )}

                                    {invoiceDetail.items && invoiceDetail.items.length > 0 ? (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead className="bg-emerald-50">
                                                    <tr>
                                                        <th className="text-left p-2">Cód</th>
                                                        <th className="text-left p-2">Produto (Fatura)</th>
                                                        <th className="text-left p-2">Vincular ao Catálogo</th>
                                                        <th className="text-center p-2">Un</th>
                                                        <th className="text-right p-2">Qtd</th>
                                                        <th className="text-right p-2">Preço Un.</th>
                                                        <th className="text-right p-2">Total</th>
                                                        {multiDeposit && !confirmSkipStock && invoiceDetail.status === "pending" && (
                                                            <th className="text-left p-2 min-w-[160px]">Depósito</th>
                                                        )}
                                                        {invoiceDetail.status === "pending" && <th className="text-center p-2">Ações</th>}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {invoiceDetail.items.map((item: any) => (
                                                        editingItemId === item.id ? (
                                                            <tr key={item.id} className="border-t border-emerald-200 bg-emerald-50/50">
                                                                <td className="p-2">
                                                                    <Input className="h-7 text-xs w-20" value={editItemData.productCode}
                                                                        onChange={e => setEditItemData({ ...editItemData, productCode: e.target.value })} />
                                                                </td>
                                                                <td className="p-2">
                                                                    <Input className="h-7 text-xs" value={editItemData.productName}
                                                                        onChange={e => setEditItemData({ ...editItemData, productName: e.target.value })} />
                                                                </td>
                                                                <td className="p-2">
                                                                    <Select value={editItemData.productId || ""} onValueChange={(v) => setEditItemData({ ...editItemData, productId: v })}>
                                                                        <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Vincular..." /></SelectTrigger>
                                                                        <SelectContent>
                                                                            {products.map((p: any) => (
                                                                                <SelectItem key={p.id} value={p.id}>{p.name} ({p.unit})</SelectItem>
                                                                            ))}
                                                                        </SelectContent>
                                                                    </Select>
                                                                </td>
                                                                <td className="p-2">
                                                                    <Input className="h-7 text-xs w-16 text-center" value={editItemData.unit}
                                                                        onChange={e => setEditItemData({ ...editItemData, unit: e.target.value })} />
                                                                </td>
                                                                <td className="p-2">
                                                                    <Input type="number" step="0.01" className="h-7 text-xs w-20 text-right" value={editItemData.quantity}
                                                                        onChange={e => setEditItemData({ ...editItemData, quantity: e.target.value })} />
                                                                </td>
                                                                <td className="p-2">
                                                                    <CurrencyInput className="h-7 text-xs w-24 text-right" value={editItemData.unitPrice}
                                                                        onValueChange={v => setEditItemData({ ...editItemData, unitPrice: v })} prefix="" />
                                                                </td>
                                                                <td className="p-2">
                                                                    <CurrencyInput className="h-7 text-xs w-24 text-right" value={editItemData.totalPrice}
                                                                        onValueChange={v => setEditItemData({ ...editItemData, totalPrice: v })} prefix="" />
                                                                </td>
                                                                {multiDeposit && !confirmSkipStock && invoiceDetail.status === "pending" && (
                                                                    <td className="p-2 text-[11px] text-gray-400 italic">Salve para escolher</td>
                                                                )}
                                                                <td className="p-2 text-center">
                                                                    <div className="flex items-center justify-center gap-1">
                                                                        <button className="p-1 rounded hover:bg-emerald-200" title="Salvar"
                                                                            onClick={() => {
                                                                                const sanitized = { ...editItemData };
                                                                                if (sanitized.quantity) sanitized.quantity = String(sanitized.quantity).replace(",", ".");
                                                                                if (sanitized.unitPrice) sanitized.unitPrice = String(sanitized.unitPrice).replace(",", ".");
                                                                                if (sanitized.totalPrice) sanitized.totalPrice = String(sanitized.totalPrice).replace(",", ".");
                                                                                updateInvoiceItemMutation.mutate({
                                                                                    invoiceId: selectedInvoice!, itemId: item.id, data: sanitized
                                                                                });
                                                                            }}>
                                                                            <Save className="h-4 w-4 text-emerald-600" />
                                                                        </button>
                                                                        <button className="p-1 rounded hover:bg-gray-200" title="Cancelar"
                                                                            onClick={() => setEditingItemId(null)}>
                                                                            <X className="h-4 w-4 text-gray-500" />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ) : (
                                                            <tr key={item.id} className="border-t border-gray-100">
                                                                <td className="p-2 text-gray-500 font-mono text-xs">{item.productCode || "—"}</td>
                                                                <td className="p-2 font-medium">{item.productName}</td>
                                                                <td className="p-2">
                                                                    <Select
                                                                        value={item.productId || ""}
                                                                        onValueChange={(v) => linkProductMutation.mutate({ invoiceId: selectedInvoice!, itemId: item.id, productId: v })}
                                                                    >
                                                                        <SelectTrigger className="h-8 text-xs">
                                                                            <SelectValue placeholder="Vincular..." />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            {products.map((p: any) => (
                                                                                <SelectItem key={p.id} value={p.id}>{p.name} ({p.unit})</SelectItem>
                                                                            ))}
                                                                        </SelectContent>
                                                                    </Select>
                                                                </td>
                                                                <td className="text-center p-2">{item.unit}</td>
                                                                {(() => {
                                                                    const pkgSize = skipConversion.has(item.id) ? null : shouldConvertPackage({ productName: item.productName, quantity: item.quantity, unitPrice: item.unitPrice, totalPrice: item.totalPrice, productId: item.productId }, stockData, products);
                                                                    const qty = parseFloat(item.quantity);
                                                                    const price = parseFloat(item.unitPrice);
                                                                    const realQty = pkgSize ? qty * pkgSize : qty;
                                                                    const realPrice = pkgSize ? price / pkgSize : price;
                                                                    return (
                                                                        <>
                                                                            <td className="text-right p-2 font-mono">
                                                                                {pkgSize ? (
                                                                                    <div className="flex flex-col items-end gap-0.5">
                                                                                        <span className="text-emerald-700 font-semibold">{realQty.toFixed(2)}</span>
                                                                                        <span className="text-[10px] text-gray-400 line-through">{qty.toFixed(2)} emb</span>
                                                                                    </div>
                                                                                ) : (
                                                                                    <span>{qty.toFixed(2)}</span>
                                                                                )}
                                                                            </td>
                                                                            <td className="text-right p-2 font-mono">
                                                                                {pkgSize ? (
                                                                                    <div className="flex flex-col items-end gap-0.5">
                                                                                        <span className="text-emerald-700 font-semibold">{formatCurrency(realPrice, invoiceDetail?.currency || "USD")}</span>
                                                                                        <span className="text-[10px] text-gray-400 line-through">{formatCurrency(price, invoiceDetail?.currency || "USD")}/emb</span>
                                                                                    </div>
                                                                                ) : (
                                                                                    <span>{formatCurrency(price, invoiceDetail?.currency || "USD")}</span>
                                                                                )}
                                                                            </td>
                                                                            <td className="text-right p-2 font-mono font-semibold">{formatCurrency(parseFloat(item.totalPrice), invoiceDetail?.currency || "USD")}</td>
                                                                        </>
                                                                    );
                                                                })()}
                                                                {multiDeposit && !confirmSkipStock && invoiceDetail.status === "pending" && (
                                                                    <td className="p-2">
                                                                        {item.productId ? (
                                                                            <Select
                                                                                value={itemDeposits[item.id] || ""}
                                                                                onValueChange={v => setItemDeposits(prev => ({ ...prev, [item.id]: v }))}
                                                                            >
                                                                                <SelectTrigger className="h-8 text-xs">
                                                                                    <SelectValue placeholder="Selecione..." />
                                                                                </SelectTrigger>
                                                                                <SelectContent>
                                                                                    {(deposits as any[]).map((d: any) => (
                                                                                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                                                                    ))}
                                                                                </SelectContent>
                                                                            </Select>
                                                                        ) : (
                                                                            <span className="text-[11px] text-gray-400 italic">Vincule ao catalogo</span>
                                                                        )}
                                                                    </td>
                                                                )}
                                                                {invoiceDetail.status === "pending" && (
                                                                    <td className="text-center p-2">
                                                                        <button className="p-1 rounded hover:bg-amber-100" title="Editar item"
                                                                            onClick={() => {
                                                                                setEditingItemId(item.id);
                                                                                setEditItemData({
                                                                                    productCode: item.productCode || "",
                                                                                    productName: item.productName || "",
                                                                                    productId: item.productId || "",
                                                                                    unit: item.unit || "",
                                                                                    quantity: item.quantity || "",
                                                                                    unitPrice: item.unitPrice || "",
                                                                                    totalPrice: item.totalPrice || "",
                                                                                });
                                                                            }}>
                                                                            <Pencil className="h-3.5 w-3.5 text-amber-600" />
                                                                        </button>
                                                                    </td>
                                                                )}
                                                            </tr>
                                                        )
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <p className="text-gray-500 py-4 text-center">Nenhum item extraído</p>
                                    )}

                                    {remissionMatch && (
                                        <div className="mt-4 flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                            <Info className="h-5 w-5 text-blue-600 shrink-0" />
                                            <p className="text-sm text-blue-800 flex-1">
                                                Produtos ja ingressados via Remissao #{remissionMatch.remissionNumber || remissionMatch.remissionId}. Os produtos nao serao duplicados no estoque.
                                            </p>
                                        </div>
                                    )}

                                    {/* Conversão embalagem → litros/kg (informativo) */}
                                    {invoiceDetail.status === "pending" && invoiceDetail.items?.length > 0 && (() => {
                                        const itemsConvertible = invoiceDetail.items.filter((item: any) => shouldConvertPackage({ productName: item.productName, quantity: item.quantity, unitPrice: item.unitPrice, totalPrice: item.totalPrice, productId: item.productId }, stockData, products));
                                        if (itemsConvertible.length === 0) return null;
                                        const activeCount = itemsConvertible.filter((item: any) => !skipConversion.has(item.id)).length;
                                        return (
                                            <div className="mt-4 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Package className="h-4 w-4 text-emerald-600" />
                                                    <span className="text-sm font-semibold text-emerald-800">
                                                        Conversao de embalagem ({activeCount}/{itemsConvertible.length} {activeCount === 1 ? "ativo" : "ativos"})
                                                    </span>
                                                </div>
                                                <p className="text-xs text-emerald-700 mb-2">
                                                    Clique no item para ativar/desativar a conversao. Valor total inalterado.
                                                </p>
                                                <div className="space-y-1">
                                                    {itemsConvertible.map((item: any) => {
                                                        const pkgSize = shouldConvertPackage({ productName: item.productName, quantity: item.quantity, unitPrice: item.unitPrice, totalPrice: item.totalPrice, productId: item.productId }, stockData, products)!;
                                                        const qty = parseFloat(item.quantity);
                                                        const price = parseFloat(item.unitPrice);
                                                        const isSkipped = skipConversion.has(item.id);
                                                        return (
                                                            <button key={item.id}
                                                                onClick={() => {
                                                                    setSkipConversion(prev => {
                                                                        const next = new Set(prev);
                                                                        if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
                                                                        return next;
                                                                    });
                                                                }}
                                                                className={`w-full flex items-center gap-2 p-1.5 rounded text-xs transition-all cursor-pointer ${isSkipped ? "bg-gray-100 opacity-60" : "bg-white/60 hover:bg-white"}`}>
                                                                <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${isSkipped ? "bg-gray-300" : "bg-emerald-500"}`}>
                                                                    <Check className={`h-3 w-3 text-white ${isSkipped ? "hidden" : ""}`} />
                                                                </div>
                                                                <span className={`font-medium flex-1 truncate text-left ${isSkipped ? "line-through text-gray-400" : ""}`}>{item.productName}</span>
                                                                <span className={`flex-shrink-0 ${isSkipped ? "text-gray-400 line-through" : "text-emerald-700"}`}>
                                                                    {qty} × {pkgSize} = {(qty * pkgSize).toFixed(0)} | {formatCurrency(price / pkgSize, invoiceDetail?.currency || "USD")}/un
                                                                </span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {invoiceDetail.status === "pending" && (
                                        <div className="mt-4 space-y-3">
                                            <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                                                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                                                <p className="text-sm text-amber-800 flex-1">
                                                    Revise os itens e vincule ao catalogo antes de confirmar. Itens sem vinculo <strong>nao</strong> entrarao no estoque.
                                                </p>
                                            </div>

                                            {/* Item #12: Somente valor (skip stock) */}
                                            <div
                                                className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${confirmSkipStock
                                                    ? 'border-amber-400 bg-amber-50'
                                                    : 'border-gray-200 bg-white hover:border-gray-300'
                                                    }`}
                                                onClick={() => setConfirmSkipStock(!confirmSkipStock)}
                                            >
                                                <div className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-colors ${confirmSkipStock ? 'bg-amber-500 text-white' : 'border-2 border-gray-300'
                                                    }`}>
                                                    {confirmSkipStock && <Check className="h-3.5 w-3.5" />}
                                                </div>
                                                <div className="flex-1">
                                                    <span className={`text-sm font-medium ${confirmSkipStock ? 'text-amber-800' : 'text-gray-700'}`}>
                                                        Somente valor (nao incluir produtos no estoque)
                                                    </span>
                                                    <p className="text-xs text-gray-500 mt-0.5">
                                                        A fatura sera registrada apenas como valor financeiro, sem movimentar o estoque.
                                                    </p>
                                                </div>
                                                <Info className={`h-4 w-4 mt-0.5 flex-shrink-0 ${confirmSkipStock ? 'text-amber-500' : 'text-gray-400'}`} />
                                            </div>

                                            <div className={`grid gap-3 ${confirmSkipStock ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-3'}`}>
                                                {/* Deposito destino */}
                                                {!confirmSkipStock && (
                                                    <div className="p-3 rounded-lg border border-gray-200 bg-white">
                                                        <Label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                                            <Warehouse className="h-4 w-4 text-emerald-500" />
                                                            Deposito
                                                        </Label>
                                                        <Select
                                                            value={confirmWarehouseId}
                                                            onValueChange={setConfirmWarehouseId}
                                                            disabled={multiDeposit}
                                                        >
                                                            <SelectTrigger className="mt-1">
                                                                <SelectValue placeholder={multiDeposit ? "Por item (abaixo)" : "Selecione..."} />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {(deposits as any[]).map((d: any) => (
                                                                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        <label className="flex items-center gap-2 mt-2 text-xs text-gray-600 cursor-pointer select-none">
                                                            <input
                                                                type="checkbox"
                                                                checked={multiDeposit}
                                                                onChange={e => {
                                                                    setMultiDeposit(e.target.checked);
                                                                    if (!e.target.checked) setItemDeposits({});
                                                                }}
                                                                className="h-3.5 w-3.5 accent-emerald-600 cursor-pointer"
                                                            />
                                                            Multi-depositos (um por produto)
                                                        </label>
                                                    </div>
                                                )}

                                                {/* Safra */}
                                                <div className="p-3 rounded-lg border border-gray-200 bg-white">
                                                    <Label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                                        <Wheat className="h-4 w-4 text-emerald-500" />
                                                        Safra
                                                    </Label>
                                                    <Select value={confirmSeasonId || (invoiceDetail.seasonId || "")} onValueChange={setConfirmSeasonId}>
                                                        <SelectTrigger className="mt-1">
                                                            <SelectValue placeholder="Selecione..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {(seasons as any[]).map((s: any) => (
                                                                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                {/* Vincular a veículo */}
                                                <div className="p-3 rounded-lg border border-gray-200 bg-white">
                                                    <Label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                                        Veiculo (opcional)
                                                    </Label>
                                                    <Select value={confirmEquipmentId} onValueChange={setConfirmEquipmentId}>
                                                        <SelectTrigger className="mt-1">
                                                            <SelectValue placeholder="Selecione..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="__none__">Nenhum</SelectItem>
                                                            {(equipment as any[]).filter((e: any) => e.status === "Ativo").map((e: any) => (
                                                                <SelectItem key={e.id} value={e.id}>{e.name} ({e.type})</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <p className="text-xs text-gray-400 mt-1">
                                                        {confirmEquipmentId && confirmEquipmentId !== "__none__"
                                                            ? "Despesa do veiculo"
                                                            : "Entrada no estoque"
                                                        }
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex justify-end">
                                                <Button
                                                    className="bg-emerald-600 hover:bg-emerald-700"
                                                    onClick={() => {
                                                        // Build item conversions map: itemId → packageSize (only when math test passes)
                                                        const conversions: Record<string, number> = {};
                                                        if (invoiceDetail.items) {
                                                            for (const item of invoiceDetail.items) {
                                                                if (skipConversion.has(item.id)) continue;
                                                                const pkgSize = shouldConvertPackage({ productName: item.productName, quantity: item.quantity, unitPrice: item.unitPrice, totalPrice: item.totalPrice, productId: item.productId }, stockData, products);
                                                                if (pkgSize) {
                                                                    conversions[item.id] = pkgSize;
                                                                }
                                                            }
                                                        }
                                                        const hasEquipment = confirmEquipmentId && confirmEquipmentId !== "__none__";
                                                        // Multi-deposito: valida que todo item vinculado ao catalogo tem deposito escolhido
                                                        if (multiDeposit && !confirmSkipStock && !hasEquipment) {
                                                            const linkedItems = (invoiceDetail.items || []).filter((i: any) => i.productId);
                                                            const missing = linkedItems.filter((i: any) => !itemDeposits[i.id]);
                                                            if (missing.length > 0) {
                                                                toast({
                                                                    title: "Selecione o deposito de cada produto",
                                                                    description: `${missing.length} produto(s) sem deposito escolhido.`,
                                                                    variant: "destructive"
                                                                });
                                                                return;
                                                            }
                                                        }
                                                        const shouldSendItemDeposits = multiDeposit && !confirmSkipStock && !hasEquipment && Object.keys(itemDeposits).length > 0;
                                                        confirmMutation.mutate({
                                                            id: selectedInvoice!,
                                                            skipStockEntry: confirmSkipStock || hasEquipment || undefined,
                                                            warehouseId: !confirmSkipStock && !hasEquipment && !multiDeposit && confirmWarehouseId ? confirmWarehouseId : undefined,
                                                            seasonId: confirmSeasonId || invoiceDetail.seasonId || undefined,
                                                            itemConversions: Object.keys(conversions).length > 0 ? conversions : undefined,
                                                            equipmentId: hasEquipment ? confirmEquipmentId : undefined,
                                                            itemDeposits: shouldSendItemDeposits ? itemDeposits : undefined,
                                                        });
                                                    }}
                                                    disabled={confirmMutation.isPending}
                                                >
                                                    {confirmMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                                                    {confirmSkipStock ? "Confirmar (somente valor)" : "Confirmar Entrada"}
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div></>)}
                            </DialogContent>
                        </Dialog>

                        {/* Invoices list - Stitch AgriIntel */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            {/* Filter row */}
                            <div className="p-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
                                <div className="relative flex-1 min-w-[200px] max-w-sm">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Buscar por fornecedor ou NF..."
                                        className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                                        value={invoiceSearch}
                                        onChange={(e) => { setInvoiceSearch(e.target.value); setInvoicePage(1); }}
                                    />
                                </div>
                                <button className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                                    <Filter className="h-4 w-4" />
                                    Filtros Avancados
                                </button>
                                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                                    <button
                                        className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${invoiceStatusFilter === "all" ? "bg-emerald-600 text-white shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
                                        onClick={() => { setInvoiceStatusFilter("all"); setInvoicePage(1); }}
                                    >
                                        Todos
                                    </button>
                                    <button
                                        className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${invoiceStatusFilter === "confirmed" ? "bg-emerald-600 text-white shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
                                        onClick={() => { setInvoiceStatusFilter("confirmed"); setInvoicePage(1); }}
                                    >
                                        Confirmados
                                    </button>
                                    <button
                                        className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${invoiceStatusFilter === "pending" ? "bg-emerald-600 text-white shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
                                        onClick={() => { setInvoiceStatusFilter("pending"); setInvoicePage(1); }}
                                    >
                                        Pendentes
                                    </button>
                                </div>
                                <button
                                    className="p-2.5 text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                                    title="Exportar"
                                >
                                    <ArrowDownToLine className="h-4 w-4" />
                                </button>
                            </div>

                            {/* Table */}
                            {isLoading ? (
                                <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-emerald-600" /></div>
                            ) : filteredStitchInvoices.length === 0 ? (
                                <div className="py-12 text-center">
                                    <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                                    <p className="text-gray-500 font-medium">Nenhuma fatura encontrada</p>
                                    <p className="text-gray-400 text-sm mt-1">Tente ajustar os filtros ou importe uma nova fatura</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm min-w-[900px]">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400">NF #</th>
                                                <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400">Safra</th>
                                                <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400">Fornecedor</th>
                                                <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400">Emissao</th>
                                                <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400">Vencimento</th>
                                                <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400">Status</th>
                                                <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400">Origem</th>
                                                <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400">Estoque</th>
                                                <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400">Valor</th>
                                                <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400">Acoes</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {paginatedInvoices.map((inv: any) => {
                                                const season = inv.seasonId ? (seasons as any[]).find((s: any) => s.id === inv.seasonId) : null;
                                                return (
                                                <tr
                                                    key={inv.id}
                                                    className="border-t border-gray-100 hover:bg-emerald-50/30 transition-colors cursor-pointer group"
                                                    onClick={() => setSelectedInvoice(inv.id)}
                                                >
                                                    <td className="px-4 py-3 font-bold text-gray-900 whitespace-nowrap">
                                                        NF-{inv.invoiceNumber || "---"}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        {season ? (
                                                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                                                                {season.name}
                                                            </span>
                                                        ) : <span className="text-gray-300 text-xs">--</span>}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap max-w-[200px]">
                                                        <div className="flex items-center gap-2">
                                                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                                                            <span className="truncate text-gray-700">{inv.supplier || "--"}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-gray-600 text-xs">
                                                        {inv.issueDate ? new Date(inv.issueDate).toLocaleDateString("pt-BR") : "--"}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-gray-600 text-xs">
                                                        {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("pt-BR") : "--"}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        {inv.paymentStatus === "pago" ? (
                                                            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                                                PAGA
                                                            </span>
                                                        ) : inv.paymentStatus === "parcial" ? (
                                                            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                                                PARCIAL
                                                            </span>
                                                        ) : inv.status === "confirmed" ? (
                                                            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                                CONFIRMADA
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                                                PENDENTE
                                                            </span>
                                                        )}
                                                        {inv.linkedRemisionId && (
                                                            <span className="ml-1.5 inline-flex items-center text-[9px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                                                                Conciliada
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <div className="flex items-center gap-1.5 text-gray-500 text-xs">
                                                            {inv.source === "whatsapp" ? (
                                                                <><Cloud className="h-3.5 w-3.5 text-green-500" /><span>WhatsApp</span></>
                                                            ) : inv.source === "email_import" ? (
                                                                <><Mail className="h-3.5 w-3.5 text-blue-500" /><span>Email</span></>
                                                            ) : (
                                                                <><Upload className="h-3.5 w-3.5 text-gray-400" /><span>Import</span></>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-xs">
                                                        {(() => {
                                                            const deps: Array<{ id: string; name: string }> = inv.linkedDeposits || [];
                                                            if (deps.length === 0) return <span className="text-gray-300">—</span>;
                                                            if (deps.length === 1) {
                                                                return (
                                                                    <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">
                                                                        <Warehouse className="h-3 w-3" />
                                                                        {deps[0].name}
                                                                    </span>
                                                                );
                                                            }
                                                            return (
                                                                <span
                                                                    className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold cursor-help"
                                                                    title={deps.map(d => d.name).join("\n")}
                                                                >
                                                                    <Warehouse className="h-3 w-3" />
                                                                    {deps.length} depositos
                                                                </span>
                                                            );
                                                        })()}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-black text-gray-900 whitespace-nowrap">
                                                        {formatCurrency(parseFloat(inv.totalAmount || "0"), inv.currency || "USD")}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                                            {inv.hasFile && (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); window.open(`/api/farm/invoices/${inv.id}/file`, '_blank'); }}
                                                                    className="p-1.5 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer"
                                                                    title="Ver arquivo original"
                                                                >
                                                                    <Eye className="h-4 w-4 text-blue-500" />
                                                                </button>
                                                            )}
                                                            {inv.hasPendingPayment ? (
                                                                <button
                                                                    className="p-1.5 rounded-lg cursor-not-allowed opacity-30"
                                                                    title="Fatura com pagamento — nao pode excluir"
                                                                    disabled
                                                                >
                                                                    <Trash2 className="h-4 w-4 text-gray-400" />
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); if (confirm("Excluir esta fatura?")) deleteMutation.mutate(inv.id); }}
                                                                    className="p-1.5 rounded-lg hover:bg-red-100 transition-colors cursor-pointer"
                                                                    title="Excluir fatura"
                                                                >
                                                                    <Trash2 className="h-4 w-4 text-red-400" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Pagination */}
                            {filteredStitchInvoices.length > 0 && (
                                <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
                                    <span className="text-xs text-gray-500">
                                        Mostrando {Math.min((invoicePage - 1) * INVOICES_PER_PAGE + 1, filteredStitchInvoices.length)}-{Math.min(invoicePage * INVOICES_PER_PAGE, filteredStitchInvoices.length)} de {filteredStitchInvoices.length} faturas
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <button
                                            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                            disabled={invoicePage <= 1}
                                            onClick={() => setInvoicePage(p => Math.max(1, p - 1))}
                                        >
                                            <ChevronLeft className="h-4 w-4 text-gray-600" />
                                        </button>
                                        {Array.from({ length: totalPages }, (_, i) => i + 1).slice(
                                            Math.max(0, invoicePage - 3),
                                            Math.min(totalPages, invoicePage + 2)
                                        ).map(page => (
                                            <button
                                                key={page}
                                                className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                                                    page === invoicePage
                                                        ? "bg-emerald-600 text-white"
                                                        : "text-gray-600 hover:bg-gray-100"
                                                }`}
                                                onClick={() => setInvoicePage(page)}
                                            >
                                                {page}
                                            </button>
                                        ))}
                                        <button
                                            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                            disabled={invoicePage >= totalPages}
                                            onClick={() => setInvoicePage(p => Math.min(totalPages, p + 1))}
                                        >
                                            <ChevronRight className="h-4 w-4 text-gray-600" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="remissions">
                        {/* Selected remission detail — same layout as invoice detail */}
                        {selectedInvoice && invoiceDetail && (invoiceDetail as any).documentType === "remision" && (
                            <Card className="border-purple-200 bg-white mb-4">
                                <CardHeader className="pb-3">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-purple-800 flex items-center gap-2">
                                            Remissao #{invoiceDetail.invoiceNumber || "--"}
                                            <Badge className={`ml-2 ${
                                                invoiceDetail.status === "conciliada" ? "bg-blue-100 text-blue-700" :
                                                invoiceDetail.status === "confirmed" ? "bg-emerald-100 text-emerald-700" :
                                                "bg-yellow-100 text-yellow-700"
                                            }`}>
                                                {invoiceDetail.status === "conciliada" ? "Conciliada" : invoiceDetail.status === "confirmed" ? "Confirmada" : "Pendente"}
                                            </Badge>
                                            {invoiceDetail.source === "whatsapp" && (
                                                <Badge className="ml-1 bg-green-100 text-green-700 text-xs">WhatsApp</Badge>
                                            )}
                                        </CardTitle>
                                        <div className="flex items-center gap-2">
                                            {invoiceDetail.hasFile && (
                                                <Button variant="outline" size="sm" onClick={() => window.open(`/api/farm/invoices/${selectedInvoice}/file`, "_blank")}>
                                                    <Eye className="mr-1 h-3 w-3" /> Ver Original
                                                </Button>
                                            )}
                                            <Button variant="ghost" size="sm" onClick={() => { setSelectedInvoice(null); setSkipConversion(new Set()); }}>Fechar</Button>
                                        </div>
                                    </div>
                                    <p className="text-sm text-gray-500 mt-1">
                                        Fornecedor: <strong>{invoiceDetail.supplier}</strong>
                                        {" "} Emissao: {invoiceDetail.issueDate ? new Date(invoiceDetail.issueDate).toLocaleDateString("pt-BR") : "--"}
                                    </p>
                                </CardHeader>
                                <CardContent>
                                    {/* Banner: linked invoice (conciliated) */}
                                    {invoiceDetail.linkedInvoice && (
                                        <div className="mb-4 p-3 rounded-lg border border-blue-300 bg-blue-50">
                                            <div className="flex items-center gap-2">
                                                <Package className="h-4 w-4 text-blue-600" />
                                                <span className="text-sm font-medium text-blue-800">
                                                    Conciliada com Fatura #{invoiceDetail.linkedInvoice.invoiceNumber || invoiceDetail.linkedInvoice.id.slice(0, 8)}
                                                </span>
                                                <span className="text-sm text-gray-600">
                                                    - Valor: {formatCurrency(parseFloat(invoiceDetail.linkedInvoice.totalAmount || 0), invoiceDetail?.currency || "USD")}
                                                </span>
                                                <Badge className="bg-blue-100 text-blue-700 text-xs">Precos atualizados</Badge>
                                            </div>
                                        </div>
                                    )}

                                    {/* Banner: matching remissions (for pending remissions) */}
                                    {invoiceDetail.matchingRemissions && invoiceDetail.matchingRemissions.length > 0 && (
                                        <div className="mb-4 p-3 rounded-lg border border-amber-300 bg-amber-50">
                                            <div className="flex items-center gap-2">
                                                <AlertTriangle className="h-4 w-4 text-amber-600" />
                                                <span className="text-sm font-medium text-amber-800">
                                                    Existem faturas que podem ser vinculadas a esta remissao. Veja na aba Faturas.
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Aviso de vinculação */}
                                    {invoiceDetail.status === "pending" && (invoiceDetail.items || []).some((i: any) => !i.productId) && (
                                        <div className="mb-3 p-3 rounded-lg border border-amber-300 bg-amber-50 flex items-center gap-2">
                                            <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                                            <span className="text-sm text-amber-800">
                                                Vincule os produtos ao catalogo para que entrem no estoque ao aprovar.
                                            </span>
                                        </div>
                                    )}

                                    <table className="w-full text-sm">
                                        <thead className="bg-purple-50">
                                            <tr>
                                                <th className="text-left p-2 font-semibold text-purple-800">Produto (Remissao)</th>
                                                <th className="text-left p-2 font-semibold text-purple-800 min-w-[180px]">Vincular ao Catalogo</th>
                                                <th className="text-left p-2 font-semibold text-purple-800">Un</th>
                                                <th className="text-right p-2 font-semibold text-purple-800">Qtd</th>
                                                {multiDeposit && invoiceDetail.status === "pending" && (
                                                    <th className="text-left p-2 font-semibold text-purple-800 min-w-[160px]">Deposito</th>
                                                )}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(invoiceDetail.items || []).map((item: any, idx: number) => (
                                                <tr key={item.id || idx} className="border-t border-gray-100">
                                                    <td className="p-2 font-medium">{item.productName}</td>
                                                    <td className="p-2">
                                                        <Select
                                                            value={item.productId || ""}
                                                            onValueChange={(v) => linkProductMutation.mutate({ invoiceId: selectedInvoice!, itemId: item.id, productId: v })}
                                                        >
                                                            <SelectTrigger className={`h-8 text-xs ${item.productId ? 'border-emerald-300 bg-emerald-50' : 'border-amber-300 bg-amber-50'}`}>
                                                                <SelectValue placeholder="Selecione..." />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {(products as any[]).map((p: any) => (
                                                                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </td>
                                                    <td className="p-2 text-gray-600">{item.unit}</td>
                                                    <td className="p-2 text-right">{parseFloat(item.quantity || 0).toFixed(2)}</td>
                                                    {multiDeposit && invoiceDetail.status === "pending" && (
                                                        <td className="p-2">
                                                            {item.productId ? (
                                                                <Select
                                                                    value={itemDeposits[item.id] || ""}
                                                                    onValueChange={v => setItemDeposits(prev => ({ ...prev, [item.id]: v }))}
                                                                >
                                                                    <SelectTrigger className="h-8 text-xs">
                                                                        <SelectValue placeholder="Selecione..." />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        {(deposits as any[]).map((d: any) => (
                                                                            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            ) : (
                                                                <span className="text-[11px] text-gray-400 italic">Vincule ao catalogo</span>
                                                            )}
                                                        </td>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>

                                    {invoiceDetail.status === "pending" && (
                                        <div className="mt-4 space-y-3">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <div className="p-3 rounded-lg border border-gray-200 bg-white">
                                                    <Label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                                        <Warehouse className="h-4 w-4 text-emerald-500" />
                                                        Deposito
                                                    </Label>
                                                    <Select
                                                        value={confirmWarehouseId}
                                                        onValueChange={setConfirmWarehouseId}
                                                        disabled={multiDeposit}
                                                    >
                                                        <SelectTrigger className="mt-1">
                                                            <SelectValue placeholder={multiDeposit ? "Por item (abaixo)" : "Selecione..."} />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {(deposits as any[]).map((d: any) => (
                                                                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <label className="flex items-center gap-2 mt-2 text-xs text-gray-600 cursor-pointer select-none">
                                                        <input
                                                            type="checkbox"
                                                            checked={multiDeposit}
                                                            onChange={e => {
                                                                setMultiDeposit(e.target.checked);
                                                                if (!e.target.checked) setItemDeposits({});
                                                            }}
                                                            className="h-3.5 w-3.5 accent-emerald-600 cursor-pointer"
                                                        />
                                                        Multi-depositos (um por produto)
                                                    </label>
                                                </div>
                                                <div className="p-3 rounded-lg border border-gray-200 bg-white">
                                                    <Label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                                        <Wheat className="h-4 w-4 text-emerald-500" />
                                                        Safra
                                                    </Label>
                                                    <Select value={confirmSeasonId || (invoiceDetail.seasonId || "")} onValueChange={setConfirmSeasonId}>
                                                        <SelectTrigger className="mt-1">
                                                            <SelectValue placeholder="Selecione..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {(seasons as any[]).map((s: any) => (
                                                                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                                    onClick={() => {
                                                        // Multi-deposito: valida items vinculados com deposito escolhido
                                                        if (multiDeposit) {
                                                            const linkedItems = (invoiceDetail.items || []).filter((i: any) => i.productId);
                                                            const missing = linkedItems.filter((i: any) => !itemDeposits[i.id]);
                                                            if (missing.length > 0) {
                                                                toast({
                                                                    title: "Selecione o deposito de cada produto",
                                                                    description: `${missing.length} produto(s) sem deposito escolhido.`,
                                                                    variant: "destructive"
                                                                });
                                                                return;
                                                            }
                                                        }
                                                        const shouldSendItemDeposits = multiDeposit && Object.keys(itemDeposits).length > 0;
                                                        confirmMutation.mutate({
                                                            id: selectedInvoice!,
                                                            warehouseId: !multiDeposit && confirmWarehouseId ? confirmWarehouseId : undefined,
                                                            seasonId: confirmSeasonId || invoiceDetail.seasonId || undefined,
                                                            itemDeposits: shouldSendItemDeposits ? itemDeposits : undefined,
                                                        });
                                                    }}
                                                    disabled={confirmMutation.isPending || (invoiceDetail.items || []).every((i: any) => !i.productId)}
                                                >
                                                    {confirmMutation.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
                                                    Aprovar Remissao (entrada no estoque)
                                                </Button>
                                                <Button variant="outline" className="text-red-600 border-red-300" onClick={() => {
                                                    deleteMutation.mutate(selectedInvoice!);
                                                }}>
                                                    Excluir
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        <Card className="border-emerald-100">
                            <CardHeader>
                                <CardTitle className="text-emerald-800 flex items-center gap-2">
                                    <ReceiptText className="h-5 w-5" />
                                    Remissoes
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {isLoadingRemissions ? (
                                    <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-emerald-600" /></div>
                                ) : (remissions as any[]).length === 0 ? (
                                    <div className="py-8 text-center">
                                        <ReceiptText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                                        <p className="text-gray-500">Nenhuma remissao importada</p>
                                    </div>
                                ) : (
                                    <div className="bg-white rounded-xl border border-emerald-100 overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead className="bg-emerald-50">
                                                <tr>
                                                    <th className="text-left p-3 font-semibold text-emerald-800">Fornecedor</th>
                                                    <th className="text-left p-3 font-semibold text-emerald-800">Nr. Remissao</th>
                                                    <th className="text-left p-3 font-semibold text-emerald-800">Data</th>
                                                    <th className="text-center p-3 font-semibold text-emerald-800">Status</th>
                                                    <th className="text-left p-3 font-semibold text-emerald-800">Produtos</th>
                                                    <th className="text-right p-3 font-semibold text-emerald-800">Acoes</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(remissions as any[]).map((rem: any) => (
                                                    <tr key={rem.id} className="border-t border-gray-100 hover:bg-emerald-50/50 cursor-pointer" onClick={() => setSelectedInvoice(rem.id)}>
                                                        <td className="p-3 font-medium">{rem.supplier || "--"}</td>
                                                        <td className="p-3 font-mono text-sm">{rem.invoiceNumber || rem.id.slice(0, 8)}</td>
                                                        <td className="p-3 text-gray-600">
                                                            {rem.issueDate ? new Date(rem.issueDate).toLocaleDateString("pt-BR") : "--"}
                                                        </td>
                                                        <td className="text-center p-3">
                                                            <Badge className={
                                                                rem.status === "conciliada"
                                                                    ? "bg-blue-100 text-blue-700 hover:bg-blue-100"
                                                                    : rem.status === "confirmed"
                                                                        ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                                                                        : "bg-yellow-100 text-yellow-700 hover:bg-yellow-100"
                                                            }>
                                                                {rem.status === "conciliada" ? "Conciliada" : rem.status === "confirmed" ? "Confirmada" : "Pendente"}
                                                            </Badge>
                                                            {rem.source === "whatsapp" && (
                                                                <Badge className="ml-1 bg-green-100 text-green-700 hover:bg-green-100 text-xs">WhatsApp</Badge>
                                                            )}
                                                        </td>
                                                        <td className="p-3 text-gray-600 text-xs max-w-xs truncate">
                                                            --
                                                        </td>
                                                        <td className="p-3 text-right">
                                                            <div className="flex items-center gap-1 justify-end">
                                                                {rem.status === "pending" && (
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        className="h-7 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                                                                        onClick={(e: React.MouseEvent) => {
                                                                            e.stopPropagation();
                                                                            setSelectedInvoice(rem.id);
                                                                            confirmMutation.mutate({ id: rem.id });
                                                                        }}
                                                                        disabled={confirmMutation.isPending}
                                                                    >
                                                                        {confirmMutation.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Check className="mr-1 h-3 w-3" />}
                                                                        Aprovar
                                                                    </Button>
                                                                )}
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="h-7 text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
                                                                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); setSelectedInvoice(rem.id); }}
                                                                >
                                                                    <Pencil className="mr-1 h-3 w-3" /> Editar
                                                                </Button>
                                                                {rem.hasFile && (
                                                                    <Button
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        className="h-7"
                                                                        onClick={(e: React.MouseEvent) => { e.stopPropagation(); window.open(`/api/farm/invoices/${rem.id}/file`, "_blank"); }}
                                                                        aria-label="Ver arquivo"
                                                                    >
                                                                        <Eye className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                )}
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    className="h-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                                    onClick={(e: React.MouseEvent) => {
                                                                        e.stopPropagation();
                                                                        if (confirm(`Excluir remissao "${rem.supplier || rem.invoiceNumber}" ?`)) {
                                                                            deleteMutation.mutate(rem.id);
                                                                        }
                                                                    }}
                                                                    aria-label="Excluir"
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="receipts">
                        <Card className="border-emerald-100">
                            <CardHeader>
                                <CardTitle className="text-emerald-800">Recibos de Frota (WhatsApp)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {isLoadingExpenses ? (
                                    <div className="flex justify-center py-8">
                                        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                                    </div>
                                ) : pendingFleetReceipts.length === 0 ? (
                                    <div className="py-8 text-center">
                                        <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                                        <p className="text-gray-500">Nenhum recibo de frota pendente de aprovação</p>
                                    </div>
                                ) : (
                                    <div className="bg-white rounded-xl border border-emerald-100 overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead className="bg-emerald-50">
                                                <tr>
                                                    <th className="text-left p-3 font-semibold text-emerald-800">Data</th>
                                                    <th className="text-left p-3 font-semibold text-emerald-800">Máquina / Veículo</th>
                                                    <th className="text-left p-3 font-semibold text-emerald-800">Fornecedor</th>
                                                    <th className="text-left p-3 font-semibold text-emerald-800">Categoria</th>
                                                    <th className="text-left p-3 font-semibold text-emerald-800">Descrição</th>
                                                    <th className="text-right p-3 font-semibold text-emerald-800">Valor</th>
                                                    <th className="text-right p-3 font-semibold text-emerald-800">Ações</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {pendingFleetReceipts.map((e: any) => {
                                                    const equip = (equipment as any[]).find((eq) => eq.id === e.equipmentId);
                                                    return (
                                                        <tr key={e.id} className="border-t border-gray-100">
                                                            <td className="p-3">
                                                                {new Date(e.expenseDate).toLocaleDateString("pt-BR")}
                                                            </td>
                                                            <td className="p-3">
                                                                <span className="font-semibold text-gray-800">
                                                                    {equip?.name || "Equipamento não encontrado"}
                                                                </span>
                                                            </td>
                                                            <td className="p-3 text-gray-700">
                                                                {extractSupplier(e.description)}
                                                            </td>
                                                            <td className="p-3">
                                                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                                                                    {e.category}
                                                                </span>
                                                            </td>
                                                            <td className="p-3">
                                                                {cleanDescription(e.description)}
                                                            </td>
                                                            <td className="text-right p-3 font-mono font-semibold">
                                                                {formatCurrency(parseFloat(e.amount), e.currency || "USD")}
                                                            </td>
                                                            <td className="text-right p-3">
                                                                <div className="flex items-center justify-end gap-2">
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        className="text-emerald-700 border-emerald-200"
                                                                        onClick={() => setSelectedExpense(e.id)}
                                                                    >
                                                                        <Eye className="mr-1 h-3 w-3" />
                                                                        Ver
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        className="bg-emerald-600 hover:bg-emerald-700"
                                                                        onClick={() => setApproveExpenseId(e.id)}
                                                                    >
                                                                        <Check className="mr-1 h-3 w-3" />
                                                                        Aprovar
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        className="text-red-600 border-red-200 hover:bg-red-50"
                                                                        disabled={deleteExpenseMutation.isPending}
                                                                        onClick={() => deleteExpenseMutation.mutate(e.id)}
                                                                    >
                                                                        <Trash2 className="mr-1 h-3 w-3" />
                                                                        Remover
                                                                    </Button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {confirmedFleetReceipts.length > 0 && (
                                    <>
                                        <h3 className="text-lg font-semibold text-emerald-800 mt-8 mb-3">Recibos Aprovados</h3>
                                        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                            <table className="w-full text-sm">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        <th className="text-left p-3 font-semibold text-gray-600">Data</th>
                                                        <th className="text-left p-3 font-semibold text-gray-600">Máquina / Veículo</th>
                                                        <th className="text-left p-3 font-semibold text-gray-600">Fornecedor</th>
                                                        <th className="text-left p-3 font-semibold text-gray-600">Categoria</th>
                                                        <th className="text-left p-3 font-semibold text-gray-600">Descrição</th>
                                                        <th className="text-right p-3 font-semibold text-gray-600">Valor</th>
                                                        <th className="text-center p-3 font-semibold text-gray-600">Status</th>
                                                        <th className="text-center p-3 font-semibold text-gray-600">Ações</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {confirmedFleetReceipts.map((e: any) => {
                                                        const equip = (equipment as any[]).find((eq) => eq.id === e.equipmentId);
                                                        return (
                                                            <tr key={e.id} className="border-t border-gray-100">
                                                                <td className="p-3 text-gray-600">
                                                                    {new Date(e.expenseDate).toLocaleDateString("pt-BR")}
                                                                </td>
                                                                <td className="p-3 font-semibold text-gray-700">
                                                                    {equip?.name || "—"}
                                                                </td>
                                                                <td className="p-3 text-gray-600">
                                                                    {extractSupplier(e.description)}
                                                                </td>
                                                                <td className="p-3">
                                                                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                                                        {e.category}
                                                                    </span>
                                                                </td>
                                                                <td className="p-3 text-gray-600">
                                                                    {cleanDescription(e.description)}
                                                                </td>
                                                                <td className="text-right p-3 font-mono font-semibold text-gray-700">
                                                                    {formatCurrency(parseFloat(e.amount), e.currency || "USD")}
                                                                </td>
                                                                <td className="text-center p-3">
                                                                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                                                                        Aprovado
                                                                    </span>
                                                                </td>
                                                                <td className="text-center p-3">
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        className="text-gray-600 border-gray-200"
                                                                        onClick={() => setSelectedExpense(e.id)}
                                                                    >
                                                                        <Eye className="mr-1 h-3 w-3" />
                                                                        Ver
                                                                    </Button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Aba Despesas sem Fatura */}
                    <TabsContent value="expenses-nofatura">
                        <Card>
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                    <CardTitle className="text-emerald-800 flex items-center gap-2">
                                        <DollarSign className="h-5 w-5" /> Despesas sem Fatura
                                    </CardTitle>
                                    {(() => {
                                        const selectedExps = selectableExpensesWithoutInvoice.filter((e: any) => selectedExpenseIds.has(e.id));
                                        const sups = new Set(selectedExps.map((e: any) => (e.supplier || "").toLowerCase().trim()));
                                        const hasPendingSelection = selectedExps.some((e: any) => e.status !== "confirmed");
                                        const canPromote = selectedExps.length > 0 && sups.size === 1 && !hasPendingSelection;
                                        return (
                                            <div className="flex items-center gap-3">
                                                {selectedExpenseIds.size > 0 && (
                                                    <span className="text-xs text-emerald-700 font-semibold">
                                                        {selectedExpenseIds.size} selecionada(s)
                                                    </span>
                                                )}
                                                {selectedExpenseIds.size > 0 && sups.size > 1 && (
                                                    <span className="text-[11px] text-amber-600">⚠ fornecedores diferentes</span>
                                                )}
                                                {selectedExpenseIds.size > 0 && hasPendingSelection && (
                                                    <span className="text-[11px] text-amber-600">⚠ aprove antes de vincular</span>
                                                )}
                                                {selectedExpenseIds.size > 0 && (
                                                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setSelectedExpenseIds(new Set())}>
                                                        Limpar
                                                    </Button>
                                                )}
                                                <Button
                                                    size="sm"
                                                    className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40"
                                                    disabled={!canPromote}
                                                    onClick={() => setPromoteOpen(true)}
                                                >
                                                    <FileText className="mr-1 h-3.5 w-3.5" />
                                                    Promover a Fatura
                                                </Button>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                {expensesWithoutInvoice.length === 0 ? (
                                    <p className="text-sm text-gray-500 text-center py-8">Nenhuma despesa sem fatura lancada</p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-emerald-50">
                                                <tr>
                                                    <th className="p-3 w-10">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectableExpensesWithoutInvoice.length > 0 && selectedExpenseIds.size === selectableExpensesWithoutInvoice.length}
                                                            onChange={() => {
                                                                setSelectedExpenseIds(prev => {
                                                                    if (prev.size === selectableExpensesWithoutInvoice.length) return new Set();
                                                                    return new Set(selectableExpensesWithoutInvoice.map((e: any) => e.id));
                                                                });
                                                            }}
                                                            className="h-4 w-4 cursor-pointer accent-emerald-600"
                                                            aria-label="Selecionar todas"
                                                        />
                                                    </th>
                                                    <th className="text-left p-3 font-semibold text-emerald-800">Data</th>
                                                    <th className="text-left p-3 font-semibold text-emerald-800">Fornecedor</th>
                                                    <th className="text-left p-3 font-semibold text-emerald-800">Doc Nº</th>
                                                    <th className="text-left p-3 font-semibold text-emerald-800">Categoria</th>
                                                    <th className="text-left p-3 font-semibold text-emerald-800">Pagamento</th>
                                                    <th className="text-left p-3 font-semibold text-emerald-800">Vencimento</th>
                                                    <th className="text-left p-3 font-semibold text-emerald-800">Parcelas</th>
                                                    <th className="text-left p-3 font-semibold text-emerald-800">Status</th>
                                                    <th className="text-right p-3 font-semibold text-emerald-800">Valor</th>
                                                    <th className="text-right p-3 font-semibold text-emerald-800">Ações</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {expensesWithoutInvoice.map((exp: any) => {
                                                    const linkedInvoice = findLinkedInvoice(exp.invoiceId);
                                                    const isLinked = !!exp.invoiceId;
                                                    const isPendingApproval = !isLinked && exp.status !== "confirmed";
                                                    return (
                                                        <tr
                                                            key={exp.id}
                                                            className={`border-t border-gray-100 hover:bg-emerald-50/30 cursor-pointer transition-colors ${selectedExpenseIds.has(exp.id) ? "bg-emerald-50/40" : ""}`}
                                                            onClick={() => isPendingApproval ? setApproveExpenseId(exp.id) : setSelectedExpense(exp.id)}
                                                        >
                                                            <td className="p-3" onClick={ev => ev.stopPropagation()}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedExpenseIds.has(exp.id)}
                                                                    disabled={isLinked}
                                                                    onChange={() => toggleExpenseSelected(exp.id)}
                                                                    className="h-4 w-4 cursor-pointer accent-emerald-600 disabled:cursor-not-allowed disabled:opacity-30"
                                                                    aria-label={`Selecionar ${exp.supplier || exp.category}`}
                                                                />
                                                            </td>
                                                            <td className="p-3 text-gray-700">{new Date(exp.expenseDate || exp.createdAt).toLocaleDateString("pt-BR")}</td>
                                                            <td className="p-3 font-medium">{exp.supplier || "--"}</td>
                                                            <td className="p-3 text-xs font-mono text-gray-600">{exp.documentNumber || "--"}</td>
                                                            <td className="p-3"><Badge variant="outline" className="text-xs">{exp.category}</Badge></td>
                                                            <td className="p-3">
                                                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${exp.paymentType === "a_prazo" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                                                                    {exp.paymentType === "a_prazo" ? "A Prazo" : "A Vista"}
                                                                </span>
                                                            </td>
                                                            <td className="p-3 text-gray-600">{exp.paymentType === "a_prazo" && exp.dueDate ? new Date(exp.dueDate).toLocaleDateString("pt-BR") : "--"}</td>
                                                            <td className="p-3 text-gray-600">{exp.paymentType === "a_prazo" ? `${exp.installmentsPaid || 0}/${exp.installments || 1}` : "--"}</td>
                                                            <td className="p-3">
                                                                {isLinked ? (
                                                                    <div className="flex flex-col gap-1">
                                                                        <Badge className="bg-blue-100 text-blue-700 text-[10px] w-fit">Vinculada</Badge>
                                                                        <span className="text-[11px] text-blue-700">
                                                                            Fatura #{linkedInvoice?.invoiceNumber || String(exp.invoiceId).slice(0, 8)}
                                                                        </span>
                                                                    </div>
                                                                ) : (
                                                                    <Badge variant={exp.status === "confirmed" ? "default" : "secondary"} className="text-xs">
                                                                        {exp.status === "confirmed" ? "Confirmada" : "Pendente"}
                                                                    </Badge>
                                                                )}
                                                            </td>
                                                            <td className="text-right p-3 font-mono font-bold text-emerald-700">{formatCurrency(parseFloat(exp.amount || "0"), exp.currency || "USD")}</td>
                                                            <td className="text-right p-3" onClick={ev => ev.stopPropagation()}>
                                                                <div className="flex items-center justify-end gap-1">
                                                                    {isPendingApproval && (
                                                                        <Button size="sm" className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => setApproveExpenseId(exp.id)}>
                                                                            <Check className="mr-1 h-3 w-3" /> Aprovar
                                                                        </Button>
                                                                    )}
                                                                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setSelectedExpense(exp.id)}>
                                                                        <Pencil className="mr-1 h-3 w-3" /> Editar
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        className="h-8 text-xs text-red-600 border-red-200 hover:bg-red-50"
                                                                        disabled={deleteExpenseMutation.isPending}
                                                                        onClick={() => {
                                                                            const message = isLinked
                                                                                ? "Excluir esta despesa vinculada? A fatura continuara existindo e a exclusao so sera permitida se ela ainda nao foi paga."
                                                                                : "Excluir esta despesa sem fatura?";
                                                                            if (confirm(message)) deleteExpenseMutation.mutate(exp.id);
                                                                        }}
                                                                    >
                                                                        <Trash2 className="mr-1 h-3 w-3" /> Excluir
                                                                    </Button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

                {/* Bottom monitoring bar */}
                <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-gray-100 shadow-sm px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            MONITORAMENTO EM TEMPO REAL
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Clock className="h-3.5 w-3.5" />
                        Proxima sincronizacao automatica em 5 minutos
                    </div>
                </div>
            </div>

            <Dialog open={!!approveExpenseId} onOpenChange={(open) => { if (!open) { setApproveExpenseId(null); setApproveSeasonId(""); setApproveDueDate(""); setApproveEquipmentId("__none__"); } }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Wallet className="h-5 w-5 text-emerald-600" />
                            Aprovar Despesa
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div>
                            <Label>Safra</Label>
                            <Select value={approveSeasonId} onValueChange={setApproveSeasonId}>
                                <SelectTrigger><SelectValue placeholder="Selecione a safra..." /></SelectTrigger>
                                <SelectContent>
                                    {(seasons as any[]).map((s: any) => (
                                        <SelectItem key={s.id} value={s.id}>
                                            {s.name}{s.isActive ? "" : " (encerrada)"}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Data de Vencimento</Label>
                            <Input type="date" value={approveDueDate} onChange={e => setApproveDueDate(e.target.value)} />
                        </div>
                        <div>
                            <Label>Vincular a Veiculo <span className="text-gray-400 font-normal">(opcional)</span></Label>
                            <Select value={approveEquipmentId} onValueChange={setApproveEquipmentId}>
                                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__none__">Nenhum</SelectItem>
                                    {(equipment as any[]).filter((e: any) => e.status === "Ativo" || !e.status).map((e: any) => (
                                        <SelectItem key={e.id} value={e.id}>{e.name} {e.type ? `(${e.type})` : ""}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-[11px] text-gray-400 mt-1">Despesa fica vinculada ao veiculo (ex: combustivel, manutencao).</p>
                        </div>
                        <p className="text-xs text-gray-500">
                            Depois de aprovada, a despesa entra em Contas a Pagar como aberta. A forma de pagamento sera definida no pagamento da conta.
                        </p>
                        <div className="flex gap-2">
                            <Button
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                                disabled={confirmExpenseMutation.isPending || !approveSeasonId || !approveDueDate}
                                onClick={() => approveExpenseId && confirmExpenseMutation.mutate({
                                    id: approveExpenseId,
                                    equipmentId: approveEquipmentId !== "__none__" ? approveEquipmentId : undefined,
                                    dueDate: approveDueDate,
                                    seasonId: approveSeasonId,
                                })}
                            >
                                {confirmExpenseMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                                Aprovar e Enviar ao Contas a Pagar
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Modal Promover a Fatura — vincula despesas selecionadas a uma fatura existente do mesmo fornecedor */}
            <Dialog open={promoteOpen} onOpenChange={open => { if (!open) { setPromoteOpen(false); setPromoteInvoiceId(""); } }}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-emerald-800">
                            <FileText className="h-5 w-5" /> Promover a Fatura
                        </DialogTitle>
                    </DialogHeader>
                    {(() => {
                        const selExps = selectableExpensesWithoutInvoice.filter((e: any) => selectedExpenseIds.has(e.id));
                        const supplier = (selExps[0]?.supplier || "").toLowerCase().trim();
                        const candidateInvoices = (invoices as any[]).filter((inv: any) => {
                            const invSup = (inv.supplier || "").toLowerCase().trim();
                            return supplier && (invSup.includes(supplier) || supplier.includes(invSup));
                        });
                        const hasPendingSelection = selExps.some((e: any) => e.status !== "confirmed");
                        const totalSel = selExps.reduce((s: number, e: any) => s + parseFloat(e.amount || "0"), 0);
                        const selectedInvoiceForPromote = (invoices as any[]).find((inv: any) => String(inv.id) === String(promoteInvoiceId));
                        const selectedInvoiceTotal = parseFloat(selectedInvoiceForPromote?.totalAmount || "0");
                        const totalsMatch = !!selectedInvoiceForPromote && Math.abs(totalSel - selectedInvoiceTotal) <= 0.01;
                        return (
                            <div className="space-y-4 text-sm py-2">
                                <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3">
                                    <p className="text-xs text-emerald-700 font-semibold mb-1">
                                        {selExps.length} despesa(s) — {selExps[0]?.supplier || "—"}
                                    </p>
                                    <p className="text-xs text-gray-600">Total: {formatCurrency(totalSel)}</p>
                                    {hasPendingSelection && (
                                        <p className="text-xs text-amber-700 mt-2">Aprove todas as despesas selecionadas antes de vincular a uma fatura.</p>
                                    )}
                                </div>

                                <div>
                                    <Label>Selecione a fatura</Label>
                                    {candidateInvoices.length === 0 ? (
                                        <p className="text-sm text-amber-600 mt-2">
                                            Nenhuma fatura encontrada para o fornecedor <strong>{selExps[0]?.supplier}</strong>.
                                            Importe ou cadastre uma fatura primeiro.
                                        </p>
                                    ) : (
                                        <Select value={promoteInvoiceId} onValueChange={setPromoteInvoiceId}>
                                            <SelectTrigger><SelectValue placeholder="Selecione a fatura..." /></SelectTrigger>
                                            <SelectContent>
                                                {candidateInvoices.map((inv: any) => (
                                                    <SelectItem key={inv.id} value={inv.id}>
                                                        NF-{inv.invoiceNumber || inv.id.slice(0, 8)} — {formatCurrency(parseFloat(inv.totalAmount || "0"), inv.currency || "USD")} — {inv.issueDate ? new Date(inv.issueDate).toLocaleDateString("pt-BR") : "?"}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                    {selectedInvoiceForPromote && !totalsMatch && (
                                        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                                            A soma das despesas selecionadas ({formatCurrency(totalSel, selectedInvoiceForPromote.currency || "USD")}) precisa ser igual ao total da fatura ({formatCurrency(selectedInvoiceTotal, selectedInvoiceForPromote.currency || "USD")}).
                                        </div>
                                    )}
                                </div>

                                <div className="flex justify-end gap-2 pt-3 border-t">
                                    <Button variant="outline" onClick={() => setPromoteOpen(false)} disabled={promoteToInvoiceMutation.isPending}>
                                        Cancelar
                                    </Button>
                                    <Button
                                        className="bg-emerald-600 hover:bg-emerald-700"
                                        onClick={() => promoteInvoiceId && promoteToInvoiceMutation.mutate({
                                            expenseIds: selExps.map((e: any) => e.id),
                                            invoiceId: promoteInvoiceId,
                                        })}
                                        disabled={!promoteInvoiceId || hasPendingSelection || !totalsMatch || promoteToInvoiceMutation.isPending}
                                    >
                                        {promoteToInvoiceMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                                        Vincular
                                    </Button>
                                </div>
                            </div>
                        );
                    })()}
                </DialogContent>
            </Dialog>

            <Dialog open={!!selectedExpense} onOpenChange={(open) => { if (!open) { setSelectedExpense(null); setEditingExpense(false); setEditingExpItemId(null); } }}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <div className="flex items-center justify-between">
                            <DialogTitle className="text-emerald-800">
                                {editingExpense ? "Editando Recibo" : "Detalhes do Recibo"}
                            </DialogTitle>
                            {expenseDetail && !editingExpense && expenseDetail.status === "pending" && (
                                <Button variant="outline" size="sm" onClick={() => {
                                    setEditingExpense(true);
                                    setEditExpData({
                                        supplier: expenseDetail.supplier || extractSupplier(expenseDetail.description) || "",
                                        category: expenseDetail.category || "",
                                        amount: expenseDetail.amount || "",
                                        description: cleanDescription(expenseDetail.description),
                                        expenseDate: expenseDetail.expenseDate ? new Date(expenseDetail.expenseDate).toISOString().split("T")[0] : "",
                                    });
                                }}>
                                    <Pencil className="mr-1 h-3 w-3" /> Editar
                                </Button>
                            )}
                            {editingExpense && (
                                <div className="flex items-center gap-2">
                                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700"
                                        disabled={updateExpenseMutation.isPending}
                                        onClick={() => updateExpenseMutation.mutate({ id: selectedExpense!, data: editExpData })}>
                                        {updateExpenseMutation.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />} Salvar
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => setEditingExpense(false)}>
                                        <X className="mr-1 h-3 w-3" /> Cancelar
                                    </Button>
                                </div>
                            )}
                        </div>
                    </DialogHeader>
                    {expenseDetail ? (
                        <div className="space-y-4">
                            {editingExpense ? (
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <Label className="text-xs text-gray-500">Fornecedor</Label>
                                        <Input className="h-8 text-sm" value={editExpData.supplier}
                                            onChange={e => setEditExpData({ ...editExpData, supplier: e.target.value })} />
                                    </div>
                                    <div>
                                        <Label className="text-xs text-gray-500">Categoria</Label>
                                        <Input className="h-8 text-sm" value={editExpData.category}
                                            onChange={e => setEditExpData({ ...editExpData, category: e.target.value })} />
                                    </div>
                                    <div>
                                        <Label className="text-xs text-gray-500">Valor ($)</Label>
                                        <CurrencyInput className="h-8 text-sm" value={editExpData.amount}
                                            onValueChange={v => setEditExpData({ ...editExpData, amount: v })} />
                                    </div>
                                    <div>
                                        <Label className="text-xs text-gray-500">Data</Label>
                                        <Input type="date" className="h-8 text-sm" value={editExpData.expenseDate}
                                            onChange={e => setEditExpData({ ...editExpData, expenseDate: e.target.value })} />
                                    </div>
                                    <div className="col-span-2">
                                        <Label className="text-xs text-gray-500">Descrição</Label>
                                        <Input className="h-8 text-sm" value={editExpData.description}
                                            onChange={e => setEditExpData({ ...editExpData, description: e.target.value })} />
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-gray-500">Fornecedor:</span>
                                        <p className="font-semibold">{expenseDetail.supplier || extractSupplier(expenseDetail.description) || "—"}</p>
                                    </div>
                                    <div>
                                        <span className="text-gray-500">Categoria:</span>
                                        <p><span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">{expenseDetail.category}</span></p>
                                    </div>
                                    <div>
                                        <span className="text-gray-500">Valor Total:</span>
                                        <p className="font-semibold text-lg">{formatCurrency(parseFloat(expenseDetail.amount), expenseDetail.currency || "USD")}</p>
                                    </div>
                                    <div>
                                        <span className="text-gray-500">Data:</span>
                                        <p className="font-semibold">{new Date(expenseDetail.expenseDate).toLocaleDateString("pt-BR")}</p>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="text-gray-500">Descrição:</span>
                                        <p>{cleanDescription(expenseDetail.description)}</p>
                                    </div>
                                </div>
                            )}

                            {expenseDetail.items && expenseDetail.items.length > 0 && (
                                <div>
                                    <h4 className="font-semibold text-emerald-800 mb-2">Itens do Recibo ({expenseDetail.items.length})</h4>
                                    <div className="bg-white rounded-lg border border-emerald-100 overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead className="bg-emerald-50">
                                                <tr>
                                                    <th className="text-left p-2 font-semibold text-emerald-800">Item</th>
                                                    <th className="text-center p-2 font-semibold text-emerald-800">Qtd</th>
                                                    <th className="text-center p-2 font-semibold text-emerald-800">Unid</th>
                                                    <th className="text-right p-2 font-semibold text-emerald-800">Preço Unit.</th>
                                                    <th className="text-right p-2 font-semibold text-emerald-800">Total</th>
                                                    {expenseDetail.status === "pending" && <th className="text-center p-2 font-semibold text-emerald-800">Ações</th>}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {expenseDetail.items.map((item: any) => (
                                                    editingExpItemId === item.id ? (
                                                        <tr key={item.id} className="border-t border-emerald-200 bg-emerald-50/50">
                                                            <td className="p-2">
                                                                <Input className="h-7 text-xs" value={editExpItemData.itemName}
                                                                    onChange={e => setEditExpItemData({ ...editExpItemData, itemName: e.target.value })} />
                                                            </td>
                                                            <td className="p-2">
                                                                <Input type="number" step="0.01" className="h-7 text-xs w-20 text-center" value={editExpItemData.quantity}
                                                                    onChange={e => setEditExpItemData({ ...editExpItemData, quantity: e.target.value })} />
                                                            </td>
                                                            <td className="p-2">
                                                                <Input className="h-7 text-xs w-16 text-center" value={editExpItemData.unit}
                                                                    onChange={e => setEditExpItemData({ ...editExpItemData, unit: e.target.value })} />
                                                            </td>
                                                            <td className="p-2">
                                                                <CurrencyInput className="h-7 text-xs w-24 text-right" value={editExpItemData.unitPrice}
                                                                    onValueChange={v => setEditExpItemData({ ...editExpItemData, unitPrice: v })} prefix="" />
                                                            </td>
                                                            <td className="p-2">
                                                                <CurrencyInput className="h-7 text-xs w-24 text-right" value={editExpItemData.totalPrice}
                                                                    onValueChange={v => setEditExpItemData({ ...editExpItemData, totalPrice: v })} prefix="" />
                                                            </td>
                                                            <td className="p-2 text-center">
                                                                <div className="flex items-center justify-center gap-1">
                                                                    <button className="p-1 rounded hover:bg-emerald-200" title="Salvar"
                                                                        onClick={() => updateExpenseItemMutation.mutate({
                                                                            expenseId: selectedExpense!, itemId: item.id, data: editExpItemData
                                                                        })}>
                                                                        <Save className="h-4 w-4 text-emerald-600" />
                                                                    </button>
                                                                    <button className="p-1 rounded hover:bg-gray-200" title="Cancelar"
                                                                        onClick={() => setEditingExpItemId(null)}>
                                                                        <X className="h-4 w-4 text-gray-500" />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        <tr key={item.id} className="border-t border-gray-100">
                                                            <td className="p-2 font-medium">{item.itemName}</td>
                                                            <td className="text-center p-2">{parseFloat(item.quantity)}</td>
                                                            <td className="text-center p-2 text-gray-500">{item.unit}</td>
                                                            <td className="text-right p-2 font-mono">{formatCurrency(parseFloat(item.unitPrice), expenseDetail?.currency || "USD")}</td>
                                                            <td className="text-right p-2 font-mono font-semibold">{formatCurrency(parseFloat(item.totalPrice), expenseDetail?.currency || "USD")}</td>
                                                            {expenseDetail.status === "pending" && (
                                                                <td className="text-center p-2">
                                                                    <button className="p-1 rounded hover:bg-amber-100" title="Editar item"
                                                                        onClick={() => {
                                                                            setEditingExpItemId(item.id);
                                                                            setEditExpItemData({
                                                                                itemName: item.itemName || "",
                                                                                quantity: item.quantity || "",
                                                                                unit: item.unit || "",
                                                                                unitPrice: item.unitPrice || "",
                                                                                totalPrice: item.totalPrice || "",
                                                                            });
                                                                        }}>
                                                                        <Pencil className="h-3.5 w-3.5 text-amber-600" />
                                                                    </button>
                                                                </td>
                                                            )}
                                                        </tr>
                                                    )
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {expenseDetail.hasImage && (
                                <div>
                                    <h4 className="font-semibold text-emerald-800 mb-2">Imagem do Recibo</h4>
                                    <img
                                        src={`/api/farm/expenses/${selectedExpense}/image`}
                                        alt="Recibo"
                                        className="rounded-lg border border-gray-200 max-w-full"
                                    />
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                        </div>
                    )}
                </DialogContent>
            </Dialog>
            {/* Modal de Busca de Fornecedor */}
            <Dialog open={supplierSearchOpen} onOpenChange={setSupplierSearchOpen}>
                <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Search className="h-5 w-5 text-emerald-600" /> Buscar Fornecedor
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 flex-1 flex flex-col min-h-0">
                        <Input
                            placeholder="Digite o nome, RUC ou telefone..."
                            value={supplierSearchTerm}
                            onChange={e => setSupplierSearchTerm(e.target.value)}
                            autoFocus
                        />
                        <div className="flex-1 overflow-y-auto min-h-0 max-h-[400px] space-y-1">
                            {(() => {
                                const term = supplierSearchTerm.toLowerCase().trim();
                                const filtered = (suppliers as any[]).filter((s: any) => {
                                    if (!term) return true;
                                    return (s.name?.toLowerCase().includes(term)) ||
                                        (s.ruc?.toLowerCase().includes(term)) ||
                                        (s.phone?.toLowerCase().includes(term));
                                });
                                if (filtered.length === 0) {
                                    return (
                                        <div className="text-center py-8 text-gray-500">
                                            <p className="text-sm">Nenhum fornecedor encontrado</p>
                                            <a href="/fazenda/fornecedores" className="text-xs text-emerald-600 hover:underline mt-2 inline-block">
                                                + Cadastrar novo fornecedor
                                            </a>
                                        </div>
                                    );
                                }
                                return filtered.map((s: any) => (
                                    <button
                                        key={s.id}
                                        type="button"
                                        onClick={() => {
                                            setExpSupplier(s.name);
                                            setSupplierSearchOpen(false);
                                        }}
                                        className={`w-full text-left p-3 rounded-lg border transition-colors cursor-pointer hover:bg-emerald-50 hover:border-emerald-300 ${expSupplier === s.name ? "bg-emerald-50 border-emerald-400" : "border-gray-200 bg-white"}`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <span className="font-medium text-sm text-gray-900">{s.name}</span>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    {s.ruc && <span className="text-xs text-gray-500">RUC: {s.ruc}</span>}
                                                    {s.phone && <span className="text-xs text-gray-500">{s.phone}</span>}
                                                </div>
                                            </div>
                                            <div className="flex gap-1">
                                                {s.person_type && (
                                                    <span className={`text-xs px-1.5 py-0.5 rounded ${s.person_type === "provedor" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>
                                                        {s.person_type === "provedor" ? "Provedor" : "Cliente"}
                                                    </span>
                                                )}
                                                {s.entity_type && (
                                                    <span className={`text-xs px-1.5 py-0.5 rounded ${s.entity_type === "fisica" ? "bg-purple-100 text-purple-700" : "bg-amber-100 text-amber-700"}`}>
                                                        {s.entity_type === "fisica" ? "P.F." : "P.J."}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                ));
                            })()}
                        </div>
                        <div className="border-t pt-2">
                            <a href="/fazenda/fornecedores" className="flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-700 font-medium">
                                <Plus className="h-4 w-4" /> Cadastrar novo fornecedor
                            </a>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </FarmLayout>
    );
}
