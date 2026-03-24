import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import {
    Package, Sprout, FileBarChart, Tractor, BarChart3, TrendingUp,
    Map, FileText, DollarSign, Satellite, BookOpen, ArrowDownUp,
    ChevronDown, ChevronUp, MessageCircle, ArrowRight, Menu, X,
    Shield, Zap, Smartphone, Globe, Bell, Users, CloudSun, Target,
    CheckCircle, Sparkles,
} from "lucide-react";

const WHATSAPP_URL = "https://wa.me/595986848326?text=Olá! Gostaria de saber mais sobre o AgroFarm.";

// ─── Dot grid background (same pattern as Login/PDV hero) ─────────────────
const DOT_GRID: React.CSSProperties = {
    backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.7) 1px, transparent 1px)",
    backgroundSize: "28px 28px",
};

// ─── GlassCard — same component as Login/PDV ──────────────────────────────
function GlassCard({ icon: Icon, title, description }: {
    icon: React.ElementType; title: string; description: string;
}) {
    return (
        <div className="flex items-start gap-4 p-5 rounded-2xl border border-white/20 bg-white/10 backdrop-blur-md shadow-[0_4px_24px_rgba(0,0,0,0.08)] transition-transform duration-200 hover:-translate-y-1">
            <div className="w-11 h-11 bg-[#F7D601] rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
                <Icon className="w-5 h-5 text-green-800" />
            </div>
            <div>
                <h4 className="font-semibold text-white text-sm leading-tight mb-1">{title}</h4>
                <p className="text-green-100/75 text-xs leading-relaxed">{description}</p>
            </div>
        </div>
    );
}

