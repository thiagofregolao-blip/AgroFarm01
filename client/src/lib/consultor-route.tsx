import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";

export function ConsultorRoute({
  path,
  component: Component,
}: {
  path: string;
  component: () => React.JSX.Element;
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-border" />
        </div>
      </Route>
    );
  }

  if (!user) {
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  if (user.role === 'faturista') {
    return (
      <Route path={path}>
        <Redirect to="/faturista" />
      </Route>
    );
  }

  if (user.role === 'agricultor') {
    return (
      <Route path={path}>
        <Redirect to="/fazenda" />
      </Route>
    );
  }

  if (user.role === 'admin_agricultor') {
    return (
      <Route path={path}>
        <Redirect to="/admin-farmers" />
      </Route>
    );
  }

  return <Route path={path} component={Component} />;
}
