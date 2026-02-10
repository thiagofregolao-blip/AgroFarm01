import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import FarmLayout from "@/components/fazenda/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit2, Trash2, MapPin, Ruler, Loader2, ChevronDown, ChevronRight } from "lucide-react";

export default function FarmProperties() {
    const [, setLocation] = useLocation();
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [openNewProp, setOpenNewProp] = useState(false);
    const [openNewPlot, setOpenNewPlot] = useState<string | null>(null);
    const [expandedProp, setExpandedProp] = useState<string | null>(null);
    const [editProp, setEditProp] = useState<any>(null);
    const [editPlot, setEditPlot] = useState<any>(null);

    const { user } = useAuth();

    const { data: properties = [], isLoading } = useQuery({
        queryKey: ["/api/farm/properties"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/properties"); return r.json(); },
        enabled: !!user,
    });

    return (
        <FarmLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-emerald-800">Propriedades & Talhões</h1>
                        <p className="text-emerald-600 text-sm">Gerencie suas propriedades e talhões</p>
                    </div>
                    <Dialog open={openNewProp} onOpenChange={setOpenNewProp}>
                        <DialogTrigger asChild>
                            <Button className="bg-emerald-600 hover:bg-emerald-700">
                                <Plus className="mr-2 h-4 w-4" /> Nova Propriedade
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>{editProp ? "Editar" : "Nova"} Propriedade</DialogTitle>
                            </DialogHeader>
                            <PropertyForm
                                initial={editProp}
                                onSave={() => { setOpenNewProp(false); setEditProp(null); queryClient.invalidateQueries({ queryKey: ["/api/farm/properties"] }); }}
                            />
                        </DialogContent>
                    </Dialog>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
                ) : properties.length === 0 ? (
                    <Card className="border-emerald-100">
                        <CardContent className="py-12 text-center">
                            <MapPin className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                            <p className="text-gray-500">Nenhuma propriedade cadastrada</p>
                            <Button className="mt-4 bg-emerald-600 hover:bg-emerald-700" onClick={() => setOpenNewProp(true)}>
                                <Plus className="mr-2 h-4 w-4" /> Cadastrar Primeira Propriedade
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        {properties.map((prop: any) => (
                            <PropertyCard
                                key={prop.id}
                                property={prop}
                                expanded={expandedProp === prop.id}
                                onToggle={() => setExpandedProp(expandedProp === prop.id ? null : prop.id)}
                                onEdit={() => { setEditProp(prop); setOpenNewProp(true); }}
                                onAddPlot={() => setOpenNewPlot(prop.id)}
                                onEditPlot={(plot: any) => setEditPlot(plot)}
                            />
                        ))}
                    </div>
                )}

                {/* New Plot Dialog */}
                <Dialog open={openNewPlot !== null || editPlot !== null} onOpenChange={() => { setOpenNewPlot(null); setEditPlot(null); }}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editPlot ? "Editar" : "Novo"} Talhão</DialogTitle>
                        </DialogHeader>
                        <PlotForm
                            propertyId={openNewPlot || editPlot?.propertyId}
                            initial={editPlot}
                            onSave={() => { setOpenNewPlot(null); setEditPlot(null); queryClient.invalidateQueries({ queryKey: ["/api/farm/properties"] }); }}
                        />
                    </DialogContent>
                </Dialog>
            </div>
        </FarmLayout>
    );
}

