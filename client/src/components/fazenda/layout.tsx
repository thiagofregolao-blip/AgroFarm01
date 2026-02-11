import { ReactNode, useState } from "react";
import { useLocation } from "wouter";
import {
    Home, Warehouse, Map, Package, FileText, BarChart3,
    LogOut, Menu, X, DollarSign, Monitor, TrendingUp, ChevronDown, Sprout
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

const navItems = [
    { label: "Início", href: "/fazenda", icon: Home },
    { label: "Propriedades", href: "/fazenda/propriedades", icon: Map },
    { label: "Safras", href: "/fazenda/safras", icon: Sprout },
    { label: "Produtos", href: "/fazenda/produtos", icon: Package },
    { label: "Faturas", href: "/fazenda/faturas", icon: FileText },
    { label: "Estoque", href: "/fazenda/estoque", icon: Warehouse },
    { label: "Aplicações", href: "/fazenda/aplicacoes", icon: BarChart3 },
    { label: "Custo/Talhão", href: "/fazenda/custos", icon: TrendingUp },
    { label: "Despesas", href: "/fazenda/despesas", icon: DollarSign },
    { label: "Terminais PDV", href: "/fazenda/terminais", icon: Monitor },
];

export default function FarmLayout({ children }: { children: ReactNode }) {
    const [location, setLocation] = useLocation();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const { user, logoutMutation } = useAuth();

    const handleLogout = () => {
        logoutMutation.mutate(undefined, {
            onSuccess: () => setLocation("/auth"),
        });
    };

    if (!user) {
        setLocation("/auth");
        return null;
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Top green header bar */}
            <header className="bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-md z-30">
                <div className="max-w-[1400px] mx-auto px-4">
                    <div className="flex items-center justify-between h-12">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-lg backdrop-blur-sm">
                                🚜
                            </div>
                            <span className="font-bold text-lg hidden sm:block">AgroFarm</span>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-sm text-white/80 hidden sm:block">{user.username || user.fullName}</span>
                            <button
                                onClick={handleLogout}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                                title="Sair"
                            >
                                <LogOut className="h-4 w-4" />
                                <span className="hidden sm:inline">Sair</span>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Navigation bar with icons */}
            <nav className="bg-white border-b border-gray-200 shadow-sm z-20 sticky top-0">
                {/* Desktop nav */}
                <div className="hidden md:block">
                    <div className="max-w-[1400px] mx-auto px-2">
                        <div className="flex items-center justify-center gap-0">
                            {navItems.map((item) => {
                                const isActive = location === item.href ||
                                    (item.href !== "/fazenda" && location.startsWith(item.href));
                                const Icon = item.icon;
                                return (
                                    <button
                                        key={item.href}
                                        onClick={() => setLocation(item.href)}
                                        className={`
                                            flex flex-col items-center gap-1.5 px-5 py-4 relative text-center
                                            transition-colors duration-150 min-w-[90px]
                                            ${isActive
                                                ? "text-emerald-600"
                                                : "text-gray-500 hover:text-emerald-600 hover:bg-emerald-50/50"
                                            }
                                        `}
                                    >
                                        <Icon className={`h-7 w-7 ${isActive ? "text-emerald-600" : "text-gray-400"}`} />
                                        <span className={`text-xs leading-tight font-medium ${isActive ? "text-emerald-600" : ""}`}>{item.label}</span>
                                        {isActive && (
                                            <div className="absolute bottom-0 left-2 right-2 h-[3px] bg-emerald-500 rounded-t-full" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Mobile nav - hamburger */}
                <div className="md:hidden">
                    <div className="flex items-center justify-between px-4 py-2">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-700">
                                {navItems.find(n => n.href === location || (n.href !== "/fazenda" && location.startsWith(n.href)))?.label || "Menu"}
                            </span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                            <ChevronDown className={`h-3 w-3 ml-1 transition-transform ${mobileMenuOpen ? "rotate-180" : ""}`} />
                        </Button>
                    </div>

                    {/* Mobile dropdown */}
                    {mobileMenuOpen && (
                        <div className="border-t border-gray-100 bg-white pb-2 shadow-lg">
                            <div className="grid grid-cols-4 gap-1 p-2">
                                {navItems.map((item) => {
                                    const isActive = location === item.href ||
                                        (item.href !== "/fazenda" && location.startsWith(item.href));
                                    const Icon = item.icon;
                                    return (
                                        <button
                                            key={item.href}
                                            onClick={() => { setLocation(item.href); setMobileMenuOpen(false); }}
                                            className={`
                                                flex flex-col items-center gap-1.5 p-3 rounded-xl text-center
                                                transition-colors
                                                ${isActive
                                                    ? "bg-emerald-50 text-emerald-700"
                                                    : "text-gray-500 hover:bg-gray-50"
                                                }
                                            `}
                                        >
                                            <Icon className={`h-5 w-5 ${isActive ? "text-emerald-600" : "text-gray-400"}`} />
                                            <span className="text-[10px] leading-tight font-medium">{item.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </nav>

            {/* Main content */}
            <main className="flex-1">
                <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    {children}
                </div>
            </main>
        </div>
    );
}
