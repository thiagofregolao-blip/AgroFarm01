import { useState } from "react";
import { Monitor, Apple, Lock, Download, CheckCircle, Loader2, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

export default function DownloadPage() {
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [links, setLinks] = useState<{ version: string; mac: string; win: string } | null>(null);
    const [, navigate] = useLocation();

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const res = await fetch("/api/download/auth", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password }),
            });
            if (!res.ok) {
                const d = await res.json();
                throw new Error(d.error || "Senha incorreta");
            }
            const data = await res.json();
            setLinks(data);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{
            minHeight: "100vh",
            background: "linear-gradient(135deg, #1a3a1a 0%, #1a56db 100%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            position: "relative",
        }}>
            {/* Dot grid */}
            <div style={{
                position: "absolute", inset: 0, opacity: 0.15,
                backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.7) 1px, transparent 1px)",
                backgroundSize: "28px 28px",
                pointerEvents: "none",
            }} />

            {/* Back button */}
            <button
                onClick={() => navigate("/")}
                style={{
                    position: "absolute", top: 24, left: 24,
                    background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
                    borderRadius: 10, padding: "8px 16px", color: "#fff",
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13,
                }}
            >
                <ArrowLeft size={14} /> Voltar
            </button>

            {/* Card */}
            <div style={{
                background: "rgba(255,255,255,0.97)", borderRadius: 20, padding: 40,
                width: "100%", maxWidth: 460,
                boxShadow: "0 24px 64px rgba(0,0,0,0.3)",
                position: "relative", zIndex: 1,
            }}>
                {/* Logo / Header */}
                <div style={{ textAlign: "center", marginBottom: 32 }}>
                    <div style={{
                        width: 64, height: 64, borderRadius: 16, margin: "0 auto 16px",
                        background: "linear-gradient(135deg, #1a56db, #1a3a1a)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                        <Download size={30} color="#F7D601" />
                    </div>
                    <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0 }}>
                        AgroFarm Digital
                    </h1>
                    <p style={{ fontSize: 14, color: "#6B7280", marginTop: 6 }}>
                        Download do aplicativo desktop
                    </p>
                </div>

                {!links ? (
                    /* Password form */
                    <form onSubmit={handleSubmit}>
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
                                Senha de acesso
                            </label>
                            <div style={{ position: "relative" }}>
                                <Lock size={16} style={{
                                    position: "absolute", left: 12, top: "50%",
                                    transform: "translateY(-50%)", color: "#9CA3AF",
                                }} />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="Digite a senha"
                                    autoFocus
                                    style={{
                                        width: "100%", padding: "12px 12px 12px 38px",
                                        borderRadius: 10, border: "1.5px solid #D1D5DB",
                                        fontSize: 15, boxSizing: "border-box",
                                        outline: "none",
                                    }}
                                />
                            </div>
                            {error && (
                                <div style={{
                                    marginTop: 8, color: "#DC2626", fontSize: 13,
                                    background: "#FEF2F2", borderRadius: 8,
                                    padding: "8px 12px", border: "1px solid #FECACA",
                                }}>
                                    {error}
                                </div>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !password}
                            style={{
                                width: "100%", padding: "13px 0", borderRadius: 10,
                                border: "none", fontSize: 15, fontWeight: 700,
                                background: loading || !password ? "#9CA3AF" : "#1a56db",
                                color: "#fff", cursor: loading || !password ? "not-allowed" : "pointer",
                                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                            }}
                        >
                            {loading ? <Loader2 size={18} className="animate-spin" /> : <Lock size={16} />}
                            {loading ? "Verificando..." : "Acessar downloads"}
                        </button>
                    </form>
                ) : (
                    /* Download links */
                    <div>
                        <div style={{
                            textAlign: "center", marginBottom: 24,
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                            color: "#16A34A", fontSize: 14, fontWeight: 600,
                        }}>
                            <CheckCircle size={18} />
                            Acesso liberado — versão {links.version}
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {/* Mac */}
                            <a
                                href={links.mac}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    display: "flex", alignItems: "center", gap: 16,
                                    padding: "18px 20px", borderRadius: 14,
                                    border: "2px solid #E5E7EB", background: "#F9FAFB",
                                    textDecoration: "none", color: "#111827",
                                    transition: "border-color 0.15s, background 0.15s",
                                }}
                                onMouseEnter={e => {
                                    (e.currentTarget as HTMLAnchorElement).style.borderColor = "#1a56db";
                                    (e.currentTarget as HTMLAnchorElement).style.background = "#EFF6FF";
                                }}
                                onMouseLeave={e => {
                                    (e.currentTarget as HTMLAnchorElement).style.borderColor = "#E5E7EB";
                                    (e.currentTarget as HTMLAnchorElement).style.background = "#F9FAFB";
                                }}
                            >
                                <div style={{
                                    width: 48, height: 48, borderRadius: 12,
                                    background: "#111827", display: "flex",
                                    alignItems: "center", justifyContent: "center", flexShrink: 0,
                                }}>
                                    <Apple size={26} color="#fff" />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 700, fontSize: 15 }}>Download para macOS</div>
                                    <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
                                        Arquivo .dmg — Mac Intel e Apple Silicon
                                    </div>
                                </div>
                                <Download size={18} color="#1a56db" />
                            </a>

                            {/* Windows */}
                            <a
                                href={links.win}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    display: "flex", alignItems: "center", gap: 16,
                                    padding: "18px 20px", borderRadius: 14,
                                    border: "2px solid #E5E7EB", background: "#F9FAFB",
                                    textDecoration: "none", color: "#111827",
                                    transition: "border-color 0.15s, background 0.15s",
                                }}
                                onMouseEnter={e => {
                                    (e.currentTarget as HTMLAnchorElement).style.borderColor = "#0078d4";
                                    (e.currentTarget as HTMLAnchorElement).style.background = "#EFF6FF";
                                }}
                                onMouseLeave={e => {
                                    (e.currentTarget as HTMLAnchorElement).style.borderColor = "#E5E7EB";
                                    (e.currentTarget as HTMLAnchorElement).style.background = "#F9FAFB";
                                }}
                            >
                                <div style={{
                                    width: 48, height: 48, borderRadius: 12,
                                    background: "#0078d4", display: "flex",
                                    alignItems: "center", justifyContent: "center", flexShrink: 0,
                                }}>
                                    <Monitor size={24} color="#fff" />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 700, fontSize: 15 }}>Download para Windows</div>
                                    <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
                                        Instalador .exe — Windows 10 e 11 (64-bit)
                                    </div>
                                </div>
                                <Download size={18} color="#0078d4" />
                            </a>
                        </div>

                        <div style={{
                            marginTop: 20, padding: "12px 16px", borderRadius: 10,
                            background: "#F0FDF4", border: "1px solid #BBF7D0",
                            fontSize: 12, color: "#166534",
                        }}>
                            <strong>Como instalar:</strong> Mac → abra o .dmg e arraste para Applications.
                            Windows → execute o .exe e siga o assistente.
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
