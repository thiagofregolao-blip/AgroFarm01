import { useState } from "react";
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
import { Plus, Scale, Loader2, Wheat, TrendingUp, Truck } from "lucide-react";

export default function FarmRomaneios() {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [openDialog, setOpenDialog] = useState(false);
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

    const totalWeight = romaneios.reduce((s: number, r: any) => s + parseFloat(r.finalWeight || 0), 0);
    const totalValue = romaneios.reduce((s: number, r: any) => s + parseFloat(r.totalValue || 0), 0);

    const save = useMutation({
        mutationFn: async (data: any) => apiRequest("POST", "/api/farm/romaneios", data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/romaneios"] });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/romaneios/productivity"] });
            toast({ title: "Romaneio registrado!" });
            setOpenDialog(false);
        },
    });

    const del = useMutation({
        mutationFn: async (id: string) => apiRequest("DELETE", `/api/farm/romaneios/${id}`),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/farm/romaneios"] }); toast({ title: "Romaneio removido" }); },
    });

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
                ) : romaneios.length === 0 ? (
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
                                {romaneios.map((r: any) => (
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
                                            <Button variant="ghost" size="sm" className="text-red-500 h-7 text-xs"
                                                onClick={() => { if (confirm("Remover este romaneio?")) del.mutate(r.id); }}>
                                                Excluir
                                            </Button>
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

function RomaneioForm({ plots, properties, seasons, onSave, saving }: any) {
    const [buyer, setBuyer] = useState("");
    const [crop, setCrop] = useState("");
    const [plotId, setPlotId] = useState("");
    const [propertyId, setPropertyId] = useState("");
    const [seasonId, setSeasonId] = useState("");
    const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().substring(0, 10));
    const [grossWeight, setGrossWeight] = useState("");
    const [tare, setTare] = useState("");
    const [moisture, setMoisture] = useState("");
    const [impurities, setImpurities] = useState("");
    const [pricePerTon, setPricePerTon] = useState("");
    const [truckPlate, setTruckPlate] = useState("");
    const [ticketNumber, setTicketNumber] = useState("");
    const [notes, setNotes] = useState("");

    const netWeight = Math.max(0, (parseFloat(grossWeight) || 0) - (parseFloat(tare) || 0));
    const moistureDisc = (parseFloat(moisture) || 0) > 14 ? netWeight * ((parseFloat(moisture) - 14) / 100) : 0;
    const impurityDisc = (parseFloat(impurities) || 0) > 1 ? netWeight * ((parseFloat(impurities) - 1) / 100) : 0;
    const finalWeight = Math.max(0, netWeight - moistureDisc - impurityDisc);
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
            truckPlate: truckPlate || null, ticketNumber: ticketNumber || null, notes: notes || null,
        });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
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

            <div className="border-t pt-4">
                <h3 className="font-semibold text-emerald-800 mb-3">💰 Valor (opcional)</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div><Label>Preço por Tonelada ($)</Label><Input type="number" step="0.01" value={pricePerTon} onChange={e => setPricePerTon(e.target.value)} /></div>
                    {totalValue > 0 && <div className="flex items-end"><p className="text-lg font-bold text-emerald-700">Total: $ {totalValue.toFixed(2)}</p></div>}
                </div>
            </div>

            <div className="border-t pt-4 grid grid-cols-2 gap-4">
                <div><Label>Placa do Caminhão</Label><Input value={truckPlate} onChange={e => setTruckPlate(e.target.value)} placeholder="ABC-1234" /></div>
                <div><Label>Nº Ticket/Boleta</Label><Input value={ticketNumber} onChange={e => setTicketNumber(e.target.value)} /></div>
            </div>
            <div><Label>Observações</Label><Input value={notes} onChange={e => setNotes(e.target.value)} /></div>

            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={saving || !buyer || !crop || !grossWeight || !tare}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Registrar Romaneio
            </Button>
        </form>
    );
}
