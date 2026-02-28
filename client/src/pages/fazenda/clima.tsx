import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
    CloudRain, Wind, Droplets, Thermometer, Plus,
    MapPin, AlignJustify, Search, Target, Loader2, ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
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
        clouds: number;
        ts: Date;
    };
}

export default function FazendaClima() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [isCreatingMode, setIsCreatingMode] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState<{ lat: number, lng: number } | null>(null);
    const [newStationName, setNewStationName] = useState("");
    const [selectedStationId, setSelectedStationId] = useState<string | null>(null);

    const { data: stations = [], isLoading } = useQuery<Station[]>({
        queryKey: ["/api/farm/weather/stations"],
    });

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

    // Custom DivIcon for Weather Marker
    const createWeatherIcon = (station: Station) => {
        const temp = station.currentWeather?.temperature
            ? Math.round(parseFloat(station.currentWeather.temperature))
            : '--';
        const wind = station.currentWeather?.windSpeed
            ? parseFloat(station.currentWeather.windSpeed).toFixed(1)
            : '--';

        return new L.DivIcon({
            className: 'custom-weather-marker',
            html: `
        <div class="bg-white rounded-lg shadow-lg border border-border p-2 flex flex-col items-center min-w-[80px] -ml-10 -mt-20">
          <div class="text-xs font-semibold truncate w-full text-center text-muted-foreground mb-1">${station.name}</div>
          <div class="flex items-center gap-2 text-primary font-bold">
            <span class="text-lg">${temp}°</span>
          </div>
          <div class="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-wind"><path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/></svg>
            ${wind} m/s
          </div>
          <div class="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-b border-r border-border transform rotate-45"></div>
        </div>
      `,
            iconSize: [80, 80],
            iconAnchor: [0, 0],
        });
    };

    return (
        <div className="flex h-screen bg-background relative overflow-hidden">
            {/* Sidebar for List/Search */}
            <div className="w-80 border-r bg-card flex flex-col z-10 shadow-xl relative">
                <div className="p-4 border-b flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Link href="/dashboard" className="mr-2">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                        </Link>
                        <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-green-600 bg-clip-text text-transparent">Minhas Estações</h1>
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
                                    onClick={() => setSelectedStationId(station.id)}
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
                                        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mt-2 bg-muted/50 p-2 rounded">
                                            <div className="flex items-center gap-1"><Wind className="h-3 w-3" /> {parseFloat(station.currentWeather.windSpeed).toFixed(1)} m/s</div>
                                            <div className="flex items-center gap-1"><Droplets className="h-3 w-3" /> {station.currentWeather.humidity}%</div>
                                        </div>
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
                    center={[-15.793889, -47.882778]} // Brazil center
                    zoom={4}
                    style={{ height: '100%', width: '100%' }}
                    zoomControl={false}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    />
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
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area
} from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function StationDashboard({ stationId, onClose }: { stationId: string, onClose: () => void }) {
    const { data, isLoading } = useQuery<any>({
        queryKey: [`/api/farm/weather/stations/${stationId}/dashboard`],
    });

    if (isLoading) {
        return (
            <div className="absolute inset-y-0 right-0 w-96 bg-card border-l shadow-2xl z-50 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!data) return null;

    const { station, charts, sprayWindow, forecast, gdd } = data;

    return (
        <div className="absolute inset-y-0 right-0 w-[450px] bg-background border-l shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ease-in-out font-sans">
            <div className="p-4 border-b flex items-center justify-between bg-card">
                <div>
                    <h2 className="text-xl font-bold bg-gradient-to-r from-primary to-green-600 bg-clip-text text-transparent">
                        {station.name}
                    </h2>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        Lat: {parseFloat(station.lat).toFixed(4)}, Lng: {parseFloat(station.lng).toFixed(4)}
                    </p>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full bg-muted/50 hover:bg-muted">
                    <ArrowLeft className="h-4 w-4" />
                </Button>
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

                    {/* GDD Acumulado (O Pulo do Gato 2) */}
                    <section>
                        <Card className="p-4 bg-gradient-to-br from-card to-muted/50 border-primary/20">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h3 className="text-sm font-semibold text-foreground">Graus-Dia Acumulados (GDD)</h3>
                                    <p className="text-xs text-muted-foreground">Ciclo da Safra Atual</p>
                                </div>
                                <div className="bg-primary/10 text-primary px-2 py-1 rounded text-xs font-bold">
                                    {gdd} / 1600
                                </div>
                            </div>
                            <div className="w-full bg-secondary rounded-full h-2.5 mt-4 overflow-hidden">
                                <div className="bg-primary h-2.5 rounded-full" style={{ width: `${Math.min((gdd / 1600) * 100, 100)}%` }}></div>
                            </div>
                        </Card>
                    </section>

                    {/* Minigráficos (Sparklines Recharts) */}
                    <section className="space-y-4">
                        <h3 className="text-sm font-semibold text-foreground border-b pb-2">Previsão 24h</h3>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Temp */}
                            <Card className="p-3 shadow-none border-dashed bg-background/50">
                                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                                    <Thermometer className="h-3 w-3 text-orange-500" /> Temperatura
                                </div>
                                <div className="h-20 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={charts.temperatures}>
                                            <Area type="monotone" dataKey="value" stroke="#f97316" fill="#f97316" fillOpacity={0.2} />
                                            <RechartsTooltip contentStyle={{ fontSize: '10px', padding: '2px 4px' }} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </Card>

                            {/* Chuva */}
                            <Card className="p-3 shadow-none border-dashed bg-background/50">
                                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                                    <CloudRain className="h-3 w-3 text-blue-500" /> Precipitação
                                </div>
                                <div className="h-20 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={charts.precipitation}>
                                            <Area type="monotone" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                                            <RechartsTooltip contentStyle={{ fontSize: '10px', padding: '2px 4px' }} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </Card>

                            {/* Vento */}
                            <Card className="p-3 shadow-none border-dashed bg-background/50">
                                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                                    <Wind className="h-3 w-3 text-gray-500" /> Vento (km/h)
                                </div>
                                <div className="h-20 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={charts.wind}>
                                            <Line type="monotone" dataKey="value" stroke="#6b7280" strokeWidth={2} dot={false} />
                                            <RechartsTooltip contentStyle={{ fontSize: '10px', padding: '2px 4px' }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </Card>

                            {/* Umidade */}
                            <Card className="p-3 shadow-none border-dashed bg-background/50">
                                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                                    <Droplets className="h-3 w-3 text-cyan-500" /> Umidade (%)
                                </div>
                                <div className="h-20 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={charts.humidity}>
                                            <Area type="monotone" dataKey="value" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.2} />
                                            <RechartsTooltip contentStyle={{ fontSize: '10px', padding: '2px 4px' }} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </Card>
                        </div>
                    </section>

                    {/* Lista de Previsão 5 Dias */}
                    <section>
                        <h3 className="text-sm font-semibold text-foreground border-b pb-2 mb-3">Próximos Dias</h3>
                        <div className="space-y-2">
                            {forecast?.map((day: string, idx: number) => {
                                const dateObj = new Date(day);
                                return (
                                    <div key={idx} className="flex items-center justify-between p-2 rounded hover:bg-muted/50 transition-colors">
                                        <span className="text-sm font-medium capitalize w-24">
                                            {format(dateObj, 'EEEE', { locale: ptBR })}
                                        </span>
                                        <div className="flex gap-4 items-center">
                                            <span className="text-muted-foreground text-xs">{format(dateObj, 'dd/MM')}</span>
                                            <CloudRain className="h-4 w-4 text-primary opacity-50" />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                </div>
            </ScrollArea>
        </div>
    );
}
