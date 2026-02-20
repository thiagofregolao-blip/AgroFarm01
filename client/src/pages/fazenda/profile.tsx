
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
import { Loader2, Save, User, Plus, Trash2, Users } from "lucide-react";
import { useEffect, useState } from "react";

const profileSchema = z.object({
    name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
    whatsapp_number: z.string().refine((val) => {
        if (!val) return true;
        const clean = val.replace(/\D/g, "");
        return clean.length >= 10 && clean.length <= 15;
    }, "Número inválido. Use o formato com DDD (ex: 5543999999999)").optional().or(z.literal("")),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export default function FarmProfile() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [extraNumbers, setExtraNumbers] = useState<string[]>([]);

    const form = useForm<ProfileFormData>({
        resolver: zodResolver(profileSchema),
        defaultValues: {
            name: "",
            whatsapp_number: "",
        },
    });

    // Fetch current profile data
    const { data: profile, isLoading } = useQuery({
        queryKey: ["/api/farm/me"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/farm/me");
            return res.json();
        },
    });

    // Update form when data loads
    useEffect(() => {
        if (profile) {
            form.reset({
                name: profile.name,
                whatsapp_number: profile.whatsapp_number || "",
            });
            // Carregar números extras
            try {
                const extras = profile.whatsapp_extra_numbers
                    ? JSON.parse(profile.whatsapp_extra_numbers)
                    : [];
                setExtraNumbers(Array.isArray(extras) ? extras : []);
            } catch {
                setExtraNumbers([]);
            }
        }
    }, [profile, form]);

    const addExtraNumber = () => {
        setExtraNumbers([...extraNumbers, ""]);
    };

    const removeExtraNumber = (index: number) => {
        setExtraNumbers(extraNumbers.filter((_, i) => i !== index));
    };

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
            });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/me"] });
            queryClient.invalidateQueries({ queryKey: ["/api/user"] });
            toast({
                title: "Sucesso!",
                description: "Perfil atualizado com sucesso.",
            });
        },
        onError: () => {
            toast({
                title: "Erro",
                description: "Falha ao atualizar perfil. Tente novamente.",
                variant: "destructive",
            });
        },
    });

    const onSubmit = (data: ProfileFormData) => {
        updateMutation.mutate(data);
    };

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
                    <p className="text-gray-500 mt-1">
                        Gerencie suas informações pessoais e de contato.
                    </p>
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

                            <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-100 mb-4">
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
                                            <Input
                                                {...field}
                                                placeholder="Ex: 5543999999999"
                                                type="tel"
                                            />
                                        </FormControl>
                                        <FormDescription>
                                            Formato internacional: Código do País + DDD + Número (apenas números). <br />
                                            Exemplo Brasil: 55 43 99999-9999 → <strong>5543999999999</strong>
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Números extras para grupo */}
                            <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Users className="h-4 w-4 text-emerald-600" />
                                        <h3 className="font-semibold text-sm text-gray-700">Números do Grupo (Opcional)</h3>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={addExtraNumber}
                                        className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                                    >
                                        <Plus className="h-3 w-3 mr-1" />
                                        Adicionar
                                    </Button>
                                </div>
                                <p className="text-xs text-gray-500">
                                    Adicione números de outros participantes para usar o agente em grupos do WhatsApp.
                                    No grupo, digite <strong>"agrofarm"</strong> + sua pergunta para acionar o bot.
                                </p>

                                {extraNumbers.length === 0 ? (
                                    <p className="text-xs text-gray-400 italic text-center py-2">
                                        Nenhum número extra cadastrado
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {extraNumbers.map((num, idx) => (
                                            <div key={idx} className="flex items-center gap-2">
                                                <Input
                                                    value={num}
                                                    onChange={(e) => updateExtraNumber(idx, e.target.value)}
                                                    placeholder="Ex: 5543999999999"
                                                    type="tel"
                                                    className="flex-1"
                                                />
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => removeExtraNumber(idx)}
                                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end pt-4">
                                <Button
                                    type="submit"
                                    disabled={updateMutation.isPending}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                >
                                    {updateMutation.isPending ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Salvando...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="mr-2 h-4 w-4" />
                                            Salvar Alterações
                                        </>
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
