/**
 * Supplier deduplication utilities
 *
 * Prevents duplicate supplier registration when invoices arrive with name
 * variations (accents, company-type suffixes, whitespace differences).
 *
 * Paraguay-aware: understands S.R.L., S.A., EAS, E.I.R.L. suffixes and
 * treats RUC as the authoritative identifier for juridical persons.
 */

// Company-type suffixes to strip before comparison (Paraguay + Brazil)
const COMPANY_SUFFIXES = [
    "S\\.R\\.L\\.", "SRL", "S\\.A\\.", "\\bSA\\b",
    "E\\.A\\.S\\.", "\\bEAS\\b",
    "E\\.I\\.R\\.L\\.", "EIRL",
    "LTDA\\.", "\\bLTDA\\b",
    "S\\.C\\.S\\.", "S\\.C\\.",
];
const SUFFIX_RE = new RegExp(`\\b(${COMPANY_SUFFIXES.join("|")})\\b`, "gi");

/**
 * Normalizes a supplier name for fuzzy comparison:
 * - Strips accents/diacritics
 * - Lowercases
 * - Removes Paraguayan/Brazilian company-type suffixes
 * - Collapses whitespace and punctuation
 */
export function normalizeSupplierName(name: string): string {
    return name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // strip combining diacritics
        .toLowerCase()
        .replace(SUFFIX_RE, " ")          // remove company suffixes
        .replace(/[.,\-_]/g, " ")         // punctuation → space
        .replace(/\s+/g, " ")             // collapse whitespace
        .trim();
}

/**
 * Dice coefficient similarity over character bigrams — returns 0..1.
 * 1.0 = identical, 0.0 = no common bigrams.
 * Works well for short strings without requiring external dependencies.
 */
export function nameSimilarity(a: string, b: string): number {
    if (a === b) return 1;
    if (a.length < 2 || b.length < 2) return 0;

    const bigramsA = new Map<string, number>();
    for (let i = 0; i < a.length - 1; i++) {
        const bg = a.slice(i, i + 2);
        bigramsA.set(bg, (bigramsA.get(bg) ?? 0) + 1);
    }

    let intersection = 0;
    for (let i = 0; i < b.length - 1; i++) {
        const bg = b.slice(i, i + 2);
        const count = bigramsA.get(bg) ?? 0;
        if (count > 0) {
            intersection++;
            bigramsA.set(bg, count - 1);
        }
    }

    return (2 * intersection) / (a.length - 1 + (b.length - 1));
}

export interface SimilarSupplier {
    id: string;
    name: string;
    ruc: string | null;
    similarity: number;
    matchedBy: "ruc" | "name";
}

/**
 * Finds existing suppliers for a farmer that are similar to the given
 * name/RUC combination.
 *
 * Matching rules:
 *   1. RUC exact match  → similarity = 1.0, matchedBy = "ruc"
 *   2. Normalized-name Dice coefficient ≥ 0.75 → matchedBy = "name"
 *
 * Returns results sorted by similarity descending.
 */
export async function findSimilarSuppliers(
    db: any,
    sql: any,
    farmerId: string,
    name: string,
    ruc: string | null,
): Promise<SimilarSupplier[]> {
    const allRows = await db.execute(sql`
        SELECT id, name, ruc FROM farm_suppliers
        WHERE farmer_id = ${farmerId} AND is_active = true
    `);
    const rows: Array<{ id: string; name: string; ruc: string | null }> =
        (allRows as any).rows ?? allRows;

    const normalizedInput = normalizeSupplierName(name);
    const results: SimilarSupplier[] = [];

    for (const row of rows) {
        // 1. Exact RUC match (most reliable)
        if (ruc && row.ruc && ruc.trim() === row.ruc.trim()) {
            results.push({ id: row.id, name: row.name, ruc: row.ruc, similarity: 1.0, matchedBy: "ruc" });
            continue;
        }

        // 2. Normalized name similarity
        const normalizedRow = normalizeSupplierName(row.name);
        const score = nameSimilarity(normalizedInput, normalizedRow);
        if (score >= 0.75) {
            results.push({ id: row.id, name: row.name, ruc: row.ruc, similarity: score, matchedBy: "name" });
        }
    }

    return results.sort((a, b) => b.similarity - a.similarity);
}

/**
 * Updates missing fields on an existing supplier (RUC, phone, email, address).
 * Only fills in null/empty fields — never overwrites existing data.
 */
export async function fillMissingSupplierFields(
    db: any,
    sql: any,
    supplierId: string,
    fields: { ruc?: string | null; phone?: string | null; email?: string | null; address?: string | null },
) {
    await db.execute(sql`
        UPDATE farm_suppliers SET
            ruc     = CASE WHEN ruc IS NULL OR ruc = '' THEN ${fields.ruc ?? null} ELSE ruc END,
            phone   = CASE WHEN phone IS NULL OR phone = '' THEN ${fields.phone ?? null} ELSE phone END,
            email   = CASE WHEN email IS NULL OR email = '' THEN ${fields.email ?? null} ELSE email END,
            address = CASE WHEN address IS NULL OR address = '' THEN ${fields.address ?? null} ELSE address END
        WHERE id = ${supplierId}
    `);
}
