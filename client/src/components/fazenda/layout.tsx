import { ReactNode, useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
    Home, Warehouse, Map, Package, FileText, BarChart3,
    LogOut, DollarSign, Monitor, TrendingUp, Sprout, User, Tractor, FileBarChart,
    BookOpen, ArrowDownUp, Satellite, Menu, X, CloudRain
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

const navItems = [
    { label: "Início", href: "/fazenda", icon: Home, moduleKey: "dashboard", alwaysOn: true },
    { label: "Propriedades", href: "/fazenda/propriedades", icon: Map, moduleKey: "properties" },
    { label: "Safras", href: "/fazenda/safras", icon: Sprout, moduleKey: "seasons" },
    { label: "Faturas", href: "/fazenda/faturas", icon: FileText, moduleKey: "invoices" },
    { label: "Estoque", href: "/fazenda/estoque", icon: Warehouse, moduleKey: "stock" },
    { label: "Frota", href: "/fazenda/equipamentos", icon: Tractor, moduleKey: "fleet" },
    { label: "Aplicações", href: "/fazenda/aplicacoes", icon: BarChart3, moduleKey: "applications" },
    { label: "Custo/Talhão", href: "/fazenda/custos", icon: TrendingUp, moduleKey: "plot_costs" },
    { label: "Despesas", href: "/fazenda/despesas", icon: DollarSign, moduleKey: "expenses" },
    { label: "Terminais PDV", href: "/fazenda/terminais", icon: Monitor, moduleKey: "terminals" },
    { label: "Caderno de Campo", href: "/fazenda/caderno-campo", icon: BookOpen, moduleKey: "field_notebook" },
    { label: "Cotações", href: "/fazenda/cotacoes", icon: ArrowDownUp, moduleKey: "quotations" },
    { label: "NDVI Satélite", href: "/fazenda/ndvi", icon: Satellite, moduleKey: "ndvi" },
    { label: "Clima", href: "/fazenda/clima", icon: CloudRain, moduleKey: "weather", alwaysOn: true },
    { label: "Relatórios", href: "/fazenda/relatorios", icon: FileBarChart, moduleKey: "reports" },
    { label: "Perfil", href: "/fazenda/perfil", icon: User, moduleKey: "profile", alwaysOn: true },
];

export default function FarmLayout({ children }: { children: ReactNode }) {
    const [location, setLocation] = useLocation();
    const { user, logoutMutation } = useAuth();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Close mobile menu when Route changes
    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [location]);

    const { data: myModules = [] } = useQuery<any[]>({
        queryKey: ["/api/farm/my-modules"],
        enabled: !!user,
    });

    // Filter nav items based on modules
    const visibleNavItems = navItems.filter(item => {
        if (item.alwaysOn) return true;
        // If the module is not in the db, it defaults to true according to our spec
        const dbModule = myModules.find(m => m.moduleKey === item.moduleKey);
        if (dbModule) return dbModule.enabled;
        return true; // default behavior for new modules
    });

    const handleLogout = () => {
        logoutMutation.mutate(undefined, {
            onSuccess: () => {
                window.location.href = "https://www.agrofarmdigital.com/auth";
            },
        });
    };

    if (!user) {
        window.location.href = "https://www.agrofarmdigital.com/auth";
        return null;
    }

    return (
        <div className="min-h-screen bg-gray-100 flex relative">
            {/* Overlay for mobile when sidebar is open */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* ===== GREEN SIDEBAR (Responsive) ===== */}
            <aside
                className={`
                    w-[220px] md:w-[200px] bg-gradient-to-b from-emerald-700 via-emerald-600 to-emerald-800 text-white 
                    flex flex-col shrink-0 fixed top-0 bottom-0 z-50 shadow-[4px_0_24px_rgba(0,0,0,0.1)]
                    transition-transform duration-300 ease-in-out md:translate-x-0
                    ${isMobileMenuOpen ? "translate-x-0 left-0" : "-translate-x-full md:left-0"}
                `}
            >
                {/* Logo / Brand */}
                <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-lg shrink-0">
                            🚜
                        </div>
                        <div className="min-w-0">
                            <span className="font-bold text-sm leading-tight block truncate">AgroFarm</span>
                            <span className="text-[10px] text-emerald-200 truncate block">{user.name || user.username}</span>
                        </div>
                    </div>
                    {/* Close button inside sidebar on mobile */}
                    <button
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="md:hidden p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-white/10 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Nav items */}
                <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
                    {visibleNavItems.map((item) => {
                        const isActive = location === item.href ||
                            (item.href !== "/fazenda" && location.startsWith(item.href));
                        const Icon = item.icon;
                        return (
                            <button
                                key={item.href}
                                onClick={() => setLocation(item.href)}
                                className={`
                                    w-full flex items-center gap-3 rounded-xl transition-all duration-150
                                    px-3 py-2.5
                                    ${isActive
                                        ? "bg-white/20 text-white shadow-md shadow-black/10"
                                        : "text-emerald-100/70 hover:bg-white/10 hover:text-white"
                                    }
                                `}
                                title={item.label}
                            >
                                <Icon className={`h-5 w-5 shrink-0 ${isActive ? "text-white" : "text-emerald-200/60"}`} />
                                <span className={`text-[13px] md:text-sm font-medium truncate leading-tight ${isActive ? "text-white" : ""}`}>{item.label}</span>
                                {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white shadow-sm" />}
                            </button>
                        );
                    })}
                </nav>

                {/* Logout */}
                <div className="p-3 border-t border-white/10 mt-auto">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-emerald-200/70 hover:bg-red-500/20 hover:text-red-200 transition-colors"
                        title="Sair"
                    >
                        <LogOut className="h-5 w-5 shrink-0" />
                        <span className="text-[13px] md:text-sm font-medium">Sair</span>
                    </button>
                </div>
            </aside>

            {/* ===== MAIN CONTENT ===== */}
            <main className="flex-1 flex flex-col min-h-screen max-w-full md:ml-[200px]">
                {/* Top bar with page title and hamburger */}
                <header className="bg-white/90 backdrop-blur-md border-b border-gray-200/60 shadow-sm sticky top-0 z-30 px-3 sm:px-6 lg:px-8 py-3 flex items-center gap-3">
                    <button
                        onClick={() => setIsMobileMenuOpen(true)}
                        className="md:hidden p-2 -ml-2 rounded-lg text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors"
                        aria-label="Abrir menu"
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                    <div className="flex-1 flex items-center justify-between min-w-0">
                        <h1 className="text-lg font-bold text-gray-800 truncate">
                            {visibleNavItems.find(n => n.href === location || (n.href !== "/fazenda" && location.startsWith(n.href)))?.label || "AgroFarm"}
                        </h1>
                        <span className="text-xs font-medium text-gray-400 hidden sm:block truncate ml-4 max-w-[200px]">{user.name || user.username}</span>
                    </div>
                </header>

                <div className="flex-1 w-full px-2 sm:px-6 lg:px-8 py-4 sm:py-6 overflow-x-hidden">
                    {children}
                </div>
            </main>
        </div>
    );
}

