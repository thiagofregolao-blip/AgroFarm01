
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import FarmLayout from "@/components/fazenda/layout";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Save, User, Plus, Trash2, Users, MapPin, Bell } from "lucide-react";
import { useEffect, useState } from "react";

const profileSchema = z.object({
    name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
    whatsapp_number: z.string().refine((val) => {
        if (!val) return true;
        const clean = val.replace(/\D/g, "");
        return clean.length >= 10 && clean.length <= 15;
    }, "Número inválido. Use o formato com DDD (ex: 5543999999999)").optional().or(z.literal("")),
    farm_city: z.string().optional().or(z.literal("")),
    farm_latitude: z.string().optional().or(z.literal("")),
    farm_longitude: z.string().optional().or(z.literal("")),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export default function FarmProfile() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [extraNumbers, setExtraNumbers] = useState<string[]>([]);
    const [bulletinEnabled, setBulletinEnabled] = useState(true);

    const form = useForm<ProfileFormData>({
        resolver: zodResolver(profileSchema),
        defaultValues: {
            name: "",
            whatsapp_number: "",
            farm_city: "",
            farm_latitude: "",
            farm_longitude: "",
        },
    });

    const { data: profile, isLoading } = useQuery({
        queryKey: ["/api/farm/me"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/farm/me");
            return res.json();
        },
    });

    useEffect(() => {
        if (profile) {
            form.reset({
                name: profile.name,
                whatsapp_number: profile.whatsapp_number || "",
                farm_city: profile.farm_city || "",
                farm_latitude: profile.farm_latitude ? String(profile.farm_latitude) : "",
                farm_longitude: profile.farm_longitude ? String(profile.farm_longitude) : "",
            });
            try {
                const extras = profile.whatsapp_extra_numbers
                    ? JSON.parse(profile.whatsapp_extra_numbers)
                    : [];
                setExtraNumbers(Array.isArray(extras) ? extras : []);
            } catch {
                setExtraNumbers([]);
            }
            setBulletinEnabled(profile.bulletin_enabled !== false);
        }
    }, [profile, form]);

    const addExtraNumber = () => setExtraNumbers([...extraNumbers, ""]);
    const removeExtraNumber = (index: number) => setExtraNumbers(extraNumbers.filter((_, i) => i !== index));
    const updateExtraNumber = (index: number, value: string) => {
        const updated = [...extraNumbers];
        updated[index] = value;
        setExtraNumbers(updated);
    };

    const updateMutation = useMutation({
        mutationFn: async (data: ProfileFormData) => {
            const cleanPhone = data.whatsapp_number?.replace(/\D/g, "");
            const cleanExtras = extraNumbers
                .map(n => n.replace(/\D/g, ""))
                .filter(n => n.length >= 10);

            const res = await apiRequest("PUT", "/api/farm/me", {
                name: data.name,
                whatsapp_number: cleanPhone,
                whatsapp_extra_numbers: JSON.stringify(cleanExtras),
                farm_city: data.farm_city || null,
                farm_latitude: data.farm_latitude ? parseFloat(data.farm_latitude) : null,
                farm_longitude: data.farm_longitude ? parseFloat(data.farm_longitude) : null,
                bulletin_enabled: bulletinEnabled,
            });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/me"] });
            queryClient.invalidateQueries({ queryKey: ["/api/user"] });
            toast({ title: "Sucesso!", description: "Perfil atualizado com sucesso." });
        },
        onError: () => {
            toast({ title: "Erro", description: "Falha ao atualizar perfil.", variant: "destructive" });
        },
    });

    const onSubmit = (data: ProfileFormData) => updateMutation.mutate(data);

    if (isLoading) {
        return (
            <FarmLayout>
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                </div>
            </FarmLayout>
        );
    }

    return (
        <FarmLayout>
            <div className="max-w-2xl mx-auto space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <User className="h-6 w-6 text-emerald-600" />
                        Meu Perfil
                    </h1>
                    <p className="text-gray-500 mt-1">Gerencie suas informações pessoais e de contato.</p>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Nome Completo</FormLabel>
                                        <FormControl>
                                            <Input {...field} placeholder="Seu nome" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-100">
                                <h3 className="font-semibold text-emerald-800 text-sm mb-1">🤖 Assistente Virtual (WhatsApp)</h3>
                                <p className="text-xs text-emerald-700">
                                    Cadastre seu número abaixo para usar o assistente de IA. Você poderá perguntar sobre estoque, despesas e faturas diretamente pelo WhatsApp.
                                </p>
                            </div>

                            <FormField
                                control={form.control}
                                name="whatsapp_number"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Número Principal do WhatsApp</FormLabel>
                                        <FormControl>
                                            <Input {...field} placeholder="Ex: 5543999999999" type="tel" />
                                        </FormControl>
                                        <FormDescription>
                                            Formato internacional: Código do País + DDD + Número (apenas números). <br />
                                            Exemplo Brasil: 55 43 99999-9999 → <strong>5543999999999</strong>
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Extra numbers */}
                            <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Users className="h-4 w-4 text-emerald-600" />
                                        <h3 className="font-semibold text-sm text-gray-700">Números do Grupo (Opcional)</h3>
                                    </div>
                                    <Button type="button" variant="outline" size="sm" onClick={addExtraNumber}
                                        className="text-emerald-600 border-emerald-200 hover:bg-emerald-50">
                                        <Plus className="h-3 w-3 mr-1" /> Adicionar
                                    </Button>
                                </div>
                                <p className="text-xs text-gray-500">
                                    Adicione números de outros participantes para usar o agente em grupos do WhatsApp.
                                    No grupo, digite <strong>"agrofarm"</strong> + sua pergunta para acionar o bot.
                                </p>
                                {extraNumbers.length === 0 ? (
                                    <p className="text-xs text-gray-400 italic text-center py-2">Nenhum número extra cadastrado</p>
                                ) : (
                                    <div className="space-y-2">
                                        {extraNumbers.map((num, idx) => (
                                            <div key={idx} className="flex items-center gap-2">
                                                <Input value={num} onChange={(e) => updateExtraNumber(idx, e.target.value)}
                                                    placeholder="Ex: 5543999999999" type="tel" className="flex-1" />
                                                <Button type="button" variant="ghost" size="sm" onClick={() => removeExtraNumber(idx)}
                                                    className="text-red-500 hover:text-red-700 hover:bg-red-50">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Farm Location */}
                            <div className="border border-blue-200 rounded-lg p-4 space-y-4 bg-blue-50/30">
                                <div className="flex items-center gap-2">
                                    <MapPin className="h-4 w-4 text-blue-600" />
                                    <h3 className="font-semibold text-sm text-gray-700">Localização da Fazenda</h3>
                                </div>
                                <p className="text-xs text-gray-500">
                                    Informe a localização para receber previsão do tempo personalizada no boletim diário.
                                </p>

                                <FormField
                                    control={form.control}
                                    name="farm_city"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Cidade / Região</FormLabel>
                                            <FormControl>
                                                <Input {...field} placeholder="Ex: Santa Helena, PR" />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />

                                <div className="grid grid-cols-2 gap-3">
                                    <FormField
                                        control={form.control}
                                        name="farm_latitude"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Latitude</FormLabel>
                                                <FormControl>
                                                    <Input {...field} placeholder="Ex: -25.2637" type="text" />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="farm_longitude"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Longitude</FormLabel>
                                                <FormControl>
                                                    <Input {...field} placeholder="Ex: -54.3378" type="text" />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <p className="text-xs text-gray-400">
                                    Dica: Abra o Google Maps, clique no local da fazenda e copie as coordenadas.
                                </p>
                            </div>

                            {/* Bulletin Toggle */}
                            <div className="border border-amber-200 rounded-lg p-4 bg-amber-50/30">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Bell className="h-4 w-4 text-amber-600" />
                                        <div>
                                            <h3 className="font-semibold text-sm text-gray-700">Boletim Diário AgroZap</h3>
                                            <p className="text-xs text-gray-500">Receba todo dia às 6h: tempo, cotação da soja e notícias</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setBulletinEnabled(!bulletinEnabled)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${bulletinEnabled ? 'bg-emerald-500' : 'bg-gray-300'
                                            }`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${bulletinEnabled ? 'translate-x-6' : 'translate-x-1'
                                            }`} />
                                    </button>
                                </div>
                            </div>

                            <div className="flex justify-end pt-4">
                                <Button type="submit" disabled={updateMutation.isPending}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white">
                                    {updateMutation.isPending ? (
                                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</>
                                    ) : (
                                        <><Save className="mr-2 h-4 w-4" /> Salvar Alterações</>
                                    )}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </div>
            </div>
        </FarmLayout>
    );
}
