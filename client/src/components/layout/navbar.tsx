import { Link, useLocation } from "wouter";
import {
  BarChart3,
  ShoppingCart,
  Percent,
  Users,
  Calendar,
  Package,
  FileText,
  Settings,
  Target,
  TrendingUp,
  History,
  Repeat,
  Kanban,
  Menu,
  X,
  ClipboardList
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { useState } from "react";

const menuItems = [
  { href: "/dashboard", icon: BarChart3, label: "Dashboard" },
  { href: "/vendas", icon: ShoppingCart, label: "Minhas Vendas" },
  { href: "/planejamento", icon: ClipboardList, label: "Planejamento 2026" },
  { href: "/barter", icon: Repeat, label: "Barter" },
  { href: "/kanban-metas", icon: Kanban, label: "Oportunidades de Negócio" },
  { href: "/clientes", icon: Users, label: "Clientes" },
  // { href: "/mercado", icon: TrendingUp, label: "Mercado" }, // Temporarily hidden
  { href: "/historico-compras", icon: History, label: "Histórico Compras" },
  { href: "/relatorios", icon: FileText, label: "Relatórios" },
];

const adminOnlyItems = [
  { href: "/safras", icon: Calendar, label: "Safras" },
  { href: "/produtos", icon: Package, label: "Produtos" },
];

const configItems = [
  { href: "/metas", icon: Target, label: "Metas" },
  { href: "/comissoes", icon: Percent, label: "Carregar Arquivos" },
];

export default function Navbar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Don't show navbar for gerente and faturista
  if (user?.role === 'gerente' || user?.role === 'faturista') {
    return null;
  }

  const isAdmin = user?.role === 'administrador';

  const NavLink = ({ item, onClick }: { item: typeof menuItems[0]; onClick?: () => void }) => {
    const Icon = item.icon;
    const isActive = location === item.href || (item.href === '/dashboard' && location === '/');

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onClick}
        className={`flex items-center gap-2 px-4 py-3 whitespace-nowrap transition-colors border-b-2 md:border-b-2 ${isActive
          ? 'text-primary border-primary font-medium bg-primary/5 md:bg-transparent'
          : 'text-muted-foreground hover:text-foreground border-transparent hover:bg-muted/50 md:hover:bg-transparent'
          }`}
        data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <Icon size={18} />
        <span className="text-sm">{item.label}</span>
      </Link>
    );
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <div className="md:hidden bg-card border-b border-border">
        <div className="px-4 py-2 flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Menu</span>
          <Button
            variant="ghost"
            className="h-11 w-11 p-0"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Abrir menu de navegação"
            data-testid="mobile-menu-button"
          >
            <Menu size={24} />
          </Button>
        </div>
      </div>

      {/* Desktop Navbar - Hidden on Mobile */}
      <nav className="hidden md:block bg-card border-b border-border">
        <div className="px-8 py-0">
          <div className="flex items-center gap-1 overflow-x-auto">
            {/* Main Menu Items */}
            {menuItems.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}

            {/* Admin Only Items - Safras e Produtos */}
            {isAdmin && adminOnlyItems.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}

            {/* Separator */}
            <div className="h-6 w-px bg-border mx-2" />

            {/* Config Items */}
            {configItems.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}

            {/* Admin Link - Only for administrador */}
            {user?.role === 'administrador' && (
              <>
                <div className="h-6 w-px bg-border mx-2" />
                <Link
                  href="/admin#dashboard"
                  className={`flex items-center gap-2 px-4 py-3 whitespace-nowrap transition-colors border-b-2 ${location === '/admin'
                    ? 'text-blue-600 border-blue-600 font-medium'
                    : 'text-muted-foreground hover:text-foreground border-transparent'
                    }`}
                  data-testid="nav-super-admin"
                >
                  <Settings size={18} />
                  <span className="text-sm">Super Admin</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile Menu Sheet */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-72">
          <SheetHeader className="flex flex-row items-center justify-between">
            <SheetTitle>Menu de Navegação</SheetTitle>
            <SheetClose asChild>
              <Button variant="ghost" className="h-11 w-11 p-0" aria-label="Fechar menu" data-testid="close-mobile-menu">
                <X size={20} />
              </Button>
            </SheetClose>
          </SheetHeader>

          <div className="flex flex-col gap-1 mt-6">
            {/* Main Menu Items */}
            {menuItems.map((item) => (
              <NavLink key={item.href} item={item} onClick={() => setMobileMenuOpen(false)} />
            ))}

            {/* Admin Only Items */}
            {isAdmin && (
              <>
                <div className="my-2 border-t border-border" />
                <p className="px-4 py-2 text-xs font-semibold text-muted-foreground">Administração</p>
                {adminOnlyItems.map((item) => (
                  <NavLink key={item.href} item={item} onClick={() => setMobileMenuOpen(false)} />
                ))}
              </>
            )}

            {/* Config Items */}
            <div className="my-2 border-t border-border" />
            <p className="px-4 py-2 text-xs font-semibold text-muted-foreground">Configurações</p>
            {configItems.map((item) => (
              <NavLink key={item.href} item={item} onClick={() => setMobileMenuOpen(false)} />
            ))}

            {/* Admin Link */}
            {user?.role === 'administrador' && (
              <>
                <div className="my-2 border-t border-border" />
                <Link
                  href="/admin#dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2 px-4 py-3 whitespace-nowrap transition-colors ${location === '/admin'
                    ? 'text-blue-600 font-medium bg-blue-50'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                  data-testid="nav-super-admin"
                >
                  <Settings size={18} />
                  <span className="text-sm">Super Admin</span>
                </Link>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