// ─── Landing Page ──────────────────────────────────────────────────────────
export default function LandingPage() {
    const [, navigate] = useLocation();
    const [mobileMenu, setMobileMenu] = useState(false);
    const [heroSlide, setHeroSlide] = useState(0);

    const heroSlides = [
        { image: "/landing-hero.png",    label: "Gestão Completa",       sublabel: "Controle total da sua fazenda",       icon: Sprout },
        { image: "/hero-drone.png",      label: "Drone Multiespectral",  sublabel: "DJI Mavic 3M com NDVI",              icon: Satellite },
        { image: "/hero-dashboard.png",  label: "Dashboard Inteligente", sublabel: "Relatórios em tempo real",           icon: BarChart3 },
        { image: "/hero-warehouse.png",  label: "Controle de Estoque",   sublabel: "Insumos sempre sob controle",        icon: Package },
    ];

    // PWA standalone → redirect to login
    useEffect(() => {
        const isPWA =
            window.matchMedia("(display-mode: standalone)").matches ||
            (window.navigator as any).standalone === true;
        if (isPWA) navigate("/auth");
    }, [navigate]);

    // Auto-rotate hero carousel
    useEffect(() => {
        const timer = setInterval(() => setHeroSlide(prev => (prev + 1) % heroSlides.length), 5000);
        return () => clearInterval(timer);
    }, [heroSlides.length]);

    const scrollTo = (id: string) => {
        setMobileMenu(false);
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    };

    const NAV_LINKS = [
        { label: "Funcionalidades", id: "features" },
        { label: "Recursos", id: "resources" },
        { label: "FAQ", id: "faq" },
    ];

    return (
        <div className="font-sans text-slate-900 antialiased">

            {/* ── NAVBAR ──────────────────────────────────────────────── */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md shadow-[0_2px_20px_rgba(0,0,0,0.07)]">
                <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-[84px]">
                    {/* Logo */}
                    <div className="flex items-center gap-3">
                        <img src="/icon-datagrow.png" alt="" className="h-16 w-auto object-contain" />
                        <div className="flex flex-col leading-none">
                            <span className="font-black tracking-tight" style={{ fontSize: "2.4rem", lineHeight: 1.05 }}>
                                <span style={{ color: "#024177" }}>Data</span><span style={{ color: "#215F30" }}>Grow</span>
                            </span>
                            <span className="font-semibold tracking-widest uppercase" style={{ fontSize: "0.65rem", color: "#555", letterSpacing: "0.14em" }}>
                                Seus dados. Seu crescimento.
                            </span>
                        </div>
                    </div>

                    {/* Desktop links */}
                    <div className="hidden lg:flex items-center gap-8">
                        {NAV_LINKS.map(item => (
                            <button key={item.id} onClick={() => scrollTo(item.id)}
                                className="text-sm font-medium text-slate-600 hover:text-green-700 transition-colors cursor-pointer bg-transparent border-none">
                                {item.label}
                            </button>
                        ))}
                        <button onClick={() => navigate("/fazenda/login")}
                            className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white text-sm font-semibold px-5 py-2.5 rounded-2xl shadow-md shadow-green-200 transition-all duration-150 border-none cursor-pointer">
                            Acessar Sistema <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Mobile hamburger */}
                    <button onClick={() => setMobileMenu(!mobileMenu)}
                        className="lg:hidden bg-transparent border-none cursor-pointer p-1 text-slate-700">
                        {mobileMenu ? <X size={26} /> : <Menu size={26} />}
                    </button>
                </div>

                {/* Mobile menu */}
                {mobileMenu && (
                    <div className="lg:hidden bg-white border-t border-slate-100 px-6 py-4 space-y-1">
                        {NAV_LINKS.map(item => (
                            <button key={item.id} onClick={() => scrollTo(item.id)}
                                className="block w-full text-left py-3 text-base font-medium text-slate-700 border-b border-slate-100 bg-transparent border-x-0 border-t-0 cursor-pointer hover:text-green-700 transition-colors">
                                {item.label}
                            </button>
                        ))}
                        <button onClick={() => navigate("/fazenda/login")}
                            className="mt-3 w-full bg-green-700 text-white rounded-2xl py-3 font-semibold text-base border-none cursor-pointer">
                            Acessar Sistema
                        </button>
                    </div>
                )}
            </nav>

            {/* ── HERO ────────────────────────────────────────────────── */}
            <section className="relative min-h-screen flex items-center overflow-hidden pt-[70px]"
                style={{ backgroundImage: "url('/hero-soja-bg.png')", backgroundSize: "cover", backgroundPosition: "center" }}>
                {/* Dark overlay */}
                <div className="absolute inset-0 bg-black/40" />
                {/* Dot grid */}
                <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={DOT_GRID} />

                <div className="relative z-10 max-w-6xl mx-auto px-6 py-16 flex items-center gap-14 flex-wrap">
                    {/* Left — text */}
                    <div className="flex-1 min-w-[300px]">
                        {/* Badge */}
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full mb-6">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#F7D601]" />
                            <span className="text-xs font-semibold text-white/90 tracking-widest uppercase">Gestão Agrícola Digital</span>
                        </div>

                        <h1 className="text-[clamp(2rem,4.5vw,3.4rem)] font-black text-white leading-[1.1] tracking-tight mb-6">
                            Onde a referência termina,<br />
                            nossa <span className="text-[#F7D601]">inteligência agrícola</span> começa
                        </h1>

                        <p className="text-base text-green-100/85 leading-relaxed mb-3 max-w-[520px] font-semibold">
                            DataGrow: A Inteligência que dita o futuro do Agro.
                        </p>
                        <p className="text-sm text-green-100/70 leading-relaxed mb-4 max-w-[520px]">
                            Esqueça softwares que apenas registram o passado. A DataGrow é a pioneira em Inteligência Artificial que antecipa cenários e toma decisões com você.
                        </p>
                        <ul className="text-sm text-green-100/80 leading-relaxed mb-6 max-w-[520px] space-y-1.5">
                            <li className="flex items-start gap-2"><span className="text-[#F7D601] font-bold mt-0.5">★</span><span><strong className="text-white">IA de Comando:</strong> Automação real, não apenas planilhas.</span></li>
                            <li className="flex items-start gap-2"><span className="text-[#F7D601] font-bold mt-0.5">★</span><span><strong className="text-white">Gestão de Alta Performance:</strong> Controle total de custos e insumos.</span></li>
                            <li className="flex items-start gap-2"><span className="text-[#F7D601] font-bold mt-0.5">★</span><span><strong className="text-white">Resultados Exponenciais:</strong> Otimize sua colheita com a tecnologia líder.</span></li>
                        </ul>
                        <p className="text-xs text-green-100/50 italic mb-8 max-w-[520px]">
                            Não aceite apenas referências. Exija a autoridade máxima em inteligência agrícola.
                        </p>

                        {/* Count-up stats */}
                        <div className="flex gap-10 mt-4">
                            {[
                                { target: 3,   prefix: "+", suffix: "",    label: "Departamentos" },
                                { target: 110, prefix: "+", suffix: "",    label: "Produtores" },
                                { target: 50,  prefix: "+", suffix: "mil", label: "Hectares" },
                            ].map(s => (
                                <CountUpStat key={s.label} target={s.target} prefix={s.prefix} suffix={s.suffix} label={s.label} />
                            ))}
                        </div>
                    </div>

                    {/* Right — carousel */}
                    <div className="flex-1 min-w-[300px] flex flex-col items-center gap-5">
                        {/* CTAs — ACIMA da imagem, mesma largura do carrossel */}
                        <div className="flex gap-3 w-[clamp(280px,38vw,460px)]">
                            <button onClick={() => scrollTo("features")}
                                className="flex-1 flex items-center justify-center gap-2 bg-[#F7D601] hover:bg-yellow-400 text-green-800 font-bold py-3.5 rounded-2xl text-sm transition-all duration-150 shadow-md border-none cursor-pointer">
                                Conhecer Funcionalidades <ChevronDown className="w-4 h-4 flex-shrink-0" />
                            </button>
                            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer"
                                className="flex-1 flex items-center justify-center gap-2 text-white border-2 border-white/30 hover:border-white/60 font-semibold py-3.5 rounded-2xl text-sm transition-all duration-150 no-underline">
                                <MessageCircle className="w-4 h-4 flex-shrink-0" /> Solicite uma Visita
                            </a>
                        </div>
                        <div className="relative">
                            {/* Main image frame */}
                            <div className="relative w-[clamp(280px,38vw,460px)] h-[clamp(280px,38vw,460px)] rounded-2xl overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.35)] border-2 border-yellow-400/30">
                                {heroSlides.map((slide, i) => (
                                    <img key={i} src={slide.image} alt={slide.label}
                                        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
                                        style={{ opacity: heroSlide === i ? 1 : 0 }}
                                    />
                                ))}
                                {/* Dots */}
                                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 z-10">
                                    {heroSlides.map((_, i) => (
                                        <button key={i} onClick={() => setHeroSlide(i)}
                                            className="h-2.5 rounded-full border-none cursor-pointer transition-all duration-300"
                                            style={{ width: heroSlide === i ? 24 : 10, background: heroSlide === i ? "#F7D601" : "rgba(255,255,255,0.45)" }}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Floating info card */}
                            <div className="absolute -bottom-5 -left-7 bg-white rounded-2xl px-5 py-4 shadow-[0_10px_40px_rgba(0,0,0,0.15)] flex items-center gap-3 transition-all duration-500">
                                <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0">
                                    {(() => { const Icon = heroSlides[heroSlide].icon; return <Icon className="w-5 h-5 text-green-700" />; })()}
                                </div>
                                <div>
                                    <p className="text-xs text-slate-400 leading-tight">{heroSlides[heroSlide].sublabel}</p>
                                    <p className="text-sm font-bold text-green-700 leading-tight">{heroSlides[heroSlide].label}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── FEATURES ────────────────────────────────────────────── */}
            <section id="features" className="py-24 px-6 bg-slate-50">
                <div className="max-w-6xl mx-auto">
                    {/* Section header */}
                    <div className="text-center mb-16">
                        <p className="text-green-600 font-bold text-xs tracking-[0.2em] uppercase mb-3">Funcionalidades</p>
                        <h2 className="text-[clamp(1.8rem,4vw,2.8rem)] font-extrabold text-slate-900 tracking-tight mb-4">
                            Tudo que você precisa em <span className="text-green-700">um só lugar</span>
                        </h2>
                        <p className="text-slate-500 text-lg max-w-xl mx-auto leading-relaxed">
                            Sistema completo para gestão da sua propriedade rural, do plantio à colheita.
                        </p>
                    </div>

                    {/* Feature rows */}
                    {[
                        { icon: Sparkles, title: "Recebimento Inteligente de Faturas", desc: "Esqueça o cadastro manual. Assim que sua empresa de insumos emite a fatura, a DataGrow recebe automaticamente, identifica os produtos, quantidades e valores — e já registra no sistema aguardando sua aprovação com um clique.", image: "/feature-faturas.svg", reverse: true, noOverlay: true,
                          items: ["Zero digitação — 100% automatizado", "Aprovação em um clique direto no app", "Estoque atualizado automaticamente após aprovação", "Histórico completo de todas as faturas recebidas"],
                          badge: "IA DataGrow" },
                        { icon: Package, title: "Controle de Estoque & Insumos", desc: "Saiba exatamente o que tem, quanto custou e quando comprar mais.", image: "/feature-estoque.png",
                          items: ["Custo médio automático por produto", "Alertas de estoque baixo via WhatsApp", "Movimentações com rastreabilidade", "Integração com faturas de compra", "Histórico completo de preços"] },
                        { icon: Satellite, title: "Monitoramento NDVI por Satélite", desc: "Imagens do Sentinel-2 atualizadas a cada 5 dias, direto no mapa dos seus talhões.", image: "/feature-ndvi.png", reverse: true,
                          items: ["Índices NDVI, EVI, Cor Real e Falsa Cor", "Resolução de 10 metros por pixel", "Histórico de 90 dias com comparativo visual", "Paleta profissional para identificar estresse", "Filtro automático de nuvens"] },
                        { icon: CloudSun, title: "Estações Meteorológicas Virtuais", desc: "Dados climáticos em tempo real para cada talhão, sem precisar instalar equipamentos.", image: "/feature-weather.png",
                          items: ["Temperatura, umidade, vento, pressão e UV", "Previsão para os próximos 7 dias", "Janela de Pulverização inteligente", "Graus-Dia de Desenvolvimento (GDD)", "Histórico climático completo"] },
                        { icon: BookOpen, title: "Caderno de Campo Automático", desc: "Rastreabilidade total sem trabalho manual. 100% automático.", image: "/feature-caderno.png", reverse: true,
                          items: ["Gerado a partir das aplicações registradas", "Mapa dos talhões com áreas aplicadas", "Linha do tempo completa da safra", "Exportação em PDF profissional", "Atende exigências de exportação"] },
                        { icon: Bell, title: "Alertas Inteligentes via WhatsApp", desc: "Receba avisos importantes sem precisar abrir o sistema.", image: "/feature-alertas.png",
                          items: ["Estoque baixo? Avisamos no WhatsApp", "Fatura vencendo em 5 dias", "Variação de preço de insumos", "Boletim diário com clima e cotações", "Notícias do mercado agrícola"] },
                        { icon: Target, title: "Inteligência Estratégica de Romaneios", desc: "Descubra qual silo entrega a melhor viabilidade e proteja-se contra descontos abusivos.", image: "/feature-inteligencia.png", reverse: true,
                          items: ["Ranking de Eficiência Real por silo", "Alerta de quebras de peso fora do padrão", "Comparativo por distância do talhão", "Análise de variação de umidade e impureza"] },
                        { icon: Users, title: "Rede de Cotação Anônima", desc: "Compare seus preços com outros agricultores. Negocie melhor.", image: "/feature-cotacoes.png",
                          items: ["Comparativo anônimo de preços", "Média, menor e maior preço pago", "Ranking: acima ou abaixo da média?", "Privacidade garantida", "Poder de negociação na compra"] },
                    ].map((feature, idx) => {
                        const Icon = feature.icon;
                        return (
                            <div key={idx} className={`flex items-center gap-14 mb-20 flex-wrap ${feature.reverse ? "flex-row-reverse" : "flex-row"}`}>
                                {/* Text */}
                                <div className="flex-1 min-w-[280px]">
                                    <div className="inline-flex items-center gap-3 mb-5">
                                        <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center flex-shrink-0">
                                            <Icon className="w-6 h-6 text-green-700" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-slate-900 tracking-tight">{feature.title}</h3>
                                            {feature.badge && (
                                                <span className="inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-bold rounded-full uppercase tracking-wider">
                                                    <Sparkles className="w-3 h-3" /> {feature.badge}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <p className="text-slate-500 text-base leading-relaxed mb-5">{feature.desc}</p>
                                    <ul className="space-y-2.5">
                                        {feature.items.map((item, i) => (
                                            <li key={i} className="flex items-center gap-3 text-sm text-slate-700">
                                                <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                {/* Image */}
                                <div className="flex-1 min-w-[280px] flex justify-center">
                                    <div className="w-full max-w-[420px] aspect-[4/3] rounded-2xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.10)] relative">
                                        <img src={feature.image} alt={feature.title} className="w-full h-full object-cover" />
                                        {!feature.noOverlay && (
                                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-5 pb-4 pt-10">
                                                <p className="text-[11px] text-white/60">DataGrow</p>
                                                <p className="text-sm font-bold text-white">{feature.title}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* ── RESOURCES GRID ──────────────────────────────────────── */}
            <section id="resources" className="relative py-20 px-6 overflow-hidden"
                style={{ backgroundImage: "url('/hero-soja-bg.png')", backgroundSize: "cover", backgroundPosition: "center 30%" }}>
                {/* Dark overlay */}
                <div className="absolute inset-0 bg-black/50" />
                {/* Dot grid */}
                <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={DOT_GRID} />

                <div className="relative z-10 max-w-6xl mx-auto">
                    <div className="text-center mb-14">
                        <p className="text-[#F7D601] font-bold text-xs tracking-[0.2em] uppercase mb-3">Mais Recursos</p>
                        <h2 className="text-[clamp(1.8rem,4vw,2.5rem)] font-extrabold text-white tracking-tight">
                            Sistema completo para sua <span className="text-[#F7D601]">fazenda crescer</span>
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {[
                            { icon: Package,     title: "Estoque",       desc: "Controle total de produtos e insumos com custo médio automático" },
                            { icon: FileText,    title: "Faturas",        desc: "Importe faturas e vincule automaticamente ao estoque" },
                            { icon: Sprout,      title: "Aplicações",    desc: "Registre aplicações por talhão com dose e operador" },
                            { icon: Tractor,     title: "Frota",          desc: "Abastecimentos, horímetro e manutenção dos equipamentos" },
                            { icon: BarChart3,   title: "Custo/Hectare", desc: "Saiba quanto custa cada talhão com precisão total" },
                            { icon: TrendingUp,  title: "Cotações",      desc: "Compare preços com outros agricultores anonimamente" },
                            { icon: Map,         title: "Propriedades",  desc: "Cadastre fazendas e talhões com mapa e localização" },
                            { icon: FileBarChart,title: "Relatórios",    desc: "9 tipos de relatórios com filtros e exportação PDF" },
                            { icon: ArrowDownUp, title: "Movimentações", desc: "Entradas, saídas e ajustes com rastreabilidade total" },
                            { icon: DollarSign,  title: "Despesas",      desc: "Controle gastos por categoria com gráficos visuais" },
                            { icon: MessageCircle,title: "WhatsApp Bot", desc: "Boletim diário com clima, cotação da soja e alertas" },
                            { icon: Satellite,   title: "Satélite NDVI", desc: "Monitore a saúde da lavoura via imagens de satélite" },
                        ].map((res, i) => (
                            <GlassCard key={i} icon={res.icon} title={res.title} description={res.desc} />
                        ))}
                    </div>
                </div>
            </section>

            {/* ── BENEFITS ────────────────────────────────────────────── */}
            <section className="relative py-20 px-6 bg-slate-50">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-14">
                        <p className="text-green-600 font-bold text-xs tracking-[0.2em] uppercase mb-3">Vantagens</p>
                        <h2 className="text-[clamp(1.8rem,4vw,2.5rem)] font-extrabold text-slate-900 tracking-tight">
                            Por que escolher o <span className="text-green-700">AgroFarm</span>?
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                            { icon: Globe,      title: "100% Na Nuvem",  desc: "Acesse do celular, tablet ou computador, de qualquer lugar" },
                            { icon: Zap,        title: "Fácil de Usar",  desc: "Interface intuitiva, sem necessidade de treinamento" },
                            { icon: Shield,     title: "Dados Seguros",  desc: "Seus dados protegidos com criptografia e backup automático" },
                            { icon: Smartphone, title: "Mobile First",   desc: "Funciona perfeitamente no celular, na lavoura" },
                        ].map((b, i) => {
                            const Icon = b.icon;
                            return (
                                <div key={i} className="bg-white rounded-2xl p-6 shadow-[0_2px_16px_rgba(0,0,0,0.05)] border border-slate-100 hover:-translate-y-1 transition-transform duration-200">
                                    <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center mb-4">
                                        <Icon className="w-6 h-6 text-green-700" />
                                    </div>
                                    <h4 className="text-base font-bold text-slate-900 mb-2">{b.title}</h4>
                                    <p className="text-sm text-slate-500 leading-relaxed">{b.desc}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* ── FAQ ─────────────────────────────────────────────────── */}
            <section id="faq" className="py-20 px-6 bg-white">
                <div className="max-w-2xl mx-auto">
                    <div className="text-center mb-12">
                        <p className="text-green-600 font-bold text-xs tracking-[0.2em] uppercase mb-3">Dúvidas</p>
                        <h2 className="text-[clamp(1.8rem,4vw,2.5rem)] font-extrabold text-slate-900 tracking-tight">
                            Perguntas <span className="text-green-700">Frequentes</span>
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

            {/* ── CTA FINAL ───────────────────────────────────────────── */}
            <section className="relative py-20 px-6 overflow-hidden text-center"
                style={{ backgroundImage: "url('/hero-soja-bg.png')", backgroundSize: "cover", backgroundPosition: "center 70%" }}>
                {/* Dark overlay */}
                <div className="absolute inset-0 bg-black/40" />
                {/* Dot grid */}
                <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={DOT_GRID} />
                <div className="relative z-10 max-w-xl mx-auto">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full mb-6">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#F7D601]" />
                        <span className="text-xs font-semibold text-white/90">Comece hoje mesmo</span>
                    </div>
                    <h2 className="text-[clamp(1.8rem,4vw,2.8rem)] font-black text-white tracking-tight mb-4">
                        Onde a referência termina,<br />nossa <span className="text-[#F7D601]">inteligência agrícola</span> começa
                    </h2>
                    <p className="text-green-100/75 text-base leading-relaxed mb-8">
                        Não aceite apenas referências. Exija a autoridade máxima em inteligência agrícola.
                    </p>
                    <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-2.5 bg-[#F7D601] hover:bg-yellow-400 text-green-800 font-bold px-10 py-4 rounded-2xl text-base shadow-lg transition-all duration-150 no-underline">
                        <MessageCircle className="w-5 h-5" /> Solicite uma Visita
                    </a>
                </div>
            </section>

            {/* ── FOOTER ──────────────────────────────────────────────── */}
            <footer className="py-10 px-6 bg-slate-900 text-center">
                <div className="flex items-center justify-center gap-2 mb-3">
                    <img src="/icon-datagrow.png" alt="" className="h-8 w-auto object-contain" style={{ filter: "brightness(0) invert(1)" }} />
                    <div className="flex flex-col leading-none text-left">
                        <span className="font-black tracking-tight" style={{ fontSize: "1.3rem", lineHeight: 1.1 }}>
                            <span style={{ color: "#5b9fd4" }}>Data</span><span style={{ color: "#6abf7a" }}>Grow</span>
                        </span>
                        <span className="font-semibold tracking-widest uppercase" style={{ fontSize: "0.5rem", color: "#666", letterSpacing: "0.12em" }}>
                            Seus dados. Seu crescimento.
                        </span>
                    </div>
                </div>
                <p className="text-slate-500 text-sm">© 2026 DataGrow — Sistema de Gestão Agrícola Digital</p>
                <p className="text-slate-600 text-xs mt-1">Para agricultores do Brasil e Paraguai</p>
            </footer>

            {/* ── STICKY FOOTER CTA ───────────────────────────────────── */}
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-green-900/95 backdrop-blur-sm px-6 py-3 flex items-center justify-center gap-6 shadow-[0_-4px_20px_rgba(0,0,0,0.2)]">
                <div className="flex items-center gap-2">
                    <span className="text-[#F7D601] font-bold text-xs tracking-widest uppercase hidden sm:block">Domine sua Lavoura</span>
                </div>
                <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 bg-[#F7D601] hover:bg-yellow-400 text-green-800 font-bold px-5 py-2 rounded-xl text-sm transition-all duration-150 no-underline">
                    <MessageCircle className="w-3.5 h-3.5" /> Solicite uma Visita
                </a>
            </div>

            {/* Bottom padding to avoid sticky footer overlap */}
            <div className="h-14" />
        </div>
    );
}

// ─── FAQ Accordion ─────────────────────────────────────────────────────────
function FAQItem({ question, answer }: { question: string; answer: string }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="border-b border-slate-100">
            <button onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between py-5 bg-transparent border-none cursor-pointer text-left">
                <span className="text-base font-semibold text-slate-900 pr-4">{question}</span>
                {open
                    ? <ChevronUp className="w-5 h-5 text-slate-400 flex-shrink-0" />
                    : <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />}
            </button>
            {open && (
                <div className="pb-5 text-sm text-slate-500 leading-relaxed">
                    {answer}
                </div>
            )}
        </div>
    );
}

// ─── Count-up stat (preserves IntersectionObserver logic) ──────────────────
function CountUpStat({ target, prefix, suffix, label }: { target: number; prefix: string; suffix: string; label: string }) {
    const [count, setCount] = useState(0);
    const ref = useRef<HTMLDivElement>(null);
    const hasAnimated = useRef(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting && !hasAnimated.current) {
                hasAnimated.current = true;
                const duration = 2000;
                const start = performance.now();
                const animate = (now: number) => {
                    const elapsed = now - start;
                    const progress = Math.min(elapsed / duration, 1);
                    const eased = 1 - (1 - progress) * (1 - progress);
                    setCount(Math.round(eased * target));
                    if (progress < 1) requestAnimationFrame(animate);
                };
                requestAnimationFrame(animate);
            }
        }, { threshold: 0.3 });
        observer.observe(el);
        return () => observer.disconnect();
    }, [target]);

    return (
        <div ref={ref}>
            <div className="text-[2.2rem] font-black text-[#F7D601] leading-none">{prefix}{count}{suffix}</div>
            <div className="text-xs text-green-100/70 mt-1">{label}</div>
        </div>
    );
}
