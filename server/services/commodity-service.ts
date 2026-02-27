/**
 * Commodity Service - Soy prices (CBOT) and exchange rates
 * Uses Alpha Vantage for commodities and exchangerate.host for currency
 */

interface CommodityData {
    soyPrice: string;
    soyChange: string;
    soyChangePercent: string;
    usdBrl: string;
    usdPyg: string;
    lastUpdated: string;
}

export async function getCommodityData(): Promise<CommodityData | null> {
    try {
        const apiKey = process.env.ALPHA_VANTAGE_API_KEY;

        // Fetch soy price from Alpha Vantage (or fallback)
        let soyPrice = "N/D";
        let soyChange = "0";
        let soyChangePercent = "0%";

        if (apiKey) {
            try {
                const soyResponse = await fetch(
                    `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=ZS%3DF&apikey=${apiKey}`
                );
                const soyData = await soyResponse.json();
                const quote = soyData["Global Quote"];

                if (quote && quote["05. price"]) {
                    soyPrice = parseFloat(quote["05. price"]).toFixed(2);
                    soyChange = parseFloat(quote["09. change"]).toFixed(2);
                    soyChangePercent = quote["10. change percent"] || "0%";
                }
            } catch (e) {
                console.error("[COMMODITY] Alpha Vantage soy error:", e);
            }
        }

        // Fetch exchange rates (free API, no key needed)
        let usdBrl = "N/D";
        let usdPyg = "N/D";

        try {
            // Using exchangerate.host free API
            const fxResponse = await fetch("https://open.er-api.com/v6/latest/USD");
            const fxData = await fxResponse.json();

            if (fxData.rates) {
                usdBrl = fxData.rates.BRL ? `R$ ${fxData.rates.BRL.toFixed(2)}` : "N/D";
                usdPyg = fxData.rates.PYG ? `₲ ${Math.round(fxData.rates.PYG).toLocaleString("pt-BR")}` : "N/D";
            }
        } catch (e) {
            console.error("[COMMODITY] Exchange rate error:", e);
        }

        return {
            soyPrice,
            soyChange,
            soyChangePercent,
            usdBrl,
            usdPyg,
            lastUpdated: new Date().toLocaleDateString("pt-BR"),
        };
    } catch (error) {
        console.error("[COMMODITY]", error);
        return null;
    }
}

export function formatCommodityMessage(data: CommodityData | null): string {
    if (!data) return "Não consegui buscar as cotações no momento.";

    const arrow = parseFloat(data.soyChange) >= 0 ? "📈" : "📉";
    const sign = parseFloat(data.soyChange) >= 0 ? "+" : "";

    let msg = `💰 *Cotações do Dia*\n\n`;
    msg += `🫘 *Soja CBOT:* US$ ${data.soyPrice}/bu ${arrow} (${sign}${data.soyChange})\n`;
    msg += `💱 *USD/BRL:* ${data.usdBrl}\n`;
    msg += `💱 *USD/PYG:* ${data.usdPyg}`;

    return msg;
}
