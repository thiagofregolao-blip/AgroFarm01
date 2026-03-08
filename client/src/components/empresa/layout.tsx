import { ReactNode, useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
    Home, Package, Users, Warehouse, FileText, CreditCard,
    ArrowLeftRight, Tag, BarChart3, LogOut, Menu, X, Building2, ShoppingCart
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

const navGroups = [
    {
        label: "COMERCIAL",
        items: [
            { label: "Dashboard", href: "/empresa", icon: Home },
            { label: "Pedidos", href: "/empresa/pedidos", icon: ShoppingCart },
            { label: "Clientes", href: "/empresa/clientes", icon: Users },
        ],
    },
    {
        label: "ESTOQUE",
        items: [
            { label: "Estoque", href: "/empresa/estoque", icon: Warehouse },
            { label: "Remissões", href: "/empresa/remissoes", icon: ArrowLeftRight },
        ],
    },
    {
        label: "FINANCEIRO",
        items: [
            { label: "Faturas", href: "/empresa/faturas", icon: FileText },
            { label: "Pagarés", href: "/empresa/pagares", icon: CreditCard },
        ],
    },
    {
        label: "GESTÃO",
        items: [
            { label: "Produtos", href: "/empresa/produtos", icon: Package },
            { label: "Tabelas de Preço", href: "/empresa/tabelas", icon: Tag },
            { label: "Depósitos", href: "/empresa/depositos", icon: Building2 },
        ],
    },
];

export default function EmpresaLayout({ children }: { children: ReactNode }) {
    const [location, setLocation] = useLocation();
    const { user, logoutMutation } = useAuth();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const { data: company } = useQuery<any>({
        queryKey: ["/api/company/me"],
        queryFn: async () => {
            const r = await fetch("/api/company/me", { credentials: "include" });
            if (!r.ok) return null;
            return r.json();
        },
        enabled: !!user,
    });

    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [location]);

    const isActive = (href: string) =>
        href === "/empresa" ? location === "/empresa" : location.startsWith(href);

    const SidebarContent = () => (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b border-slate-700">
                <div className="flex items-center gap-2">
                    <Building2 className="h-6 w-6 text-blue-400" />
                    <div>
                        <p className="text-white font-semibold text-sm leading-tight">
                            {company?.name ?? "Empresa"}
                        </p>
                        <p className="text-slate-400 text-xs capitalize">
                            {company?.role ?? user?.role ?? ""}
                        </p>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-4 px-2">
                {navGroups.map((group) => (
                    <div key={group.label} className="mb-4">
                        <p className="text-slate-500 text-xs font-semibold px-3 mb-1 tracking-wider">
                            {group.label}
                        </p>
                        {group.items.map((item) => {
                            const Icon = item.icon;
                            const active = isActive(item.href);
                            return (
                                <button
                                    key={item.href}
                                    onClick={() => setLocation(item.href)}
                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors mb-0.5 ${
                                        active
                                            ? "bg-blue-600 text-white"
                                            : "text-slate-300 hover:bg-slate-700 hover:text-white"
                                    }`}
                                >
                                    <Icon className="h-4 w-4 flex-shrink-0" />
                                    <span>{item.label}</span>
                                </button>
                            );
                        })}
                    </div>
                ))}
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-slate-700">
                <div className="text-slate-400 text-xs mb-2 truncate">{user?.name}</div>
                <button
                    onClick={() => logoutMutation.mutate()}
                    className="w-full flex items-center gap-2 text-slate-400 hover:text-white text-sm px-2 py-1 rounded hover:bg-slate-700 transition-colors"
                >
                    <LogOut className="h-4 w-4" />
                    Sair
                </button>
            </div>
        </div>
    );

    return (
        <div className="flex h-screen bg-slate-100">
            {/* Desktop Sidebar */}
            <aside className="hidden md:flex flex-col w-56 bg-slate-800 flex-shrink-0">
                <SidebarContent />
            </aside>

            {/* Mobile menu button */}
            <div className="md:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between bg-slate-800 px-4 py-3">
                <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-blue-400" />
                    <span className="text-white font-semibold text-sm">{company?.name ?? "Empresa"}</span>
                </div>
                <button
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="text-white p-1"
                >
                    {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
            </div>

            {/* Mobile Sidebar Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="md:hidden fixed inset-0 z-20 bg-black/50"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}
            <aside
                className={`md:hidden fixed top-0 left-0 bottom-0 z-30 w-56 bg-slate-800 transform transition-transform duration-200 ${
                    isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
                }`}
            >
                <SidebarContent />
            </aside>

            {/* Main content */}
            <main className="flex-1 overflow-auto md:pt-0 pt-14">
                {children}
            </main>
        </div>
    );
}
