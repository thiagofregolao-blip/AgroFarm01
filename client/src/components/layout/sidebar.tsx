import { useState, useEffect } from "react";
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
  Sprout,
  TrendingUp,
  LogOut,
  History,
  Repeat,
  ListChecks,
  Kanban
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";

interface SidebarProps {
  collapsed: boolean;
}

const menuItems = [
  { href: "/dashboard", icon: BarChart3, label: "Dashboard" },
  { href: "/vendas", icon: ShoppingCart, label: "Minhas Vendas" },
  { href: "/barter", icon: Repeat, label: "Barter" },
  { href: "/kanban-metas", icon: Kanban, label: "Oportunidades de Negócio" },
  { href: "/clientes", icon: Users, label: "Clientes" },
  // { href: "/mercado", icon: TrendingUp, label: "Mercado" }, // Temporarily hidden
  { href: "/historico-compras", icon: History, label: "Histórico Compras" },
  { href: "/safras", icon: Calendar, label: "Safras" },
  { href: "/produtos", icon: Package, label: "Produtos" },
  { href: "/relatorios", icon: FileText, label: "Relatórios" },
];

const configItems = [
  { href: "/metas", icon: Target, label: "Metas" },
  { href: "/comissoes", icon: Percent, label: "Comissões" },
];

const adminItems = [
  { href: "/admin", icon: Settings, label: "Super Admin" },
];

