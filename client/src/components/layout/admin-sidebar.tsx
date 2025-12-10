import { useLocation } from "wouter";
import { 
  Users, 
  Package, 
  FolderTree, 
  Percent,
  Settings,
  LayoutDashboard,
  LogOut,
  Repeat,
  Trophy
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface AdminSidebarProps {
  collapsed: boolean;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

const adminMenuItems = [
  { tab: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { tab: "users", icon: Users, label: "Usuários" },
  { tab: "master-clients", icon: Users, label: "Clientes Master" },
  { tab: "categories", icon: FolderTree, label: "Categorias" },
  { tab: "subcategories", icon: FolderTree, label: "Subcategorias" },
  { tab: "products", icon: Package, label: "Produtos" },
  { tab: "commissions", icon: Percent, label: "Comissões" },
  { tab: "parameters", icon: Settings, label: "Parâmetros" },
  { tab: "barter", icon: Repeat, label: "Barter" },
  { tab: "timac", icon: Trophy, label: "Timac" },
];

export default function AdminSidebar({ collapsed, activeTab = "users", onTabChange }: AdminSidebarProps) {
  const [location, setLocation] = useLocation();
  const { user, logoutMutation } = useAuth();

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

  return (
    <aside 
      className={`bg-card border-r border-border flex flex-col slide-in transition-all duration-300 ${
        collapsed ? 'w-20' : 'w-72'
      }`}
      data-testid="admin-sidebar"
    >
      {/* Logo & Brand */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Settings className="text-white text-xl" />
          </div>
          {!collapsed && (
            <div className="menu-text">
              <h1 className="text-lg font-bold text-foreground">Super Admin</h1>
              <p className="text-xs text-muted-foreground">Painel de Gestão</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4">
        <ul className="space-y-1">
          {adminMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.tab;
            
            return (
              <li key={item.tab}>
                <button
                  onClick={() => onTabChange?.(item.tab)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors border-l-4 ${
                    isActive 
                      ? 'bg-blue-50 dark:bg-blue-950 text-blue-800 dark:text-blue-200 border-blue-600 dark:border-blue-500' 
                      : 'hover:bg-muted text-foreground border-transparent'
                  }`}
                  data-testid={`admin-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <Icon className="text-lg flex-shrink-0" size={20} />
                  {!collapsed && (
                    <span className="menu-text font-medium text-left">{item.label}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Section */}
      <div className="border-t border-border p-4">
        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white font-medium text-sm">
              {user ? getInitials(user.name) : 'SA'}
            </span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0 menu-text">
              <p className="text-sm font-medium text-foreground truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground">Super Admin</p>
            </div>
          )}
        </div>
        {!collapsed && (
          <button
            onClick={handleLogout}
            className="mt-3 w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
            data-testid="admin-logout-button"
          >
            <LogOut size={16} />
            <span>Sair</span>
          </button>
        )}
      </div>
    </aside>
  );
}
