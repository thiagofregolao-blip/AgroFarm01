import { useState, lazy, Suspense } from "react";
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

const PlotMapDraw = lazy(() => import("@/components/fazenda/plot-map-draw"));
import PlotThumbnail from "@/components/fazenda/plot-thumbnail";

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
            <div className="space-y-6 p-4 lg:p-8 max-w-7xl mx-auto">
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

                {/* New/Edit Plot — Fullscreen on mobile, centered modal on desktop */}
                {(openNewPlot !== null || editPlot !== null) && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center">
                        {/* Backdrop */}
                        <div
                            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                            onClick={() => { setOpenNewPlot(null); setEditPlot(null); }}
                        />
                        {/* Content — fullscreen on mobile, modal on desktop */}
                        <div className="relative w-full h-full md:w-[1200px] md:max-w-[95vw] md:h-[85vh] bg-white md:rounded-xl overflow-hidden flex flex-col md:flex-row shadow-2xl">
                            {/* Close button */}
                            <button
                                onClick={() => { setOpenNewPlot(null); setEditPlot(null); }}
                                className="absolute top-3 right-3 z-[1001] w-8 h-8 rounded-full bg-white/80 hover:bg-white flex items-center justify-center text-lg shadow-md"
                            >✕</button>
                            <PlotForm
                                propertyId={openNewPlot || editPlot?.propertyId}
                                initial={editPlot}
                                onSave={() => { setOpenNewPlot(null); setEditPlot(null); queryClient.invalidateQueries({ queryKey: ["/api/farm/properties"] }); }}
                                onCancel={() => { setOpenNewPlot(null); setEditPlot(null); }}
                            />
                        </div>
                    </div>
                )}
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
                <div style={{ padding: 16, borderTop: "1px solid #d1fae5", background: "rgba(236,253,245,0.3)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                        <p style={{ fontSize: 13, fontWeight: 500, color: "#6b7280", whiteSpace: "nowrap" }}>
                            {totalArea.toFixed(2)} ha
                        </p>
                        <div style={{ flex: 1, height: 1, background: "#d1d5db" }} />
                        <Button size="sm" variant="outline" onClick={onAddPlot}>
                            <Plus className="mr-1 h-3 w-3" /> Talhão
                        </Button>
                    </div>
                    {plots.length === 0 ? (
                        <p className="text-sm text-gray-400 py-2">Nenhum talhão cadastrado</p>
                    ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
                            {plots.map((plot: any) => {
                                let coords: any[] = [];
                                try { coords = plot.coordinates ? JSON.parse(plot.coordinates) : []; } catch { }
                                const hasMap = coords.length >= 3;

                                if (hasMap) {
                                    return (
                                        <PlotThumbnail
                                            key={plot.id}
                                            coordinates={coords}
                                            name={plot.name}
                                            areaHa={plot.areaHa}
                                            onClick={() => onEditPlot(plot)}
                                            onMenuClick={() => {
                                                if (window.confirm(`Excluir talhão "${plot.name}"?`)) {
                                                    deletePlot.mutate(plot.id);
                                                }
                                            }}
                                        />
                                    );
                                }

                                // Card without map
                                return (
                                    <div
                                        key={plot.id}
                                        onClick={() => onEditPlot(plot)}
                                        style={{
                                            position: "relative", borderRadius: 12, overflow: "hidden",
                                            cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                                            background: "linear-gradient(135deg, #059669, #10b981)",
                                            paddingBottom: "75%",
                                        }}
                                    >
                                        <div style={{
                                            position: "absolute", bottom: 0, left: 0, right: 0,
                                            background: "linear-gradient(transparent, rgba(0,0,0,0.5))",
                                            padding: "24px 12px 10px 12px",
                                            display: "flex", alignItems: "flex-end", justifyContent: "space-between",
                                        }}>
                                            <div>
                                                <p style={{ color: "white", fontWeight: 700, fontSize: 15, margin: 0 }}>{plot.name}</p>
                                                <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, margin: 0 }}>({plot.areaHa} ha)</p>
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); if (window.confirm(`Excluir talhão "${plot.name}"?`)) deletePlot.mutate(plot.id); }}
                                                style={{ background: "none", border: "none", color: "white", cursor: "pointer", fontSize: 20, padding: "4px 8px" }}
                                            >⋮</button>
                                        </div>
                                    </div>
                                );
                            })}
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

