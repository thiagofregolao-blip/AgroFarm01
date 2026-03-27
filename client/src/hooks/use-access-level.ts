import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";

/**
 * Hook to check if the current user can edit a specific module.
 * Returns { canEdit, isLoading } for a given module key.
 *
 * For regular farmers/admins: always returns canEdit = true.
 * For funcionario_fazenda: checks the access_level from user_modules.
 */
export function useAccessLevel(moduleKey?: string) {
    const { user } = useAuth();
    const isFuncionario = user?.role === 'funcionario_fazenda';

    const { data: accessLevels, isLoading } = useQuery<Record<string, string>>({
        queryKey: ["/api/farm/my-access-levels"],
        queryFn: async () => {
            const res = await fetch("/api/farm/my-access-levels", { credentials: "include" });
            if (!res.ok) return {};
            return res.json();
        },
        enabled: isFuncionario,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });

    if (!isFuncionario) {
        return { canEdit: true, isLoading: false, accessLevels: {} as Record<string, string> };
    }

    if (!moduleKey) {
        return { canEdit: false, isLoading, accessLevels: accessLevels || {} };
    }

    const level = accessLevels?.[moduleKey];
    return {
        canEdit: level === 'edit',
        isLoading,
        accessLevels: accessLevels || {},
    };
}
