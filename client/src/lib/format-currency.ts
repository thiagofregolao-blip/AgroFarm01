/**
 * Format currency values for USD and PYG (Guarani)
 * Guarani: no decimals, dot as thousands separator
 * Dollar: 2 decimals, comma as thousands separator
 */
export function formatCurrency(value: number | string | null | undefined, currency: string = "USD"): string {
    const num = typeof value === "string" ? parseFloat(value) : (value ?? 0);
    if (isNaN(num)) return currency === "PYG" ? "Gs. 0" : "$ 0.00";

    if (currency === "PYG" || currency === "GS") {
        // Guarani: no decimals, dot as thousands
        return "Gs. " + Math.round(num).toLocaleString("es-PY", { maximumFractionDigits: 0 });
    }

    // USD: 2 decimals
    return "$ " + num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Short format for cards (e.g., $29.6k or Gs. 1.5M)
 */
export function formatCurrencyShort(value: number | string | null | undefined, currency: string = "USD"): string {
    const num = typeof value === "string" ? parseFloat(value) : (value ?? 0);
    if (isNaN(num)) return currency === "PYG" ? "Gs. 0" : "$ 0";

    const prefix = currency === "PYG" || currency === "GS" ? "Gs. " : "$ ";

    if (Math.abs(num) >= 1_000_000) return prefix + (num / 1_000_000).toFixed(1) + "M";
    if (Math.abs(num) >= 1_000) return prefix + (num / 1_000).toFixed(1) + "k";
    return prefix + (currency === "PYG" ? Math.round(num).toString() : num.toFixed(2));
}