function PropertyCard({ property, expanded, onToggle, onEdit, onAddPlot, onEditPlot }: any) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const { data: plots = [] } = useQuery({
        queryKey: ["/api/farm/properties", property.id, "plots"],
        queryFn: async () => { const r = await apiRequest("GET", `/api/farm/properties/${property.id}/plots`); return r.json(); },
        enabled: expanded,
    });

    const deleteProp = useMutation({
        mutationFn: () => apiRequest("DELETE", `/api/farm/properties/${property.id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/properties"] });
            toast({ title: "Propriedade excluída" });
        },
    });

    const deletePlot = useMutation({
        mutationFn: (id: string) => apiRequest("DELETE", `/api/farm/plots/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/properties", property.id, "plots"] });
            toast({ title: "Talhão excluído" });
        },
    });

    const totalArea = plots.reduce((s: number, p: any) => s + parseFloat(p.areaHa || 0), 0);

    return (
        <Card className="border-emerald-100 overflow-hidden">
            <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-emerald-50/50" onClick={onToggle}>
                {expanded ? <ChevronDown className="h-5 w-5 text-emerald-500" /> : <ChevronRight className="h-5 w-5 text-gray-400" />}
                <div className="flex-1">
                    <h3 className="font-semibold text-emerald-800">{property.name}</h3>
                    <p className="text-sm text-gray-500">{property.location || "Sem localização"} • {property.totalAreaHa ? `${property.totalAreaHa} ha` : "Área não informada"}</p>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" onClick={onEdit}><Edit2 className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700" onClick={() => deleteProp.mutate()}><Trash2 className="h-4 w-4" /></Button>
                </div>
            </div>

            {expanded && (
                <div className="border-t border-emerald-100 p-4 bg-emerald-50/30">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-medium text-emerald-700">{plots.length} talhões — {totalArea.toFixed(1)} ha total</p>
                        <Button size="sm" variant="outline" onClick={onAddPlot}>
                            <Plus className="mr-1 h-3 w-3" /> Talhão
                        </Button>
                    </div>
                    {plots.length === 0 ? (
                        <p className="text-sm text-gray-400 py-2">Nenhum talhão cadastrado</p>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {plots.map((plot: any) => (
                                <div key={plot.id} className="flex items-center justify-between p-3 rounded-lg bg-white border border-emerald-100">
                                    <div>
                                        <p className="font-medium text-sm">{plot.name}</p>
                                        <p className="text-xs text-gray-500">{plot.areaHa} ha {plot.crop ? `• ${plot.crop}` : ""}</p>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEditPlot(plot)}><Edit2 className="h-3 w-3" /></Button>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => deletePlot.mutate(plot.id)}><Trash2 className="h-3 w-3" /></Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </Card>
    );
}

function PropertyForm({ initial, onSave }: { initial?: any; onSave: () => void }) {
    const [name, setName] = useState(initial?.name || "");
    const [location, setLocation] = useState(initial?.location || "");
    const [totalAreaHa, setTotalAreaHa] = useState(initial?.totalAreaHa || "");
    const { toast } = useToast();

    const save = useMutation({
        mutationFn: async () => {
            if (initial?.id) {
                return apiRequest("PUT", `/api/farm/properties/${initial.id}`, { name, location, totalAreaHa: totalAreaHa || null });
            }
            return apiRequest("POST", "/api/farm/properties", { name, location, totalAreaHa: totalAreaHa || null });
        },
        onSuccess: () => {
            toast({ title: initial ? "Propriedade atualizada" : "Propriedade criada" });
            onSave();
        },
    });

    return (
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
            <div><Label>Nome *</Label><Input value={name} onChange={e => setName(e.target.value)} required /></div>
            <div><Label>Localização</Label><Input value={location} onChange={e => setLocation(e.target.value)} /></div>
            <div><Label>Área Total (ha)</Label><Input type="number" step="0.01" value={totalAreaHa} onChange={e => setTotalAreaHa(e.target.value)} /></div>
            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={save.isPending}>
                {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Salvar
            </Button>
        </form>
    );
}

function PlotForm({ propertyId, initial, onSave }: { propertyId: string; initial?: any; onSave: () => void }) {
    const [name, setName] = useState(initial?.name || "");
    const [areaHa, setAreaHa] = useState(initial?.areaHa || "");
    const [crop, setCrop] = useState(initial?.crop || "");
    const { toast } = useToast();

    const save = useMutation({
        mutationFn: async () => {
            if (initial?.id) {
                return apiRequest("PUT", `/api/farm/plots/${initial.id}`, { name, areaHa, crop });
            }
            return apiRequest("POST", `/api/farm/properties/${propertyId}/plots`, { name, areaHa, crop });
        },
        onSuccess: () => {
            toast({ title: initial ? "Talhão atualizado" : "Talhão criado" });
            onSave();
        },
    });

    return (
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
            <div><Label>Nome do Talhão *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Talhão 1" required /></div>
            <div><Label>Área (ha) *</Label><Input type="number" step="0.01" value={areaHa} onChange={e => setAreaHa(e.target.value)} required /></div>
            <div><Label>Cultura</Label><Input value={crop} onChange={e => setCrop(e.target.value)} placeholder="Ex: Soja, Milho..." /></div>
            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={save.isPending}>
                {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Salvar
            </Button>
        </form>
    );
}
