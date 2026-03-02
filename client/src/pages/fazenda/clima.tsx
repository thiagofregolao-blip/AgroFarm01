import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
    CloudRain, Wind, Droplets, Thermometer, Plus, Trash2,
    MapPin, AlignJustify, Search, Target, Loader2, ArrowLeft,
    Cloud, ArrowDown, ArrowUp, History, Calendar, CalendarDays
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format as formatFns } from "date-fns";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix icon paths
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface Station {
    id: string;
    name: string;
    lat: string;
    lng: string;
    currentWeather?: {
        temperature: string;
        windSpeed: string;
        precipitation: string;
        humidity: number;
        clouds: number;
        ts: Date;
    };
}

// Component to handle dynamic map centering
function MapUpdater({ center, zoom }: { center: [number, number], zoom: number }) {
    const map = useMap();
    useEffect(() => {
        map.flyTo(center, zoom, { animate: true, duration: 2 });
    }, [center, zoom, map]);
    return null;
}

export default function FazendaClima() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const [isCreatingMode, setIsCreatingMode] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState<{ lat: number, lng: number } | null>(null);
    const [newStationName, setNewStationName] = useState("");
    const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
    const [mapCenter, setMapCenter] = useState<[number, number]>([-15.793889, -47.882778]); // Default Brazil
    const [mapZoom, setMapZoom] = useState<number>(6); // Default Macro Zoom
    const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Make sidebar responsive

    // Geolocation hook to center the user automatically on mount or when the farm API loads
    useEffect(() => {
        // Only run this effectively once initially logic for profile coords
        if (user && user.farmLatitude && user.farmLongitude) {
            setMapCenter([parseFloat(String(user.farmLatitude)), parseFloat(String(user.farmLongitude))]);
            setMapZoom(13); // Deep zoom for physical farm
        }
        else if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setMapCenter([position.coords.latitude, position.coords.longitude]);
                    setMapZoom(13); // Device found, dive in
                },
                (error) => {
                    console.error("Erro ao obter localização do usuário:", error);
                    setMapZoom(6); // Default macro to show country and not lose stations
                },
                { enableHighAccuracy: true, timeout: 5000 }
            );
        } else {
            setMapZoom(6);
        }
    }, [user?.farmLatitude, user?.farmLongitude]);

    // Removed MapUpdater component since it forced centering on state changes


    const { data: stations = [], isLoading } = useQuery<Station[]>({
        queryKey: ["/api/farm/weather/stations"],
    });

    // Fly to station when selected from sidebar or map
    useEffect(() => {
        if (selectedStationId && stations.length > 0) {
            const station = stations.find(s => s.id === selectedStationId);
            if (station && station.lat && station.lng) {
                setMapCenter([parseFloat(station.lat), parseFloat(station.lng)]);
                setMapZoom(16); // High zoom to see the station closely
            }
        }
    }, [selectedStationId, stations]);

    const createMutation = useMutation({
        mutationFn: async (data: { name: string; lat: number; lng: number }) => {
            const res = await fetch("/api/farm/weather/stations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error("Falha ao criar estação");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/weather/stations"] });
            setIsCreatingMode(false);
            setSelectedLocation(null);
            setNewStationName("");
            toast({ title: "Estação criada com sucesso!" });
        },
    });

    const handleCreateStation = () => {
        if (!selectedLocation || !newStationName) return;
        createMutation.mutate({
            name: newStationName,
            lat: selectedLocation.lat,
            lng: selectedLocation.lng,
        });
    };

    function MapEvents() {
        useMapEvents({
            click(e) {
                if (isCreatingMode) {
                    setSelectedLocation(e.latlng);
                }
            },
        });
        return null;
    }

    // Custom Component for My Location Button
    function LocateControl() {
        const map = useMap();
        return (
            <div className="leaflet-top leaflet-right" style={{ zIndex: 1000, position: 'absolute', top: 10, right: 10 }}>
                <div className="leaflet-control leaflet-bar">
                    <button
                        className="bg-white flex items-center justify-center w-10 h-10 hover:bg-gray-100 transition-colors cursor-pointer"
                        title="Minha Localização (Perfil ou GPS)"
                        onClick={(e) => {
                            e.preventDefault();
                            if (user && user.farmLatitude && user.farmLongitude) {
                                const latlng: [number, number] = [parseFloat(String(user.farmLatitude)), parseFloat(String(user.farmLongitude))];
                                setMapCenter(latlng);
                                setMapZoom(14);
                                toast({ title: "Centralizado na sua fazenda cadastrada!" });
                            } else if ("geolocation" in navigator) {
                                navigator.geolocation.getCurrentPosition(
                                    (position) => {
                                        const latlng: [number, number] = [position.coords.latitude, position.coords.longitude];
                                        setMapCenter(latlng);
                                        setMapZoom(14);
                                        toast({ title: "Centralizado no GPS do navegador!" });
                                    },
                                    (error) => {
                                        console.error("Erro GPS:", error);
                                        toast({ title: "Erro", description: "Cadastre as coordenadas no seu perfil ou permita o GPS do navegador.", variant: "destructive" });
                                    }
                                );
                            } else {
                                toast({ title: "Erro", description: "Nenhuma coordenada disponível.", variant: "destructive" });
                            }
                        }}
                    >
                        <Target className="h-5 w-5 text-blue-600" />
                    </button>
                </div>
            </div>
        );
    }

    // Custom DivIcon for Weather Marker (OneSoil Style Pill)
    const createWeatherIcon = (station: Station) => {
        const temp = station.currentWeather?.temperature
            ? Math.round(parseFloat(station.currentWeather.temperature))
            : '--';
        const wind = station.currentWeather?.windSpeed
            ? (parseFloat(station.currentWeather.windSpeed) * 3.6).toFixed(1)
            : '--';

        return new L.DivIcon({
            className: 'custom-weather-marker',
            html: `
        <div class="relative bg-white rounded-3xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.3)] border border-border/50 px-3 py-1.5 flex flex-col items-center justify-center min-w-[70px] -ml-9 -mt-16">
          <div class="flex items-center gap-1.5 text-foreground font-bold leading-none mb-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sun text-yellow-500"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
            <span class="text-[15px] tracking-tight">${temp}°</span>
          </div>
          <div class="flex items-center gap-1 text-[11px] font-medium text-muted-foreground leading-none whitespace-nowrap">
            ${wind} km/h <span class="text-[10px] transform rotate-45">↘</span>
          </div>
          <div class="absolute -bottom-[6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-b border-r border-border/50 transform rotate-45 rounded-sm"></div>
        </div>
      `,
            iconSize: [70, 60],
            iconAnchor: [0, 0],
        });
    };

    return (
        <div className="flex flex-col md:flex-row w-full h-[100dvh] bg-background relative overflow-hidden">
            {/* Mobile Top Actions (Back + Menu) - hidden when dashboard is open */}
            <div className={`md:hidden absolute top-4 left-4 z-[1000] flex gap-2 ${selectedStationId ? 'hidden' : ''}`}>
                <Link href="/fazenda">
                    <Button variant="secondary" size="icon" className="h-10 w-10 rounded-full shadow-lg bg-white hover:bg-white text-emerald-800 pointer-events-auto">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <Button
                    variant="secondary"
                    size="icon"
                    className="h-10 w-10 rounded-full shadow-lg bg-white hover:bg-white text-emerald-800 pointer-events-auto"
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                >
                    <AlignJustify className="h-5 w-5" />
                </Button>
            </div>

            {/* Sidebar Overlay background for mobile */}
            {isSidebarOpen && (
                <div
                    className="md:hidden fixed inset-0 bg-black/50 z-[100]"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar for List/Search */}
            <div className={`
                ${isSidebarOpen ? 'flex' : 'hidden'} 
                md:flex w-80 max-w-[85vw] border-r bg-card flex-col shadow-xl 
                fixed md:relative inset-y-0 left-0 z-[101] md:z-10 transition-transform duration-300
            `}>
                <div className="p-4 border-b flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Link href="/fazenda" className="hidden md:flex mr-2">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                        </Link>
                        <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-green-600 bg-clip-text text-transparent">Minhas Estações</h1>
                    </div>
                    {/* Mobile close sidebar button */}
                    <div className="md:hidden">
                        <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(false)}>
                            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
                        </Button>
                    </div>
                </div>

                <div className="p-4 space-y-4">
                    {!isCreatingMode ? (
                        <Button
                            className="w-full gap-2 shadow-md hover:shadow-lg transition-all"
                            onClick={() => setIsCreatingMode(true)}
                        >
                            <Plus className="h-4 w-4" />
                            Adicionar Estação Virtual
                        </Button>
                    ) : (
                        <div className="space-y-3 bg-muted/50 p-4 rounded-lg border border-primary/20">
                            <h3 className="text-sm font-medium text-primary flex items-center gap-2">
                                <Target className="h-4 w-4" /> Modo Criação
                            </h3>
                            <p className="text-xs text-muted-foreground">
                                1. Clique no mapa para definir a localização exata da estação.
                            </p>
                            <Input
                                placeholder="Nome da estação (Ex: Talhão 1)"
                                value={newStationName}
                                onChange={(e) => setNewStationName(e.target.value)}
                            />
                            <div className="flex gap-2">
                                <Button
                                    disabled={!selectedLocation || !newStationName || createMutation.isPending}
                                    onClick={handleCreateStation}
                                    className="flex-1"
                                >
                                    {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                                    Salvar
                                </Button>
                                <Button variant="outline" onClick={() => {
                                    setIsCreatingMode(false);
                                    setSelectedLocation(null);
                                }}>
                                    Cancelar
                                </Button>
                            </div>
                        </div>
                    )}

                    <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Buscar localização..." className="pl-9 bg-background/50" />
                    </div>
                </div>

                <ScrollArea className="flex-1 p-4">
                    <div className="space-y-3">
                        {isLoading ? (
                            <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                        ) : stations.length === 0 ? (
                            <div className="text-center p-8 text-muted-foreground border border-dashed rounded-lg bg-background/50">
                                <CloudRain className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">Nenhuma estação virtual cadastrada.</p>
                            </div>
                        ) : (
                            stations.map((station) => (
                                <Card
                                    key={station.id}
                                    className="p-3 cursor-pointer hover:border-primary/50 transition-colors shadow-sm"
                                    onClick={() => {
                                        setSelectedStationId(station.id);
                                        if (window.innerWidth < 768) setIsSidebarOpen(false); // auto close mobile drawer when selecting card
                                    }}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-semibold text-sm truncate">{station.name}</h4>
                                        {station.currentWeather && (
                                            <div className="text-primary font-bold text-lg">
                                                {Math.round(parseFloat(station.currentWeather.temperature))}°
                                            </div>
                                        )}
                                    </div>
                                    {station.currentWeather && (
                                        <>
                                            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mt-2 bg-muted/50 p-2 rounded">
                                                <div className="flex items-center gap-1"><Wind className="h-3 w-3" /> {(parseFloat(station.currentWeather.windSpeed) * 3.6).toFixed(1)} km/h</div>
                                                <div className="flex items-center gap-1"><Droplets className="h-3 w-3" /> {station.currentWeather.humidity}%</div>
                                            </div>
                                            <p className="text-[9px] text-muted-foreground/50 mt-1.5">
                                                {formatFns(new Date(station.currentWeather.ts), "dd/MM HH:mm")}
                                            </p>
                                        </>
                                    )}
                                </Card>
                            ))
                        )}
                    </div>
                </ScrollArea>
            </div>

            {/* Main Map Area */}
            <div className="flex-1 relative z-0">
                <MapContainer
                    center={mapCenter}
                    zoom={mapZoom}
                    style={{ height: '100%', width: '100%' }}
                    zoomControl={false}
                >
                    <MapUpdater center={mapCenter} zoom={mapZoom} />
                    {/* Imagem de Satélite base */}
                    <TileLayer
                        attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
                        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    />
                    {/* Layer de Labels Híbrido (Somente Fronteiras e Nomes de Cidades principais, sem poluir com estradas) */}
                    <TileLayer
                        url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                    />
                    <LocateControl />
                    <MapEvents />

                    {selectedLocation && (
                        <Marker position={[selectedLocation.lat, selectedLocation.lng]} />
                    )}

                    {stations.map(station => (
                        <Marker
                            key={station.id}
                            position={[parseFloat(station.lat), parseFloat(station.lng)]}
                            icon={createWeatherIcon(station)}
                            eventHandlers={{
                                click: () => setSelectedStationId(station.id),
                            }}
                        />
                    ))}
                </MapContainer>

                {/* Creating Crosshair Overlay */}
                {isCreatingMode && !selectedLocation && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10 bg-black/10">
                        <Target className="h-12 w-12 text-primary drop-shadow-lg opacity-50 animate-pulse" />
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-10 bg-background/90 text-primary px-4 py-2 rounded-full text-sm font-medium shadow-xl border border-primary/20 backdrop-blur-sm">
                            Clique no mapa para posicionar a estação
                        </div>
                    </div>
                )}
            </div>

            {/* Dashboard Modal */}
            {selectedStationId && (
                <StationDashboard
                    stationId={selectedStationId}
                    onClose={() => setSelectedStationId(null)}
                />
            )}
        </div>
    );
}

