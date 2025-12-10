import { Link, useLocation } from "wouter";
import { Home, Calendar, Users, MapPin, Settings } from "lucide-react";

export default function CRMLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { path: "/crm/home", icon: Home, label: "Início" },
    { path: "/crm/agenda", icon: Calendar, label: "Agenda" },
    { path: "/crm/clientes", icon: Users, label: "Clientes" },
    { path: "/crm/farms", icon: MapPin, label: "Fazendas" },
    { path: "/crm/settings", icon: Settings, label: "Config" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="bg-green-600 dark:bg-green-700 text-white p-4 shadow-md">
        <h1 className="text-xl font-bold">CRM Agro</h1>
      </header>

      <main className="flex-1 overflow-y-auto pb-16">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex justify-around items-center h-16 shadow-lg">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.path;
          
          return (
            <Link key={item.path} href={item.path} className={`flex flex-col items-center justify-center w-16 h-16 ${
              isActive 
                ? "text-green-600 dark:text-green-400" 
                : "text-gray-600 dark:text-gray-400"
            }`}>
              <Icon className="h-6 w-6" />
              <span className="text-xs mt-1">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
