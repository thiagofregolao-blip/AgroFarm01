import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";

export function EmpresaRoute({
    path,
    component: Component,
}: {
    path: string;
    component: () => React.JSX.Element;
}) {
    const { user, isLoading } = useAuth();

    // Check if user is linked to a company (covers rtv, director, faturista, etc.)
    const { data: company, isLoading: companyLoading } = useQuery<any>({
        queryKey: ["/api/company/me"],
        queryFn: () => fetch("/api/company/me", { credentials: "include" })
            .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; }),
        enabled: !!user,
        retry: false,
    });

    if (isLoading || companyLoading) {
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

    // Allow access if user is admin or has an active company link
    if (user.role !== 'administrador' && !company) {
        return (
            <Route path={path}>
                <Redirect to="/dashboard" />
            </Route>
        );
    }

    return <Route path={path} component={Component} />;
}
