import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import FarmLayout from "@/components/fazenda/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Scale, Loader2, Wheat, TrendingUp, Truck, Upload, Camera, Check, X, Clock, MessageSquare, FileImage } from "lucide-react";

export default function FarmRomaneios() {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [openDialog, setOpenDialog] = useState(false);
    const [importDialogOpen, setImportDialogOpen] = useState(false);
    const [importedData, setImportedData] = useState<any>(null);
    const [uploading, setUploading] = useState(false);
    const { user } = useAuth();

    const { data: romaneios = [], isLoading } = useQuery({
        queryKey: ["/api/farm/romaneios"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/romaneios"); return r.json(); },
        enabled: !!user,
    });

    const { data: plots = [] } = useQuery({
        queryKey: ["/api/farm/plots"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/plots"); return r.json(); },
        enabled: !!user,
    });

    const { data: properties = [] } = useQuery({
        queryKey: ["/api/farm/properties"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/properties"); return r.json(); },
        enabled: !!user,
    });

    const { data: seasons = [] } = useQuery({
        queryKey: ["/api/farm/seasons"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/seasons"); return r.json(); },
        enabled: !!user,
    });

    const { data: productivity = [] } = useQuery({
        queryKey: ["/api/farm/romaneios/productivity"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/romaneios/productivity"); return r.json(); },
        enabled: !!user,
    });

    // Separate confirmed vs pending romaneios
    const confirmedRomaneios = romaneios.filter((r: any) => r.status !== "pending");
    const pendingRomaneios = romaneios.filter((r: any) => r.status === "pending");

    const totalWeight = confirmedRomaneios.reduce((s: number, r: any) => s + parseFloat(r.finalWeight || 0), 0);
    const totalValue = confirmedRomaneios.reduce((s: number, r: any) => s + parseFloat(r.totalValue || 0), 0);

    const save = useMutation({
        mutationFn: async (data: any) => apiRequest("POST", "/api/farm/romaneios", data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/romaneios"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/romaneios/productivity"] });
            toast({ title: "Romaneio registrado!" });
            setOpenDialog(false);
            setImportDialogOpen(false);
            setImportedData(null);
        },
    });

    const del = useMutation({
        mutationFn: async (id: string) => apiRequest("DELETE", `/api/farm/romaneios/${id}`),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/farm/romaneios"] }); toast({ title: "Romaneio removido" }); },
    });

    const confirmMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: any }) => {
            const r = await apiRequest("POST", `/api/farm/romaneios/${id}/confirm`, data);
            return r.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/romaneios"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/romaneios/productivity"] });
            toast({ title: "✅ Romaneio aprovado!" });
        },
    });

    const handleImportUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append("file", file);

            const res = await fetch("/api/farm/romaneios/import", {
                method: "POST",
                body: formData,
                credentials: "include",
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Falha ao processar");
            }

            const result = await res.json();
            setImportedData(result.parsed);
            toast({ title: "📸 Romaneio extraído!", description: `Ticket #${result.parsed.ticketNumber || 'S/N'} — revise e confirme.` });
        } catch (error: any) {
            toast({ title: "Erro ao importar", description: error.message, variant: "destructive" });
        } finally {
            setUploading(false);
        }
    };

    return (
        <FarmLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-emerald-800">📦 Romaneios</h1>
                        <p className="text-emerald-600 text-sm">
                            Total: <strong>{(totalWeight / 1000).toFixed(2)} ton</strong> • Valor: <strong>$ {totalValue.toLocaleString("en", { minimumFractionDigits: 2 })}</strong>
                        </p>
                    </div>
                    <div className="flex gap-2">
                        {/* Import Button */}
                        <Dialog open={importDialogOpen} onOpenChange={(v) => { setImportDialogOpen(v); if (!v) setImportedData(null); }}>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="border-emerald-300 text-emerald-700 hover:bg-emerald-50">
                                    <Camera className="mr-2 h-4 w-4" /> Importar Romaneio
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2">
                                        <FileImage className="h-5 w-5 text-emerald-600" />
                                        Importar Romaneio via IA
                                    </DialogTitle>
                                </DialogHeader>

                                {!importedData ? (
                                    <div className="space-y-4">
                                        <div className="border-2 border-dashed border-emerald-200 rounded-xl p-8 text-center bg-emerald-50/50">
                                            {uploading ? (
                                                <div className="flex flex-col items-center gap-3">
                                                    <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
                                                    <p className="text-emerald-700 font-medium">🤖 IA analisando o romaneio...</p>
                                                    <p className="text-sm text-gray-500">Extraindo dados de pesagem, classificação e descontos</p>
                                                </div>
                                            ) : (
                                                <>
                                                    <Camera className="h-12 w-12 text-emerald-300 mx-auto mb-4" />
                                                    <p className="text-emerald-700 font-medium mb-1">Envie a foto ou PDF do romaneio</p>
                                                    <p className="text-sm text-gray-500 mb-4">A IA vai extrair todos os dados automaticamente (C.Vale, Agridesa, ADM, Cargill...)</p>
                                                    <label className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg cursor-pointer hover:bg-emerald-700 transition-colors">
                                                        <Upload className="h-4 w-4" />
                                                        Selecionar Arquivo
                                                        <input
                                                            type="file"
                                                            accept="image/*,application/pdf"
                                                            className="hidden"
                                                            onChange={handleImportUpload}
                                                        />
                                                    </label>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <RomaneioForm
                                        plots={plots}
                                        properties={properties}
                                        seasons={seasons}
                                        onSave={(data: any) => save.mutate(data)}
                                        saving={save.isPending}
                                        initialData={importedData}
                                    />
                                )}
                            </DialogContent>
                        </Dialog>

                        {/* New Manual Entry */}
                        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                            <DialogTrigger asChild>
                                <Button className="bg-emerald-600 hover:bg-emerald-700"><Plus className="mr-2 h-4 w-4" /> Novo Romaneio</Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                                <DialogHeader><DialogTitle>Novo Romaneio (Boleta)</DialogTitle></DialogHeader>
                                <RomaneioForm plots={plots} properties={properties} seasons={seasons} onSave={(data: any) => save.mutate(data)} saving={save.isPending} />
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

                {/* ====== WhatsApp Pending Approval ====== */}
                {pendingRomaneios.length > 0 && (
                    <Card className="border-amber-200 bg-amber-50/50">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2 text-amber-800">
                                <MessageSquare className="h-5 w-5" />
                                Romaneios via WhatsApp — Aguardando Aprovação ({pendingRomaneios.length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {pendingRomaneios.map((r: any) => (
                                <PendingRomaneioCard
                                    key={r.id}
                                    romaneio={r}
                                    plots={plots}
                                    seasons={seasons}
                                    onConfirm={(data: any) => confirmMutation.mutate({ id: r.id, data })}
                                    onReject={() => { if (confirm("Descartar este romaneio?")) del.mutate(r.id); }}
                                    saving={confirmMutation.isPending}
                                />
                            ))}
                        </CardContent>
                    </Card>
                )}

                {/* Productivity Cards */}
                {productivity.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {productivity.map((p: any, i: number) => (
                            <Card key={i} className="border-emerald-100">
                                <CardContent className="p-4">
                                    <p className="text-xs text-gray-500">{p.plotName} • {p.crop}</p>
                                    <p className="text-xl font-bold text-emerald-700">{p.tonPerHa ? `${p.tonPerHa} ton/ha` : "—"}</p>
                                    <p className="text-xs text-gray-400">{p.deliveryCount} entregas • {(parseFloat(p.totalFinalWeight) / 1000).toFixed(1)} ton</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                {isLoading ? (
                    <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
                ) : confirmedRomaneios.length === 0 ? (
                    <Card className="border-emerald-100"><CardContent className="py-12 text-center">
                        <Scale className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">Nenhum romaneio registrado</p>
                    </CardContent></Card>
                ) : (
                    <div className="bg-white rounded-xl border border-emerald-100 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-emerald-50">
                                <tr>
                                    <th className="text-left p-3 font-semibold text-emerald-800">Data</th>
                                    <th className="text-left p-3 font-semibold text-emerald-800">Comprador</th>
                                    <th className="text-left p-3 font-semibold text-emerald-800">Cultura</th>
                                    <th className="text-left p-3 font-semibold text-emerald-800">Talhão</th>
                                    <th className="text-right p-3 font-semibold text-emerald-800">Peso Líquido</th>
                                    <th className="text-right p-3 font-semibold text-emerald-800">Peso Final</th>
                                    <th className="text-right p-3 font-semibold text-emerald-800">Valor</th>
                                    <th className="p-3"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {confirmedRomaneios.map((r: any) => (
                                    <tr key={r.id} className="border-t border-gray-100">
                                        <td className="p-3">{new Date(r.deliveryDate).toLocaleDateString("pt-BR")}</td>
                                        <td className="p-3 font-medium">{r.buyer}</td>
                                        <td className="p-3"><span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700">{r.crop}</span></td>
                                        <td className="p-3">{r.plotName || "—"}</td>
                                        <td className="text-right p-3 font-mono">{parseFloat(r.netWeight).toLocaleString()} kg</td>
                                        <td className="text-right p-3 font-mono font-semibold">{parseFloat(r.finalWeight).toLocaleString()} kg</td>
                                        <td className="text-right p-3 font-mono font-semibold text-emerald-700">
                                            {r.totalValue ? `$ ${parseFloat(r.totalValue).toFixed(2)}` : "—"}
                                        </td>
                                        <td className="p-3">
                                            <div className="flex items-center gap-1">
                                                {r.source === "whatsapp" && <MessageSquare className="h-3.5 w-3.5 text-green-500" title="Via WhatsApp" />}
                                                {r.source === "import" && <Camera className="h-3.5 w-3.5 text-blue-500" title="Via Import IA" />}
                                                <Button variant="ghost" size="sm" className="text-red-500 h-7 text-xs"
                                                    onClick={() => { if (confirm("Remover este romaneio?")) del.mutate(r.id); }}>
                                                    Excluir
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </FarmLayout>
    );
}

// ====== Pending Romaneio Card (WhatsApp approval) ======
function PendingRomaneioCard({ romaneio, plots, seasons, onConfirm, onReject, saving }: any) {
    const [plotId, setPlotId] = useState(romaneio.plotId || "");
    const [seasonId, setSeasonId] = useState(romaneio.seasonId || "");

    return (
        <div className="bg-white rounded-lg border border-amber-200 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-amber-500" />
                        <span className="font-semibold text-amber-800">Ticket #{romaneio.ticketNumber || "S/N"}</span>
                        <span className="text-gray-400">•</span>
                        <span className="text-gray-500">{new Date(romaneio.deliveryDate).toLocaleDateString("pt-BR")}</span>
                        <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700 flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" /> WhatsApp
                        </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                        <div><span className="text-gray-400">Comprador:</span> <strong>{romaneio.buyer}</strong></div>
                        <div><span className="text-gray-400">Cultura:</span> <strong>{romaneio.crop}</strong></div>
                        <div><span className="text-gray-400">Peso Bruto:</span> <strong>{parseFloat(romaneio.grossWeight).toLocaleString()} kg</strong></div>
                        <div><span className="text-gray-400">Peso Final:</span> <strong className="text-emerald-700">{parseFloat(romaneio.finalWeight).toLocaleString()} kg</strong></div>
                    </div>
                    {(romaneio.moisture || romaneio.impurities) && (
                        <div className="flex gap-3 text-xs text-gray-500">
                            {romaneio.moisture && <span>💧 Umidade: {romaneio.moisture}%</span>}
                            {romaneio.impurities && <span>🔬 Impureza: {romaneio.impurities}%</span>}
                            {romaneio.truckPlate && <span>🚛 {romaneio.truckPlate}</span>}
                        </div>
                    )}

                    {/* Selection for talhão and safra */}
                    <div className="flex gap-3 mt-2">
                        <div className="flex-1">
                            <Label className="text-xs text-gray-500">Talhão *</Label>
                            <Select value={plotId} onValueChange={setPlotId}>
                                <SelectTrigger className="h-8 text-sm">
                                    <SelectValue placeholder="Selecione o talhão..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {plots.map((p: any) => (
                                        <SelectItem key={p.id} value={p.id}>{p.name} ({p.areaHa} ha)</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex-1">
                            <Label className="text-xs text-gray-500">Safra</Label>
                            <Select value={seasonId} onValueChange={setSeasonId}>
                                <SelectTrigger className="h-8 text-sm">
                                    <SelectValue placeholder="Selecione a safra..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {seasons.map((s: any) => (
                                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1"
                        disabled={!plotId || saving}
                        onClick={() => onConfirm({ plotId, seasonId: seasonId || null })}
                    >
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        Aprovar
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        className="text-red-500 border-red-200 hover:bg-red-50 flex items-center gap-1"
                        onClick={onReject}
                    >
                        <X className="h-3.5 w-3.5" /> Rejeitar
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ====== Romaneio Form (Manual + AI pre-filled) ======
function RomaneioForm({ plots, properties, seasons, onSave, saving, initialData }: any) {
    const d = initialData || {};
    const [buyer, setBuyer] = useState(d.buyer || "");
    const [crop, setCrop] = useState(d.crop ? d.crop.charAt(0).toUpperCase() + d.crop.slice(1) : "");
    const [plotId, setPlotId] = useState("");
    const [propertyId, setPropertyId] = useState("");
    const [seasonId, setSeasonId] = useState("");
    const [deliveryDate, setDeliveryDate] = useState(
        d.deliveryDate ? new Date(d.deliveryDate).toISOString().substring(0, 10) : new Date().toISOString().substring(0, 10)
    );
    const [grossWeight, setGrossWeight] = useState(d.grossWeight ? String(d.grossWeight) : "");
    const [tare, setTare] = useState(d.tare ? String(d.tare) : "");
    const [moisture, setMoisture] = useState(d.moisture != null ? String(d.moisture) : "");
    const [impurities, setImpurities] = useState(d.impurities != null ? String(d.impurities) : "");
    const [pricePerTon, setPricePerTon] = useState(d.pricePerTon != null ? String(d.pricePerTon) : "");
    const [truckPlate, setTruckPlate] = useState(d.truckPlate || "");
    const [ticketNumber, setTicketNumber] = useState(d.ticketNumber || "");
    const [driver, setDriver] = useState(d.driver || "");
    const [notes, setNotes] = useState(d.notes || "");

    const netWeight = Math.max(0, (parseFloat(grossWeight) || 0) - (parseFloat(tare) || 0));
    const moistureDisc = (parseFloat(moisture) || 0) > 14 ? netWeight * ((parseFloat(moisture) - 14) / 100) : 0;
    const impurityDisc = (parseFloat(impurities) || 0) > 1 ? netWeight * ((parseFloat(impurities) - 1) / 100) : 0;
    const finalWeight = d.finalWeight ? Number(d.finalWeight) : Math.max(0, netWeight - moistureDisc - impurityDisc);
    const totalValue = (finalWeight / 1000) * (parseFloat(pricePerTon) || 0);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            buyer, crop, plotId: plotId || null, propertyId: propertyId || null, seasonId: seasonId || null,
            deliveryDate, grossWeight, tare, netWeight: String(netWeight),
            moisture: moisture || null, impurities: impurities || null,
            moistureDiscount: String(moistureDisc), impurityDiscount: String(impurityDisc),
            finalWeight: String(finalWeight), pricePerTon: pricePerTon || null,
            totalValue: totalValue > 0 ? String(totalValue) : null,
            truckPlate: truckPlate || null, ticketNumber: ticketNumber || null,
            driver: driver || null,
            discounts: d.discounts || null,
            documentNumber: d.documentNumber || null,
            source: initialData ? "import" : "manual",
            notes: notes || null,
        });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {initialData && (
                <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-700 flex items-center gap-2 border border-blue-200">
                    <Camera className="h-4 w-4" />
                    Dados extraídos pela IA — revise e ajuste se necessário antes de confirmar.
                </div>
            )}

            <div className="grid grid-cols-2 gap-4">
                <div><Label>Comprador/Trading *</Label><Input value={buyer} onChange={e => setBuyer(e.target.value)} required placeholder="Ex: Cargill, ADM..." /></div>
                <div><Label>Cultura *</Label>
                    <Select value={crop} onValueChange={setCrop}>
                        <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Soja">Soja</SelectItem>
                            <SelectItem value="Milho">Milho</SelectItem>
                            <SelectItem value="Trigo">Trigo</SelectItem>
                            <SelectItem value="Girassol">Girassol</SelectItem>
                            <SelectItem value="Arroz">Arroz</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div><Label>Propriedade</Label>
                    <Select value={propertyId} onValueChange={setPropertyId}>
                        <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>{properties.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <div><Label>Talhão</Label>
                    <Select value={plotId} onValueChange={setPlotId}>
                        <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>{plots.filter((p: any) => !propertyId || p.propertyId === propertyId).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.areaHa} ha)</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <div><Label>Safra</Label>
                    <Select value={seasonId} onValueChange={setSeasonId}>
                        <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>{seasons.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <div><Label>Data de Entrega *</Label><Input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} required /></div>
            </div>

            <div className="border-t pt-4">
                <h3 className="font-semibold text-emerald-800 mb-3 flex items-center gap-2"><Scale className="h-4 w-4" /> Pesagem</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div><Label>Peso Bruto (kg) *</Label><Input type="number" step="0.01" value={grossWeight} onChange={e => setGrossWeight(e.target.value)} required /></div>
                    <div><Label>Tara (kg) *</Label><Input type="number" step="0.01" value={tare} onChange={e => setTare(e.target.value)} required /></div>
                    <div><Label>Umidade (%)</Label><Input type="number" step="0.01" value={moisture} onChange={e => setMoisture(e.target.value)} placeholder="Ex: 14.5" /></div>
                    <div><Label>Impurezas (%)</Label><Input type="number" step="0.01" value={impurities} onChange={e => setImpurities(e.target.value)} placeholder="Ex: 0.8" /></div>
                </div>
                <div className="mt-3 p-3 bg-emerald-50 rounded-lg text-sm space-y-1">
                    <p>Peso Líquido: <strong>{netWeight.toLocaleString()} kg</strong></p>
                    {moistureDisc > 0 && <p className="text-red-600">Desconto Umidade: -{moistureDisc.toFixed(0)} kg</p>}
                    {impurityDisc > 0 && <p className="text-red-600">Desconto Impureza: -{impurityDisc.toFixed(0)} kg</p>}
                    <p className="text-lg font-bold text-emerald-700">Peso Final: {finalWeight.toLocaleString()} kg ({(finalWeight / 1000).toFixed(2)} ton)</p>
                </div>
            </div>

            {/* Extra discounts from AI */}
            {d.discounts && Object.keys(d.discounts).length > 0 && (
                <div className="border-t pt-4">
                    <h3 className="font-semibold text-emerald-800 mb-3">🔬 Análises Extraídas</h3>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                        {Object.entries(d.discounts).map(([key, val]: [string, any]) => (
                            <div key={key} className="bg-gray-50 rounded px-3 py-2">
                                <span className="text-gray-500 text-xs">{key.replace(/_/g, " ")}:</span>{" "}
                                <strong>{typeof val === "number" ? val.toFixed(2) : val}</strong>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="border-t pt-4">
                <h3 className="font-semibold text-emerald-800 mb-3">💰 Valor (opcional)</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div><Label>Preço por Tonelada ($)</Label><Input type="number" step="0.01" value={pricePerTon} onChange={e => setPricePerTon(e.target.value)} /></div>
                    {totalValue > 0 && <div className="flex items-end"><p className="text-lg font-bold text-emerald-700">Total: $ {totalValue.toFixed(2)}</p></div>}
                </div>
            </div>

            <div className="border-t pt-4 grid grid-cols-3 gap-4">
                <div><Label>Placa do Caminhão</Label><Input value={truckPlate} onChange={e => setTruckPlate(e.target.value)} placeholder="ABC-1234" /></div>
                <div><Label>Nº Ticket/Boleta</Label><Input value={ticketNumber} onChange={e => setTicketNumber(e.target.value)} /></div>
                <div><Label>Motorista</Label><Input value={driver} onChange={e => setDriver(e.target.value)} /></div>
            </div>
            <div><Label>Observações</Label><Input value={notes} onChange={e => setNotes(e.target.value)} /></div>

            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={saving || !buyer || !crop || !grossWeight || !tare}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {initialData ? "✅ Confirmar Romaneio Importado" : "Registrar Romaneio"}
            </Button>
        </form>
    );
}
