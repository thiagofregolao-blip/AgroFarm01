import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Bell, Plus, Sprout, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";

interface HeaderProps {
  onNewSale?: () => void;
  title?: string;
  subtitle?: string;
  showNewSaleButton?: boolean;
}

export default function Header({ onNewSale, title, subtitle, showNewSaleButton = true }: HeaderProps) {
  const { user, logoutMutation } = useAuth();
  const [, setLocation] = useLocation();

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
    <header className="bg-primary border-b border-primary-foreground/10 sticky top-0 z-20">
      <div className="px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#F7D601] rounded-lg flex items-center justify-center">
              <Sprout className="text-primary text-xl" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-primary-foreground">Agro Farm Digital</h1>
              <p className="text-xs text-primary-foreground/80">Gestão de Comissões</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#F7D601] rounded-full flex items-center justify-center">
              <span className="text-primary font-semibold text-sm">
                {user ? getInitials(user.name) : 'U'}
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-primary-foreground">{user?.name || 'Usuário'}</p>
              <p className="text-xs text-primary-foreground/80">{user ? getRoleLabel(user.role) : ''}</p>
            </div>
          </div>

          <Button
            onClick={handleLogout}
            variant="ghost"
            size="sm"
            className="text-white hover:text-white hover:bg-white/20"
            data-testid="button-logout"
          >
            <LogOut size={18} />
          </Button>
        </div>
      </div>
    </header>
  );
}
