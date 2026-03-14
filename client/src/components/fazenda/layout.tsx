import { ReactNode, useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import {
    Home, Warehouse, Map, FileText, BarChart3,
    LogOut, DollarSign, Monitor, TrendingUp, Sprout, User, Tractor, FileBarChart,
    BookOpen, ArrowDownUp, Satellite, Menu, X, CloudRain, Wallet,
    Receipt, HandCoins, PieChart, Target, Scale, Landmark, Building2,
    Settings, HelpCircle, Download, ChevronDown
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
            { labelKey: "nav_productivity", href: "/fazenda/produtividade", icon: BarChart3, moduleKey: "productivity" },
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

// ─── SHARED (always visible in footer of mobile menu + header right on desktop)
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

// ─── Desktop Horizontal Menu Item with Dropdown ─────────────────────────────
function DesktopMenuDropdown({
    label, icon: Icon, items, location, onNavigate, isEnabled,
}: {
    label: string;
    icon?: any;
    items: NavItem[];
    location: string;
    onNavigate: (href: string) => void;
    isEnabled: (item: NavItem) => boolean;
}) {
    const { t } = useLanguage();
    const [open, setOpen] = useState(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
    const ref = useRef<HTMLDivElement>(null);

    const visibleItems = items.filter(isEnabled);
    if (!visibleItems.length) return null;

    const hasActive = visibleItems.some(i => location === i.href || (i.href !== "/fazenda" && location.startsWith(i.href)));

    function handleEnter() {
        clearTimeout(timeoutRef.current);
        setOpen(true);
    }
    function handleLeave() {
        timeoutRef.current = setTimeout(() => setOpen(false), 150);
    }

    return (
        <div ref={ref} className="relative" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
            <button
                className={`flex flex-col items-center gap-1 px-4 py-2 text-xs font-medium rounded-lg transition-colors duration-150 cursor-pointer whitespace-nowrap
                    ${hasActive ? "text-emerald-700 bg-emerald-50" : "text-gray-600 hover:text-emerald-700 hover:bg-gray-50"}
                `}
                onClick={() => setOpen(!open)}
            >
                {Icon && <Icon className="w-6 h-6" />}
                <div className="flex items-center gap-0.5">
                    <span>{label}</span>
                    <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
                </div>
            </button>

            {open && (
                <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-gray-100 py-2 min-w-[220px] z-50">
                    {visibleItems.map(item => {
                        const ItemIcon = item.icon;
                        const isActive = location === item.href || (item.href !== "/fazenda" && location.startsWith(item.href));
                        return (
                            <button
                                key={item.href}
                                onClick={() => { onNavigate(item.href); setOpen(false); }}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-100 cursor-pointer
                                    ${isActive ? "text-emerald-700 bg-emerald-50 font-semibold" : "text-gray-700 hover:bg-gray-50 hover:text-emerald-700"}
                                `}
                            >
                                <ItemIcon className={`w-4 h-4 shrink-0 ${isActive ? "text-emerald-600" : "text-gray-400"}`} />
                                <span>{t(item.labelKey as any)}</span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ─── Desktop Financeiro Mega Dropdown (grouped) ─────────────────────────────
function FinanceiroMegaDropdown({
    location, onNavigate, isEnabled,
}: {
    location: string;
    onNavigate: (href: string) => void;
    isEnabled: (item: NavItem) => boolean;
}) {
    const { t } = useLanguage();
    const [open, setOpen] = useState(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

    const hasActive = financeNavGroups.some(g => g.items.some(i => isEnabled(i) && (location === i.href || location.startsWith(i.href))));

    function handleEnter() {
        clearTimeout(timeoutRef.current);
        setOpen(true);
    }
    function handleLeave() {
        timeoutRef.current = setTimeout(() => setOpen(false), 150);
    }

    return (
        <div className="relative" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
            <button
                className={`flex flex-col items-center gap-1 px-4 py-2 text-xs font-medium rounded-lg transition-colors duration-150 cursor-pointer whitespace-nowrap
                    ${hasActive ? "text-emerald-700 bg-emerald-50" : "text-gray-600 hover:text-emerald-700 hover:bg-gray-50"}
                `}
                onClick={() => setOpen(!open)}
            >
                <Wallet className="w-6 h-6" />
                <div className="flex items-center gap-0.5">
                    <span>Financeiro</span>
                    <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
                </div>
            </button>

            {open && (
                <div className="absolute top-full right-0 mt-1 bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-gray-100 py-2 min-w-[240px] z-50">
                    {financeNavGroups.map((group, gi) => {
                        const visibleItems = group.items.filter(isEnabled);
                        if (!visibleItems.length) return null;
                        return (
                            <div key={gi}>
                                {group.label && (
                                    <p className={`px-4 text-[11px] font-bold uppercase tracking-widest text-gray-400 ${gi > 0 ? "mt-2 pt-2 border-t border-gray-100" : ""} mb-1`}>
                                        {group.label}
                                    </p>
                                )}
                                {visibleItems.map(item => {
                                    const ItemIcon = item.icon;
                                    const isActive = location === item.href || location.startsWith(item.href);
                                    return (
                                        <button
                                            key={item.href}
                                            onClick={() => { onNavigate(item.href); setOpen(false); }}
                                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-100 cursor-pointer
                                                ${isActive ? "text-emerald-700 bg-emerald-50 font-semibold" : "text-gray-700 hover:bg-gray-50 hover:text-emerald-700"}
                                            `}
                                        >
                                            <ItemIcon className={`w-4 h-4 shrink-0 ${isActive ? "text-emerald-600" : "text-gray-400"}`} />
                                            <span>{t(item.labelKey as any)}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
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
        <div className="min-h-screen bg-gray-100 flex flex-col relative">

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
                    <div className="flex items-center gap-3 mb-6">
                        <img src="/icon-512x512.png" alt="AgroFarm" className="w-16 h-16 object-contain" />
                        <div>
                            <p className="text-xl font-extrabold text-[#0a6e3a] leading-tight tracking-tight">AgroFarm</p>
                            <p className="text-[11px] font-semibold text-[#0a6e3a]/70 uppercase tracking-wider">Gestor Rural Digital</p>
                        </div>
                    </div>
                    <div>
                        <p className="text-lg font-bold text-gray-800">
                            Ola, {(user.name || user.username || "").split(" ")[0]}
                        </p>
                        <p className="text-sm text-gray-500 truncate">{user.username}</p>
                        <button onClick={handleLogout} className="mt-1 text-sm font-semibold text-red-500 hover:text-red-600 transition-colors">
                            Sair
                        </button>
                    </div>
                </div>
                <div className="mx-6 border-t border-gray-200" />
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
                <div className="shrink-0 px-6 py-4 border-t border-gray-100">
                    <p className="text-center text-xs text-gray-400">Termos de Uso</p>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════════
                HEADER — Green bar (both mobile & desktop)
                ══════════════════════════════════════════════════════════════════ */}
            <header className="bg-gradient-to-r from-[#0d2418] to-emerald-900 text-white shadow-md sticky top-0 z-30 px-3 sm:px-6 lg:px-8 py-2 flex items-center gap-3">
                {/* Mobile: hamburger */}
                <button
                    onClick={() => setIsMobileMenuOpen(true)}
                    className="md:hidden p-2 -ml-2 rounded-lg text-white hover:bg-white/10 active:bg-white/20 transition-colors"
                    aria-label="Abrir menu"
                >
                    <Menu className="w-6 h-6" />
                </button>

                {/* Desktop: Logo */}
                <div className="hidden md:flex items-center gap-3 mr-4">
                    <img src="/icon-512x512.png" alt="AgroFarm" className="w-9 h-9 rounded-xl object-contain" />
                    <div className="min-w-0">
                        <span className="font-bold text-sm leading-tight block text-white">AgroFarm</span>
                        <span className="text-[10px] text-emerald-300 block">Gestor Rural Digital</span>
                    </div>
                </div>

                {/* Page title */}
                <div className="flex-1 flex items-center min-w-0">
                    <h1 className="text-lg font-bold text-white truncate">
                        {t((allNavItems.find(n => n.href === location || (n.href !== "/fazenda" && location.startsWith(n.href)))?.labelKey || "nav_home") as any) || "AgroFarm"}
                    </h1>
                </div>

                {/* Desktop: right side actions */}
                <div className="hidden md:flex items-center gap-1">
                    <button
                        onClick={() => setLocation("/fazenda/relatorios")}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                            ${location.startsWith("/fazenda/relatorios") ? "bg-white/20 text-white" : "text-white/80 hover:bg-white/10 hover:text-white"}`}
                    >
                        <FileBarChart className="w-4 h-4" />
                        <span>Relatorios</span>
                    </button>
                    <button
                        onClick={() => setLocation("/fazenda/perfil")}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                            ${location.startsWith("/fazenda/perfil") ? "bg-white/20 text-white" : "text-white/80 hover:bg-white/10 hover:text-white"}`}
                    >
                        <User className="w-4 h-4" />
                        <span>Perfil</span>
                    </button>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-red-300 hover:bg-red-500/20 hover:text-red-200 transition-colors"
                    >
                        <LogOut className="w-4 h-4" />
                        <span>Sair</span>
                    </button>
                </div>

                {/* Mobile: logo right */}
                <img src="/logo.png" alt="AgroFarm" className="h-8 w-auto object-contain md:hidden" />
            </header>

            {/* ══════════════════════════════════════════════════════════════════
                DESKTOP HORIZONTAL MENU BAR — White, sticky below header (>= md)
                ══════════════════════════════════════════════════════════════════ */}
            <nav className="hidden md:block bg-white border-b border-gray-200 sticky top-[52px] z-20 shadow-sm">
                <div className="max-w-screen-xl mx-auto px-4 lg:px-8 flex items-center justify-center gap-2 py-1">
                    {/* Inicio — direct link, no dropdown */}
                    <button
                        onClick={() => setLocation("/fazenda")}
                        className={`flex flex-col items-center gap-1 px-4 py-2 text-xs font-medium rounded-lg transition-colors duration-150 cursor-pointer whitespace-nowrap
                            ${location === "/fazenda" ? "text-emerald-700 bg-emerald-50" : "text-gray-600 hover:text-emerald-700 hover:bg-gray-50"}
                        `}
                    >
                        <Home className="w-6 h-6" />
                        <span>Inicio</span>
                    </button>

                    {/* Producao dropdown */}
                    <DesktopMenuDropdown
                        label="Producao"
                        icon={Sprout}
                        items={farmNavGroups[1].items}
                        location={location}
                        onNavigate={setLocation}
                        isEnabled={isEnabled}
                    />

                    {/* Campo dropdown */}
                    <DesktopMenuDropdown
                        label="Campo"
                        icon={BookOpen}
                        items={farmNavGroups[2].items}
                        location={location}
                        onNavigate={setLocation}
                        isEnabled={isEnabled}
                    />

                    {/* Estoque dropdown */}
                    <DesktopMenuDropdown
                        label="Estoque"
                        icon={Warehouse}
                        items={farmNavGroups[3].items}
                        location={location}
                        onNavigate={setLocation}
                        isEnabled={isEnabled}
                    />

                    {/* Inteligencia dropdown */}
                    <DesktopMenuDropdown
                        label="Inteligencia"
                        icon={Satellite}
                        items={farmNavGroups[4].items}
                        location={location}
                        onNavigate={setLocation}
                        isEnabled={isEnabled}
                    />

                    {/* Financeiro mega dropdown */}
                    <FinanceiroMegaDropdown
                        location={location}
                        onNavigate={setLocation}
                        isEnabled={isEnabled}
                    />
                </div>
            </nav>

            {/* ── Main content ── */}
            <main className="flex-1 flex flex-col w-full overflow-x-hidden">
                <div className={`flex-1 flex flex-col w-full ${location === "/fazenda/clima" ? "p-0" : "px-2 sm:px-6 lg:px-8 py-4 sm:py-6"}`}>
                    {children}
                </div>
            </main>
        </div>
    );
}
