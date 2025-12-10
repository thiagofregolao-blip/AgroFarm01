import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CRMPerfil() {
  async function logout() {
    try {
      await fetch("/api/logout", { method: "POST", credentials: "include" });
    } catch {}
    window.location.href = "/";
  }

  return (
    <div className="p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Perfil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={logout} variant="destructive">
            Sair do CRM
          </Button>
          <p className="text-sm text-muted-foreground">
            Dica: adicione este app à tela inicial (PWA) para uma experiência tipo nativa.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
