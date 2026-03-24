import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import FarmLayout from "@/components/fazenda/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, Check, AlertTriangle, Loader2, Eye, Package, Trash2, Sprout, Info, Download, Wallet, Pencil, Save, X, ReceiptText, Search, Warehouse, Plus, DollarSign, Wheat, RefreshCw } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function FarmInvoices() {
    const [, setLocation] = useLocation();
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);
    const [selectedExpense, setSelectedExpense] = useState<string | null>(null);
    const [approveExpenseId, setApproveExpenseId] = useState<string | null>(null);
    const [approveAccountId, setApproveAccountId] = useState<string>("");
    const [approvePayStatus, setApprovePayStatus] = useState<string>("pago");
    const [approvePayType, setApprovePayType] = useState<string>("a_vista");
    const [approveDueDate, setApproveDueDate] = useState<string>("");
    const [approveInstallments, setApproveInstallments] = useState<string>("1");
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
    const [isRemission, setIsRemission] = useState(false);
    const [remissionMatch, setRemissionMatch] = useState<any>(null);
    const [matchedRemissionId, setMatchedRemissionId] = useState<string | null>(null);
    const [filterSupplier, setFilterSupplier] = useState("");
    const [filterNumber, setFilterNumber] = useState("");
    const [filterDate, setFilterDate] = useState("");
    const [confirmSkipStock, setConfirmSkipStock] = useState(false);
    const [confirmWarehouseId, setConfirmWarehouseId] = useState<string>("");
    const [confirmSeasonId, setConfirmSeasonId] = useState<string>("");
    const [confirmFrotaAmount, setConfirmFrotaAmount] = useState<string>("");

    // Nova Despesa dialog state
    const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
    const [expCategory, setExpCategory] = useState("");
    const [expDescription, setExpDescription] = useState("");
    const [expAmount, setExpAmount] = useState("");
    const [expSupplier, setExpSupplier] = useState("");
    const [expDate, setExpDate] = useState(new Date().toISOString().substring(0, 10));
    const [expPaymentType, setExpPaymentType] = useState("a_vista");
    const [expAccountId, setExpAccountId] = useState("");
    const [expHasFatura, setExpHasFatura] = useState(false);
    const [expInvoiceId, setExpInvoiceId] = useState("");
    const [expDueDate, setExpDueDate] = useState("");
    const [expInstallments, setExpInstallments] = useState("1");
    const [expPropertyId, setExpPropertyId] = useState("");
    const [expSeasonId, setExpSeasonId] = useState("");
    const [supplierSearchOpen, setSupplierSearchOpen] = useState(false);
    const [supplierSearchTerm, setSupplierSearchTerm] = useState("");

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

    const whatsappExpenses = (expenses as any[]).filter((e) =>
        e.equipmentId &&
        (e.description?.startsWith("[Via WhatsApp]") ?? false)
    );
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
        mutationFn: ({ id, skipStockEntry, warehouseId, seasonId, frotaAmount }: { id: string; skipStockEntry?: boolean; warehouseId?: string; seasonId?: string; frotaAmount?: string }) =>
            apiRequest("POST", `/api/farm/invoices/${id}/confirm`, {
                ...(skipStockEntry ? { skipStockEntry: true } : {}),
                ...(warehouseId ? { warehouseId } : {}),
                ...(seasonId ? { seasonId } : {}),
                ...(frotaAmount && parseFloat(frotaAmount) > 0 ? { frotaAmount } : {}),
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/invoices"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/stock"] });
            toast({ title: confirmSkipStock ? "Fatura confirmada (somente valor, sem estoque)." : "Confirmado! Estoque atualizado." });
            setSelectedInvoice(null);
            setConfirmSkipStock(false);
            setConfirmWarehouseId("");
            setConfirmSeasonId("");
        },
        onError: (err: any) => toast({ title: `Erro ao confirmar: ${err?.message || "Falha desconhecida"}`, variant: "destructive" }),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => apiRequest("DELETE", `/api/farm/invoices/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/invoices"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/invoices", "remision"] });
            toast({ title: "Excluido com sucesso." });
            setSelectedInvoice(null);
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

    const { data: cashAccounts = [] } = useQuery({
        queryKey: ["/api/farm/cash-accounts"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/cash-accounts"); return r.json(); },
        enabled: !!user,
    });

    const confirmExpenseMutation = useMutation({
        mutationFn: ({ id, accountId }: { id: string; accountId?: string }) =>
            apiRequest("POST", `/api/farm/expenses/${id}/confirm`, {
                accountId, paymentMethod: "efetivo",
                paymentStatus: approvePayStatus,
                paymentType: approvePayType,
                dueDate: approveDueDate || undefined,
                installments: approveInstallments || "1",
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/expenses"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/cash-summary"] });
            toast({ title: "✅ Recibo aprovado e lançado no caixa!" });
            setApproveExpenseId(null);
            setApproveAccountId("");
        },
        onError: () => toast({ title: "Erro ao aprovar recibo", variant: "destructive" }),
    });

    const deleteExpenseMutation = useMutation({
        mutationFn: (id: string) => apiRequest("DELETE", `/api/farm/expenses/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/expenses"] });
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

    const createExpenseMutation = useMutation({
        mutationFn: (data: any) => apiRequest("POST", "/api/farm/expenses", data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/expenses"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/accounts-payable"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/cash-summary"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/cash-transactions"] });
            toast({ title: "Despesa lancada com sucesso!" });
            setExpenseDialogOpen(false);
            setExpCategory(""); setExpDescription(""); setExpAmount(""); setExpSupplier("");
            setExpDate(new Date().toISOString().substring(0, 10)); setExpPaymentType("a_vista");
            setExpAccountId(""); setExpHasFatura(false); setExpInvoiceId("");
            setExpDueDate(""); setExpInstallments("1"); setExpPropertyId(""); setExpSeasonId("");
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
            supplier: expSupplier,
            expenseDate: expDate,
            paymentType: expPaymentType,
            accountId: expPaymentType === "a_vista" && expAccountId ? expAccountId : null,
            invoiceId: expHasFatura && expInvoiceId ? expInvoiceId : null,
            dueDate: expPaymentType === "a_prazo" ? expDueDate : null,
            installments: expPaymentType === "a_prazo" ? parseInt(expInstallments) : 1,
            propertyId: expPropertyId || null,
            seasonId: expSeasonId || null,
        });
    }

    // When invoice selected in expense form, auto-fill amount
    function handleExpInvoiceSelect(invId: string) {
        setExpInvoiceId(invId);
        const inv = (invoices as any[]).find((i: any) => String(i.id) === invId);
        if (inv) {
            setExpAmount(String(inv.totalAmount || ""));
            if (inv.supplier) setExpSupplier(inv.supplier);
        }
    }

    // Expenses without invoice for the new tab
    const expensesWithoutInvoice = (expenses as any[]).filter((e: any) => !e.invoiceId && !e.equipmentId);

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

            // If remission mode, post to remissions endpoint
            if (isRemission) {
                formData.append("isRemission", "true");
                const res = await fetch("/api/farm/remissions/import", {
                    method: "POST",
                    body: formData,
                    credentials: "include",
                });
                const data = await res.json();
                if (!res.ok) throw new Error("Upload failed");
                queryClient.invalidateQueries({ queryKey: ["/api/farm/remissions"] });
                setImportDialogOpen(false);
                setIsRemission(false);
                toast({ title: `Remissao importada com sucesso` });

                // Auto-register supplier from remission
                if (data.ruc && data.supplier) {
                    await autoRegisterSupplier(data.supplier, data.ruc);
                }
                return;
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
            setSelectedInvoice(data.invoice.id);
            setImportDialogOpen(false);

            // Show import success + remission match notification
            if (data.matchingRemissions && data.matchingRemissions.length > 0) {
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
            <div className="space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-emerald-800">Importação de Faturas</h1>
                        <p className="text-emerald-600 text-sm">Importe faturas PDF para registrar entrada no estoque</p>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            className="bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => setImportDialogOpen(true)}
                        >
                            <Upload className="mr-2 h-4 w-4" />
                            Importar PDF
                        </Button>
                        <Button
                            variant="outline"
                            className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                            onClick={() => setExpenseDialogOpen(true)}
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Nova Despesa
                        </Button>
                    </div>
                </div>

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
                            {/* Linha 1: Checkbox fatura + selecao fatura */}
                            <div className="flex items-center gap-4">
                                <div
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer transition-all flex-shrink-0 ${expHasFatura ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-white hover:border-gray-300"}`}
                                    onClick={() => { setExpHasFatura(!expHasFatura); if (expHasFatura) setExpInvoiceId(""); }}
                                >
                                    <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors ${expHasFatura ? "bg-blue-500 text-white" : "border-2 border-gray-300"}`}>
                                        {expHasFatura && <Check className="h-3 w-3" />}
                                    </div>
                                    <span className={`text-sm font-medium ${expHasFatura ? "text-blue-800" : "text-gray-700"}`}>Despesa com fatura</span>
                                </div>
                                {expHasFatura && (
                                    <div className="flex-1">
                                        <Select value={expInvoiceId} onValueChange={handleExpInvoiceSelect}>
                                            <SelectTrigger><SelectValue placeholder="Escolha uma fatura..." /></SelectTrigger>
                                            <SelectContent>
                                                {(invoices as any[]).filter((i: any) => i.status === "pending" || i.status === "pendente").map((inv: any) => (
                                                    <SelectItem key={inv.id} value={String(inv.id)}>
                                                        #{inv.invoiceNumber || "S/N"} - {inv.supplier || "?"} - ${parseFloat(inv.totalAmount || "0").toFixed(2)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </div>

                            {/* Linha 2: Categoria + Fornecedor + Descricao */}
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

                            {/* Linha 3: Valor + Data + Pagamento + Propriedade + Safra */}
                            <div className="grid grid-cols-5 gap-3">
                                <div>
                                    <Label className="text-xs text-gray-500">Valor *</Label>
                                    <CurrencyInput value={expAmount} onValueChange={setExpAmount} />
                                </div>
                                <div>
                                    <Label className="text-xs text-gray-500">Data</Label>
                                    <Input type="date" value={expDate} onChange={e => setExpDate(e.target.value)} />
                                </div>
                                <div>
                                    <Label className="text-xs text-gray-500">Pagamento</Label>
                                    <Select value={expPaymentType} onValueChange={setExpPaymentType}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="a_vista">A Vista</SelectItem>
                                            <SelectItem value="a_prazo">A Prazo</SelectItem>
                                        </SelectContent>
                                    </Select>
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

                            {/* Linha condicional: A Vista conta ou A Prazo parcelas */}
                            {expPaymentType === "a_vista" && (cashAccounts as any[]).length > 0 && (
                                <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                                    <Wallet className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                                    <div className="flex-1 grid grid-cols-2 gap-3 items-center">
                                        <Select value={expAccountId} onValueChange={setExpAccountId}>
                                            <SelectTrigger><SelectValue placeholder="Selecione a conta para debito..." /></SelectTrigger>
                                            <SelectContent>
                                                {(cashAccounts as any[]).map((acc: any) => (
                                                    <SelectItem key={acc.id} value={String(acc.id)}>
                                                        {acc.name} {acc.bankName ? `(${acc.bankName})` : ""} - {acc.currency || "USD"}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <p className="text-xs text-emerald-600">Debito automatico no fluxo de caixa</p>
                                    </div>
                                </div>
                            )}

                            {expPaymentType === "a_prazo" && (
                                <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                                    <div className="grid grid-cols-2 gap-3 flex-1">
                                        <div>
                                            <Label className="text-xs text-amber-700">N Parcelas</Label>
                                            <Input type="number" min="1" max="60" value={expInstallments} onChange={e => setExpInstallments(e.target.value)} />
                                        </div>
                                        <div>
                                            <Label className="text-xs text-amber-700">1o Vencimento</Label>
                                            <Input type="date" value={expDueDate} onChange={e => setExpDueDate(e.target.value)} />
                                        </div>
                                    </div>
                                </div>
                            )}
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
                    <TabsList className="bg-emerald-50 border border-emerald-200 p-1 h-10">
                        <TabsTrigger value="invoices" className="text-[13px] font-semibold data-[state=active]:bg-emerald-600 data-[state=active]:text-white px-4">Faturas</TabsTrigger>
                        <TabsTrigger value="remissions" className="text-[13px] font-semibold data-[state=active]:bg-emerald-600 data-[state=active]:text-white px-4">Remissoes</TabsTrigger>
                        <TabsTrigger value="receipts" className="text-[13px] font-semibold data-[state=active]:bg-emerald-600 data-[state=active]:text-white px-4">Recibos de Frota</TabsTrigger>
                        <TabsTrigger value="expenses-nofatura" className="text-[13px] font-semibold data-[state=active]:bg-emerald-600 data-[state=active]:text-white px-4">Despesas s/ Fatura</TabsTrigger>
                    </TabsList>

                    <TabsContent value="invoices">
                        {/* Selected invoice detail */}
                        {selectedInvoice && invoiceDetail && (
                            <Card className="border-emerald-200 bg-white mb-4">
                                <CardHeader className="pb-3">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-emerald-800 flex items-center gap-2">
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
                                        </CardTitle>
                                        <div className="flex items-center gap-2">
                                            {!editingInvoice && (
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
                                            <Button variant="ghost" size="sm" onClick={() => { setSelectedInvoice(null); setEditingInvoice(false); }}>Fechar</Button>
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
                                </CardHeader>
                                <CardContent>
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
                                                                <td className="p-2 text-center">
                                                                    <div className="flex items-center justify-center gap-1">
                                                                        <button className="p-1 rounded hover:bg-emerald-200" title="Salvar"
                                                                            onClick={() => updateInvoiceItemMutation.mutate({
                                                                                invoiceId: selectedInvoice!, itemId: item.id, data: editItemData
                                                                            })}>
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
                                                                <td className="text-right p-2 font-mono">{parseFloat(item.quantity).toFixed(2)}</td>
                                                                <td className="text-right p-2 font-mono">${parseFloat(item.unitPrice).toFixed(2)}</td>
                                                                <td className="text-right p-2 font-mono font-semibold">${parseFloat(item.totalPrice).toFixed(2)}</td>
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

                                            {/* Item #13: Deposito destino */}
                                            {!confirmSkipStock && (
                                                <div className="p-3 rounded-lg border border-gray-200 bg-white">
                                                    <Label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                                        <Warehouse className="h-4 w-4 text-emerald-500" />
                                                        Deposito destino dos produtos
                                                    </Label>
                                                    <Select value={confirmWarehouseId} onValueChange={setConfirmWarehouseId}>
                                                        <SelectTrigger className="mt-1">
                                                            <SelectValue placeholder="Selecione o deposito..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {(properties as any[]).map((p: any) => (
                                                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            )}

                                            {/* Safra selector */}
                                            <div className="p-3 rounded-lg border border-gray-200 bg-white">
                                                <Label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                                    <Wheat className="h-4 w-4 text-emerald-500" />
                                                    Safra
                                                </Label>
                                                <Select value={confirmSeasonId || (invoiceDetail.seasonId || "")} onValueChange={setConfirmSeasonId}>
                                                    <SelectTrigger className="mt-1">
                                                        <SelectValue placeholder="Selecione a safra..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {(seasons as any[]).map((s: any) => (
                                                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            {/* Despesa de Frota */}
                                            <div className="p-3 rounded-lg border border-gray-200 bg-white">
                                                <Label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                                    Despesa de Frota (opcional)
                                                </Label>
                                                <CurrencyInput
                                                    value={confirmFrotaAmount}
                                                    onValueChange={setConfirmFrotaAmount}
                                                    className="mt-1"
                                                    placeholder="0,00"
                                                />
                                                <p className="text-xs text-gray-400 mt-1">Frete e transporte relacionado a esta fatura</p>
                                            </div>

                                            <div className="flex justify-end">
                                                <Button
                                                    className="bg-emerald-600 hover:bg-emerald-700"
                                                    onClick={() => confirmMutation.mutate({
                                                        id: selectedInvoice!,
                                                        skipStockEntry: confirmSkipStock || undefined,
                                                        warehouseId: !confirmSkipStock && confirmWarehouseId ? confirmWarehouseId : undefined,
                                                        seasonId: confirmSeasonId || invoiceDetail.seasonId || undefined,
                                                        frotaAmount: confirmFrotaAmount || undefined,
                                                    })}
                                                    disabled={confirmMutation.isPending}
                                                >
                                                    {confirmMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                                                    {confirmSkipStock ? "Confirmar (somente valor)" : "Confirmar Entrada"}
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {/* Invoices list */}
                        <Card className="border-emerald-100">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-emerald-800">Faturas Importadas</CardTitle>
                                    <Button variant="outline" size="sm" className="border-emerald-200 text-emerald-700" onClick={() => queryClient.invalidateQueries()}>
                                        <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
                                    </Button>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                                    <div className="relative">
                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                        <Input
                                            placeholder="Buscar fornecedor..."
                                            className="pl-8 h-9 text-sm"
                                            value={filterSupplier}
                                            onChange={(e) => setFilterSupplier(e.target.value)}
                                        />
                                    </div>
                                    <div className="relative">
                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                        <Input
                                            placeholder="Buscar nro. fatura..."
                                            className="pl-8 h-9 text-sm"
                                            value={filterNumber}
                                            onChange={(e) => setFilterNumber(e.target.value)}
                                        />
                                    </div>
                                    <Input
                                        type="date"
                                        className="h-9 text-sm"
                                        value={filterDate}
                                        onChange={(e) => setFilterDate(e.target.value)}
                                    />
                                </div>
                            </CardHeader>
                            <CardContent>
                                {isLoading ? (
                                    <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-emerald-600" /></div>
                                ) : invoices.length === 0 ? (
                                    <div className="py-8 text-center">
                                        <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                                        <p className="text-gray-500">Nenhuma fatura importada</p>
                                    </div>
                                ) : (() => {
                                    const filteredInvoices = (invoices as any[]).filter((inv: any) => {
                                        if (filterSupplier && !(inv.supplier || "").toLowerCase().includes(filterSupplier.toLowerCase())) return false;
                                        if (filterNumber && !(inv.invoiceNumber || "").toLowerCase().includes(filterNumber.toLowerCase())) return false;
                                        if (filterDate && inv.issueDate) {
                                            const invDate = new Date(inv.issueDate).toISOString().split("T")[0];
                                            if (invDate !== filterDate) return false;
                                        } else if (filterDate && !inv.issueDate) {
                                            return false;
                                        }
                                        return true;
                                    });
                                    return filteredInvoices.length === 0 ? (
                                        <div className="py-8 text-center">
                                            <Search className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                                            <p className="text-gray-500">Nenhuma fatura encontrada com os filtros aplicados</p>
                                        </div>
                                    ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm min-w-[800px]">
                                            <thead className="bg-emerald-50">
                                                <tr>
                                                    <th className="text-left p-2.5 font-semibold text-emerald-800 whitespace-nowrap">Nro. Fatura</th>
                                                    <th className="text-left p-2.5 font-semibold text-emerald-800 whitespace-nowrap">Safra</th>
                                                    <th className="text-left p-2.5 font-semibold text-emerald-800 whitespace-nowrap">Fornecedor</th>
                                                    <th className="text-center p-2.5 font-semibold text-emerald-800 whitespace-nowrap">Emissao</th>
                                                    <th className="text-center p-2.5 font-semibold text-emerald-800 whitespace-nowrap">Vencimento</th>
                                                    <th className="text-center p-2.5 font-semibold text-emerald-800 whitespace-nowrap">Status</th>
                                                    <th className="text-center p-2.5 font-semibold text-emerald-800 whitespace-nowrap">Origem</th>
                                                    <th className="text-center p-2.5 font-semibold text-emerald-800 whitespace-nowrap">Entrada</th>
                                                    <th className="text-right p-2.5 font-semibold text-emerald-800 whitespace-nowrap">Valor</th>
                                                    <th className="p-2.5"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredInvoices.map((inv: any) => {
                                                    const season = inv.seasonId ? (seasons as any[]).find((s: any) => s.id === inv.seasonId) : null;
                                                    return (
                                                    <tr
                                                        key={inv.id}
                                                        className={`border-t cursor-pointer transition-colors ${
                                                            selectedInvoice === inv.id ? "bg-emerald-50 border-emerald-200" : "border-gray-100 hover:bg-gray-50"
                                                        }`}
                                                        onClick={() => setSelectedInvoice(inv.id)}
                                                    >
                                                        <td className="p-2.5 font-medium whitespace-nowrap">
                                                            <div className="flex items-center gap-1.5">
                                                                <FileText className={`h-3.5 w-3.5 shrink-0 ${inv.status === "confirmed" ? "text-green-500" : "text-orange-500"}`} />
                                                                #{inv.invoiceNumber || "—"}
                                                            </div>
                                                        </td>
                                                        <td className="p-2.5 whitespace-nowrap">
                                                            {season ? (
                                                                <Badge variant="outline" className="text-[10px] px-2 py-0 h-5 border-emerald-400 text-emerald-700 bg-emerald-50">
                                                                    {season.name}
                                                                </Badge>
                                                            ) : <span className="text-gray-400 text-xs">--</span>}
                                                        </td>
                                                        <td className="p-2.5 whitespace-nowrap truncate max-w-[180px]">{inv.supplier || "—"}</td>
                                                        <td className="p-2.5 text-center whitespace-nowrap text-xs">{inv.issueDate ? new Date(inv.issueDate).toLocaleDateString("pt-BR") : "—"}</td>
                                                        <td className="p-2.5 text-center whitespace-nowrap text-xs">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("pt-BR") : "—"}</td>
                                                        <td className="p-2.5 text-center">
                                                            <Badge variant={inv.status === "confirmed" ? "default" : "secondary"} className="text-[10px] px-2 py-0 h-5">
                                                                {inv.status === "confirmed" ? "Confirmada" : "Pendente"}
                                                            </Badge>
                                                            {inv.linkedRemisionId && (
                                                                <Badge className="ml-1 bg-blue-100 text-blue-700 text-[9px] px-1.5 py-0 h-4">Conciliada</Badge>
                                                            )}
                                                        </td>
                                                        <td className="p-2.5 text-center">
                                                            <Badge variant="outline" className={`text-[10px] px-2 py-0 h-5 ${
                                                                inv.source === "whatsapp" ? "border-green-400 text-green-700 bg-green-50" :
                                                                inv.source === "email_import" ? "border-blue-400 text-blue-700 bg-blue-50" :
                                                                "border-gray-300 text-gray-600 bg-gray-50"
                                                            }`}>
                                                                {inv.source === "whatsapp" ? "WhatsApp" :
                                                                 inv.source === "email_import" ? "Email" : "Import"}
                                                            </Badge>
                                                        </td>
                                                        <td className="p-2.5 text-center whitespace-nowrap text-xs text-gray-500">
                                                            {inv.createdAt ? new Date(inv.createdAt).toLocaleDateString("pt-BR") + " " + new Date(inv.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}
                                                        </td>
                                                        <td className="p-2.5 text-right font-mono font-semibold whitespace-nowrap">
                                                            ${parseFloat(inv.totalAmount || "0").toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                                        </td>
                                                        <td className="p-2.5">
                                                            <div className="flex items-center gap-1">
                                                                {inv.hasFile && (
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); window.open(`/api/farm/invoices/${inv.id}/file`, '_blank'); }}
                                                                        className="p-1 rounded hover:bg-blue-100 transition-colors"
                                                                        title="Ver arquivo original"
                                                                    >
                                                                        <Eye className="h-3.5 w-3.5 text-blue-400 hover:text-blue-600" />
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); if (confirm("Excluir esta fatura?")) deleteMutation.mutate(inv.id); }}
                                                                    className="p-1 rounded hover:bg-red-100 transition-colors"
                                                                    title="Excluir fatura"
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5 text-red-400 hover:text-red-600" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                );
                                })()}
                            </CardContent>
                        </Card>
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
                                            <Button variant="ghost" size="sm" onClick={() => setSelectedInvoice(null)}>Fechar</Button>
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
                                                    - Valor: ${parseFloat(invoiceDetail.linkedInvoice.totalAmount || 0).toFixed(2)}
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

                                    <table className="w-full text-sm">
                                        <thead className="bg-purple-50">
                                            <tr>
                                                <th className="text-left p-2 font-semibold text-purple-800">Cod</th>
                                                <th className="text-left p-2 font-semibold text-purple-800">Produto (Remissao)</th>
                                                <th className="text-left p-2 font-semibold text-purple-800">Un</th>
                                                <th className="text-right p-2 font-semibold text-purple-800">Qtd</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(invoiceDetail.items || []).map((item: any, idx: number) => (
                                                <tr key={item.id || idx} className="border-t border-gray-100">
                                                    <td className="p-2 text-gray-400">{item.productCode || "--"}</td>
                                                    <td className="p-2 font-medium">{item.productName}</td>
                                                    <td className="p-2 text-gray-600">{item.unit}</td>
                                                    <td className="p-2 text-right">{parseFloat(item.quantity || 0).toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>

                                    {invoiceDetail.status === "pending" && (
                                        <div className="mt-4 flex gap-2">
                                            <Button
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                                onClick={() => {
                                                    confirmMutation.mutate({ id: selectedInvoice! });
                                                }}
                                                disabled={confirmMutation.isPending}
                                            >
                                                {confirmMutation.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                                                Aprovar Remissao (entrada no estoque)
                                            </Button>
                                            <Button variant="outline" className="text-red-600 border-red-300" onClick={() => {
                                                deleteMutation.mutate(selectedInvoice!);
                                            }}>
                                                Excluir
                                            </Button>
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
                                                                ${parseFloat(e.amount).toFixed(2)}
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
                                                                    ${parseFloat(e.amount).toFixed(2)}
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
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-emerald-800 flex items-center gap-2">
                                        <DollarSign className="h-5 w-5" /> Despesas sem Fatura
                                    </CardTitle>
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
                                                    <th className="text-left p-3 font-semibold text-emerald-800">Data</th>
                                                    <th className="text-left p-3 font-semibold text-emerald-800">Fornecedor</th>
                                                    <th className="text-left p-3 font-semibold text-emerald-800">Categoria</th>
                                                    <th className="text-left p-3 font-semibold text-emerald-800">Pagamento</th>
                                                    <th className="text-left p-3 font-semibold text-emerald-800">Vencimento</th>
                                                    <th className="text-left p-3 font-semibold text-emerald-800">Parcelas</th>
                                                    <th className="text-left p-3 font-semibold text-emerald-800">Status</th>
                                                    <th className="text-right p-3 font-semibold text-emerald-800">Valor</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {expensesWithoutInvoice.map((exp: any) => (
                                                    <tr key={exp.id} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                                                        <td className="p-3 text-gray-700">{new Date(exp.expenseDate || exp.createdAt).toLocaleDateString("pt-BR")}</td>
                                                        <td className="p-3 font-medium">{exp.supplier || "--"}</td>
                                                        <td className="p-3"><Badge variant="outline" className="text-xs">{exp.category}</Badge></td>
                                                        <td className="p-3">
                                                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${exp.paymentType === "a_prazo" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                                                                {exp.paymentType === "a_prazo" ? "A Prazo" : "A Vista"}
                                                            </span>
                                                        </td>
                                                        <td className="p-3 text-gray-600">{exp.paymentType === "a_prazo" && exp.dueDate ? new Date(exp.dueDate).toLocaleDateString("pt-BR") : "--"}</td>
                                                        <td className="p-3 text-gray-600">{exp.paymentType === "a_prazo" ? `${exp.installmentsPaid || 0}/${exp.installments || 1}` : "--"}</td>
                                                        <td className="p-3">
                                                            <Badge variant={exp.status === "confirmed" ? "default" : "secondary"} className="text-xs">
                                                                {exp.status === "confirmed" ? "Confirmada" : "Pendente"}
                                                            </Badge>
                                                        </td>
                                                        <td className="text-right p-3 font-mono font-bold text-emerald-700">$ {parseFloat(exp.amount || "0").toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>

            <Dialog open={!!approveExpenseId} onOpenChange={(open) => { if (!open) { setApproveExpenseId(null); setApproveAccountId(""); setApprovePayStatus("pago"); setApprovePayType("a_vista"); setApproveDueDate(""); setApproveInstallments("1"); } }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Wallet className="h-5 w-5 text-emerald-600" />
                            Aprovar Despesa
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div>
                            <Label>Status do Pagamento</Label>
                            <Select value={approvePayStatus} onValueChange={setApprovePayStatus}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="pago">Já foi pago</SelectItem>
                                    <SelectItem value="pendente">Ainda não pagou</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Tipo de Pagamento</Label>
                            <Select value={approvePayType} onValueChange={setApprovePayType}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="a_vista">À Vista</SelectItem>
                                    <SelectItem value="a_prazo">A Prazo (Fiado)</SelectItem>
                                    <SelectItem value="financiado">Financiado / Parcelado</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {(approvePayType === "a_prazo" || approvePayType === "financiado") && (
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label>Vencimento</Label>
                                    <Input type="date" value={approveDueDate} onChange={e => setApproveDueDate(e.target.value)} />
                                </div>
                                {approvePayType === "financiado" && (
                                    <div>
                                        <Label>Parcelas</Label>
                                        <Input type="number" min="1" value={approveInstallments} onChange={e => setApproveInstallments(e.target.value)} />
                                    </div>
                                )}
                            </div>
                        )}
                        {approvePayStatus === "pago" && (
                            <div>
                                <Label>Conta de Pagamento</Label>
                                <Select value={approveAccountId} onValueChange={setApproveAccountId}>
                                    <SelectTrigger><SelectValue placeholder="Selecione a conta..." /></SelectTrigger>
                                    <SelectContent>
                                        {(cashAccounts as any[]).map((a: any) => (
                                            <SelectItem key={a.id} value={a.id}>
                                                {a.name} ({a.currency})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        <div className="flex gap-2">
                            <Button
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                                disabled={confirmExpenseMutation.isPending || (approvePayStatus === "pago" && !approveAccountId)}
                                onClick={() => approveExpenseId && confirmExpenseMutation.mutate({
                                    id: approveExpenseId,
                                    accountId: approvePayStatus === "pago" ? approveAccountId : undefined,
                                })}
                            >
                                {confirmExpenseMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                                {approvePayStatus === "pago" ? "Aprovar e Lançar" : "Aprovar (Pendente)"}
                            </Button>
                        </div>
                    </div>
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
                                        <p className="font-semibold text-lg">${parseFloat(expenseDetail.amount).toFixed(2)}</p>
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
                                                            <td className="text-right p-2 font-mono">${parseFloat(item.unitPrice).toFixed(2)}</td>
                                                            <td className="text-right p-2 font-mono font-semibold">${parseFloat(item.totalPrice).toFixed(2)}</td>
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
