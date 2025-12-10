import { 
  Package,
  BarChart3
} from "lucide-react";

interface FaturistaNavbarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  selectedSession?: string | null;
}

const menuItems = [
  { id: "sessions", icon: Package, label: "Sessões" },
  { id: "analysis", icon: BarChart3, label: "Análises" },
];

export default function FaturistaNavbar({ activeTab, onTabChange, selectedSession }: FaturistaNavbarProps) {
  return (
    <nav className="bg-card border-b border-border">
      <div className="px-8 py-0">
        <div className="flex items-center gap-1 overflow-x-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const isDisabled = item.id === 'analysis' && !selectedSession;
            
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (!isDisabled) {
                    onTabChange(item.id);
                  }
                }}
                disabled={isDisabled}
                className={`flex items-center gap-2 px-4 py-3 whitespace-nowrap transition-colors border-b-2 ${
                  isActive 
                    ? 'text-orange-600 border-orange-600 font-medium' 
                    : isDisabled
                    ? 'text-muted-foreground/50 border-transparent cursor-not-allowed'
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
