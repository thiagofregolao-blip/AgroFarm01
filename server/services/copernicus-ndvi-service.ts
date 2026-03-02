/**
 * Copernicus Data Space — Sentinel Hub Process API integration for NDVI
 * Uses Sentinel-2 L2A data with custom evalscripts for high-quality NDVI imagery.
 * 
 * Requires env vars:
 *   COPERNICUS_CLIENT_ID
 *   COPERNICUS_CLIENT_SECRET
 * 
 * Register OAuth client at: https://dataspace.copernicus.eu/
 * Docs: https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/
 */

const TOKEN_URL = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token";
const PROCESS_URL = "https://sh.dataspace.copernicus.eu/api/v1/process";
const CATALOG_URL = "https://sh.dataspace.copernicus.eu/api/v1/catalog/1.0.0/search";
const STATS_URL = "https://sh.dataspace.copernicus.eu/api/v1/statistics";

let cachedToken: { access_token: string; expires_at: number } | null = null;

async function getAccessToken(): Promise<string> {
    if (cachedToken && Date.now() < cachedToken.expires_at - 60_000) {
        return cachedToken.access_token;
    }

    const clientId = process.env.COPERNICUS_CLIENT_ID;
    const clientSecret = process.env.COPERNICUS_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error("[Copernicus] COPERNICUS_CLIENT_ID and COPERNICUS_CLIENT_SECRET must be set");
    }

    const res = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "client_credentials",
            client_id: clientId,
            client_secret: clientSecret,
        }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`[Copernicus] Auth failed (${res.status}): ${err}`);
    }

    const data = await res.json();
    cachedToken = {
        access_token: data.access_token,
        expires_at: Date.now() + (data.expires_in || 300) * 1000,
    };

    console.log("[Copernicus] Token obtained successfully");
    return cachedToken.access_token;
}

// Vivid NDVI contrast palette with continuous interpolation (fixed scale)
const EVALSCRIPT_NDVI_CONTRAST = `//VERSION=3
function setup() {
  return {
    input: ["B04", "B08", "SCL", "dataMask"],
    output: { bands: 4, sampleType: "AUTO" }
  };
}

function evaluatePixel(sample) {
  if (sample.dataMask === 0) return [0, 0, 0, 0];
  if ([0, 1, 3, 6, 8, 9, 10, 11].includes(sample.SCL)) return [0, 0, 0, 0];

  let ndvi = index(sample.B08, sample.B04);

  return valueInterpolate(ndvi,
    [-0.2, 0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
    [
      [0.05, 0.05, 0.05, 1],
      [0.80, 0.00, 0.00, 1],
      [0.95, 0.15, 0.00, 1],
      [1.00, 0.40, 0.00, 1],
      [1.00, 0.65, 0.00, 1],
      [1.00, 0.85, 0.00, 1],
      [0.90, 0.95, 0.00, 1],
      [0.55, 0.88, 0.00, 1],
      [0.20, 0.75, 0.00, 1],
      [0.00, 0.55, 0.00, 1],
      [0.00, 0.40, 0.00, 1],
      [0.00, 0.28, 0.00, 1]
    ]
  );
}`;

// Agronomic NDVI — fixed scale for cross-date/cross-field comparison
const EVALSCRIPT_NDVI_STANDARD = `//VERSION=3
function setup() {
  return {
    input: ["B04", "B08", "SCL", "dataMask"],
    output: { bands: 4, sampleType: "AUTO" }
  };
}

function evaluatePixel(sample) {
  if (sample.dataMask === 0) return [0, 0, 0, 0];
  if ([0, 1, 3, 6, 8, 9, 10, 11].includes(sample.SCL)) return [0, 0, 0, 0];

  let ndvi = index(sample.B08, sample.B04);
  return valueInterpolate(ndvi,
    [-0.2, 0.0, 0.2, 0.4, 0.6, 0.8, 1.0],
    [
      [0.60, 0.50, 0.40, 1],
      [0.80, 0.75, 0.65, 1],
      [0.75, 0.85, 0.55, 1],
      [0.40, 0.72, 0.30, 1],
      [0.15, 0.55, 0.10, 1],
      [0.02, 0.40, 0.02, 1],
      [0.00, 0.25, 0.00, 1]
    ]
  );
}`;

