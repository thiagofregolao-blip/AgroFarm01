import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function TextParser({ onCreated }: { onCreated: () => void }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function handleParse() {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/agenda/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text })
      });
      const data = await res.json();
      console.log("Parsed:", data);
      
      if (data.items && data.items.length > 0) {
        console.log("Confirmando visitas:", data.items);
        const confirmRes = await fetch("/api/agenda/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ items: data.items })
        });
        
        const result = await confirmRes.json();
        console.log("Resultado confirm:", result);
        
        if (confirmRes.ok) {
          setText("");
          const description = result.skipped > 0 
            ? `${result.skipped} não reconhecido(s): ${result.invalid_items?.join(', ')}`
            : undefined;
          
          toast({
            title: `${result.created} visita(s) criada(s)!`,
            description,
          });
          onCreated();
        } else {
          const invalidNames = result.invalid?.join(', ') || 'clientes não reconhecidos';
          toast({
            variant: "destructive",
            title: "Erro ao criar visitas",
            description: `${result.error || 'Nenhum cliente reconhecido'}: ${invalidNames}`,
          });
        }
      } else {
        toast({
          variant: "destructive",
          title: "Nenhum item identificado",
          description: "Digite pelo menos um nome de cliente",
        });
      }
    } catch (err) {
      console.error("Erro:", err);
      toast({
        variant: "destructive",
        title: "Erro ao processar",
        description: "Verifique sua conexão e tente novamente",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h4 style={{ marginBottom: 8, fontWeight: 600 }}>Criar visitas por texto</h4>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Ex: amanhã João Silva inspeção 08:00; Maria Lopes amostra 10:30"
        style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 6, minHeight: 80 }}
      />
      <button
        onClick={handleParse}
        disabled={loading || !text.trim()}
        style={{ 
          marginTop: 8, 
          background: loading ? "#ccc" : "#1db954", 
          color: "#fff", 
          border: 0, 
          padding: "8px 16px", 
          borderRadius: 6,
          cursor: loading ? "not-allowed" : "pointer"
        }}
      >
        {loading ? "Criando..." : "Criar Visitas"}
      </button>
    </div>
  );
}
