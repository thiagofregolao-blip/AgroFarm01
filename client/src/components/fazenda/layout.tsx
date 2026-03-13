import { ReactNode, useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
    Home, Warehouse, Map, FileText, BarChart3,
    LogOut, DollarSign, Monitor, TrendingUp, Sprout, User, Tractor, FileBarChart,
    BookOpen, ArrowDownUp, Satellite, Menu, X, CloudRain, Wallet,
    Receipt, HandCoins, PieChart, Target, Scale, Landmark, Building2,
    Settings, HelpCircle, Download
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/lib/i18n";

// ─── Types ───────────────────────────────────────────────────────────────────
interface NavItem {
    labelKey: string;
    href: string;
    icon: any;
    moduleKey: string;
    alwaysOn?: boolean;
}

interface NavGroup {
    label?: string;
    items: NavItem[];
}

// ─── FAZENDA nav groups ───────────────────────────────────────────────────────
const farmNavGroups: NavGroup[] = [
    {
        items: [
            { labelKey: "nav_home", href: "/fazenda", icon: Home, moduleKey: "dashboard", alwaysOn: true },
        ],
    },
    {
        label: "Producao",
        items: [
            { labelKey: "nav_properties",   href: "/fazenda/propriedades",  icon: Map,       moduleKey: "properties" },
            { labelKey: "nav_seasons",       href: "/fazenda/safras",        icon: Sprout,    moduleKey: "seasons" },
            { labelKey: "nav_applications",  href: "/fazenda/aplicacoes",    icon: BarChart3, moduleKey: "applications" },
            { labelKey: "nav_plot_costs",    href: "/fazenda/custos",        icon: TrendingUp,moduleKey: "plot_costs" },
        ],
    },
    {
        label: "Operacao & Campo",
        items: [
            { labelKey: "nav_field_notebook", href: "/fazenda/caderno-campo", icon: BookOpen, moduleKey: "field_notebook" },
            { labelKey: "nav_romaneios",       href: "/fazenda/romaneios",     icon: Scale,    moduleKey: "romaneios" },
            { labelKey: "nav_fleet",           href: "/fazenda/equipamentos",  icon: Tractor,  moduleKey: "fleet" },
        ],
    },
    {
        label: "Estoque & PDV",
        items: [
            { labelKey: "nav_stock",     href: "/fazenda/estoque",   icon: Warehouse, moduleKey: "stock" },
            { labelKey: "nav_terminals", href: "/fazenda/terminais", icon: Monitor,   moduleKey: "terminals" },
        ],
    },
    {
        label: "Inteligencia",
        items: [
            { labelKey: "nav_quotations", href: "/fazenda/cotacoes", icon: ArrowDownUp, moduleKey: "quotations" },
            { labelKey: "nav_ndvi",       href: "/fazenda/ndvi",     icon: Satellite,   moduleKey: "ndvi" },
            { labelKey: "nav_weather",    href: "/fazenda/clima",    icon: CloudRain,   moduleKey: "weather" },
        ],
    },
];

// ─── FINANCEIRO nav groups ────────────────────────────────────────────────────
const financeNavGroups: NavGroup[] = [
    {
        label: "Caixa",
        items: [
            { labelKey: "nav_cash_flow", href: "/fazenda/fluxo-caixa", icon: Wallet,   moduleKey: "cash_flow" },
            { labelKey: "nav_invoices",  href: "/fazenda/faturas",     icon: FileText, moduleKey: "invoices" },
        ],
    },
    {
        label: "Saidas",
        items: [
            { labelKey: "nav_expenses",          href: "/fazenda/despesas",       icon: DollarSign, moduleKey: "expenses" },
            { labelKey: "nav_accounts_payable",  href: "/fazenda/contas-pagar",   icon: Receipt,    moduleKey: "accounts_payable" },
            { labelKey: "nav_suppliers",          href: "/fazenda/fornecedores",  icon: Building2,  moduleKey: "suppliers" },
        ],
    },
    {
        label: "Entradas",
        items: [
            { labelKey: "nav_accounts_receivable", href: "/fazenda/contas-receber", icon: HandCoins, moduleKey: "accounts_receivable" },
        ],
    },
    {
        label: "Analise",
        items: [
            { labelKey: "nav_dre",             href: "/fazenda/dre",         icon: PieChart, moduleKey: "dre" },
            { labelKey: "nav_budget",          href: "/fazenda/orcamento",   icon: Target,   moduleKey: "budget" },
            { labelKey: "nav_reconciliation",  href: "/fazenda/conciliacao", icon: Landmark, moduleKey: "reconciliation" },
        ],
    },
];

// ─── SHARED (always visible in footer of BOTH menus) ─────────────────────────
const sharedFooterItems: NavItem[] = [
    { labelKey: "nav_reports", href: "/fazenda/relatorios", icon: FileBarChart, moduleKey: "reports",  alwaysOn: true },
    { labelKey: "nav_profile", href: "/fazenda/perfil",     icon: User,         moduleKey: "profile",  alwaysOn: true },
];

// Flat arrays (for route detection)
const allFarmItems   = farmNavGroups.flatMap(g => g.items);
const allFinanceItems = financeNavGroups.flatMap(g => g.items);
const financeRoutes  = allFinanceItems.map(i => i.href);
const allNavItems    = [...allFarmItems, ...allFinanceItems, ...sharedFooterItems];

type SidebarTab = "fazenda" | "financeiro";

// ─── Desktop NavButton (dark sidebar) ────────────────────────────────────────
function NavButton({ item, location, onClick }: { item: NavItem; location: string; onClick: () => void }) {
    const { t } = useLanguage();
    const isActive = location === item.href || (item.href !== "/fazenda" && location.startsWith(item.href));
    const Icon = item.icon;
    const label = t(item.labelKey as any);
    return (
        <button
            onClick={onClick}
            className={`
                w-full flex items-center gap-3 rounded-full transition-all duration-150 px-3 py-2.5
                ${isActive
                    ? "bg-white text-[#0d2418] shadow-md font-semibold"
                    : "text-white/90 hover:bg-white/10 hover:text-white font-medium"
                }
            `}
            title={label}
        >
            <Icon className={`h-5 w-5 shrink-0 ${isActive ? "text-[#0d2418]" : "text-white/80"}`} />
            <span className="text-[13px] md:text-sm truncate leading-tight">{label}</span>
        </button>
    );
}

// ─── Mobile NavButton (white drawer) ─────────────────────────────────────────
function MobileNavButton({ item, location, onClick }: { item: NavItem; location: string; onClick: () => void }) {
    const { t } = useLanguage();
    const isActive = location === item.href || (item.href !== "/fazenda" && location.startsWith(item.href));
    const Icon = item.icon;
    const label = t(item.labelKey as any);
    return (
        <button
            onClick={onClick}
            className={`
                w-full flex items-center gap-4 px-2 py-3.5 transition-colors duration-150
                ${isActive
                    ? "text-[#0a6e3a] font-semibold"
                    : "text-gray-700 hover:text-[#0a6e3a] font-medium"
                }
            `}
        >
            <Icon className={`h-6 w-6 shrink-0 ${isActive ? "text-[#0a6e3a]" : "text-gray-500"}`} />
            <span className="text-base leading-tight">{label}</span>
        </button>
    );
}

// ─── Main Layout ──────────────────────────────────────────────────────────────
export default function FarmLayout({ children }: { children: ReactNode }) {
    const [location, setLocation] = useLocation();
    const { user, logoutMutation } = useAuth();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const { t } = useLanguage();

    const isFinanceRoute = financeRoutes.some(r => location === r || location.startsWith(r + "/"));
    const [activeTab, setActiveTab] = useState<SidebarTab>(isFinanceRoute ? "financeiro" : "fazenda");

    useEffect(() => {
        setIsMobileMenuOpen(false);
        if (financeRoutes.some(r => location === r || location.startsWith(r + "/"))) {
            setActiveTab("financeiro");
        } else if (location === "/fazenda" || allFarmItems.some(i => location === i.href || location.startsWith(i.href + "/"))) {
            setActiveTab("fazenda");
        }
    }, [location]);

    const { data: myModules = [] } = useQuery<any[]>({
        queryKey: ["/api/farm/my-modules"],
        enabled: !!user,
    });

    function isEnabled(item: NavItem) {
        if (item.alwaysOn) return true;
        const m = myModules.find((m: any) => m.moduleKey === item.moduleKey);
        return m ? m.enabled : true;
    }

    const activeGroups = activeTab === "fazenda" ? farmNavGroups : financeNavGroups;

    // All groups combined for mobile (show everything, no tab switching)
    const allGroupsForMobile = [
        { label: "Fazenda", items: farmNavGroups.flatMap(g => g.items) },
        { label: "Financeiro", items: financeNavGroups.flatMap(g => g.items) },
    ];

    const handleLogout = () => {
        logoutMutation.mutate(undefined, {
            onSuccess: () => { window.location.href = "https://www.agrofarmdigital.com/auth"; },
        });
    };

    if (!user) {
        window.location.href = "https://www.agrofarmdigital.com/auth";
        return null;
    }

    return (
        <div className="min-h-screen bg-gray-100 flex relative">

            {/* ══════════════════════════════════════════════════════════════════
                MOBILE DRAWER — White, wide, app-native style (< md)
                ══════════════════════════════════════════════════════════════════ */}
            {isMobileMenuOpen && (
                <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />
            )}

            <div className={`
                md:hidden fixed top-0 left-0 bottom-0 z-50 w-[80%] max-w-[340px] bg-white
                flex flex-col shadow-2xl
                transition-transform duration-300 ease-in-out
                ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
            `}>
                {/* Header: Logo + User info */}
                <div className="px-6 pt-10 pb-6">
                    {/* Logo */}
                    <div className="flex items-center gap-3 mb-6">
                        <img src="/icon-512x512.png" alt="AgroFarm" className="w-16 h-16 object-contain" />
                        <div>
                            <p className="text-xl font-extrabold text-[#0a6e3a] leading-tight tracking-tight">AgroFarm</p>
                            <p className="text-[11px] font-semibold text-[#0a6e3a]/70 uppercase tracking-wider">Gestor Rural Digital</p>
                        </div>
                    </div>

                    {/* User greeting */}
                    <div>
                        <p className="text-lg font-bold text-gray-800">
                            Ola, {(user.name || user.username || "").split(" ")[0]}
                        </p>
                        <p className="text-sm text-gray-500 truncate">{user.username}</p>
                        <button
                            onClick={handleLogout}
                            className="mt-1 text-sm font-semibold text-red-500 hover:text-red-600 transition-colors"
                        >
                            Sair
                        </button>
                    </div>
                </div>

                {/* Divider */}
                <div className="mx-6 border-t border-gray-200" />

                {/* Tab switcher */}
                <div className="flex mx-6 mt-4 bg-gray-100 rounded-xl p-1">
                    <button onClick={() => setActiveTab("fazenda")}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200
                            ${activeTab === "fazenda" ? "bg-white text-[#0a6e3a] shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                        Fazenda
                    </button>
                    <button onClick={() => setActiveTab("financeiro")}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200
                            ${activeTab === "financeiro" ? "bg-white text-[#0a6e3a] shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                        Financeiro
                    </button>
                </div>

                {/* Nav items */}
                <nav className="flex-1 overflow-y-auto px-6 py-4">
                    {activeGroups.map((group, gi) => {
                        const visibleItems = group.items.filter(isEnabled);
                        if (!visibleItems.length) return null;
                        return (
                            <div key={gi}>
                                {gi > 0 && group.label && (
                                    <div className="mt-4 mb-1">
                                        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 px-2">
                                            {group.label}
                                        </p>
                                    </div>
                                )}
                                <div>
                                    {visibleItems.map(item => (
                                        <MobileNavButton
                                            key={item.href}
                                            item={item}
                                            location={location}
                                            onClick={() => { setLocation(item.href); setIsMobileMenuOpen(false); }}
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })}

                    {/* Shared items */}
                    <div className="mt-4 pt-4 border-t border-gray-100">
                        {sharedFooterItems.map(item => (
                            <MobileNavButton
                                key={item.href}
                                item={item}
                                location={location}
                                onClick={() => { setLocation(item.href); setIsMobileMenuOpen(false); }}
                            />
                        ))}
                    </div>
                </nav>

                {/* Footer */}
                <div className="shrink-0 px-6 py-4 border-t border-gray-100">
                    <p className="text-center text-xs text-gray-400">Termos de Uso</p>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════════
                DESKTOP SIDEBAR — Dark green, narrow (>= md)
                ══════════════════════════════════════════════════════════════════ */}
            <aside className="hidden md:flex w-[200px] bg-[#0d2418] text-white flex-col shrink-0 fixed top-0 bottom-0 z-50 shadow-[4px_0_24px_rgba(0,0,0,0.15)]">
                {/* Logo */}
                <div className="flex items-center gap-3 px-4 py-4 border-b border-white/10">
                    <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0">
                        <img src="/icon-512x512.png" alt="AgroFarm" className="w-full h-full object-contain" />
                    </div>
                    <div className="min-w-0">
                        <span className="font-bold text-sm leading-tight block text-white truncate">AgroFarm</span>
                        <span className="text-[10px] text-emerald-400 truncate block">{user.name || user.username}</span>
                    </div>
                </div>

                {/* Tab switcher */}
                <div className="flex mx-2 mt-3 bg-white/10 rounded-full p-0.5">
                    <button onClick={() => setActiveTab("fazenda")}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full text-[11px] font-semibold transition-all duration-200
                            ${activeTab === "fazenda" ? "bg-white text-[#0d2418] shadow-sm" : "text-white/70 hover:text-white"}`}>
                        {t("nav_tab_farm" as any)}
                    </button>
                    <button onClick={() => setActiveTab("financeiro")}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full text-[11px] font-semibold transition-all duration-200
                            ${activeTab === "financeiro" ? "bg-white text-[#0d2418] shadow-sm" : "text-white/70 hover:text-white"}`}>
                        {t("nav_tab_finance" as any)}
                    </button>
                </div>

                {/* Scrollable nav groups */}
                <nav className="flex-1 overflow-y-auto py-3 px-2">
                    {activeGroups.map((group, gi) => {
                        const visibleItems = group.items.filter(isEnabled);
                        if (!visibleItems.length) return null;
                        return (
                            <div key={gi}>
                                {gi > 0 && (
                                    <div className="my-2 px-1">
                                        <div className="border-t border-white/10" />
                                        {group.label && (
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 px-2 pt-2 pb-0.5">
                                                {group.label}
                                            </p>
                                        )}
                                    </div>
                                )}
                                <div className="space-y-0.5">
                                    {visibleItems.map(item => (
                                        <NavButton key={item.href} item={item} location={location} onClick={() => setLocation(item.href)} />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </nav>

                {/* Fixed footer */}
                <div className="shrink-0 px-2 pb-3">
                    <div className="border-t border-white/20 mb-2 mx-1" />
                    <div className="space-y-0.5 mb-2">
                        {sharedFooterItems.map(item => (
                            <NavButton key={item.href} item={item} location={location} onClick={() => setLocation(item.href)} />
                        ))}
                    </div>
                    <div className="border-t border-white/10 mb-2 mx-1" />
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-full text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                        title={t("nav_logout")}
                    >
                        <LogOut className="h-5 w-5 shrink-0" />
                        <span className="text-sm font-medium">{t("nav_logout")}</span>
                    </button>
                </div>
            </aside>

            {/* ── Main content ── */}
            <main className="flex-1 flex flex-col min-h-screen max-w-full md:ml-[200px]">
                <header className="bg-gradient-to-r from-[#0d2418] to-emerald-900 text-white shadow-md sticky top-0 z-30 px-3 sm:px-6 lg:px-8 py-2 flex items-center gap-3">
                    <button
                        onClick={() => setIsMobileMenuOpen(true)}
                        className="md:hidden p-2 -ml-2 rounded-lg text-white hover:bg-white/10 active:bg-white/20 transition-colors"
                        aria-label="Abrir menu"
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                    <div className="flex-1 flex items-center justify-between min-w-0">
                        <h1 className="text-lg font-bold text-white truncate">
                            {t((allNavItems.find(n => n.href === location || (n.href !== "/fazenda" && location.startsWith(n.href)))?.labelKey || "nav_home") as any) || "AgroFarm"}
                        </h1>
                        <span className="text-xs font-medium text-emerald-100 hidden sm:block truncate ml-4 max-w-[200px]">{user.name || user.username}</span>
                    </div>
                    <img src="/logo.png" alt="AgroFarm" className="h-8 w-auto object-contain md:hidden" />
                </header>
                <div className={`flex-1 flex flex-col w-full overflow-x-hidden ${location === "/fazenda/clima" ? "p-0" : "px-2 sm:px-6 lg:px-8 py-4 sm:py-6"}`}>
                    {children}
                </div>
            </main>
        </div>
    );
}
