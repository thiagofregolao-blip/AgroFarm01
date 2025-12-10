import { 
  BarChart3,
  Users,
  Package,
  FolderTree,
  Percent,
  Settings,
  Repeat,
  Target,
  Calendar,
  DollarSign,
  Shield
} from "lucide-react";

interface AdminNavbarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const menuItems = [
  { id: "dashboard", icon: BarChart3, label: "Dashboard" },
  { id: "users", icon: Users, label: "Usuários" },
  { id: "master-clients", icon: Users, label: "Clientes" },
  { id: "seasons", icon: Calendar, label: "Safras" },
  { id: "categories", icon: Package, label: "Categorias" },
  { id: "subcategories", icon: FolderTree, label: "Subcategorias" },
  { id: "products", icon: Package, label: "Produtos" },
  { id: "price-table", icon: DollarSign, label: "Tabela de Preços" },
  { id: "commissions", icon: Percent, label: "Comissões" },
  { id: "parameters", icon: Settings, label: "Parâmetros" },
  { id: "barter", icon: Repeat, label: "Barter" },
  { id: "timac", icon: Target, label: "Timac" },
  { id: "system", icon: Shield, label: "Sistema" },
];

export default function AdminNavbar({ activeTab, onTabChange }: AdminNavbarProps) {
  return (
    <nav className="bg-card border-b border-border">
      <div className="px-8 py-0">
        <div className="flex items-center gap-1 overflow-x-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => {
                  onTabChange(item.id);
                  window.location.hash = item.id;
                }}
                className={`flex items-center gap-2 px-4 py-3 whitespace-nowrap transition-colors border-b-2 ${
                  isActive 
                    ? 'text-primary border-primary font-medium' 
                    : 'text-muted-foreground hover:text-foreground border-transparent'
                }`}
                data-testid={`nav-${item.id}`}
              >
                <Icon size={18} />
                <span className="text-sm">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
