import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import FarmLayout from "@/components/fazenda/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, Check, AlertTriangle, Loader2, Eye, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function FarmInvoices() {
    const [, setLocation] = useLocation();
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);

    const { user } = useAuth();

    const { data: invoices = [], isLoading } = useQuery({
        queryKey: ["/api/farm/invoices"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/invoices"); return r.json(); },
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

    const confirmMutation = useMutation({
        mutationFn: (id: string) => apiRequest("POST", `/api/farm/invoices/${id}/confirm`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/invoices"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/stock"] });
            toast({ title: "✅ Fatura confirmada! Estoque atualizado." });
            setSelectedInvoice(null);
        },
        onError: () => toast({ title: "Erro ao confirmar fatura", variant: "destructive" }),
    });

    const linkProductMutation = useMutation({
        mutationFn: ({ invoiceId, itemId, productId }: { invoiceId: string; itemId: string; productId: string }) =>
            apiRequest("PATCH", `/api/farm/invoices/${invoiceId}/items/${itemId}`, { productId }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/invoices", selectedInvoice] });
            toast({ title: "Produto vinculado" });
        },
    });

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);

        try {
            const formData = new FormData();
            formData.append("file", file);

            const res = await fetch("/api/farm/invoices/import", {
                method: "POST",
                body: formData,
                credentials: "include",
            });

            if (!res.ok) throw new Error("Upload failed");
            const data = await res.json();
            queryClient.invalidateQueries({ queryKey: ["/api/farm/invoices"] });
            setSelectedInvoice(data.invoice.id);
            toast({ title: `📄 ${data.message}` });
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
                    <div>
                        <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleUpload} className="hidden" />
                        <Button
                            className="bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                        >
                            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                            Importar PDF
                        </Button>
                    </div>
                </div>

                {/* Selected invoice detail */}
                {selectedInvoice && invoiceDetail && (
                    <Card className="border-emerald-200 bg-white">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-emerald-800">
                                    Fatura #{invoiceDetail.invoiceNumber || "—"}
                                    <Badge className="ml-2" variant={invoiceDetail.status === "confirmed" ? "default" : "secondary"}>
                                        {invoiceDetail.status === "confirmed" ? "Confirmada" : "Pendente"}
                                    </Badge>
                                </CardTitle>
                                <Button variant="ghost" size="sm" onClick={() => setSelectedInvoice(null)}>Fechar</Button>
                            </div>
                            <div className="flex gap-4 text-sm text-gray-600 mt-1">
                                <span>Fornecedor: <strong>{invoiceDetail.supplier || "—"}</strong></span>
                                <span>Data: <strong>{invoiceDetail.issueDate ? new Date(invoiceDetail.issueDate).toLocaleDateString("pt-BR") : "—"}</strong></span>
                                <span>Total: <strong>${invoiceDetail.totalAmount}</strong></span>
                            </div>
                        </CardHeader>
                        <CardContent>
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
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {invoiceDetail.items.map((item: any) => (
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
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <p className="text-gray-500 py-4 text-center">Nenhum item extraído</p>
                            )}

                            {invoiceDetail.status === "pending" && (
                                <div className="mt-4 flex items-center gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                                    <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                                    <p className="text-sm text-amber-800 flex-1">
                                        Revise os itens e vincule ao catálogo antes de confirmar. Itens sem vínculo <strong>não</strong> entrarão no estoque.
                                    </p>
                                    <Button
                                        className="bg-emerald-600 hover:bg-emerald-700 shrink-0"
                                        onClick={() => confirmMutation.mutate(selectedInvoice!)}
                                        disabled={confirmMutation.isPending}
                                    >
                                        {confirmMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                                        Confirmar Entrada
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Invoices list */}
                <Card className="border-emerald-100">
                    <CardHeader>
                        <CardTitle className="text-emerald-800">Faturas Importadas</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-emerald-600" /></div>
                        ) : invoices.length === 0 ? (
                            <div className="py-8 text-center">
                                <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                                <p className="text-gray-500">Nenhuma fatura importada</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {invoices.map((inv: any) => (
                                    <div
                                        key={inv.id}
                                        className={`flex items-center gap-4 p-3 rounded-lg border cursor-pointer transition-colors
                      ${selectedInvoice === inv.id ? "border-emerald-300 bg-emerald-50" : "border-gray-100 hover:bg-gray-50"}`}
                                        onClick={() => setSelectedInvoice(inv.id)}
                                    >
                                        <FileText className={`h-5 w-5 ${inv.status === "confirmed" ? "text-green-500" : "text-orange-500"}`} />
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-sm truncate">#{inv.invoiceNumber || "—"} — {inv.supplier || "Fornecedor desconhecido"}</p>
                                            <p className="text-xs text-gray-500">{inv.issueDate ? new Date(inv.issueDate).toLocaleDateString("pt-BR") : "Data desconhecida"}</p>
                                        </div>
                                        <Badge variant={inv.status === "confirmed" ? "default" : "secondary"}>
                                            {inv.status === "confirmed" ? "Confirmada" : "Pendente"}
                                        </Badge>
                                        <p className="font-semibold text-sm">${inv.totalAmount || "0"}</p>
                                        <Eye className="h-4 w-4 text-gray-400" />
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </FarmLayout>
    );
}
