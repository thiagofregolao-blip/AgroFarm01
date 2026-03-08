import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import EmpresaLayout from "@/components/empresa/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Upload, Search, Eye, RefreshCw, Loader2, CheckCircle2, AlertCircle, Link } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const api = (method: string, path: string, body?: any) =>
    fetch(path, { method, headers: body ? { "Content-Type": "application/json" } : {}, credentials: "include", body: body ? JSON.stringify(body) : undefined }).then(r => r.json());

const RECON_LABEL: Record<string, { label: string; color: string; icon: any }> = {
    unmatched: { label: "Não Reconciliada", color: "bg-orange-100 text-orange-800", icon: AlertCircle },
    partial: { label: "Parcial", color: "bg-yellow-100 text-yellow-800", icon: RefreshCw },
    matched: { label: "Reconciliada", color: "bg-green-100 text-green-800", icon: CheckCircle2 },
};

export default function EmpresaFaturas() {
    const { user } = useAuth();
    const { toast } = useToast();
    const qc = useQueryClient();
    const [search, setSearch] = useState("");
    const [detail, setDetail] = useState<any>(null);
    const pdfRef = useRef<HTMLInputElement>(null);

    const { data: invoices = [], isLoading } = useQuery<any[]>({
        queryKey: ["/api/company/invoices"],
        queryFn: () => api("GET", "/api/company/invoices"),
        enabled: !!user,
    });

    const uploadPdf = useMutation({
        mutationFn: async (file: File) => {
            const fd = new FormData(); fd.append("pdf", file);
            const r = await fetch("/api/company/invoices/upload-pdf", { method: "POST", credentials: "include", body: fd });
            return r.json();
        },
        onSuccess: (data) => {
            qc.invalidateQueries({ queryKey: ["/api/company/invoices"] });
            toast({ title: `Fatura importada — ${data.linkedOrders} pedido(s) reconciliado(s)` });
        },
        onError: () => toast({ title: "Erro ao importar PDF", variant: "destructive" }),
    });

    const reconcile = useMutation({
        mutationFn: (id: string) => api("POST", `/api/company/invoices/${id}/reconcile`),
        onSuccess: (data) => {
            qc.invalidateQueries({ queryKey: ["/api/company/invoices"] });
            toast({ title: `Reconciliados: ${data.linked} item(s)` });
        },
    });

    const downloadPdf = async (id: string) => {
        const r = await fetch(`/api/company/invoices/${id}/pdf`, { credentials: "include" });
        if (!r.ok) return;
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `fatura-${id}.pdf`; a.click();
    };

    const filtered = invoices.filter((i: any) => !search || (i.invoiceNumber ?? "").toLowerCase().includes(search.toLowerCase()) || (i.clientName ?? "").toLowerCase().includes(search.toLowerCase()));

    return (
        <EmpresaLayout>
            <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-slate-800">Faturas Recebidas</h1>
                    <div className="flex gap-2">
                        <input ref={pdfRef} type="file" accept="application/pdf" className="hidden"
                            onChange={e => { if (e.target.files?.[0]) uploadPdf.mutate(e.target.files[0]); }} />
                        <Button variant="outline" onClick={() => pdfRef.current?.click()} disabled={uploadPdf.isPending}>
                            {uploadPdf.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                            Importar PDF
                        </Button>
                    </div>
                </div>

                <div className="relative max-w-xs">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input placeholder="Buscar fatura ou cliente..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">Nenhuma fatura encontrada</div>
                ) : (
                    <div className="space-y-2">
                        {filtered.map((inv: any) => {
                            const rs = RECON_LABEL[inv.reconciliationStatus] ?? RECON_LABEL.unmatched;
                            const Icon = rs.icon;
                            return (
                                <Card key={inv.id}>
                                    <CardContent className="p-4">
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-semibold text-sm">{inv.invoiceNumber ?? "S/N"}</span>
                                                    <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${rs.color}`}>
                                                        <Icon className="h-3 w-3" />{rs.label}
                                                    </span>
                                                    <span className="text-xs text-slate-400 capitalize">{inv.source === "email_import" ? "Email" : "Manual"}</span>
                                                </div>
                                                <p className="text-slate-600 text-sm mt-0.5">{inv.clientName ?? "Cliente não vinculado"}</p>
                                                {inv.issueDate && <p className="text-slate-400 text-xs">Emissão: {new Date(inv.issueDate).toLocaleDateString("es-PY")}</p>}
                                            </div>
                                            <div className="text-right">
                                                <p className="font-semibold text-sm">
                                                    {inv.currency === "USD" ? "$ " : "₲ "}
                                                    {parseFloat(inv.totalAmountUsd ?? 0).toLocaleString("es-PY", { minimumFractionDigits: 2 })}
                                                </p>
                                                <p className="text-slate-400 text-xs">{new Date(inv.createdAt).toLocaleDateString("es-PY")}</p>
                                            </div>
                                            <div className="flex gap-1">
                                                <Button size="sm" variant="ghost" onClick={() => setDetail(inv)}>
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                                {inv.reconciliationStatus !== "matched" && (
                                                    <Button size="sm" variant="ghost" className="text-blue-600" title="Tentar reconciliar" onClick={() => reconcile.mutate(inv.id)}>
                                                        <Link className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>

            <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
                <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Fatura {detail?.invoiceNumber ?? "S/N"}</DialogTitle>
                    </DialogHeader>
                    {detail && <InvoiceDetail invoiceId={detail.id} onDownload={() => downloadPdf(detail.id)} />}
                </DialogContent>
            </Dialog>
        </EmpresaLayout>
    );
}

function InvoiceDetail({ invoiceId, onDownload }: { invoiceId: string; onDownload: () => void }) {
    const { data, isLoading } = useQuery<any>({
        queryKey: ["/api/company/invoices", invoiceId],
        queryFn: () => fetch(`/api/company/invoices/${invoiceId}`, { credentials: "include" }).then(r => r.json()),
    });

    if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;
    if (!data) return null;

    return (
        <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-2">
                <div><span className="text-slate-500">Reconciliação:</span><p className="font-medium capitalize">{data.reconciliationStatus}</p></div>
                <div><span className="text-slate-500">Origem:</span><p className="font-medium">{data.source === "email_import" ? "Email automático" : "Manual"}</p></div>
            </div>
            {data.items?.length > 0 && (
                <div>
                    <p className="font-medium mb-2">Itens</p>
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="text-slate-500 border-b">
                                <th className="text-left py-1">Produto</th>
                                <th className="text-right py-1">Qtd</th>
                                <th className="text-right py-1">Un.</th>
                                <th className="text-right py-1">Preço</th>
                                <th className="text-right py-1">Total</th>
                                <th className="text-right py-1">Recon.</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {data.items.map((i: any) => (
                                <tr key={i.id} className={i.isReconciled ? "bg-green-50" : ""}>
                                    <td className="py-1">{i.productName}</td>
                                    <td className="text-right">{parseFloat(i.quantity).toLocaleString("es-PY")}</td>
                                    <td className="text-right">{i.unit}</td>
                                    <td className="text-right">{parseFloat(i.unitPriceUsd ?? 0).toLocaleString("es-PY", { minimumFractionDigits: 2 })}</td>
                                    <td className="text-right font-medium">{parseFloat(i.totalPriceUsd ?? 0).toLocaleString("es-PY", { minimumFractionDigits: 2 })}</td>
                                    <td className="text-right">{i.isReconciled ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600 inline" /> : "—"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {data.links?.length > 0 && (
                <div>
                    <p className="font-medium mb-1 text-green-700">Pedidos Vinculados ({data.links.length})</p>
                </div>
            )}
            {data.pdfBase64 && (
                <Button variant="outline" size="sm" onClick={onDownload}>Baixar PDF</Button>
            )}
        </div>
    );
}