// Subcomponente do Dashboard da Estação
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area,
    BarChart, Bar
} from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function StationDashboard({ stationId, onClose }: { stationId: string, onClose: () => void }) {
    const { data, isLoading } = useQuery<any>({
        queryKey: [`/api/farm/weather/stations/${stationId}/dashboard`],
    });

    const queryClient = useQueryClient();
    const { toast } = useToast();

    // Historico de chuva local state
    const [historyDays, setHistoryDays] = useState("30");
    const { data: rainHistory, isLoading: isLoadingHistory } = useQuery<any[]>({
        queryKey: [`/api/farm/weather/stations/${stationId}/history`, historyDays],
        queryFn: async () => {
            const res = await fetch(`/api/farm/weather/stations/${stationId}/history?days=${historyDays}`);
            return res.json();
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/farm/weather/stations/${stationId}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Falha ao deletar estação");
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Estação virtual excluída com sucesso." });
            queryClient.invalidateQueries({ queryKey: ["/api/farm/weather/stations"] });
            onClose();
        }
    });

    if (isLoading) {
        return (
            <div className="absolute inset-y-0 right-0 w-full md:w-96 bg-card border-l shadow-2xl z-50 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!data) return null;

    const { station, charts, sprayWindow, forecast, gdd, lastUpdate } = data;

    const lastUpdateStr = lastUpdate
        ? formatFns(new Date(lastUpdate), "dd/MM HH:mm")
        : null;

    return (
        <div className="absolute inset-y-0 right-0 w-full md:w-[450px] bg-background border-l shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ease-in-out font-sans">
            <div className="p-4 border-b flex items-center justify-between bg-card">
                <div>
                    <h2 className="text-xl font-bold bg-gradient-to-r from-primary to-green-600 bg-clip-text text-transparent">
                        {station.name}
                    </h2>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        Lat: {parseFloat(station.lat).toFixed(4)}, Lng: {parseFloat(station.lng).toFixed(4)}
                    </p>
                    {lastUpdateStr && (
                        <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                            Atualizado: {lastUpdateStr}
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => {
                            if (window.confirm("Deseja realmente excluir esta estação virtual?")) {
                                deleteMutation.mutate();
                            }
                        }}
                        className="rounded-full shadow-sm"
                        disabled={deleteMutation.isPending}
                    >
                        {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full bg-muted/50 hover:bg-muted">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <ScrollArea className="flex-1 p-4">
                <div className="space-y-6 pb-20">

                    {/* Janela de Pulverização (O Pulo do Gato 1) */}
                    <section>
                        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-foreground">
                            <Target className="h-4 w-4 text-primary" /> Janela de Pulverização (Hoje)
                        </h3>
                        <div className="grid grid-cols-4 gap-2">
                            {sprayWindow?.map((item: any, idx: number) => (
                                <div
                                    key={idx}
                                    className={`p-2 rounded-lg border text-center relative group cursor-help transition-colors ${item.status === 'GREEN' ? 'bg-green-100 border-green-200 text-green-800 dark:bg-green-900/30 dark:border-green-800 dark:text-green-300' :
                                        item.status === 'YELLOW' ? 'bg-yellow-100 border-yellow-200 text-yellow-800 dark:bg-yellow-900/30 dark:border-yellow-800 dark:text-yellow-300' :
                                            'bg-red-100 border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300'
                                        }`}
                                >
                                    <div className="text-xs font-bold">{item.time}</div>
                                    <div className="absolute invisible group-hover:visible z-50 bg-popover text-popover-foreground text-xs p-2 rounded shadow-lg -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap border">
                                        {item.reason}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-2 text-center">
                            Baseado em regras agronômicas de Vento, Umidade e Chuva.
                        </p>
                    </section>

                    {/* Acumulado de Chuva + GDD */}
                    <div className="grid grid-cols-2 gap-4">
                        <Dialog>
                            <DialogTrigger asChild>
                                <Card className="p-4 bg-blue-50/50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900 shadow-sm cursor-pointer hover:bg-blue-100/50 transition-colors group relative overflow-hidden">
                                    <div className="absolute top-2 right-2 p-1.5 bg-blue-100 dark:bg-blue-900 rounded-full text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <History className="h-3 w-3" />
                                    </div>
                                    <h3 className="text-xs font-semibold text-blue-800 dark:text-blue-300 mb-1">Chuva Acumulada</h3>
                                    <p className="text-[10px] text-blue-600/70 dark:text-blue-400/70 mb-2">Últimos 30 dias</p>
                                    <div className="flex items-end gap-1">
                                        <span className="text-2xl font-black text-blue-600 dark:text-blue-400 leading-none">{data.accumulatedRain || 0}</span>
                                        <span className="text-sm font-semibold text-blue-600/70 dark:text-blue-400/70 leading-none pb-0.5">mm</span>
                                    </div>
                                </Card>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[600px]">
                                <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2">
                                        <CalendarDays className="h-5 w-5 text-blue-500" /> Histórico de Chuvas (Estação)
                                    </DialogTitle>
                                    <DialogDescription>
                                        Consulte os dados de precipitação capturados por esta estação.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium">Período de Análise</span>
                                        <Select value={historyDays} onValueChange={setHistoryDays}>
                                            <SelectTrigger className="w-[180px]">
                                                <SelectValue placeholder="Selecione..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="7">Últimos 7 dias</SelectItem>
                                                <SelectItem value="15">Últimos 15 dias</SelectItem>
                                                <SelectItem value="30">Últimos 30 dias</SelectItem>
                                                <SelectItem value="90">Últimos 90 dias</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Gráfico */}
                                    <div className="h-[300px] w-full mt-4 border rounded-xl p-4 bg-slate-50/50 dark:bg-slate-900/50">
                                        {isLoadingHistory ? (
                                            <div className="h-full w-full flex items-center justify-center">
                                                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                                            </div>
                                        ) : rainHistory && rainHistory.length > 0 ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={rainHistory}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                                                    <XAxis
                                                        dataKey="date"
                                                        tickFormatter={(val) => {
                                                            const parts = val.split('-');
                                                            if (parts.length !== 3) return val;
                                                            return `${parts[2]}/${parts[1]}`;
                                                        }}
                                                        axisLine={false}
                                                        tickLine={false}
                                                        tick={{ fontSize: 11 }}
                                                        dy={10}
                                                    />
                                                    <YAxis
                                                        axisLine={false}
                                                        tickLine={false}
                                                        tick={{ fontSize: 11 }}
                                                        dx={-10}
                                                        tickFormatter={(val) => `${val}mm`}
                                                    />
                                                    <RechartsTooltip
                                                        cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
                                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                                                        labelFormatter={(label) => {
                                                            const parts = String(label).split('-');
                                                            if (parts.length !== 3) return label;
                                                            return `${parts[2]}/${parts[1]}/${parts[0]}`;
                                                        }}
                                                        formatter={(value: number) => [`${value} mm`, 'Chuva']}
                                                    />
                                                    <Bar dataKey="precipitation" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <div className="h-full w-full flex flex-col items-center justify-center text-muted-foreground">
                                                <CloudRain className="h-8 w-8 mb-2 opacity-20" />
                                                <p className="text-sm">Nenhum registro de chuva encontrado neste período.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>

                        <Card className="p-4 bg-orange-50/50 dark:bg-orange-950/20 border-orange-100 dark:border-orange-900 shadow-sm">
                            <h3 className="text-xs font-semibold text-orange-800 dark:text-orange-300 mb-1">GDD Acumulado</h3>
                            <p className="text-[10px] text-orange-600/70 dark:text-orange-400/70 mb-2">Últimos 90 dias (base 10°C)</p>
                            <div className="flex items-end mb-2 gap-1">
                                <span className="text-2xl font-black text-orange-600 dark:text-orange-400 leading-none">{gdd || 0}</span>
                                <span className="text-sm font-semibold text-orange-600/70 dark:text-orange-400/70 leading-none pb-0.5">°D</span>
                            </div>
                            <p className="text-[9px] text-orange-500/60 dark:text-orange-400/50">
                                Soja: ~1300°D | Milho: ~1600°D | Trigo: ~1100°D
                            </p>
                        </Card>
                    </div>

                    {/* Previsão 24h - OneSoil Style Cards */}
                    <section className="space-y-4">
                        <h3 className="text-sm font-semibold text-foreground border-b pb-2">Previsão 24h</h3>

                        {(() => {
                            const getTimeTicks = (data: any[]) => {
                                if (!data || data.length < 3) return [];
                                return [data[0]?.time, data[Math.floor(data.length / 2)]?.time, data[data.length - 1]?.time];
                            };
                            const firstTime = charts.temperatures?.[0]?.time;
                            const formatTick = (val: string) => val === firstTime ? 'Agora' : val;
                            const dewPointData = charts.temperatures?.map((t: any, i: number) => ({
                                time: t.time,
                                value: Math.round(t.value - ((100 - (charts.humidity?.[i]?.value || 50)) / 5))
                            }));
                            const currentDewPoint = dewPointData?.[0]?.value ?? '--';

                            const chartCardStyle = "p-3 shadow-sm border bg-card hover:bg-muted/30 transition-colors";
                            const tooltipStyle = { fontSize: '10px', padding: '2px 6px', borderRadius: '6px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' };

                            return (
                                <div className="grid grid-cols-2 gap-3">
                                    {/* Temperatura */}
                                    <Card className={chartCardStyle}>
                                        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
                                            <Thermometer className="h-3.5 w-3.5 text-orange-500" /> Temperatura
                                        </div>
                                        <span className="text-lg font-bold text-foreground leading-none">{charts.temperatures?.[0]?.value || '--'}°C</span>
                                        <div className="h-14 w-full mt-2">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={charts.temperatures}>
                                                    <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#9ca3af' }} ticks={getTimeTicks(charts.temperatures)} tickFormatter={formatTick} />
                                                    <Area type="monotone" dataKey="value" stroke="#f97316" fill="#fb923c" fillOpacity={0.15} strokeWidth={2} dot={false} />
                                                    <RechartsTooltip contentStyle={tooltipStyle} cursor={{ stroke: '#f97316', strokeWidth: 1, strokeDasharray: '3 3' }} formatter={(v: number) => [`${v}°C`, 'Temp']} />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </Card>

                                    {/* Precipitação */}
                                    <Card className={chartCardStyle}>
                                        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
                                            <CloudRain className="h-3.5 w-3.5 text-blue-500" /> Precipitação
                                        </div>
                                        <span className="text-lg font-bold text-foreground leading-none">{charts.precipitation?.[0]?.value || '0'} mm</span>
                                        <div className="h-14 w-full mt-2">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={charts.precipitation}>
                                                    <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#9ca3af' }} ticks={getTimeTicks(charts.precipitation)} tickFormatter={formatTick} />
                                                    <Area type="monotone" dataKey="value" stroke="#3b82f6" fill="#60a5fa" fillOpacity={0.15} strokeWidth={2} dot={false} />
                                                    <RechartsTooltip contentStyle={tooltipStyle} cursor={{ stroke: '#3b82f6', strokeWidth: 1, strokeDasharray: '3 3' }} formatter={(v: number) => [`${v} mm`, 'Chuva']} />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </Card>

                                    {/* Ventos */}
                                    <Card className={chartCardStyle}>
                                        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
                                            <Wind className="h-3.5 w-3.5 text-slate-500" /> Ventos
                                        </div>
                                        <span className="text-lg font-bold text-foreground leading-none">{charts.wind?.[0]?.value || '--'} km/h</span>
                                        <div className="h-14 w-full mt-2">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={charts.wind}>
                                                    <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#9ca3af' }} ticks={getTimeTicks(charts.wind)} tickFormatter={formatTick} />
                                                    <Area type="monotone" dataKey="value" stroke="#64748b" fill="#94a3b8" fillOpacity={0.15} strokeWidth={2} dot={false} />
                                                    <RechartsTooltip contentStyle={tooltipStyle} cursor={{ stroke: '#64748b', strokeWidth: 1, strokeDasharray: '3 3' }} formatter={(v: number) => [`${v} km/h`, 'Vento']} />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </Card>

                                    {/* Cobertura de nuvens */}
                                    <Card className={chartCardStyle}>
                                        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
                                            <Cloud className="h-3.5 w-3.5 text-gray-400" /> Cobertura de nuvens
                                        </div>
                                        <span className="text-lg font-bold text-foreground leading-none">{charts.clouds?.[0]?.value || '--'}%</span>
                                        <div className="h-14 w-full mt-2">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={charts.clouds}>
                                                    <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#9ca3af' }} ticks={getTimeTicks(charts.clouds)} tickFormatter={formatTick} />
                                                    <Area type="step" dataKey="value" stroke="#9ca3af" fill="#d1d5db" fillOpacity={0.15} strokeWidth={2} dot={false} />
                                                    <RechartsTooltip contentStyle={tooltipStyle} cursor={{ stroke: '#9ca3af', strokeWidth: 1, strokeDasharray: '3 3' }} formatter={(v: number) => [`${v}%`, 'Nuvens']} />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </Card>

                                    {/* Umidade */}
                                    <Card className={chartCardStyle}>
                                        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
                                            <Droplets className="h-3.5 w-3.5 text-cyan-500" /> Umidade
                                        </div>
                                        <span className="text-lg font-bold text-foreground leading-none">{charts.humidity?.[0]?.value || '--'}%</span>
                                        <div className="h-14 w-full mt-2">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={charts.humidity}>
                                                    <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#9ca3af' }} ticks={getTimeTicks(charts.humidity)} tickFormatter={formatTick} />
                                                    <Area type="monotone" dataKey="value" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.15} strokeWidth={2} dot={false} />
                                                    <RechartsTooltip contentStyle={tooltipStyle} cursor={{ stroke: '#06b6d4', strokeWidth: 1, strokeDasharray: '3 3' }} formatter={(v: number) => [`${v}%`, 'Umidade']} />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </Card>

                                    {/* Ponto de orvalho */}
                                    <Card className={chartCardStyle}>
                                        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
                                            <Droplets className="h-3.5 w-3.5 text-teal-500" /> Ponto de orvalho
                                        </div>
                                        <span className="text-lg font-bold text-foreground leading-none">{currentDewPoint}°C</span>
                                        <div className="h-14 w-full mt-2">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={dewPointData}>
                                                    <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#9ca3af' }} ticks={getTimeTicks(dewPointData)} tickFormatter={formatTick} />
                                                    <Area type="monotone" dataKey="value" stroke="#14b8a6" fill="#14b8a6" fillOpacity={0.15} strokeWidth={2} dot={false} />
                                                    <RechartsTooltip contentStyle={tooltipStyle} cursor={{ stroke: '#14b8a6', strokeWidth: 1, strokeDasharray: '3 3' }} formatter={(v: number) => [`${v}°C`, 'Ponto de orvalho']} />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </Card>
                                </div>
                            );
                        })()}</section>

                    {/* Previsão para os próximos dias */}
                    <section>
                        <h3 className="text-sm font-semibold text-foreground border-b pb-2 mb-3">Previsão para os próximos dias</h3>
                        <div className="space-y-1">
                            {forecast?.length > 0 ? forecast.map((day: any, idx: number) => {
                                const dateObj = new Date(day.date + 'T12:00:00Z');
                                const isToday = new Date().toDateString() === dateObj.toDateString();
                                const dayName = isToday ? 'Hoje' : (day.dayName || format(dateObj, 'eee', { locale: ptBR }).replace('.', ''));

                                return (
                                    <div key={idx} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border">
                                        <div className="flex items-center w-16">
                                            <span className="text-[13px] font-semibold capitalize text-foreground">
                                                {dayName}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-4 flex-1 justify-center">
                                            <div className="flex items-center gap-1 w-14 text-blue-500">
                                                {day.rain > 0 ? (
                                                    <>
                                                        <Droplets className="h-3 w-3 fill-current" />
                                                        <span className="text-[11px] font-medium">{day.rain} mm</span>
                                                    </>
                                                ) : null}
                                            </div>

                                            <div className="flex items-center gap-1 w-20 text-muted-foreground">
                                                <ArrowDown className="h-3 w-3 transform rotate-45" />
                                                <span className="text-[11px] font-medium">{day.windKmh} km/h</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-end gap-2 text-[13px] font-medium">
                                            <span className="text-muted-foreground">{day.minTemp}°</span>
                                            <div className="w-8 h-1 rounded-full bg-gradient-to-r from-blue-400 to-orange-500 opacity-80"></div>
                                            <span className="text-foreground">{day.maxTemp}°</span>
                                        </div>
                                    </div>
                                );
                            }) : (
                                <p className="text-xs text-muted-foreground text-center py-4">Sem dados de previsão disponíveis.</p>
                            )}
                        </div>
                    </section>

                </div>
            </ScrollArea>
        </div>
    );
}