export default function Sidebar({ collapsed }: SidebarProps) {
  const [location, setLocation] = useLocation();
  const { user, logoutMutation } = useAuth();
  const [currentHash, setCurrentHash] = useState(window.location.hash);

  // Listen to hash changes to update active state
  useEffect(() => {
    const handleHashChange = () => {
      setCurrentHash(window.location.hash);
    };
    
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        setLocation("/auth");
      }
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleLabel = (role: string) => {
    const roleMap: Record<string, string> = {
      consultor: 'Consultor',
      gerente: 'Gerente',
      administrador: 'Administrador',
      faturista: 'Faturista',
    };
    return roleMap[role] || role;
  };

  return (
    <aside 
      className={`bg-card border-r border-border flex flex-col slide-in transition-all duration-300 ${
        collapsed ? 'w-20' : 'w-72'
      }`}
      data-testid="sidebar"
    >
      {/* Logo & Brand */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
            <Sprout className="text-primary-foreground text-xl" />
          </div>
          {!collapsed && (
            <div className="menu-text">
              <h1 className="text-lg font-bold text-foreground">Agro Farm Digital</h1>
              <p className="text-xs text-muted-foreground">Gestão de Comissões</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4">
        {/* Menu principal - Ocultar para gerentes e faturistas */}
        {user?.role !== 'gerente' && user?.role !== 'faturista' && (
          <>
            <ul className="space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.href || (item.href === '/dashboard' && location === '/');
                
                return (
                  <li key={item.href}>
                    <Link 
                      href={item.href}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors border-l-4 ${
                        isActive 
                          ? 'bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200 border-green-600 dark:border-green-500' 
                          : 'hover:bg-muted text-foreground border-transparent'
                      }`}
                      data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <Icon className="text-lg flex-shrink-0" size={20} />
                      {!collapsed && (
                        <span className="menu-text font-medium">{item.label}</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="mt-8 pt-4 border-t border-border">
              {!collapsed && (
                <p className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider menu-text mb-2">
                  Configurações
                </p>
              )}
              <ul className="space-y-1">
                {configItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location === item.href;
                  
                  return (
                    <li key={item.href}>
                      <Link 
                        href={item.href}
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors border-l-4 ${
                          isActive 
                            ? 'bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200 border-green-600 dark:border-green-500' 
                            : 'hover:bg-muted text-foreground border-transparent'
                        }`}
                        data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        <Icon className="text-lg flex-shrink-0" size={20} />
                        {!collapsed && (
                          <span className="menu-text font-medium">{item.label}</span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        )}

        {/* Manager Section - Only for gerente */}
        {user?.role === 'gerente' && (
          <div className="mt-8 pt-4 border-t border-border">
            {!collapsed && (
              <p className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider menu-text mb-2">
                Gerência
              </p>
            )}
            <ul className="space-y-1">
              {/* Main link - Only show when NOT on manager page */}
              {location !== '/manager' && (
                <li>
                  <Link 
                    href="/manager#dashboard"
                    className="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors border-l-4 hover:bg-muted text-foreground border-transparent"
                    data-testid="nav-painel-gerente"
                  >
                    <Users className="text-lg flex-shrink-0" size={20} />
                    {!collapsed && (
                      <span className="menu-text font-medium">Painel Gerente</span>
                    )}
                  </Link>
                </li>
              )}
              
              {/* Submenu - Only show when on manager page */}
              {location === '/manager' && !collapsed && (
                <>
                  <li>
                    <a
                      href="#dashboard"
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ml-4 ${
                        currentHash === '#dashboard' || currentHash === ''
                          ? 'bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200'
                          : 'hover:bg-muted text-foreground'
                      }`}
                      data-testid="tab-dashboard"
                    >
                      <TrendingUp className="text-lg flex-shrink-0" size={18} />
                      <span className="menu-text font-medium">Dashboard</span>
                    </a>
                  </li>
                  <li>
                    <a
                      href="#team"
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ml-4 ${
                        currentHash === '#team'
                          ? 'bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200'
                          : 'hover:bg-muted text-foreground'
                      }`}
                      data-testid="tab-team"
                    >
                      <Users className="text-lg flex-shrink-0" size={18} />
                      <span className="menu-text font-medium">Equipe</span>
                    </a>
                  </li>
                  <li>
                    <a
                      href="#action-plans"
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ml-4 ${
                        currentHash === '#action-plans'
                          ? 'bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200'
                          : 'hover:bg-muted text-foreground'
                      }`}
                      data-testid="tab-action-plans"
                    >
                      <ListChecks className="text-lg flex-shrink-0" size={18} />
                      <span className="menu-text font-medium">Planos de Ação</span>
                    </a>
                  </li>
                  <li>
                    <a
                      href="#metas"
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ml-4 ${
                        currentHash === '#metas'
                          ? 'bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200'
                          : 'hover:bg-muted text-foreground'
                      }`}
                      data-testid="tab-metas"
                    >
                      <Target className="text-lg flex-shrink-0" size={18} />
                      <span className="menu-text font-medium">Metas</span>
                    </a>
                  </li>
                </>
              )}
            </ul>
          </div>
        )}

        {/* Admin Section - Only for administrador */}
        {user?.role === 'administrador' && (
          <div className="mt-8 pt-4 border-t border-border">
            {!collapsed && (
              <p className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider menu-text mb-2">
                Administração
              </p>
            )}
            <ul className="space-y-1">
              <li>
                <Link 
                  href="/admin#dashboard"
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors border-l-4 ${
                    location === '/admin'
                      ? 'bg-blue-50 dark:bg-blue-950 text-blue-800 dark:text-blue-200 border-blue-600 dark:border-blue-500' 
                      : 'hover:bg-muted text-foreground border-transparent'
                  }`}
                  data-testid="nav-super-admin"
                >
                  <Settings className="text-lg flex-shrink-0" size={20} />
                  {!collapsed && (
                    <span className="menu-text font-medium">Super Admin</span>
                  )}
                </Link>
              </li>
              
              {/* Submenu - Only show when on admin page */}
              {location === '/admin' && !collapsed && (
                <>
                  <li>
                    <a
                      href="#dashboard"
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ml-4 ${
                        currentHash === '#dashboard' || currentHash === ''
                          ? 'bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200'
                          : 'hover:bg-muted text-foreground'
                      }`}
                      data-testid="tab-dashboard"
                    >
                      <BarChart3 className="text-lg flex-shrink-0" size={18} />
                      <span className="menu-text font-medium">Dashboard</span>
                    </a>
                  </li>
                  <li>
                    <a
                      href="#users"
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ml-4 ${
                        currentHash === '#users'
                          ? 'bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200'
                          : 'hover:bg-muted text-foreground'
                      }`}
                      data-testid="tab-users"
                    >
                      <Users className="text-lg flex-shrink-0" size={18} />
                      <span className="menu-text font-medium">Usuários</span>
                    </a>
                  </li>
                  <li>
                    <a
                      href="#master-clients"
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ml-4 ${
                        currentHash === '#master-clients'
                          ? 'bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200'
                          : 'hover:bg-muted text-foreground'
                      }`}
                      data-testid="tab-master-clients"
                    >
                      <Users className="text-lg flex-shrink-0" size={18} />
                      <span className="menu-text font-medium">Clientes Master</span>
                    </a>
                  </li>
                  <li>
                    <a
                      href="#categories"
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ml-4 ${
                        currentHash === '#categories'
                          ? 'bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200'
                          : 'hover:bg-muted text-foreground'
                      }`}
                      data-testid="tab-categories"
                    >
                      <Package className="text-lg flex-shrink-0" size={18} />
                      <span className="menu-text font-medium">Categorias</span>
                    </a>
                  </li>
                  <li>
                    <a
                      href="#subcategories"
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ml-4 ${
                        currentHash === '#subcategories'
                          ? 'bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200'
                          : 'hover:bg-muted text-foreground'
                      }`}
                      data-testid="tab-subcategories"
                    >
                      <Package className="text-lg flex-shrink-0" size={18} />
                      <span className="menu-text font-medium">Subcategorias</span>
                    </a>
                  </li>
                  <li>
                    <a
                      href="#products"
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ml-4 ${
                        currentHash === '#products'
                          ? 'bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200'
                          : 'hover:bg-muted text-foreground'
                      }`}
                      data-testid="tab-products"
                    >
                      <Package className="text-lg flex-shrink-0" size={18} />
                      <span className="menu-text font-medium">Produtos</span>
                    </a>
                  </li>
                  <li>
                    <a
                      href="#commissions"
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ml-4 ${
                        currentHash === '#commissions'
                          ? 'bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200'
                          : 'hover:bg-muted text-foreground'
                      }`}
                      data-testid="tab-commissions"
                    >
                      <Percent className="text-lg flex-shrink-0" size={18} />
                      <span className="menu-text font-medium">Comissões</span>
                    </a>
                  </li>
                  <li>
                    <a
                      href="#parameters"
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ml-4 ${
                        currentHash === '#parameters'
                          ? 'bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200'
                          : 'hover:bg-muted text-foreground'
                      }`}
                      data-testid="tab-parameters"
                    >
                      <Settings className="text-lg flex-shrink-0" size={18} />
                      <span className="menu-text font-medium">Parâmetros</span>
                    </a>
                  </li>
                  <li>
                    <a
                      href="#barter"
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ml-4 ${
                        currentHash === '#barter'
                          ? 'bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200'
                          : 'hover:bg-muted text-foreground'
                      }`}
                      data-testid="tab-barter"
                    >
                      <Repeat className="text-lg flex-shrink-0" size={18} />
                      <span className="menu-text font-medium">Barter</span>
                    </a>
                  </li>
                  <li>
                    <a
                      href="#timac"
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ml-4 ${
                        currentHash === '#timac'
                          ? 'bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200'
                          : 'hover:bg-muted text-foreground'
                      }`}
                      data-testid="tab-timac"
                    >
                      <Target className="text-lg flex-shrink-0" size={18} />
                      <span className="menu-text font-medium">Timac</span>
                    </a>
                  </li>
                </>
              )}
            </ul>
          </div>
        )}

        {/* Faturista Section - Only for faturista */}
        {user?.role === 'faturista' && (
          <div className="mt-8 pt-4 border-t border-border">
            {!collapsed && (
              <p className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider menu-text mb-2">
                Controle de Estoque
              </p>
            )}
            <ul className="space-y-1">
              <li>
                <Link 
                  href="/faturista"
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors border-l-4 ${
                    location === '/faturista'
                      ? 'bg-orange-50 dark:bg-orange-950 text-orange-800 dark:text-orange-200 border-orange-600 dark:border-orange-500' 
                      : 'hover:bg-muted text-foreground border-transparent'
                  }`}
                  data-testid="nav-faturista"
                >
                  <Package className="text-lg flex-shrink-0" size={20} />
                  {!collapsed && (
                    <span className="menu-text font-medium">Faturista</span>
                  )}
                </Link>
              </li>
            </ul>
          </div>
        )}
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-border">
        {!collapsed ? (
          <div className="space-y-2">
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted cursor-pointer transition-colors">
              <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center">
                <span className="text-secondary-foreground font-semibold">
                  {user ? getInitials(user.name) : 'U'}
                </span>
              </div>
              <div className="menu-text flex-1">
                <p className="text-sm font-medium text-foreground">{user?.name || 'Usuário'}</p>
                <p className="text-xs text-muted-foreground">{user ? getRoleLabel(user.role) : ''}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
              data-testid="button-logout"
            >
              <LogOut size={20} className="flex-shrink-0" />
              <span className="menu-text font-medium">Sair</span>
            </button>
          </div>
        ) : (
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center px-4 py-3 rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
            data-testid="button-logout"
            title="Sair"
          >
            <LogOut size={20} />
          </button>
        )}
      </div>
    </aside>
  );
}