const EVALSCRIPT_TRUECOLOR = `//VERSION=3
function setup() {
  return {
    input: ["B02", "B03", "B04", "SCL", "dataMask"],
    output: { bands: 4, sampleType: "AUTO" }
  };
}

function evaluatePixel(sample) {
  if (sample.dataMask === 0) return [0, 0, 0, 0];
  if ([0, 1, 3, 8, 9, 10].includes(sample.SCL)) return [0, 0, 0, 0];
  return [2.5 * sample.B04, 2.5 * sample.B03, 2.5 * sample.B02, 1];
}`;

const EVALSCRIPT_FALSECOLOR = `//VERSION=3
function setup() {
  return {
    input: ["B03", "B04", "B08", "SCL", "dataMask"],
    output: { bands: 4, sampleType: "AUTO" }
  };
}

function evaluatePixel(sample) {
  if (sample.dataMask === 0) return [0, 0, 0, 0];
  if ([0, 1, 3, 8, 9, 10].includes(sample.SCL)) return [0, 0, 0, 0];
  return [2.5 * sample.B08, 2.5 * sample.B04, 2.5 * sample.B03, 1];
}`;

const EVALSCRIPT_EVI = `//VERSION=3
function setup() {
  return {
    input: ["B02", "B04", "B08", "SCL", "dataMask"],
    output: { bands: 4, sampleType: "AUTO" }
  };
}

function evaluatePixel(sample) {
  if (sample.dataMask === 0) return [0, 0, 0, 0];
  if ([0, 1, 3, 6, 8, 9, 10, 11].includes(sample.SCL)) return [0, 0, 0, 0];

  let evi = 2.5 * (sample.B08 - sample.B04) / (sample.B08 + 6.0 * sample.B04 - 7.5 * sample.B02 + 1.0);
  evi = Math.max(0, Math.min(1, evi));

  return valueInterpolate(evi,
    [0.0, 0.1, 0.2, 0.4, 0.6, 0.9],
    [
      [0.60, 0.50, 0.35, 1],
      [0.85, 0.85, 0.60, 1],
      [0.65, 0.82, 0.40, 1],
      [0.30, 0.65, 0.20, 1],
      [0.13, 0.50, 0.13, 1],
      [0.04, 0.33, 0.04, 1]
    ]
  );
}`;

// Statistical API evalscript — must output dataMask
const EVALSCRIPT_STATS = `//VERSION=3
function setup() {
  return {
    input: ["B04", "B08", "SCL", "dataMask"],
    output: [
      { id: "ndvi", bands: 1, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1 }
    ]
  };
}

function evaluatePixel(sample) {
  if (sample.dataMask === 0 || [0,1,3,6,8,9,10,11].includes(sample.SCL)) {
    return { ndvi: [0], dataMask: [0] };
  }
  return { ndvi: [index(sample.B08, sample.B04)], dataMask: [1] };
}`;

export type NdviLayerType = "ndvi" | "ndvi_contrast" | "truecolor" | "falsecolor" | "evi";

function getEvalscript(layer: NdviLayerType): string {
    switch (layer) {
        case "ndvi": return EVALSCRIPT_NDVI_STANDARD;
        case "ndvi_contrast": return EVALSCRIPT_NDVI_CONTRAST;
        case "truecolor": return EVALSCRIPT_TRUECOLOR;
        case "falsecolor": return EVALSCRIPT_FALSECOLOR;
        case "evi": return EVALSCRIPT_EVI;
        default: return EVALSCRIPT_NDVI_CONTRAST;
    }
}

/**
 * Build a dynamic contrast evalscript that stretches the full color palette
 * across the field's actual NDVI range (histogram stretching).
 */
