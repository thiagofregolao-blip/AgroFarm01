/**
 * Product deduplication utilities
 *
 * Groups stock rows that refer to the same commercial product even when the
 * catalog has multiple records (different ingredient descriptions, package
 * suffixes, whitespace variations).
 *
 * Phase B: display-only grouping. A real merge in the catalog belongs to a
 * later migration — until then, the UI shows one aggregated row per group
 * and hides edit/delete when the group has duplicates.
 */

// Package suffix at end of name: "X 10 KG.", "X 20L", "5 LT", "1000 ML", "X 5 UN"
const PACKAGE_SUFFIX_RE =
    /\s*(?:[x×]\s*)?\d+[.,]?\d*\s*(kg|lt|l|ml|g|un|uni|und|unid|unidades?)\.?\s*$/i;

/**
 * Normalizes a product name for grouping:
 * - Strips accents/diacritics
 * - Lowercases
 * - Removes trailing package suffixes ("X 10 KG.", "5 LT", etc.)
 * - Collapses punctuation and whitespace
 */
export function normalizeProductName(name: string | null | undefined): string {
    if (!name) return "";
    let n = name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
    // Strip package suffix repeatedly (handles "LASCAR X 10 KG.")
    let prev: string;
    do {
        prev = n;
        n = n.replace(PACKAGE_SUFFIX_RE, "").trim();
    } while (n !== prev);
    return n
        .replace(/[.,\-_]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

interface StockRow {
    id: string;
    productId: string;
    productName?: string | null;
    quantity: string | number;
    averageCost: string | number;
    [k: string]: any;
}

export interface GroupedStockRow extends StockRow {
    mergedCount: number;
    mergedStockIds: string[];
    mergedProductIds: string[];
}

/**
 * Groups stock rows by normalized product name.
 *
 * - quantity = sum of all rows in the group
 * - averageCost = weighted average over rows with quantity > 0 and cost > 0
 * - canonical row = highest-quantity row (the "real" one); its metadata
 *   (category, unit, image, deposit) is kept for display
 * - mergedCount/mergedStockIds/mergedProductIds let the UI detect duplicates
 */
export function groupStockByProduct<T extends StockRow>(rows: T[]): GroupedStockRow[] {
    const groups = new Map<string, T[]>();

    for (const row of rows) {
        const normalized = normalizeProductName(row.productName);
        // Fall back to row id when name is empty so unnamed rows don't collapse
        const key = normalized || `__unnamed_${row.id}`;
        const bucket = groups.get(key);
        if (bucket) bucket.push(row);
        else groups.set(key, [row]);
    }

    const result: GroupedStockRow[] = [];

    for (const bucket of Array.from(groups.values())) {
        if (bucket.length === 1) {
            const r = bucket[0];
            result.push({
                ...r,
                mergedCount: 1,
                mergedStockIds: [r.id],
                mergedProductIds: [r.productId],
            });
            continue;
        }

        // Canonical: row with highest quantity wins — most likely the "real" one
        const sorted = [...bucket].sort((a, b) => {
            const qa = parseFloat(String(a.quantity ?? 0));
            const qb = parseFloat(String(b.quantity ?? 0));
            return qb - qa;
        });
        const canonical = sorted[0];

        let totalQty = 0;
        let weightedCostNumerator = 0;
        let positiveQtyTotal = 0;

        for (const r of bucket) {
            const q = parseFloat(String(r.quantity ?? 0));
            const c = parseFloat(String(r.averageCost ?? 0));
            totalQty += q;
            if (q > 0 && c > 0) {
                weightedCostNumerator += q * c;
                positiveQtyTotal += q;
            }
        }

        const avgCost = positiveQtyTotal > 0
            ? weightedCostNumerator / positiveQtyTotal
            : parseFloat(String(canonical.averageCost ?? 0));

        const uniqueProductIds = Array.from(new Set(bucket.map((r: T) => r.productId)));

        result.push({
            ...canonical,
            quantity: totalQty.toString(),
            averageCost: avgCost.toString(),
            mergedCount: bucket.length,
            mergedStockIds: bucket.map((r: T) => r.id),
            mergedProductIds: uniqueProductIds,
        });
    }

    result.sort((a, b) =>
        (a.productName ?? "").localeCompare(b.productName ?? "", "pt-BR"),
    );

    return result;
}
