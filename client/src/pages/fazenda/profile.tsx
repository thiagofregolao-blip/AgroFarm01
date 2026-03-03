
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
import { Loader2, Save, User, Plus, Trash2, Users, MapPin, Bell, Mail, Globe } from "lucide-react";
import { useEffect, useState } from "react";
import { useLanguage, LANGUAGE_OPTIONS, type Language } from "@/lib/i18n";

const profileSchema = z.object({
    name: z.string().min(2),
    whatsapp_number: z.string().refine((val) => {
        if (!val) return true;
        const clean = val.replace(/\D/g, "");
        return clean.length >= 10 && clean.length <= 15;
    }).optional().or(z.literal("")),
    farm_city: z.string().optional().or(z.literal("")),
    farm_latitude: z.string().optional().or(z.literal("")),
    farm_longitude: z.string().optional().or(z.literal("")),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export default function FarmProfile() {
    const { user } = useAuth();
    const { toast } = useToast();
    const { t, language, setLanguage } = useLanguage();
    const [extraNumbers, setExtraNumbers] = useState<string[]>([]);
    const [bulletinEnabled, setBulletinEnabled] = useState(true);
    const [invoiceEmail, setInvoiceEmail] = useState("");
    const [accountantEmail, setAccountantEmail] = useState("");
    const [selectedLanguage, setSelectedLanguage] = useState<Language>(language);

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
            setInvoiceEmail(profile.invoice_email || "");
            setAccountantEmail(profile.accountant_email || "");
            if (profile.language && (profile.language === "pt-BR" || profile.language === "es")) {
                setSelectedLanguage(profile.language);
                setLanguage(profile.language);
            }
        }
    }, [profile, form, setLanguage]);

    const addExtraNumber = () => setExtraNumbers([...extraNumbers, ""]);
    const removeExtraNumber = (index: number) => setExtraNumbers(extraNumbers.filter((_, i) => i !== index));
    const updateExtraNumber = (index: number, value: string) => {
        const updated = [...extraNumbers];
        updated[index] = value;
        setExtraNumbers(updated);
    };

    const handleLanguageChange = (lang: Language) => {
        setSelectedLanguage(lang);
        setLanguage(lang);
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
                invoice_email: invoiceEmail || null,
                accountant_email: accountantEmail || null,
                language: selectedLanguage,
            });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/me"] });
            queryClient.invalidateQueries({ queryKey: ["/api/user"] });
            toast({ title: t("profile_success"), description: t("profile_success_desc") });
        },
        onError: () => {
            toast({ title: t("profile_error"), description: t("profile_error_desc"), variant: "destructive" });
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
                        {t("profile_title")}
                    </h1>
                    <p className="text-gray-500 mt-1">{t("profile_subtitle")}</p>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            {/* Language Selector */}
                            <div className="border border-indigo-200 rounded-lg p-4 bg-indigo-50/30">
                                <div className="flex items-center gap-2 mb-2">
                                    <Globe className="h-4 w-4 text-indigo-600" />
                                    <h3 className="font-semibold text-sm text-gray-700">{t("profile_language_title")}</h3>
                                </div>
                                <p className="text-xs text-gray-500 mb-3">{t("profile_language_desc")}</p>
                                <div className="flex gap-2">
                                    {LANGUAGE_OPTIONS.map((opt) => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => handleLanguageChange(opt.value)}
                                            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 transition-all text-sm font-medium ${
                                                selectedLanguage === opt.value
                                                    ? "border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm"
                                                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                                            }`}
                                        >
                                            <span className="text-lg">{opt.flag}</span>
                                            <span>{opt.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t("profile_name")}</FormLabel>
                                        <FormControl>
                                            <Input {...field} placeholder={t("profile_name_placeholder")} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-100">
                                <h3 className="font-semibold text-emerald-800 text-sm mb-1">🤖 {t("profile_whatsapp_bot_title")}</h3>
                                <p className="text-xs text-emerald-700">{t("profile_whatsapp_bot_desc")}</p>
                            </div>

                            <FormField
                                control={form.control}
                                name="whatsapp_number"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t("profile_whatsapp")}</FormLabel>
                                        <FormControl>
                                            <Input {...field} placeholder={t("profile_whatsapp_placeholder")} type="tel" />
                                        </FormControl>
                                        <FormDescription>
                                            {t("profile_whatsapp_desc")} <br />
                                            {t("profile_whatsapp_example")} <strong>{t("profile_whatsapp_placeholder")}</strong>
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
                                        <h3 className="font-semibold text-sm text-gray-700">{t("profile_extra_numbers_title")}</h3>
                                    </div>
                                    <Button type="button" variant="outline" size="sm" onClick={addExtraNumber}
                                        className="text-emerald-600 border-emerald-200 hover:bg-emerald-50">
                                        <Plus className="h-3 w-3 mr-1" /> {t("profile_add")}
                                    </Button>
                                </div>
                                <p className="text-xs text-gray-500">
                                    {t("profile_extra_numbers_desc")}
                                    {" "}{t("profile_extra_numbers_hint")} <strong>"{t("profile_extra_numbers_keyword")}"</strong> {t("profile_extra_numbers_hint2")}
                                </p>
                                {extraNumbers.length === 0 ? (
                                    <p className="text-xs text-gray-400 italic text-center py-2">{t("profile_extra_numbers_empty")}</p>
                                ) : (
                                    <div className="space-y-2">
                                        {extraNumbers.map((num, idx) => (
                                            <div key={idx} className="flex items-center gap-2">
                                                <Input value={num} onChange={(e) => updateExtraNumber(idx, e.target.value)}
                                                    placeholder={t("profile_whatsapp_placeholder")} type="tel" className="flex-1" />
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
                                    <h3 className="font-semibold text-sm text-gray-700">{t("profile_location_title")}</h3>
                                </div>
                                <p className="text-xs text-gray-500">{t("profile_location_desc")}</p>

                                <FormField
                                    control={form.control}
                                    name="farm_city"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t("profile_city")}</FormLabel>
                                            <FormControl>
                                                <Input {...field} placeholder={t("profile_city_placeholder")} />
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
                                                <FormLabel>{t("profile_latitude")}</FormLabel>
                                                <FormControl>
                                                    <Input {...field} placeholder={t("profile_latitude_placeholder")} type="text" />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="farm_longitude"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t("profile_longitude")}</FormLabel>
                                                <FormControl>
                                                    <Input {...field} placeholder={t("profile_longitude_placeholder")} type="text" />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <p className="text-xs text-gray-400">{t("profile_location_hint")}</p>
                            </div>

                            {/* Bulletin Toggle */}
                            <div className="border border-amber-200 rounded-lg p-4 bg-amber-50/30">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Bell className="h-4 w-4 text-amber-600" />
                                        <div>
                                            <h3 className="font-semibold text-sm text-gray-700">{t("profile_bulletin_title")}</h3>
                                            <p className="text-xs text-gray-500">{t("profile_bulletin_desc")}</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setBulletinEnabled(!bulletinEnabled)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${bulletinEnabled ? 'bg-emerald-500' : 'bg-gray-300'}`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${bulletinEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>
                            </div>

                            {/* Invoice Email */}
                            <div className="border border-purple-200 rounded-lg p-4 bg-purple-50/30 space-y-3">
                                <div className="flex items-center gap-2">
                                    <Mail className="h-4 w-4 text-purple-600" />
                                    <h3 className="font-semibold text-sm text-gray-700">{t("profile_invoice_email_title")}</h3>
                                </div>
                                <p className="text-xs text-gray-500">{t("profile_invoice_email_desc")}</p>
                                <Input
                                    value={invoiceEmail}
                                    onChange={(e) => setInvoiceEmail(e.target.value)}
                                    placeholder={t("profile_invoice_email_placeholder")}
                                    type="email"
                                />
                                <p className="text-xs text-purple-600 font-medium">
                                    💡 {t("profile_invoice_email_hint")}
                                </p>
                            </div>

                            {/* Accountant Email */}
                            <div className="border border-blue-200 rounded-lg p-4 bg-blue-50/30 space-y-3">
                                <div className="flex items-center gap-2">
                                    <Mail className="h-4 w-4 text-blue-600" />
                                    <h3 className="font-semibold text-sm text-gray-700">{t("profile_accountant_title")}</h3>
                                </div>
                                <p className="text-xs text-gray-500">{t("profile_accountant_desc")}</p>
                                <Input
                                    value={accountantEmail}
                                    onChange={(e) => setAccountantEmail(e.target.value)}
                                    placeholder={t("profile_accountant_placeholder")}
                                    type="email"
                                />
                                <p className="text-xs text-blue-600 font-medium">
                                    📨 {t("profile_accountant_hint")}
                                </p>
                            </div>

                            <div className="flex justify-end pt-4">
                                <Button type="submit" disabled={updateMutation.isPending}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white">
                                    {updateMutation.isPending ? (
                                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("profile_saving")}</>
                                    ) : (
                                        <><Save className="mr-2 h-4 w-4" /> {t("profile_save")}</>
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