function buildDynamicContrastEvalscript(ndviMin: number, ndviMax: number): string {
    let lo = Math.max(-0.2, ndviMin - 0.05);
    let hi = Math.min(1.0, ndviMax + 0.05);
    if (hi - lo < 0.25) {
        const mid = (lo + hi) / 2;
        lo = Math.max(-0.2, mid - 0.125);
        hi = Math.min(1.0, mid + 0.125);
    }

    const steps: number[] = [];
    for (let i = 0; i <= 9; i++) {
        steps.push(+(lo + (hi - lo) * (i / 9)).toFixed(3));
    }

    return `//VERSION=3
function setup() {
  return {
    input: ["B04", "B08", "SCL", "dataMask"],
    output: { bands: 4, sampleType: "AUTO" }
  };
}

function evaluatePixel(sample) {
  if (sample.dataMask === 0) return [0, 0, 0, 0];
  if ([0, 1, 3, 6, 8, 9, 10, 11].includes(sample.SCL)) return [0, 0, 0, 0];

  let ndvi = index(sample.B08, sample.B04);

  return valueInterpolate(ndvi,
    [${steps.join(', ')}],
    [
      [0.80, 0.00, 0.00, 1],
      [0.95, 0.18, 0.00, 1],
      [1.00, 0.42, 0.00, 1],
      [1.00, 0.65, 0.00, 1],
      [1.00, 0.85, 0.00, 1],
      [0.88, 0.95, 0.00, 1],
      [0.50, 0.85, 0.00, 1],
      [0.18, 0.72, 0.00, 1],
      [0.00, 0.52, 0.00, 1],
      [0.00, 0.35, 0.00, 1]
    ]
  );
}`;
}

/**
 * Convert [{lat, lng}] to GeoJSON Polygon (closing the ring if needed)
 */
export function coordinatesToGeoJson(coords: { lat: number; lng: number }[]): { type: "Polygon"; coordinates: number[][][] } {
    const ring = coords.map(c => [c.lng, c.lat]);
    if (ring.length > 0) {
        const first = ring[0];
        const last = ring[ring.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
            ring.push([...first]);
        }
    }
    return { type: "Polygon", coordinates: [ring] };
}

/**
 * Convert [{lat, lng}] to bbox [minLng, minLat, maxLng, maxLat]
 */
export function coordinatesToBbox(coords: { lat: number; lng: number }[]): [number, number, number, number] {
    const lats = coords.map(c => c.lat);
    const lngs = coords.map(c => c.lng);
    return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
}

/**
 * Search the Sentinel-2 catalog for available dates over a polygon.
 */
