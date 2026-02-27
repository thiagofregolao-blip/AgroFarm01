/**
 * Commodity Service - Soy prices (CBOT) and exchange rates
 * Uses Yahoo Finance API for soy futures + Open Exchange Rates for currency
 */

interface CommodityData {
    soyPrice: string;
    soyChange: string;
    soyChangePercent: string;
    usdBrl: string;
    usdPyg: string;
    lastUpdated: string;
}

/**
 * Fetch soy price from Yahoo Finance v8 API (free, no key needed)
 * Returns last closing price even when market is closed
 */
async function fetchSoyPrice(): Promise<{ price: string; change: string; changePercent: string }> {
    const fallback = { price: "N/D", change: "0", changePercent: "0%" };

    try {
        // Yahoo Finance API - works 24/7, returns last available price
        const response = await fetch(
            "https://query1.finance.yahoo.com/v8/finance/chart/ZS=F?interval=1d&range=2d",
            {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                },
                signal: AbortSignal.timeout(8000),
            }
        );

        if (!response.ok) {
            console.error("[COMMODITY] Yahoo Finance HTTP error:", response.status);
            return fallback;
        }

        const data = await response.json();
        const result = data?.chart?.result?.[0];

        if (!result) {
            console.error("[COMMODITY] Yahoo Finance: no result data");
            return fallback;
        }

        const meta = result.meta;
        const currentPrice = meta?.regularMarketPrice || meta?.previousClose;

        if (!currentPrice) {
            console.error("[COMMODITY] Yahoo Finance: no price found");
            return fallback;
        }

        const previousClose = meta?.chartPreviousClose || meta?.previousClose || currentPrice;
        const change = (currentPrice - previousClose).toFixed(2);
        const changePercent = previousClose > 0
            ? ((currentPrice - previousClose) / previousClose * 100).toFixed(2) + "%"
            : "0%";

        console.log(`[COMMODITY] Soy price: US$ ${currentPrice.toFixed(2)} (change: ${change})`);

        return {
            price: currentPrice.toFixed(2),
            change,
            changePercent,
        };
    } catch (e) {
        console.error("[COMMODITY] Yahoo Finance error:", e);

        // Fallback: try Alpha Vantage if available
        const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
        if (apiKey) {
            try {
                const avResponse = await fetch(
                    `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=SOYB&apikey=${apiKey}`,
                    { signal: AbortSignal.timeout(5000) }
                );
                const avData = await avResponse.json();
                const quote = avData["Global Quote"];

                if (quote && quote["05. price"]) {
                    return {
                        price: parseFloat(quote["05. price"]).toFixed(2),
                        change: parseFloat(quote["09. change"] || "0").toFixed(2),
                        changePercent: quote["10. change percent"] || "0%",
                    };
                }
            } catch (e2) {
                console.error("[COMMODITY] Alpha Vantage fallback error:", e2);
            }
        }

        return fallback;
    }
}

export async function getCommodityData(): Promise<CommodityData | null> {
    try {
        // Fetch soy price (Yahoo Finance → Alpha Vantage fallback)
        const soy = await fetchSoyPrice();

        // Fetch exchange rates (free API, no key needed)
        let usdBrl = "N/D";
        let usdPyg = "N/D";

        try {
            const fxResponse = await fetch("https://open.er-api.com/v6/latest/USD", {
                signal: AbortSignal.timeout(5000),
            });
            const fxData = await fxResponse.json();

            if (fxData.rates) {
                usdBrl = fxData.rates.BRL ? `R$ ${fxData.rates.BRL.toFixed(2)}` : "N/D";
                usdPyg = fxData.rates.PYG ? `₲ ${Math.round(fxData.rates.PYG).toLocaleString("pt-BR")}` : "N/D";
            }
        } catch (e) {
            console.error("[COMMODITY] Exchange rate error:", e);
        }

        return {
            soyPrice: soy.price,
            soyChange: soy.change,
            soyChangePercent: soy.changePercent,
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

    const soyPriceNum = parseFloat(data.soyPrice);
    const changeNum = parseFloat(data.soyChange);

    let msg = `💰 *Cotações do Dia*\n\n`;

    if (!isNaN(soyPriceNum) && soyPriceNum > 0) {
        const arrow = changeNum >= 0 ? "📈" : "📉";
        const sign = changeNum >= 0 ? "+" : "";
        // Convert cents/bushel to $/bushel if price seems to be in cents (>100)
        const displayPrice = soyPriceNum > 100
            ? (soyPriceNum / 100).toFixed(2)
            : data.soyPrice;
        msg += `🫘 *Soja CBOT:* US$ ${displayPrice}/bu ${arrow} (${sign}${data.soyChange})\n`;
    }

    msg += `💱 *USD/BRL:* ${data.usdBrl}\n`;
    msg += `💱 *USD/PYG:* ${data.usdPyg}`;

    return msg;
}
