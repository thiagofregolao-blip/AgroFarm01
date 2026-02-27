import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import {
    Package, Sprout, FileBarChart, Tractor, BarChart3, TrendingUp,
    Map, FileText, DollarSign, Satellite, BookOpen, ArrowDownUp,
    ChevronDown, ChevronUp, MessageCircle, ArrowRight, Menu, X,
    Shield, Zap, Smartphone, Globe, Bell, Users
} from "lucide-react";

// ===========================
// COLOR PALETTE — John Deere
// ===========================
const colors = {
    green: "#367C2B",
    greenDark: "#2A5F21",
    greenLight: "#4A9D3C",
    yellow: "#FFDE00",
    yellowLight: "#FFF3B0",
    yellowDark: "#E5C800",
    white: "#FFFFFF",
    gray50: "#F9FAFB",
    gray100: "#F3F4F6",
    gray200: "#E5E7EB",
    gray500: "#6B7280",
    gray700: "#374151",
    gray900: "#111827",
};

// ===========================
// LANDING PAGE
// ===========================
export default function LandingPage() {
    const [, navigate] = useLocation();
    const [mobileMenu, setMobileMenu] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [heroSlide, setHeroSlide] = useState(0);

    const heroSlides = [
        { image: "/landing-hero.png", label: "Gestão Completa", sublabel: "Controle total da sua fazenda", icon: "🌾" },
        { image: "/hero-drone.png", label: "Drone Multiespectral", sublabel: "DJI Mavic 3M com NDVI", icon: "🛩️" },
        { image: "/hero-dashboard.png", label: "Dashboard Inteligente", sublabel: "Relatórios e gráficos em tempo real", icon: "📊" },
        { image: "/hero-warehouse.png", label: "Controle de Estoque", sublabel: "Insumos sempre sob controle", icon: "📦" },
    ];

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 50);
        window.addEventListener("scroll", onScroll);
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    // Auto-rotate hero carousel
    useEffect(() => {
        const timer = setInterval(() => {
            setHeroSlide(prev => (prev + 1) % heroSlides.length);
        }, 5000);
        return () => clearInterval(timer);
    }, [heroSlides.length]);

    const WHATSAPP_URL = "https://wa.me/595986848326?text=Olá! Gostaria de saber mais sobre o AgroFarm.";

    const scrollTo = (id: string) => {
        setMobileMenu(false);
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    };

    return (
        <div style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif", color: colors.gray900 }}>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />

            {/* ========== NAVBAR ========== */}
            <nav style={{
                position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
                background: "rgba(255,255,255,0.97)",
                backdropFilter: "blur(12px)",
                boxShadow: "0 2px 20px rgba(0,0,0,0.08)",
                transition: "all 0.3s ease",
                padding: "0 24px",
            }}>
                <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 70 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Sprout size={32} color={colors.green} />
                        <span style={{ fontSize: 24, fontWeight: 800, color: colors.green }}>AgroFarm</span>
                    </div>

                    {/* Desktop Nav */}
                    <div style={{ display: "flex", alignItems: "center", gap: 32 }} className="hidden-mobile">
                        {[
                            { label: "Funcionalidades", id: "features" },
                            { label: "Recursos", id: "resources" },
                            { label: "FAQ", id: "faq" },
                        ].map(item => (
                            <button key={item.id} onClick={() => scrollTo(item.id)}
                                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15, fontWeight: 500, color: colors.gray700 }}>
                                {item.label}
                            </button>
                        ))}
                        <button onClick={() => navigate("/fazenda/login")}
                            style={{
                                background: colors.green, color: colors.white,
                                border: "none", borderRadius: 8, padding: "10px 24px",
                                fontSize: 15, fontWeight: 600, cursor: "pointer",
                                display: "flex", alignItems: "center", gap: 8,
                                transition: "transform 0.2s ease, box-shadow 0.2s ease",
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1.05)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 15px rgba(54,124,43,0.4)"; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
                        >
                            Acessar Sistema <ArrowRight size={16} />
                        </button>
                    </div>

                    {/* Mobile hamburger */}
                    <button onClick={() => setMobileMenu(!mobileMenu)} className="show-mobile"
                        style={{ background: "none", border: "none", cursor: "pointer", display: "none" }}>
                        {mobileMenu ? <X size={28} /> : <Menu size={28} />}
                    </button>
                </div>

                {/* Mobile menu */}
                {mobileMenu && (
                    <div style={{ background: colors.white, padding: 20, borderTop: `1px solid ${colors.gray200}` }}>
                        {["features", "resources", "faq"].map(id => (
                            <button key={id} onClick={() => scrollTo(id)} style={{ display: "block", width: "100%", textAlign: "left", padding: "12px 0", background: "none", border: "none", fontSize: 16, cursor: "pointer", color: colors.gray700, borderBottom: `1px solid ${colors.gray100}` }}>
                                {id === "features" ? "Funcionalidades" : id === "resources" ? "Recursos" : "FAQ"}
                            </button>
                        ))}
                        <button onClick={() => navigate("/fazenda/login")} style={{ marginTop: 12, width: "100%", background: colors.green, color: colors.white, border: "none", borderRadius: 8, padding: "12px 20px", fontSize: 16, fontWeight: 600, cursor: "pointer" }}>
                            Acessar Sistema
                        </button>
                    </div>
                )}
            </nav>

            {/* ========== HERO ========== */}
            <section style={{
                minHeight: "100vh", display: "flex", alignItems: "center",
                background: `linear-gradient(135deg, ${colors.green} 0%, ${colors.greenDark} 50%, #1A3F15 100%)`,
                position: "relative", overflow: "hidden", paddingTop: 70,
            }}>
                {/* Decorative circles */}
                <div style={{ position: "absolute", top: -100, right: -100, width: 400, height: 400, borderRadius: "50%", border: `2px solid rgba(255,222,0,0.15)` }} />
                <div style={{ position: "absolute", bottom: -50, left: -50, width: 300, height: 300, borderRadius: "50%", border: `2px solid rgba(255,222,0,0.1)` }} />

                <div style={{ maxWidth: 1200, margin: "0 auto", padding: "60px 24px", display: "flex", alignItems: "center", gap: 60, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 320 }}>
                        <div style={{ display: "inline-block", background: "rgba(255,222,0,0.2)", color: colors.yellow, padding: "6px 16px", borderRadius: 20, fontSize: 13, fontWeight: 600, marginBottom: 20, letterSpacing: 1 }}>
                            🌾 GESTÃO AGRÍCOLA DIGITAL
                        </div>
                        <h1 style={{ fontSize: "clamp(2.2rem, 5vw, 3.5rem)", fontWeight: 900, color: colors.white, lineHeight: 1.1, marginBottom: 20 }}>
                            Domine a gestão da sua <span style={{ color: colors.yellow }}>fazenda</span>
                        </h1>
                        <p style={{ fontSize: 18, color: "rgba(255,255,255,0.8)", lineHeight: 1.7, marginBottom: 32, maxWidth: 520 }}>
                            Controle estoque, insumos, aplicações, custos e muito mais.
                            Tudo em um sistema completo, fácil e acessível de qualquer lugar.
                        </p>
                        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                            <button onClick={() => scrollTo("features")}
                                style={{
                                    background: colors.yellow, color: colors.greenDark,
                                    border: "none", borderRadius: 10, padding: "14px 32px",
                                    fontSize: 16, fontWeight: 700, cursor: "pointer",
                                    display: "flex", alignItems: "center", gap: 8,
                                    transition: "transform 0.2s ease",
                                }}
                                onMouseEnter={e => { (e.target as HTMLElement).style.transform = "scale(1.05)"; }}
                                onMouseLeave={e => { (e.target as HTMLElement).style.transform = "scale(1)"; }}
                            >
                                Conhecer Funcionalidades <ChevronDown size={18} />
                            </button>
                            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer"
                                style={{
                                    background: "transparent", color: colors.white,
                                    border: `2px solid rgba(255,255,255,0.4)`, borderRadius: 10,
                                    padding: "14px 32px", fontSize: 16, fontWeight: 600, cursor: "pointer",
                                    textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8,
                                }}
                            >
                                <MessageCircle size={18} /> Solicite uma Visita
                            </a>
                        </div>

                        {/* Stats */}
                        <div style={{ display: "flex", gap: 40, marginTop: 48 }}>
                            {[
                                { n: "100%", label: "Na Nuvem" },
                                { n: "24/7", label: "WhatsApp Bot" },
                                { n: "9+", label: "Relatórios" },
                            ].map(s => (
                                <div key={s.label}>
                                    <div style={{ fontSize: 28, fontWeight: 800, color: colors.yellow }}>{s.n}</div>
                                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>{s.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Hero Carousel */}
                    <div style={{ flex: 1, minWidth: 320, display: "flex", justifyContent: "center" }}>
                        <div style={{ position: "relative" }}>
                            <div style={{
                                width: "clamp(300px, 40vw, 480px)", height: "clamp(300px, 40vw, 480px)",
                                borderRadius: 24, overflow: "hidden",
                                boxShadow: "0 40px 80px rgba(0,0,0,0.3)",
                                border: `3px solid rgba(255,222,0,0.3)`,
                                position: "relative",
                            }}>
                                {heroSlides.map((slide, i) => (
                                    <img key={i} src={slide.image} alt={slide.label}
                                        style={{
                                            position: "absolute", top: 0, left: 0,
                                            width: "100%", height: "100%", objectFit: "cover",
                                            opacity: heroSlide === i ? 1 : 0,
                                            transition: "opacity 0.8s ease-in-out",
                                        }}
                                    />
                                ))}
                                {/* Carousel dots */}
                                <div style={{
                                    position: "absolute", bottom: 16, left: 0, right: 0,
                                    display: "flex", justifyContent: "center", gap: 8, zIndex: 5,
                                }}>
                                    {heroSlides.map((_, i) => (
                                        <button key={i} onClick={() => setHeroSlide(i)}
                                            style={{
                                                width: heroSlide === i ? 24 : 10, height: 10,
                                                borderRadius: 5, border: "none", cursor: "pointer",
                                                background: heroSlide === i ? colors.yellow : "rgba(255,255,255,0.5)",
                                                transition: "all 0.3s ease",
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>
                            {/* Floating card — changes with slide */}
                            <div style={{
                                position: "absolute", bottom: -20, left: -30,
                                background: colors.white, borderRadius: 16, padding: "16px 20px",
                                boxShadow: "0 10px 40px rgba(0,0,0,0.15)",
                                display: "flex", alignItems: "center", gap: 12,
                                transition: "all 0.5s ease",
                            }}>
                                <div style={{ background: `${colors.green}15`, borderRadius: 12, padding: 10, fontSize: 22 }}>
                                    {heroSlides[heroSlide].icon}
                                </div>
                                <div>
                                    <div style={{ fontSize: 12, color: colors.gray500 }}>{heroSlides[heroSlide].sublabel}</div>
                                    <div style={{ fontSize: 16, fontWeight: 700, color: colors.green }}>{heroSlides[heroSlide].label}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ========== FEATURES ========== */}
            <section id="features" style={{ padding: "100px 24px", background: colors.white }}>
                <div style={{ maxWidth: 1200, margin: "0 auto" }}>
                    <div style={{ textAlign: "center", marginBottom: 64 }}>
                        <div style={{ color: colors.green, fontWeight: 700, fontSize: 14, letterSpacing: 2, marginBottom: 12 }}>FUNCIONALIDADES</div>
                        <h2 style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: 800, color: colors.gray900, marginBottom: 16 }}>
                            Tudo que você precisa em <span style={{ color: colors.green }}>um só lugar</span>
                        </h2>
                        <p style={{ fontSize: 18, color: colors.gray500, maxWidth: 600, margin: "0 auto" }}>
                            Sistema completo para gestão da sua propriedade rural, do plantio à colheita.
                        </p>
                    </div>

                    {/* Feature rows — alternating layout */}
                    {[
                        {
                            icon: Package, title: "Controle de Estoque & Insumos",
                            desc: "Saiba exatamente o que tem, quanto custou e quando comprar mais.",
                            items: ["Custo médio automático por produto", "Alertas de estoque baixo via WhatsApp", "Movimentações com rastreabilidade", "Integração com faturas de compra", "Histórico completo de preços"],
                            color: colors.green, image: "/feature-estoque.png",
                        },
                        {
                            icon: Satellite, title: "Monitoramento com Drone DJI Mavic 3M",
                            desc: "Imagens multiespectrais de alta precisão com o DJI Mavic 3 Multispectral.",
                            items: ["Câmera RGB 20MP + 4 câmeras multiespectrais 5MP", "Bandas: Verde, Vermelho, Red Edge e Infravermelho Próximo (NIR)", "Até 200 hectares por voo (43 min de autonomia)", "Posicionamento RTK centimétrico sem pontos de controle", "Índices NDVI, NDRE e GNDVI em tempo real"],
                            color: colors.greenLight, reverse: true, image: "/feature-ndvi.png",
                        },
                        {
                            icon: BookOpen, title: "Caderno de Campo Automático",
                            desc: "Rastreabilidade total sem trabalho manual. 100% automático.",
                            items: ["Gerado a partir das aplicações registradas", "Mapa dos talhões com áreas aplicadas", "Linha do tempo completa da safra", "Exportação em PDF profissional", "Atende exigências de exportação"],
                            color: colors.green, image: "/feature-caderno.png",
                        },
                        {
                            icon: Bell, title: "Alertas Inteligentes via WhatsApp",
                            desc: "Receba avisos importantes sem precisar abrir o sistema.",
                            items: ["Estoque baixo? Avisamos no WhatsApp", "Fatura vencendo em 5 dias", "Variação de preço de insumos", "Boletim diário com clima e cotações", "Notícias do mercado agrícola"],
                            color: colors.greenLight, reverse: true, image: "/feature-alertas.png",
                        },
                        {
                            icon: Users, title: "Rede de Cotação Anônima",
                            desc: "Compare seus preços com outros agricultores. Negocie melhor.",
                            items: ["Comparativo anônimo de preços", "Média, menor e maior preço pago", "Ranking: você está acima ou abaixo?", "Privacidade garantida", "Poder de negociação na compra"],
                            color: colors.green, image: "/feature-cotacoes.png",
                        },
                    ].map((feature, idx) => {
                        const Icon = feature.icon;
                        const isReversed = feature.reverse;
                        return (
                            <div key={idx} style={{
                                display: "flex", alignItems: "center", gap: 60,
                                marginBottom: 80, flexWrap: "wrap",
                                flexDirection: isReversed ? "row-reverse" : "row",
                            }}>
                                {/* Text side */}
                                <div style={{ flex: 1, minWidth: 300 }}>
                                    <div style={{ display: "inline-flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                                        <div style={{ background: `${feature.color}15`, borderRadius: 14, padding: 12 }}>
                                            <Icon size={28} color={feature.color} />
                                        </div>
                                        <h3 style={{ fontSize: 24, fontWeight: 700, color: colors.gray900 }}>{feature.title}</h3>
                                    </div>
                                    <p style={{ fontSize: 16, color: colors.gray500, marginBottom: 24, lineHeight: 1.6 }}>{feature.desc}</p>
                                    <ul style={{ listStyle: "none", padding: 0 }}>
                                        {feature.items.map((item, i) => (
                                            <li key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", fontSize: 15, color: colors.gray700 }}>
                                                <div style={{ width: 22, height: 22, borderRadius: "50%", background: `${colors.green}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                                    <span style={{ color: colors.green, fontSize: 14, fontWeight: 700 }}>✓</span>
                                                </div>
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                {/* Visual side — gradient card */}
                                <div style={{ flex: 1, minWidth: 300, display: "flex", justifyContent: "center" }}>
                                    <div style={{
                                        width: "100%", maxWidth: 420, aspectRatio: "4/3", borderRadius: 20,
                                        overflow: "hidden",
                                        boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
                                        position: "relative",
                                    }}>
                                        <img src={(feature as any).image} alt={feature.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent, rgba(0,0,0,0.7))", padding: "40px 20px 16px" }}>
                                            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>AgroFarm</div>
                                            <div style={{ fontSize: 15, fontWeight: 700, color: colors.white }}>{feature.title}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* ========== RESOURCES GRID ========== */}
            <section id="resources" style={{ padding: "80px 24px", background: colors.gray50 }}>
                <div style={{ maxWidth: 1200, margin: "0 auto" }}>
                    <div style={{ textAlign: "center", marginBottom: 56 }}>
                        <div style={{ color: colors.green, fontWeight: 700, fontSize: 14, letterSpacing: 2, marginBottom: 12 }}>MAIS RECURSOS</div>
                        <h2 style={{ fontSize: "clamp(1.8rem, 4vw, 2.5rem)", fontWeight: 800, color: colors.gray900 }}>
                            Sistema completo para sua <span style={{ color: colors.green }}>fazenda crescer</span>
                        </h2>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 24 }}>
                        {[
                            { icon: Package, title: "Estoque", desc: "Controle total de produtos e insumos com custo médio automático" },
                            { icon: FileText, title: "Faturas", desc: "Importe faturas e vincule automaticamente ao estoque" },
                            { icon: Sprout, title: "Aplicações", desc: "Registre aplicações por talhão com dose e operador" },
                            { icon: Tractor, title: "Frota", desc: "Abastecimentos, horímetro e manutenção dos equipamentos" },
                            { icon: BarChart3, title: "Custo/Hectare", desc: "Saiba quanto custa cada talhão com precisão total" },
                            { icon: TrendingUp, title: "Cotações", desc: "Compare preços com outros agricultores anonimamente" },
                            { icon: Map, title: "Propriedades", desc: "Cadastre fazendas e talhões com mapa e localização" },
                            { icon: FileBarChart, title: "Relatórios", desc: "9 tipos de relatórios com filtros e exportação PDF" },
                            { icon: ArrowDownUp, title: "Movimentações", desc: "Entradas, saídas e ajustes com rastreabilidade total" },
                            { icon: DollarSign, title: "Despesas", desc: "Controle gastos por categoria com gráficos visuais" },
                            { icon: MessageCircle, title: "WhatsApp Bot", desc: "Boletim diário com clima, cotação da soja e alertas" },
                            { icon: Satellite, title: "Satélite NDVI", desc: "Monitore a saúde da lavoura via imagens de satélite" },
                        ].map((res, i) => {
                            const Icon = res.icon;
                            return (
                                <div key={i} style={{
                                    background: colors.white, borderRadius: 16, padding: 24,
                                    border: `1px solid ${colors.gray200}`,
                                    transition: "all 0.3s ease",
                                    cursor: "default",
                                }}
                                    onMouseEnter={e => {
                                        (e.currentTarget as HTMLElement).style.transform = "translateY(-4px)";
                                        (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 30px rgba(0,0,0,0.08)";
                                        (e.currentTarget as HTMLElement).style.borderColor = colors.green;
                                    }}
                                    onMouseLeave={e => {
                                        (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                                        (e.currentTarget as HTMLElement).style.boxShadow = "none";
                                        (e.currentTarget as HTMLElement).style.borderColor = colors.gray200;
                                    }}
                                >
                                    <div style={{ background: `${colors.green}10`, borderRadius: 12, width: 48, height: 48, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                                        <Icon size={24} color={colors.green} />
                                    </div>
                                    <h4 style={{ fontSize: 17, fontWeight: 700, color: colors.gray900, marginBottom: 8 }}>{res.title}</h4>
                                    <p style={{ fontSize: 14, color: colors.gray500, lineHeight: 1.5 }}>{res.desc}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* ========== BENEFITS BANNER ========== */}
            <section style={{
                padding: "80px 24px",
                background: `linear-gradient(135deg, ${colors.green} 0%, ${colors.greenDark} 100%)`,
                color: colors.white,
            }}>
                <div style={{ maxWidth: 1200, margin: "0 auto", textAlign: "center" }}>
                    <h2 style={{ fontSize: "clamp(1.8rem, 4vw, 2.5rem)", fontWeight: 800, marginBottom: 48, color: colors.white }}>
                        Por que escolher o <span style={{ color: colors.yellow }}>AgroFarm</span>?
                    </h2>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 32 }}>
                        {[
                            { icon: Globe, title: "100% Na Nuvem", desc: "Acesse do celular, tablet ou computador, de qualquer lugar" },
                            { icon: Zap, title: "Fácil de Usar", desc: "Interface intuitiva, sem necessidade de treinamento" },
                            { icon: Shield, title: "Dados Seguros", desc: "Seus dados protegidos com criptografia e backup automático" },
                            { icon: Smartphone, title: "Mobile First", desc: "Funciona perfeitamente no celular, na lavoura" },
                        ].map((b, i) => {
                            const Icon = b.icon;
                            return (
                                <div key={i} style={{ padding: 24 }}>
                                    <div style={{ background: "rgba(255,222,0,0.15)", borderRadius: 16, width: 56, height: 56, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                                        <Icon size={28} color={colors.yellow} />
                                    </div>
                                    <h4 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: colors.white }}>{b.title}</h4>
                                    <p style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>{b.desc}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* ========== FAQ ========== */}
            <section id="faq" style={{ padding: "80px 24px", background: colors.white }}>
                <div style={{ maxWidth: 800, margin: "0 auto" }}>
                    <div style={{ textAlign: "center", marginBottom: 48 }}>
                        <div style={{ color: colors.green, fontWeight: 700, fontSize: 14, letterSpacing: 2, marginBottom: 12 }}>DÚVIDAS</div>
                        <h2 style={{ fontSize: "clamp(1.8rem, 4vw, 2.5rem)", fontWeight: 800, color: colors.gray900 }}>
                            Perguntas <span style={{ color: colors.green }}>Frequentes</span>
                        </h2>
                    </div>

                    {[
                        { q: "O que é o AgroFarm?", a: "O AgroFarm é um sistema de gestão agrícola completo na nuvem. Ele controla estoque de insumos, aplicações em talhões, custos por hectare, faturas de compra, frota de equipamentos e muito mais." },
                        { q: "Preciso instalar algum programa?", a: "Não! O AgroFarm funciona 100% no navegador. Acesse do celular, tablet ou computador, de qualquer lugar com internet." },
                        { q: "Como funciona o monitoramento por satélite?", a: "Utilizamos imagens do satélite Sentinel-2 para calcular o índice NDVI dos seus talhões, mostrando a saúde da vegetação em um mapa colorido (verde=saudável, vermelho=estresse)." },
                        { q: "O que são os alertas inteligentes?", a: "São avisos automáticos enviados pelo WhatsApp quando seu estoque está baixo, uma fatura está vencendo, ou o preço de um insumo mudou significativamente." },
                        { q: "Meus dados ficam seguros?", a: "Sim! Utilizamos criptografia, backup automático e servidores seguros na nuvem. Seus dados são exclusivamente seus." },
                        { q: "Como funciona a rede de cotação?", a: "Comparamos anonimamente os preços que você pagou por insumos com os de outros agricultores do sistema. Você vê se pagou acima ou abaixo da média — sem revelar nomes." },
                        { q: "Posso acessar de qualquer lugar?", a: "Sim! O sistema é acessível via navegador em qualquer dispositivo. Além disso, o bot do WhatsApp envia informações diárias diretamente no seu celular." },
                        { q: "Funciona no Paraguai e no Brasil?", a: "Sim! O AgroFarm foi desenvolvido para atender agricultores do Brasil e do Paraguai, com suporte a diferentes moedas e regiões." },
                    ].map((item, i) => (
                        <FAQItem key={i} question={item.q} answer={item.a} />
                    ))}
                </div>
            </section>

            {/* ========== CTA FINAL ========== */}
            <section style={{
                padding: "80px 24px",
                background: `linear-gradient(135deg, ${colors.yellow} 0%, ${colors.yellowDark} 100%)`,
                textAlign: "center",
            }}>
                <div style={{ maxWidth: 700, margin: "0 auto" }}>
                    <h2 style={{ fontSize: "clamp(1.8rem, 4vw, 2.5rem)", fontWeight: 800, color: colors.greenDark, marginBottom: 16 }}>
                        Domine a gestão da sua fazenda
                    </h2>
                    <p style={{ fontSize: 18, color: colors.greenDark, opacity: 0.8, marginBottom: 32 }}>
                        Comece agora a usar o sistema mais completo de gestão agrícola.
                    </p>
                    <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer"
                        style={{
                            background: colors.green, color: colors.white,
                            border: "none", borderRadius: 12, padding: "16px 40px",
                            fontSize: 18, fontWeight: 700, cursor: "pointer",
                            display: "inline-flex", alignItems: "center", gap: 10,
                            boxShadow: "0 8px 30px rgba(54,124,43,0.3)",
                            transition: "transform 0.2s ease",
                            textDecoration: "none",
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1.05)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
                    >
                        <MessageCircle size={20} /> Solicite uma Visita
                    </a>
                </div>
            </section>

            {/* ========== FOOTER ========== */}
            <footer style={{
                padding: "40px 24px", background: colors.gray900, color: "rgba(255,255,255,0.5)",
                textAlign: "center", fontSize: 14,
            }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 8 }}>
                    <Sprout size={20} color={colors.green} />
                    <span style={{ fontWeight: 700, color: colors.white }}>AgroFarm</span>
                </div>
                <p>© 2026 AgroFarm — Sistema de Gestão Agrícola Digital</p>
                <p style={{ marginTop: 4 }}>Feito com 💚 para agricultores do Brasil e Paraguai</p>
            </footer>

            {/* ========== STICKY FOOTER CTA ========== */}
            <div style={{
                position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 90,
                background: colors.greenDark,
                padding: "12px 24px",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 24,
                boxShadow: "0 -4px 20px rgba(0,0,0,0.2)",
            }}>
                <span style={{ color: colors.yellow, fontWeight: 700, fontSize: 14, letterSpacing: 1 }}>
                    🌾 DOMINE SUA LAVOURA
                </span>
                <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer"
                    style={{
                        background: colors.yellow, color: colors.greenDark,
                        border: "none", borderRadius: 8, padding: "10px 24px",
                        fontSize: 14, fontWeight: 700, cursor: "pointer",
                        animation: "pulse-btn 2s infinite",
                        textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6,
                    }}>
                    <MessageCircle size={14} /> Solicite uma Visita
                </a>
            </div>

            {/* Responsive + animation styles */}
            <style>{`
                @keyframes pulse-btn {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(255,222,0,0.5); }
                    50% { box-shadow: 0 0 0 8px rgba(255,222,0,0); }
                }
                @media (max-width: 768px) {
                    .hidden-mobile { display: none !important; }
                    .show-mobile { display: block !important; }
                }
                @media (min-width: 769px) {
                    .show-mobile { display: none !important; }
                }
            `}</style>
        </div>
    );
}

// ===========================
// FAQ ACCORDION ITEM
// ===========================
function FAQItem({ question, answer }: { question: string; answer: string }) {
    const [open, setOpen] = useState(false);
    return (
        <div style={{
            borderBottom: `1px solid #E5E7EB`, marginBottom: 0,
        }}>
            <button onClick={() => setOpen(!open)} style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "20px 0", background: "none", border: "none", cursor: "pointer",
                fontSize: 16, fontWeight: 600, color: "#111827", textAlign: "left",
            }}>
                <span>{question}</span>
                {open ? <ChevronUp size={20} color="#6B7280" /> : <ChevronDown size={20} color="#6B7280" />}
            </button>
            {open && (
                <div style={{ padding: "0 0 20px", fontSize: 15, color: "#6B7280", lineHeight: 1.7 }}>
                    {answer}
                </div>
            )}
        </div>
    );
}
