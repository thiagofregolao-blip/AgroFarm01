import { ReactNode, useState } from "react";
import { useLocation } from "wouter";
import {
    Home, Warehouse, Map, Package, FileText, BarChart3,
    LogOut, DollarSign, Monitor, TrendingUp, Sprout, User
} from "lucide-react";
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
    { label: "Perfil", href: "/fazenda/perfil", icon: User },
];

export default function FarmLayout({ children }: { children: ReactNode }) {
    const [location, setLocation] = useLocation();
    const { user, logoutMutation } = useAuth();

    const handleLogout = () => {
        logoutMutation.mutate(undefined, {
            onSuccess: () => setLocation("/fazenda/login"),
        });
    };

    if (!user) {
        setLocation("/fazenda/login");
        return null;
    }

    return (
        <div className="min-h-screen bg-gray-100 flex">
            {/* ===== FIXED GREEN SIDEBAR (mobile + desktop) ===== */}
            <aside className="w-[60px] md:w-[200px] bg-gradient-to-b from-emerald-700 via-emerald-600 to-emerald-800 text-white flex flex-col shrink-0 fixed left-0 top-0 bottom-0 z-40 shadow-xl">
                {/* Logo / Brand */}
                <div className="flex items-center gap-2.5 px-3 py-4 border-b border-white/10">
                    <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-lg shrink-0">
                        🚜
                    </div>
                    <div className="hidden md:block min-w-0">
                        <span className="font-bold text-sm leading-tight block truncate">AgroFarm</span>
                        <span className="text-[10px] text-emerald-200 truncate block">{user.name || user.username}</span>
                    </div>
                </div>

                {/* Nav items */}
                <nav className="flex-1 overflow-y-auto py-2 px-1.5 space-y-0.5">
                    {navItems.map((item) => {
                        const isActive = location === item.href ||
                            (item.href !== "/fazenda" && location.startsWith(item.href));
                        const Icon = item.icon;
                        return (
                            <button
                                key={item.href}
                                onClick={() => setLocation(item.href)}
                                className={`
                                    w-full flex items-center gap-2.5 rounded-xl transition-all duration-150
                                    px-2.5 py-2.5 md:px-3 md:py-2
                                    ${isActive
                                        ? "bg-white/20 text-white shadow-md shadow-black/10"
                                        : "text-emerald-100/70 hover:bg-white/10 hover:text-white"
                                    }
                                `}
                                title={item.label}
                            >
                                <Icon className={`h-5 w-5 shrink-0 ${isActive ? "text-white" : "text-emerald-200/60"}`} />
                                <span className={`text-sm font-medium truncate hidden md:block ${isActive ? "text-white" : ""}`}>{item.label}</span>
                                {isActive && <div className="hidden md:block ml-auto w-1.5 h-1.5 rounded-full bg-white shadow-sm" />}
                            </button>
                        );
                    })}
                </nav>

                {/* Logout */}
                <div className="p-2 border-t border-white/10">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2.5 px-2.5 py-2.5 md:px-3 md:py-2 rounded-xl text-emerald-200/70 hover:bg-red-500/20 hover:text-red-200 transition-colors"
                        title="Sair"
                    >
                        <LogOut className="h-5 w-5 shrink-0" />
                        <span className="text-sm font-medium hidden md:block">Sair</span>
                    </button>
                </div>
            </aside>

            {/* ===== MAIN CONTENT (offset by sidebar width) ===== */}
            <main className="flex-1 ml-[60px] md:ml-[200px] min-h-screen overflow-x-hidden max-w-[calc(100vw-60px)] md:max-w-[calc(100vw-200px)]">
                {/* Top bar with page title */}
                <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200/60 shadow-sm sticky top-0 z-30">
                    <div className="px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
                        <h1 className="text-lg font-bold text-gray-800">
                            {navItems.find(n => n.href === location || (n.href !== "/fazenda" && location.startsWith(n.href)))?.label || "AgroFarm"}
                        </h1>
                        <span className="text-xs text-gray-400 hidden sm:block">{user.name || user.username}</span>
                    </div>
                </header>

                <div className="px-2 sm:px-6 lg:px-8 py-4 sm:py-6 overflow-x-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}