export async function searchAvailableDates(
    bbox: [number, number, number, number],
    fromDate: string,
    toDate: string,
    maxCloudPct: number = 80
): Promise<{ date: string; cloudCover: number; id: string }[]> {
    const token = await getAccessToken();

    const body = {
        bbox,
        datetime: `${fromDate}/${toDate}`,
        collections: ["sentinel-2-l2a"],
        limit: 100,
        filter: `eo:cloud_cover < ${maxCloudPct}`,
        "filter-lang": "cql2-text",
    };

    const res = await fetch(CATALOG_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const err = await res.text();
        console.error(`[Copernicus] Catalog search failed (${res.status}): ${err}`);
        return [];
    }

    const data = await res.json();
    const features = data.features || [];

    const dateMap = new Map<string, { cloudCover: number; id: string }>();
    for (const f of features) {
        const dt = f.properties?.datetime?.split("T")[0];
        const cc = f.properties?.["eo:cloud_cover"] ?? 100;
        if (dt && (!dateMap.has(dt) || dateMap.get(dt)!.cloudCover > cc)) {
            dateMap.set(dt, { cloudCover: Math.round(cc), id: f.id });
        }
    }

    return Array.from(dateMap.entries())
        .map(([date, info]) => ({ date, ...info }))
        .sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Generate an NDVI (or other layer) PNG image clipped to polygon geometry.
 */
export async function generateNdviImage(
    geometry: { type: "Polygon"; coordinates: number[][][] },
    bbox: [number, number, number, number],
    date: string,
    layer: NdviLayerType = "ndvi_contrast",
    maxDim: number = 512,
    ndviRange?: { min: number; max: number },
): Promise<string | null> {
    const token = await getAccessToken();

    const bboxWidthDeg = bbox[2] - bbox[0];
    const bboxHeightDeg = bbox[3] - bbox[1];
    const midLat = (bbox[1] + bbox[3]) / 2;
    const bboxWidthM = bboxWidthDeg * 111320 * Math.cos(midLat * Math.PI / 180);
    const bboxHeightM = bboxHeightDeg * 111320;
    const aspectRatio = bboxWidthM / bboxHeightM;

    let width: number, height: number;
    if (aspectRatio >= 1) {
        width = maxDim;
        height = Math.max(64, Math.round(maxDim / aspectRatio));
    } else {
        height = maxDim;
        width = Math.max(64, Math.round(maxDim * aspectRatio));
    }

    let evalscript: string;
    if (layer === "ndvi_contrast" && ndviRange) {
        evalscript = buildDynamicContrastEvalscript(ndviRange.min, ndviRange.max);
        console.log(`[Copernicus] Using dynamic range [${ndviRange.min}, ${ndviRange.max}] for contrast`);
    } else {
        evalscript = getEvalscript(layer);
    }

    const requestBody = {
        input: {
            bounds: {
                properties: { crs: "http://www.opengis.net/def/crs/OGC/1.3/CRS84" },
                geometry,
            },
            data: [{
                type: "sentinel-2-l2a",
                dataFilter: {
                    timeRange: { from: `${date}T00:00:00Z`, to: `${date}T23:59:59Z` },
                    mosaickingOrder: "leastCC",
                },
            }],
        },
        output: {
            width,
            height,
            responses: [{
                identifier: "default",
                format: { type: "image/png" },
            }],
        },
        evalscript,
    };

    console.log(`[Copernicus] Generating ${layer} image for ${date} (${width}x${height})`);

    try {
        const res = await fetch(PROCESS_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
                Accept: "image/png",
            },
            body: JSON.stringify(requestBody),
        });

        if (!res.ok) {
            const err = await res.text();
            console.error(`[Copernicus] Process API failed for ${layer} on ${date} (${res.status}): ${err}`);
            return null;
        }

        const buffer = Buffer.from(await res.arrayBuffer());
        const b64 = buffer.toString("base64");
        console.log(`[Copernicus] Image generated: ${layer} ${date} — ${Math.round(b64.length / 1024)}KB`);
        return `data:image/png;base64,${b64}`;
    } catch (err) {
        console.error(`[Copernicus] Process API exception for ${layer} on ${date}:`, err);
        return null;
    }
}

/**
 * Get NDVI statistics using the Statistical API.
 * Returns { date, mean, min, max } for each day in the range.
 */
export async function getNdviStatsBatch(
    geometry: { type: "Polygon"; coordinates: number[][][] },
    fromDate: string,
    toDate: string,
): Promise<{ date: string; mean: number; min: number; max: number; sampleCount: number }[]> {
    const token = await getAccessToken();

    const requestBody = {
        input: {
            bounds: {
                properties: { crs: "http://www.opengis.net/def/crs/OGC/1.3/CRS84" },
                geometry,
            },
            data: [{
                type: "sentinel-2-l2a",
                dataFilter: {
                    mosaickingOrder: "leastCC",
                },
            }],
        },
        aggregation: {
            timeRange: { from: fromDate, to: toDate },
            aggregationInterval: { of: "P1D" },
            evalscript: EVALSCRIPT_STATS,
            resx: 10,
            resy: 10,
        },
    };

    try {
        const res = await fetch(STATS_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(requestBody),
        });

        if (!res.ok) {
            const err = await res.text();
            console.error(`[Copernicus] Statistics API failed (${res.status}): ${err}`);
            return [];
        }

        const data = await res.json();
        const intervals = data.data || [];

        return intervals
            .filter((i: any) => {
                const stats = i.outputs?.ndvi?.bands?.B0?.stats;
                return stats && stats.sampleCount > 0;
            })
            .map((i: any) => {
                const stats = i.outputs.ndvi.bands.B0.stats;
                return {
                    date: i.interval.from.split("T")[0],
                    mean: Math.round(stats.mean * 1000) / 1000,
                    min: Math.round(stats.min * 1000) / 1000,
                    max: Math.round(stats.max * 1000) / 1000,
                    sampleCount: stats.sampleCount,
                };
            });
    } catch (err) {
        console.error("[Copernicus] Stats batch error:", err);
        return [];
    }
}

export function isCopernicusConfigured(): boolean {
    return !!(process.env.COPERNICUS_CLIENT_ID && process.env.COPERNICUS_CLIENT_SECRET);
}