function PlotForm({ propertyId, initial, onSave, onCancel }: { propertyId: string; initial?: any; onSave: () => void; onCancel: () => void }) {
    const [name, setName] = useState(initial?.name || "");
    const [areaHa, setAreaHa] = useState(initial?.areaHa || "");
    const [crop, setCrop] = useState(initial?.crop || "");
    const [showForm, setShowForm] = useState(true);
    const [coordinates, setCoordinates] = useState<any[]>(() => {
        if (initial?.coordinates) {
            try { return JSON.parse(initial.coordinates); } catch { return []; }
        }
        return [];
    });
    const { toast } = useToast();

    const save = useMutation({
        mutationFn: async () => {
            if (initial?.id) {
                return apiRequest("PUT", `/api/farm/plots/${initial.id}`, { name, areaHa, crop, coordinates });
            }
            return apiRequest("POST", `/api/farm/properties/${propertyId}/plots`, { name, areaHa, crop, coordinates });
        },
        onSuccess: () => {
            toast({ title: initial ? "Talhão atualizado" : "Talhão criado" });
            onSave();
        },
    });

    return (
        <>
            {/* ===== DESKTOP: Side-by-side layout ===== */}
            <div className="hidden md:flex flex-row w-full h-full">
                {/* LEFT: Form panel */}
                <div style={{ width: 340, minWidth: 340, display: "flex", flexDirection: "column", borderRight: "1px solid #e5e7eb", background: "white", flexShrink: 0 }}>
                    <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb", background: "#ecfdf5" }}>
                        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#065f46" }}>
                            {initial ? "Editar" : "Novo"} Talhão
                        </h2>
                        <p style={{ fontSize: 13, color: "#059669", marginTop: 2 }}>
                            Desenhe a área no mapa para calcular automaticamente
                        </p>
                    </div>

                    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} style={{ flex: 1, display: "flex", flexDirection: "column", padding: 20 }}>
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
                            <div>
                                <Label className="text-sm font-semibold text-gray-700">Nome do Talhão *</Label>
                                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Talhão 1" required className="mt-1" />
                            </div>

                            <div>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                    <Label className="text-sm font-semibold text-gray-700">Área (ha) *</Label>
                                    {coordinates.length >= 3 && (
                                        <span style={{ fontSize: 11, background: "#d1fae5", color: "#047857", padding: "2px 8px", borderRadius: 12, fontWeight: 500 }}>
                                            📐 Calculado do mapa
                                        </span>
                                    )}
                                </div>
                                <Input type="number" step="0.01" value={areaHa} onChange={e => setAreaHa(e.target.value)} required className="mt-1 text-lg font-bold" />
                            </div>

                            <div>
                                <Label className="text-sm font-semibold text-gray-700">Cultura</Label>
                                <Input value={crop} onChange={e => setCrop(e.target.value)} placeholder="Ex: Soja, Milho..." className="mt-1" />
                            </div>

                            <div style={{
                                borderRadius: 12, padding: 12, fontSize: 13,
                                background: coordinates.length >= 3 ? "#ecfdf5" : "#f9fafb",
                                border: `1px solid ${coordinates.length >= 3 ? "#a7f3d0" : "#e5e7eb"}`,
                                color: coordinates.length >= 3 ? "#047857" : "#6b7280",
                            }}>
                                {coordinates.length >= 3 ? (
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <MapPin style={{ width: 16, height: 16, color: "#10b981" }} />
                                        <span><strong>{coordinates.length}</strong> pontos marcados no mapa</span>
                                    </div>
                                ) : (
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <MapPin style={{ width: 16, height: 16 }} />
                                        <span>Desenhe o contorno do talhão no mapa →</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 16, borderTop: "1px solid #e5e7eb", marginTop: 16 }}>
                            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 py-5 text-base font-bold" disabled={save.isPending}>
                                {save.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                                SALVAR
                            </Button>
                            <Button type="button" variant="outline" className="w-full" onClick={onCancel}>
                                CANCELAR
                            </Button>
                        </div>
                    </form>
                </div>

                {/* RIGHT: Map */}
                <div style={{ flex: 1, position: "relative", background: "#e5e7eb", minHeight: 300 }}>
                    <Suspense fallback={
                        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#f3f4f6" }}>
                            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                        </div>
                    }>
                        <PlotMapDraw
                            initialCoordinates={coordinates.length >= 3 ? coordinates : undefined}
                            onAreaCalculated={(area) => setAreaHa(String(area))}
                            onCoordinatesChange={(coords) => setCoordinates(coords)}
                        />
                    </Suspense>
                </div>
            </div>

            {/* ===== MOBILE: Fullscreen map + collapsible bottom form ===== */}
            <div className="flex md:hidden flex-col w-full h-full relative">
                {/* Map — fullscreen */}
                <div className="flex-1 relative bg-gray-200" style={{ minHeight: 200 }}>
                    <Suspense fallback={
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                        </div>
                    }>
                        <PlotMapDraw
                            initialCoordinates={coordinates.length >= 3 ? coordinates : undefined}
                            onAreaCalculated={(area) => setAreaHa(String(area))}
                            onCoordinatesChange={(coords) => setCoordinates(coords)}
                        />
                    </Suspense>

                    {/* Floating toggle button */}
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[100] bg-emerald-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-bold"
                    >
                        <Edit2 className="h-4 w-4" />
                        {showForm ? "Ocultar Dados" : "Editar Dados"}
                        <ChevronDown className={`h-4 w-4 transition-transform ${showForm ? "rotate-180" : ""}`} />
                    </button>
                </div>

                {/* Collapsible form panel */}
                {showForm && (
                    <div className="bg-white border-t border-gray-200 shadow-[0_-4px_12px_rgba(0,0,0,0.1)] max-h-[55vh] overflow-y-auto">
                        <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-100">
                            <h2 className="text-base font-bold text-emerald-800">
                                {initial ? "Editar" : "Novo"} Talhão
                            </h2>
                            <p className="text-xs text-emerald-600">Desenhe a área no mapa acima</p>
                        </div>

                        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="p-4 space-y-3">
                            <div>
                                <Label className="text-xs font-semibold text-gray-700">Nome do Talhão *</Label>
                                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Talhão 1" required className="mt-1 h-9" />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <div className="flex items-center gap-1">
                                        <Label className="text-xs font-semibold text-gray-700">Área (ha) *</Label>
                                        {coordinates.length >= 3 && (
                                            <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium">📐 Auto</span>
                                        )}
                                    </div>
                                    <Input type="number" step="0.01" value={areaHa} onChange={e => setAreaHa(e.target.value)} required className="mt-1 h-9 font-bold" />
                                </div>
                                <div>
                                    <Label className="text-xs font-semibold text-gray-700">Cultura</Label>
                                    <Input value={crop} onChange={e => setCrop(e.target.value)} placeholder="Soja, Milho..." className="mt-1 h-9" />
                                </div>
                            </div>

                            {coordinates.length >= 3 && (
                                <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-100">
                                    <MapPin className="h-3.5 w-3.5 text-emerald-500" />
                                    <strong>{coordinates.length}</strong> pontos marcados
                                </div>
                            )}

                            <div className="flex gap-2 pt-2">
                                <Button type="button" variant="outline" className="flex-1 h-10" onClick={onCancel}>
                                    Cancelar
                                </Button>
                                <Button type="submit" className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-700 font-bold" disabled={save.isPending}>
                                    {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Salvar
                                </Button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </>
    );
}

