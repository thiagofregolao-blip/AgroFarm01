import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";

export type Language = "pt-BR" | "es";

const translations = {
  "pt-BR": {
    // Navigation
    nav_home: "Início",
    nav_properties: "Propriedades",
    nav_seasons: "Safras",
    nav_invoices: "Faturas",
    nav_stock: "Estoque",
    nav_fleet: "Frota",
    nav_employees: "Funcionários",
    nav_applications: "Aplicações",
    nav_plot_costs: "Custo/Talhão",
    nav_expenses: "Despesas",
    nav_cash_flow: "Fluxo de Caixa",
    nav_terminals: "Terminais PDV",
    nav_field_notebook: "Caderno de Campo",
    nav_soja_quotes: "Cotacao Soja",
    nav_quotations: "Cotações",
    nav_ndvi: "NDVI Satélite",
    nav_weather: "Clima",
    nav_reports: "Relatórios",
    nav_profile: "Perfil",
    nav_logout: "Sair",
    nav_open_menu: "Abrir menu",
    nav_tab_farm: "Fazenda",
    nav_tab_finance: "Financeiro",
    nav_romaneios: "Romaneios",
    nav_accounts_payable: "Pagamentos",
    nav_accounts_receivable: "Recebimentos",
    nav_emission_faturas: "Emissão de Faturas",
    nav_dre: "DRE / Resultado",
    nav_budget: "Orçamento",
    nav_reconciliation: "Conciliação",
    nav_suppliers: "Empresas e Pessoas",
    nav_productivity: "Produtividade",

    // Profile
    profile_title: "Meu Perfil",
    profile_subtitle: "Gerencie suas informações pessoais e de contato.",
    profile_name: "Nome Completo",
    profile_name_placeholder: "Seu nome",
    profile_name_min: "Nome deve ter pelo menos 2 caracteres",
    profile_whatsapp: "Número Principal do WhatsApp",
    profile_whatsapp_placeholder: "Ex: 5543999999999",
    profile_whatsapp_desc: "Formato internacional: Código do País + DDD + Número (apenas números).",
    profile_whatsapp_example: "Exemplo Brasil: 55 43 99999-9999 →",
    profile_whatsapp_invalid: "Número inválido. Use o formato com DDD",
    profile_whatsapp_bot_title: "Assistente Virtual (WhatsApp)",
    profile_whatsapp_bot_desc: "Cadastre seu número abaixo para usar o assistente de IA. Você poderá perguntar sobre estoque, despesas e faturas diretamente pelo WhatsApp.",
    profile_extra_numbers_title: "Números do Grupo (Opcional)",
    profile_extra_numbers_desc: "Adicione números de outros participantes para usar o agente em grupos do WhatsApp.",
    profile_extra_numbers_hint: "No grupo, digite",
    profile_extra_numbers_keyword: "agrofarm",
    profile_extra_numbers_hint2: "+ sua pergunta para acionar o bot.",
    profile_extra_numbers_empty: "Nenhum número extra cadastrado",
    profile_add: "Adicionar",
    profile_location_title: "Localização da Fazenda",
    profile_location_desc: "Informe a localização para receber previsão do tempo personalizada no boletim diário.",
    profile_city: "Cidade / Região",
    profile_city_placeholder: "Ex: Santa Helena, PR",
    profile_latitude: "Latitude",
    profile_latitude_placeholder: "Ex: -25.2637",
    profile_longitude: "Longitude",
    profile_longitude_placeholder: "Ex: -54.3378",
    profile_location_hint: "Dica: Abra o Google Maps, clique no local da fazenda e copie as coordenadas.",
    profile_bulletin_title: "Boletim Diário AgroZap",
    profile_bulletin_desc: "Receba todo dia às 6h: tempo, cotação da soja e notícias",
    profile_invoice_email_title: "Email para Faturas Automáticas",
    profile_invoice_email_desc: "Configure um email para receber faturas automaticamente. Quando um fornecedor enviar um PDF de fatura para este email, o sistema irá ler e importar os dados automaticamente, aguardando sua aprovação.",
    profile_invoice_email_placeholder: "Ex: meunome.faturas@mail.agrofarmdigital.com",
    profile_invoice_email_hint: "Forneça este email apenas para empresas agrícolas de confiança.",
    profile_accountant_title: "Email do Contador",
    profile_accountant_desc: "Ao receber uma fatura, o sistema enviará automaticamente uma cópia para o seu contador.",
    profile_accountant_placeholder: "Ex: contador@escritorio.com",
    profile_accountant_hint: "Seu contador receberá uma cópia de cada fatura importada.",
    profile_save: "Salvar Alterações",
    profile_saving: "Salvando...",
    profile_success: "Sucesso!",
    profile_success_desc: "Perfil atualizado com sucesso.",
    profile_error: "Erro",
    profile_error_desc: "Falha ao atualizar perfil.",
    profile_language_title: "Idioma do Sistema",
    profile_language_desc: "Escolha o idioma da interface do sistema.",

    // NDVI
    ndvi_fields: "Campos",
    ndvi_plots_count: "talhões cadastrados",
    ndvi_loading: "Carregando talhões...",
    ndvi_no_plots: "Nenhum talhão cadastrado",
    ndvi_no_gps: "Sem GPS",
    ndvi_processing: "Processando dados de satélite...",
    ndvi_satellite_error: "Falha ao conectar ao satélite.",
    ndvi_history: "Histórico",
    ndvi_hide_clouds: "Ocultar dias nublados",
    ndvi_no_data: "Nenhum dado disponível",
    ndvi_all_filtered: "Todos os dias filtrados (muitas nuvens)",
    ndvi_average: "Média",
    ndvi_excellent: "Excelente",
    ndvi_healthy: "Saudável",
    ndvi_moderate: "Moderado",
    ndvi_stress: "Estresse",
    ndvi_critical: "Crítico",
    ndvi_contrast: "NDVI com contraste",
    ndvi_standard: "NDVI",
    ndvi_evi: "EVI",
    ndvi_truecolor: "Cor Real",
    ndvi_falsecolor: "Falsa Cor",

    // Weather
    weather_title: "Estações Meteorológicas",
    weather_stations: "estações",
    weather_temperature: "Temperatura",
    weather_humidity: "Umidade",
    weather_wind: "Vento",
    weather_pressure: "Pressão",
    weather_uv: "Índice UV",
    weather_feels_like: "Sensação",
    weather_forecast: "Previsão do Tempo",
    weather_spray_window: "Janela de Pulverização",
    weather_gdd: "Graus-Dia (GDD)",
    weather_today: "Hoje",
    weather_ideal: "Ideal",
    weather_caution: "Atenção",
    weather_avoid: "Evitar",
    weather_no_stations: "Nenhuma estação cadastrada",

    // Common
    common_loading: "Carregando...",
    common_error: "Erro",
    common_save: "Salvar",
    common_cancel: "Cancelar",
    common_delete: "Excluir",
    common_edit: "Editar",
    common_add: "Adicionar",
    common_back: "Voltar",
    common_search: "Buscar",
    common_filter: "Filtrar",
    common_ha: "ha",
  },

  es: {
    // Navigation
    nav_home: "Inicio",
    nav_properties: "Propiedades",
    nav_seasons: "Zafras",
    nav_invoices: "Facturas",
    nav_stock: "Inventario",
    nav_fleet: "Flota",
    nav_employees: "Empleados",
    nav_applications: "Aplicaciones",
    nav_plot_costs: "Costo/Parcela",
    nav_expenses: "Gastos",
    nav_cash_flow: "Flujo de Caja",
    nav_terminals: "Terminales PDV",
    nav_field_notebook: "Cuaderno de Campo",
    nav_soja_quotes: "Cotizacion Soja",
    nav_quotations: "Cotizaciones",
    nav_ndvi: "NDVI Satélite",
    nav_weather: "Clima",
    nav_reports: "Informes",
    nav_profile: "Perfil",
    nav_logout: "Salir",
    nav_open_menu: "Abrir menú",
    nav_tab_farm: "Finca",
    nav_tab_finance: "Financiero",
    nav_romaneios: "Romaneos",
    nav_accounts_payable: "Pagos",
    nav_accounts_receivable: "Cobros",
    nav_emission_faturas: "Emisión de Facturas",
    nav_dre: "Estado de Resultados",
    nav_budget: "Presupuesto",
    nav_reconciliation: "Conciliación",
    nav_suppliers: "Empresas e Pessoas",
    nav_productivity: "Productividad",

    // Profile
    profile_title: "Mi Perfil",
    profile_subtitle: "Administre su información personal y de contacto.",
    profile_name: "Nombre Completo",
    profile_name_placeholder: "Su nombre",
    profile_name_min: "El nombre debe tener al menos 2 caracteres",
    profile_whatsapp: "Número Principal de WhatsApp",
    profile_whatsapp_placeholder: "Ej: 595981999999",
    profile_whatsapp_desc: "Formato internacional: Código del País + Número (solo números).",
    profile_whatsapp_example: "Ejemplo Paraguay: 595 981 999999 →",
    profile_whatsapp_invalid: "Número inválido. Use el formato con código de área",
    profile_whatsapp_bot_title: "Asistente Virtual (WhatsApp)",
    profile_whatsapp_bot_desc: "Registre su número para usar el asistente de IA. Podrá consultar sobre inventario, gastos y facturas directamente por WhatsApp.",
    profile_extra_numbers_title: "Números del Grupo (Opcional)",
    profile_extra_numbers_desc: "Agregue números de otros participantes para usar el agente en grupos de WhatsApp.",
    profile_extra_numbers_hint: "En el grupo, escriba",
    profile_extra_numbers_keyword: "agrofarm",
    profile_extra_numbers_hint2: "+ su consulta para activar el bot.",
    profile_extra_numbers_empty: "Ningún número extra registrado",
    profile_add: "Agregar",
    profile_location_title: "Ubicación de la Finca",
    profile_location_desc: "Informe la ubicación para recibir pronóstico del tiempo personalizado en el boletín diario.",
    profile_city: "Ciudad / Región",
    profile_city_placeholder: "Ej: Hernandarias, Alto Paraná",
    profile_latitude: "Latitud",
    profile_latitude_placeholder: "Ej: -25.2637",
    profile_longitude: "Longitud",
    profile_longitude_placeholder: "Ej: -54.3378",
    profile_location_hint: "Consejo: Abra Google Maps, haga clic en la ubicación de la finca y copie las coordenadas.",
    profile_bulletin_title: "Boletín Diario AgroZap",
    profile_bulletin_desc: "Reciba todos los días a las 6h: clima, cotización de la soja y noticias",
    profile_invoice_email_title: "Email para Facturas Automáticas",
    profile_invoice_email_desc: "Configure un email para recibir facturas automáticamente. Cuando un proveedor envíe un PDF de factura a este email, el sistema leerá e importará los datos automáticamente.",
    profile_invoice_email_placeholder: "Ej: minombre.facturas@mail.agrofarmdigital.com",
    profile_invoice_email_hint: "Proporcione este email solo a empresas agrícolas de confianza.",
    profile_accountant_title: "Email del Contador",
    profile_accountant_desc: "Al recibir una factura, el sistema enviará automáticamente una copia a su contador.",
    profile_accountant_placeholder: "Ej: contador@oficina.com",
    profile_accountant_hint: "Su contador recibirá una copia de cada factura importada.",
    profile_save: "Guardar Cambios",
    profile_saving: "Guardando...",
    profile_success: "¡Éxito!",
    profile_success_desc: "Perfil actualizado correctamente.",
    profile_error: "Error",
    profile_error_desc: "Error al actualizar el perfil.",
    profile_language_title: "Idioma del Sistema",
    profile_language_desc: "Elija el idioma de la interfaz del sistema.",

    // NDVI
    ndvi_fields: "Campos",
    ndvi_plots_count: "parcelas registradas",
    ndvi_loading: "Cargando parcelas...",
    ndvi_no_plots: "Ninguna parcela registrada",
    ndvi_no_gps: "Sin GPS",
    ndvi_processing: "Procesando datos de satélite...",
    ndvi_satellite_error: "Error al conectar con el satélite.",
    ndvi_history: "Historial",
    ndvi_hide_clouds: "Ocultar días nublados",
    ndvi_no_data: "No hay datos disponibles",
    ndvi_all_filtered: "Todos los días filtrados (muchas nubes)",
    ndvi_average: "Promedio",
    ndvi_excellent: "Excelente",
    ndvi_healthy: "Saludable",
    ndvi_moderate: "Moderado",
    ndvi_stress: "Estrés",
    ndvi_critical: "Crítico",
    ndvi_contrast: "NDVI con contraste",
    ndvi_standard: "NDVI",
    ndvi_evi: "EVI",
    ndvi_truecolor: "Color Real",
    ndvi_falsecolor: "Falso Color",

    // Weather
    weather_title: "Estaciones Meteorológicas",
    weather_stations: "estaciones",
    weather_temperature: "Temperatura",
    weather_humidity: "Humedad",
    weather_wind: "Viento",
    weather_pressure: "Presión",
    weather_uv: "Índice UV",
    weather_feels_like: "Sensación",
    weather_forecast: "Pronóstico del Tiempo",
    weather_spray_window: "Ventana de Pulverización",
    weather_gdd: "Grados-Día (GDD)",
    weather_today: "Hoy",
    weather_ideal: "Ideal",
    weather_caution: "Precaución",
    weather_avoid: "Evitar",
    weather_no_stations: "Ninguna estación registrada",

    // Common
    common_loading: "Cargando...",
    common_error: "Error",
    common_save: "Guardar",
    common_cancel: "Cancelar",
    common_delete: "Eliminar",
    common_edit: "Editar",
    common_add: "Agregar",
    common_back: "Volver",
    common_search: "Buscar",
    common_filter: "Filtrar",
    common_ha: "ha",
  },
} as const;

type TranslationKey = keyof typeof translations["pt-BR"];

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: "pt-BR",
  setLanguage: () => { },
  t: (key) => key,
});

export function LanguageProvider({ children, initialLanguage }: { children: ReactNode; initialLanguage?: Language }) {
  const [language, setLanguageState] = useState<Language>(initialLanguage || "pt-BR");

  useEffect(() => {
    const stored = localStorage.getItem("agrofarm_language") as Language;
    if (stored && (stored === "pt-BR" || stored === "es")) {
      setLanguageState(stored);
    }
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("agrofarm_language", lang);
  }, []);

  const t = useCallback((key: TranslationKey): string => {
    return translations[language]?.[key] || translations["pt-BR"][key] || key;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export const LANGUAGE_OPTIONS = [
  { value: "pt-BR" as Language, label: "Português (Brasil)", flag: "🇧🇷" },
  { value: "es" as Language, label: "Español", flag: "🇵🇾" },
];
