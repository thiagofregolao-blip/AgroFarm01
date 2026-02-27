import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function FarmLogin() {
    useEffect(() => {
        window.location.replace("/auth");
    }, []);

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 flex items-center justify-center p-4">
            <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                <p className="text-emerald-700 font-medium">Redirecionando...</p>
            </div>
        </div>
    );
}

