import { ReactNode, useState } from "react";
import { useLocation } from "wouter";
import {
    Home, Warehouse, Map, Package, FileText, BarChart3,
    LogOut, Menu, X, DollarSign, Monitor, ChevronRight, TrendingUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

const navItems = [
    { label: "Dashboard", href: "/fazenda", icon: Home },
    { label: "Propriedades", href: "/fazenda/propriedades", icon: Map },
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
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { user, logoutMutation } = useAuth();

    const handleLogout = () => {
        logoutMutation.mutate(undefined, {
            onSuccess: () => setLocation("/auth"),
        });
    };

    // Redirect if not authenticated
    if (!user) {
        setLocation("/auth");
        return null;
    }


    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
            {/* Mobile header */}
            <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-emerald-100 shadow-sm">
                <div className="flex items-center gap-2">
                    <span className="text-2xl">🚜</span>
                    <span className="font-bold text-emerald-800 text-lg">AgroFarm</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
                    {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </Button>
            </div>

            <div className="flex">
                {/* Sidebar */}
                <aside className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-emerald-100 shadow-lg
          transform transition-transform duration-200 ease-in-out
          lg:translate-x-0 lg:static lg:z-auto
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
                    <div className="flex flex-col h-full">
                        {/* Logo */}
                        <div className="px-6 py-5 border-b border-emerald-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center text-white text-xl shadow-md">
                                    🚜
                                </div>
                                <div>
                                    <h1 className="font-bold text-emerald-800 text-lg">AgroFarm</h1>
                                    <p className="text-xs text-emerald-500">Gestão de Fazenda</p>
                                </div>
                            </div>
                        </div>

                        {/* Nav items */}
                        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
                            {navItems.map((item) => {
                                const isActive = location === item.href ||
                                    (item.href !== "/fazenda" && location.startsWith(item.href));
                                const Icon = item.icon;
                                return (
                                    <button
                                        key={item.href}
                                        onClick={() => { setLocation(item.href); setSidebarOpen(false); }}
                                        className={`
                      w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                      transition-all duration-150
                      ${isActive
                                                ? 'bg-emerald-100 text-emerald-800 shadow-sm'
                                                : 'text-gray-600 hover:bg-emerald-50 hover:text-emerald-700'}
                    `}
                                    >
                                        <Icon className={`h-5 w-5 ${isActive ? 'text-emerald-600' : 'text-gray-400'}`} />
                                        {item.label}
                                        {isActive && <ChevronRight className="h-4 w-4 ml-auto text-emerald-400" />}
                                    </button>
                                );
                            })}
                        </nav>

                        {/* Logout */}
                        <div className="p-3 border-t border-emerald-100">
                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                            >
                                <LogOut className="h-5 w-5" />
                                Sair
                            </button>
                        </div>
                    </div>
                </aside>

                {/* Overlay */}
                {sidebarOpen && (
                    <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
                )}

                {/* Main content */}
                <main className="flex-1 p-4 lg:p-8 min-h-screen">
                    {children}
                </main>
            </div>
        </div>
    );
}
