import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { parseMapFile } from "@/lib/map-file-parser";
import { useAuth } from "@/hooks/use-auth";
import FarmLayout from "@/components/fazenda/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit2, Trash2, MapPin, Ruler, Loader2, ChevronDown, ChevronRight, Upload } from "lucide-react";

const PlotMapDraw = lazy(() => import("@/components/fazenda/plot-map-draw"));
import PlotThumbnail from "@/components/fazenda/plot-thumbnail";
import { MapContainer, TileLayer, Polygon, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

function MapAutoFitPlots({ plots }: { plots: any[] }) {
    const map = useMap();
    useEffect(() => {
        const all: [number, number][] = [];
        plots.forEach((p: any) => {
            try {
                const c = JSON.parse(p.coordinates || "[]");
                if (Array.isArray(c)) c.forEach((pt: any) => { if (pt.lat && pt.lng) all.push([pt.lat, pt.lng]); });
            } catch { }
        });
        if (all.length > 0) {
            const L = (window as any).L;
            if (L) map.fitBounds(L.latLngBounds(all), { padding: [30, 30] });
        }
    }, [plots, map]);
    return null;
}

/** Calculate area in hectares from lat/lng coordinates (Shoelace formula on sphere) */
function calculateAreaFromCoords(coords: { lat: number; lng: number }[]): number {
    if (coords.length < 3) return 0;
    // Approximate geodesic area using the Shoelace formula projected
    const toRad = (d: number) => (d * Math.PI) / 180;
    let area = 0;
    for (let i = 0; i < coords.length; i++) {
        const j = (i + 1) % coords.length;
        area += toRad(coords[j].lng - coords[i].lng) * (2 + Math.sin(toRad(coords[i].lat)) + Math.sin(toRad(coords[j].lat)));
    }
    area = Math.abs((area * 6378137 * 6378137) / 2);
    return Math.round((area / 10000) * 100) / 100; // m² → ha
}

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
    const [selectedPropId, setSelectedPropId] = useState<string | null>(null);

    const { data: properties = [], isLoading } = useQuery({
        queryKey: ["/api/farm/properties"],
        queryFn: async () => { const r = await apiRequest("GET", "/api/farm/properties"); return r.json(); },
        enabled: !!user,
    });

    // Auto-select first property
    useEffect(() => {
        if (properties.length > 0 && !selectedPropId) setSelectedPropId(properties[0].id);
    }, [properties, selectedPropId]);

    const selectedProp = properties.find((p: any) => p.id === selectedPropId);

    // Fetch plots for selected property
    const { data: selectedPlots = [] } = useQuery({
        queryKey: ["/api/farm/properties", selectedPropId, "plots"],
        queryFn: async () => { const r = await apiRequest("GET", `/api/farm/properties/${selectedPropId}/plots`); return r.json(); },
        enabled: !!selectedPropId,
    });

    const totalArea = selectedPlots.reduce((s: number, p: any) => s + parseFloat(p.areaHa || 0), 0);
    const plotsWithMap = selectedPlots.filter((p: any) => {
        try { const c = JSON.parse(p.coordinates || "[]"); return c.length >= 3; } catch { return false; }
    });

    return (
        <FarmLayout>
            {/* MOBILE: original stacked layout */}
            <div className="md:hidden space-y-6 p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-emerald-800">Propriedades & Talhoes</h1>
                        <p className="text-emerald-600 text-sm">Gerencie suas propriedades e talhoes</p>
                    </div>
                    <Dialog open={openNewProp} onOpenChange={setOpenNewProp}>
                        <DialogTrigger asChild>
                            <Button className="bg-emerald-600 hover:bg-emerald-700"><Plus className="mr-2 h-4 w-4" /> Nova</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader><DialogTitle>{editProp ? "Editar" : "Nova"} Propriedade</DialogTitle></DialogHeader>
                            <PropertyForm initial={editProp} onSave={() => { setOpenNewProp(false); setEditProp(null); queryClient.invalidateQueries({ queryKey: ["/api/farm/properties"] }); }} />
                        </DialogContent>
                    </Dialog>
                </div>
                {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div> :
                properties.length === 0 ? (
                    <Card className="border-emerald-100"><CardContent className="py-12 text-center"><MapPin className="h-12 w-12 text-gray-300 mx-auto mb-4" /><p className="text-gray-500">Nenhuma propriedade</p><Button className="mt-4 bg-emerald-600" onClick={() => setOpenNewProp(true)}><Plus className="mr-2 h-4 w-4" /> Cadastrar</Button></CardContent></Card>
                ) : (
                    <div className="space-y-4">{properties.map((prop: any) => (
                        <PropertyCard key={prop.id} property={prop} expanded={expandedProp === prop.id}
                            onToggle={() => setExpandedProp(expandedProp === prop.id ? null : prop.id)}
                            onEdit={() => { setEditProp(prop); setOpenNewProp(true); }}
                            onAddPlot={() => setOpenNewPlot(prop.id)} onEditPlot={(plot: any) => setEditPlot(plot)} />
                    ))}</div>
                )}
            </div>

            {/* DESKTOP: Master-Detail layout */}
            <div className="hidden md:flex h-[calc(100vh-80px)] overflow-hidden">
                {/* Sidebar — lista de propriedades */}
                <div className="w-[280px] min-w-[280px] bg-white border-r border-gray-200 flex flex-col">
                    <div className="p-4 border-b border-gray-100">
                        <h2 className="text-lg font-bold text-gray-800">Propriedades</h2>
                        <p className="text-xs text-gray-400 mt-0.5">{properties.length} propriedades</p>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-emerald-600" /></div> :
                        properties.map((prop: any) => {
                            const isSelected = selectedPropId === prop.id;
                            return (
                                <div key={prop.id}
                                    className={`px-4 py-3 cursor-pointer border-b border-gray-50 transition-colors ${isSelected ? "bg-emerald-50 border-l-[3px] border-l-emerald-600" : "hover:bg-gray-50 border-l-[3px] border-l-transparent"}`}
                                    onClick={() => setSelectedPropId(prop.id)}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isSelected ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-500"}`}>
                                            <MapPin className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className={`text-sm font-semibold truncate ${isSelected ? "text-emerald-800" : "text-gray-700"}`}>{prop.name}</p>
                                            <p className="text-[11px] text-gray-400 truncate">{prop.location || "Sem localizacao"} {prop.totalAreaHa ? `• ${prop.totalAreaHa} ha` : ""}</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="p-3 border-t border-gray-100">
                        <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-sm" onClick={() => { setEditProp(null); setOpenNewProp(true); }}>
                            <Plus className="mr-2 h-4 w-4" /> Nova Propriedade
                        </Button>
                    </div>
                </div>

                {/* Main area — detalhe da propriedade selecionada */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {selectedProp ? (
                        <>
                            {/* Header da propriedade */}
                            <div className="px-6 py-4 bg-white border-b border-gray-100 flex items-center justify-between">
                                <div>
                                    <h2 className="text-xl font-bold text-gray-800">{selectedProp.name}</h2>
                                    <p className="text-sm text-gray-400">{selectedProp.location || "Sem localizacao"} • {totalArea.toFixed(1)} ha • {selectedPlots.length} talhoes</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="sm" onClick={() => { setEditProp(selectedProp); setOpenNewProp(true); }}>
                                        <Edit2 className="mr-1 h-3.5 w-3.5" /> Editar
                                    </Button>
                                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setOpenNewPlot(selectedProp.id)}>
                                        <Plus className="mr-1 h-3.5 w-3.5" /> Novo Talhao
                                    </Button>
                                </div>
                            </div>

                            {/* Mapa + talhoes */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                {/* Mapa grande */}
                                {plotsWithMap.length > 0 && (
                                    <div className="h-[350px] rounded-xl overflow-hidden shadow-sm border border-gray-200">
                                        <Suspense fallback={<div className="h-full bg-gray-100 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-emerald-600" /></div>}>
                                            <MapContainer center={[-25.5, -54.6]} zoom={13} className="h-full w-full" zoomControl={true} attributionControl={false}
                                                dragging={true} touchZoom={true} scrollWheelZoom={true}>
                                                <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
                                                <MapAutoFitPlots plots={plotsWithMap} />
                                                {plotsWithMap.map((plot: any) => {
                                                    const coords = JSON.parse(plot.coordinates);
                                                    const positions = coords.map((c: any) => [c.lat, c.lng] as [number, number]);
                                                    return (
                                                        <Polygon key={plot.id} positions={positions}
                                                            pathOptions={{ color: "#f59e0b", weight: 2, fillOpacity: 0.2, fillColor: "#f59e0b" }}>
                                                            <Popup><div className="text-sm"><strong>{plot.name}</strong><br/>{parseFloat(plot.areaHa || 0).toFixed(1)} ha{plot.crop && <><br/>Cultura: {plot.crop}</>}</div></Popup>
                                                        </Polygon>
                                                    );
                                                })}
                                            </MapContainer>
                                        </Suspense>
                                    </div>
                                )}

                                {/* Grid de talhoes */}
                                <div>
                                    <h3 className="text-sm font-bold text-gray-700 mb-3">Talhoes ({selectedPlots.length})</h3>
                                    {selectedPlots.length === 0 ? (
                                        <div className="text-center py-8 text-gray-400"><MapPin className="w-8 h-8 mx-auto mb-2 text-gray-300" /><p className="text-sm">Nenhum talhao cadastrado</p></div>
                                    ) : (
                                        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                            {selectedPlots.map((plot: any) => {
                                                let coords: any[] = [];
                                                try { coords = plot.coordinates ? JSON.parse(plot.coordinates) : []; } catch { }
                                                const hasMap = coords.length >= 3;
                                                if (hasMap) {
                                                    return <PlotThumbnail key={plot.id} coordinates={coords} name={plot.name} areaHa={plot.areaHa}
                                                        onClick={() => setEditPlot(plot)}
                                                        onMenuClick={() => { if (window.confirm(`Excluir talhao "${plot.name}"?`)) apiRequest("DELETE", `/api/farm/plots/${plot.id}`).then(() => queryClient.invalidateQueries({ queryKey: ["/api/farm/properties", selectedPropId, "plots"] })); }} />;
                                                }
                                                return (
                                                    <div key={plot.id} onClick={() => setEditPlot(plot)}
                                                        className="relative rounded-xl overflow-hidden cursor-pointer shadow-sm hover:shadow-md transition-shadow border border-gray-200 bg-gradient-to-br from-emerald-600 to-emerald-500"
                                                        style={{ paddingBottom: "75%" }}>
                                                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-3">
                                                            <p className="text-white font-bold text-sm">{plot.name}</p>
                                                            <p className="text-white/80 text-xs">{plot.areaHa} ha</p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-gray-400">
                            <div className="text-center"><MapPin className="w-12 h-12 mx-auto mb-3 text-gray-300" /><p>Selecione uma propriedade</p></div>
                        </div>
                    )}
                </div>
            </div>

            {/* Dialog Nova/Editar Propriedade */}
            <Dialog open={openNewProp} onOpenChange={(v) => { setOpenNewProp(v); if (!v) setEditProp(null); }}>
                <DialogContent>
                    <DialogHeader><DialogTitle>{editProp ? "Editar" : "Nova"} Propriedade</DialogTitle></DialogHeader>
                    <PropertyForm initial={editProp} onSave={() => { setOpenNewProp(false); setEditProp(null); queryClient.invalidateQueries({ queryKey: ["/api/farm/properties"] }); }} />
                </DialogContent>
            </Dialog>

            {/* New/Edit Plot — Fullscreen on mobile, centered modal on desktop */}
            {(openNewPlot !== null || editPlot !== null) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm hidden md:block" onClick={() => { setOpenNewPlot(null); setEditPlot(null); }} />
                    <div className="relative w-full h-full md:w-[1200px] md:max-w-[95vw] md:h-[85vh] bg-white md:rounded-xl overflow-hidden flex flex-col md:flex-row shadow-2xl">
                        <button onClick={() => { setOpenNewPlot(null); setEditPlot(null); }}
                            className="hidden md:flex absolute top-3 right-3 z-[1001] w-8 h-8 rounded-full bg-white/80 hover:bg-white items-center justify-center text-lg shadow-md">✕</button>
                        <button onClick={() => { setOpenNewPlot(null); setEditPlot(null); }}
                            className="md:hidden absolute top-3 left-3 z-[1001] flex items-center gap-2 bg-white/90 backdrop-blur-md pl-2 pr-4 py-2 rounded-full shadow-lg text-sm font-bold text-gray-800 active:scale-95 transition-transform">
                            <ChevronRight className="h-5 w-5 rotate-180" /> Voltar
                        </button>
                        <PlotForm
                            propertyId={openNewPlot || editPlot?.propertyId}
                            initial={editPlot}
                            onSave={() => { setOpenNewPlot(null); setEditPlot(null); queryClient.invalidateQueries({ queryKey: ["/api/farm/properties"] }); queryClient.invalidateQueries({ queryKey: ["/api/farm/properties", selectedPropId, "plots"] }); }}
                            onCancel={() => { setOpenNewPlot(null); setEditPlot(null); }}
                        />
                    </div>
                </div>
            )}
        </FarmLayout>
    );
}

function PropertyCard({ property, expanded, onToggle, onEdit, onAddPlot, onEditPlot }: any) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const mapFileInputRef = useRef<HTMLInputElement>(null);
    const [importing, setImporting] = useState(false);

    const handleImportMaps = async (file: File) => {
        setImporting(true);
        try {
            const polygons = await parseMapFile(file);
            if (polygons.length === 0) {
                toast({ title: "Nenhum polígono encontrado", description: "O arquivo não contém áreas delimitadas válidas.", variant: "destructive" });
                return;
            }

            let created = 0;
            for (const polygon of polygons) {
                // Calculate area using geodesic formula (same as Leaflet)
                const areaHa = calculateAreaFromCoords(polygon.coordinates);
                await apiRequest("POST", `/api/farm/properties/${property.id}/plots`, {
                    name: polygon.name,
                    areaHa: String(areaHa),
                    crop: "",
                    coordinates: polygon.coordinates,
                });
                created++;
            }

            queryClient.invalidateQueries({ queryKey: ["/api/farm/properties", property.id, "plots"] });
            toast({ title: "Mapas importados!", description: `${created} talhões criados a partir do arquivo.` });
        } catch (err: any) {
            console.error("Map import error:", err);
            toast({ title: "Erro na importação", description: err.message || "Formato inválido", variant: "destructive" });
        } finally {
            setImporting(false);
        }
    };

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
                        <input
                            type="file"
                            ref={mapFileInputRef}
                            className="hidden"
                            accept=".kml,.kmz,.zip,.xml,.shp"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleImportMaps(file);
                                e.target.value = "";
                            }}
                        />
                        <Button size="sm" variant="outline" onClick={() => mapFileInputRef.current?.click()} disabled={importing}>
                            {importing ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Upload className="mr-1 h-3 w-3" />}
                            {importing ? "Importando..." : "Importar Mapas"}
                        </Button>
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

function useIsMobile() {
    const [mobile, setMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
    useEffect(() => {
        const mq = window.matchMedia("(max-width: 767px)");
        const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
    }, []);
    return mobile;
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
    const isMobile = useIsMobile();

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

    const mapElement = (
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
    );

    if (!isMobile) {
        // ===== DESKTOP: Side-by-side layout =====
        return (
            <div className="flex flex-row w-full h-full">
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
                                            Calculado do mapa
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
                                        <span>Desenhe o contorno do talhão no mapa</span>
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

                <div style={{ flex: 1, position: "relative", background: "#e5e7eb", minHeight: 300 }}>
                    {mapElement}
                </div>
            </div>
        );
    }

    // ===== MOBILE: Fullscreen map + collapsible bottom form =====
    return (
        <div className="flex flex-col w-full h-full relative">
            <div className="flex-1 relative bg-gray-200" style={{ minHeight: 200 }}>
                {mapElement}

                <button
                    onClick={() => setShowForm(!showForm)}
                    className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[100] bg-emerald-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-bold"
                >
                    <Edit2 className="h-4 w-4" />
                    {showForm ? "Ocultar Dados" : "Editar Dados"}
                    <ChevronDown className={`h-4 w-4 transition-transform ${showForm ? "rotate-180" : ""}`} />
                </button>
            </div>

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
                                        <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium">Auto</span>
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
    );
}

