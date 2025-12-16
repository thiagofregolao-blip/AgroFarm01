import { Link } from "wouter";
import {
  BarChart3,
  Users,
  ListChecks,
  Target,
  Settings
} from "lucide-react";

interface ManagerNavbarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const menuItems = [
  { id: "dashboard", icon: BarChart3, label: "Dashboard" },
  { id: "team", icon: Users, label: "Equipe" },
  { id: "action-plans", icon: ListChecks, label: "Planos de Ação" },
  { id: "metas", icon: Target, label: "Metas" },
  { id: "gestao-potencial", icon: Settings, label: "Gestão de Potencial" },
];

export default function ManagerNavbar({ activeTab, onTabChange }: ManagerNavbarProps) {
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
                className={`flex items-center gap-2 px-4 py-3 whitespace-nowrap transition-colors border-b-2 ${isActive
                    ? 'text-green-600 border-green-600 font-medium'
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
