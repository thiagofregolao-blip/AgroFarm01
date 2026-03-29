import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Bot, User, Zap, AlertTriangle, HelpCircle, BarChart3 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface Message {
    role: "user" | "assistant";
    content: string;
    ts: Date;
}

export default function ChatBot({ userRole }: { userRole?: string }) {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<"user" | "agent">("user");
    const [sessionId] = useState(() => `bot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const isAdmin = ["administrador", "admin_agricultor", "agricultor", "consultor", "gerente", "director"].includes(userRole || "");

    useEffect(() => {
        if (open && messages.length === 0) {
            setMessages([{
                role: "assistant",
                content: isAdmin
                    ? "🤖 Ola! Sou o assistente do AgroFarm. Estou em modo agente — posso consultar o banco, ver erros e executar acoes. Como posso ajudar?"
                    : "👋 Ola! Sou o assistente do AgroFarm. Posso ajudar com duvidas sobre o sistema. O que precisa?",
                ts: new Date(),
            }]);
            setMode(isAdmin ? "agent" : "user");
        }
    }, [open, isAdmin, messages.length]);

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, [messages]);

    const sendMessage = useCallback(async (text: string) => {
        if (!text.trim() || loading) return;
        const userMsg: Message = { role: "user", content: text.trim(), ts: new Date() };
        setMessages(prev => [...prev, userMsg]);
        setInput("");
        setLoading(true);

        try {
            const res = await apiRequest("POST", "/api/bot/chat", { message: text.trim(), sessionId });
            const data = await res.json();
            setMessages(prev => [...prev, { role: "assistant", content: data.reply || "Sem resposta.", ts: new Date() }]);
            if (data.mode) setMode(data.mode);
        } catch (err) {
            setMessages(prev => [...prev, { role: "assistant", content: "❌ Erro ao conectar com o bot. Tente novamente.", ts: new Date() }]);
        } finally {
            setLoading(false);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [loading, sessionId]);

    const quickActions = [
        { label: "Resumo", icon: BarChart3, msg: "Me de um resumo do sistema" },
        { label: "Erros", icon: AlertTriangle, msg: "Quais erros recentes?" },
        { label: "Ajuda", icon: HelpCircle, msg: "Como usar o sistema?" },
    ];

    return (
        <>
            {/* Floating button */}
            <button
                onClick={() => setOpen(!open)}
                className="fixed bottom-6 right-6 z-[999] w-14 h-14 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer"
                style={{ background: "linear-gradient(135deg, #024177, #0369a1)" }}
                aria-label="Abrir chat"
            >
                {open ? <X className="w-6 h-6 text-white" /> : <MessageCircle className="w-6 h-6 text-white" />}
            </button>

            {/* Chat panel */}
            {open && (
                <div className="fixed bottom-24 right-6 z-[998] w-[380px] max-w-[calc(100vw-2rem)] h-[520px] max-h-[calc(100vh-8rem)] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
                    style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>

                    {/* Header */}
                    <div className="px-4 py-3 flex items-center gap-3" style={{ background: "linear-gradient(135deg, #024177, #0369a1)" }}>
                        <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                            <Bot className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                            <p className="text-white font-bold text-sm">AgroFarm Bot</p>
                            <p className="text-blue-200 text-[10px] font-medium uppercase tracking-wider">
                                {mode === "agent" ? "Modo Agente" : "Assistente"} • {loading ? "Pensando..." : "Online"}
                            </p>
                        </div>
                        <button onClick={() => setOpen(false)} className="p-1 hover:bg-white/10 rounded-lg transition-colors cursor-pointer">
                            <X className="w-5 h-5 text-white" />
                        </button>
                    </div>

                    {/* Messages */}
                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                        {messages.map((msg, i) => (
                            <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                {msg.role === "assistant" && (
                                    <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-1">
                                        <Bot className="w-4 h-4 text-[#024177]" />
                                    </div>
                                )}
                                <div className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                                    msg.role === "user"
                                        ? "bg-[#024177] text-white rounded-br-md"
                                        : "bg-white text-gray-700 rounded-bl-md shadow-sm border border-gray-100"
                                }`}>
                                    <p className="whitespace-pre-wrap">{msg.content}</p>
                                    <p className={`text-[9px] mt-1 ${msg.role === "user" ? "text-blue-200" : "text-gray-400"}`}>
                                        {msg.ts.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                                    </p>
                                </div>
                                {msg.role === "user" && (
                                    <div className="w-7 h-7 rounded-full bg-[#024177] flex items-center justify-center shrink-0 mt-1">
                                        <User className="w-4 h-4 text-white" />
                                    </div>
                                )}
                            </div>
                        ))}
                        {loading && (
                            <div className="flex gap-2 items-start">
                                <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                                    <Bot className="w-4 h-4 text-[#024177]" />
                                </div>
                                <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-md shadow-sm border border-gray-100">
                                    <div className="flex gap-1.5"><div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" /><div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "0.15s" }} /><div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "0.3s" }} /></div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Quick actions */}
                    {messages.length <= 1 && (
                        <div className="px-4 py-2 flex gap-2 border-t border-gray-100 bg-white">
                            {quickActions.map(a => (
                                <button key={a.label} onClick={() => sendMessage(a.msg)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 text-[#024177] text-[11px] font-semibold hover:bg-blue-100 transition-colors cursor-pointer">
                                    <a.icon className="w-3 h-3" /> {a.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Input */}
                    <div className="px-3 py-3 bg-white border-t border-gray-100">
                        <form onSubmit={e => { e.preventDefault(); sendMessage(input); }} className="flex items-center gap-2">
                            <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
                                placeholder={mode === "agent" ? "Comando ou pergunta..." : "Digite sua duvida..."}
                                className="flex-1 px-4 py-2.5 bg-gray-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                                disabled={loading} />
                            <button type="submit" disabled={loading || !input.trim()}
                                className="w-10 h-10 rounded-xl flex items-center justify-center text-white disabled:opacity-40 transition-all cursor-pointer"
                                style={{ background: "linear-gradient(135deg, #024177, #0369a1)" }}>
                                <Send className="w-4 h-4" />
                            </button>
                        </form>
                        {isAdmin && (
                            <div className="flex items-center gap-2 mt-2">
                                <Zap className="w-3 h-3 text-amber-500" />
                                <span className="text-[10px] text-gray-400">
                                    Modo {mode === "agent" ? "Agente" : "Usuario"} • Digite /agente ou /usuario para trocar
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
