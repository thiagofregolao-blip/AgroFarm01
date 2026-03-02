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

// OneSoil-style NDVI contrast palette: red → orange → yellow → light green → dark green
const EVALSCRIPT_NDVI_CONTRAST = `//VERSION=3
function setup() {
  return {
    input: ["B04", "B08", "SCL"],
    output: { bands: 4, sampleType: "AUTO" }
  };
}

function evaluatePixel(sample) {
  // Mask clouds, shadows, snow, water (SCL classes)
  if ([0, 1, 3, 6, 8, 9, 10, 11].includes(sample.SCL)) {
    return [0, 0, 0, 0]; // transparent
  }

  let ndvi = index(sample.B08, sample.B04);

  // OneSoil-style red-yellow-green contrast palette
  let r, g, b;
  if (ndvi < -0.2) {
    r = 0.05; g = 0.05; b = 0.05;
  } else if (ndvi < 0.0) {
    r = 0.75; g = 0.15; b = 0.15;
  } else if (ndvi < 0.1) {
    r = 0.84; g = 0.18; b = 0.13;
  } else if (ndvi < 0.2) {
    r = 0.96; g = 0.36; b = 0.11;
  } else if (ndvi < 0.3) {
    r = 0.99; g = 0.55; b = 0.14;
  } else if (ndvi < 0.4) {
    r = 1.0; g = 0.76; b = 0.17;
  } else if (ndvi < 0.5) {
    r = 0.95; g = 0.91; b = 0.2;
  } else if (ndvi < 0.6) {
    r = 0.65; g = 0.85; b = 0.2;
  } else if (ndvi < 0.7) {
    r = 0.35; g = 0.75; b = 0.17;
  } else if (ndvi < 0.8) {
    r = 0.15; g = 0.62; b = 0.13;
  } else if (ndvi < 0.9) {
    r = 0.08; g = 0.5; b = 0.08;
  } else {
    r = 0.04; g = 0.36; b = 0.04;
  }

  return [r, g, b, 1];
}`;

// Standard green-only NDVI palette
const EVALSCRIPT_NDVI_STANDARD = `//VERSION=3
function setup() {
  return {
    input: ["B04", "B08", "SCL"],
    output: { bands: 4, sampleType: "AUTO" }
  };
}

function evaluatePixel(sample) {
  if ([0, 1, 3, 6, 8, 9, 10, 11].includes(sample.SCL)) {
    return [0, 0, 0, 0];
  }

  let ndvi = index(sample.B08, sample.B04);
  return valueInterpolate(ndvi,
    [-0.2, 0.0, 0.1, 0.2, 0.3, 0.4, 0.6, 0.9],
    [
      [0.05, 0.05, 0.05, 1],
      [0.75, 0.75, 0.70, 1],
      [0.86, 0.90, 0.76, 1],
      [0.65, 0.82, 0.52, 1],
      [0.44, 0.73, 0.35, 1],
      [0.27, 0.60, 0.22, 1],
      [0.13, 0.47, 0.13, 1],
      [0.04, 0.33, 0.04, 1]
    ]
  );
}`;

// True color (RGB)
const EVALSCRIPT_TRUECOLOR = `//VERSION=3
function setup() {
  return {
    input: ["B02", "B03", "B04", "SCL"],
    output: { bands: 4, sampleType: "AUTO" }
  };
}

function evaluatePixel(sample) {
  if ([0, 1, 3, 8, 9, 10].includes(sample.SCL)) {
    return [0, 0, 0, 0];
  }
  return [2.5 * sample.B04, 2.5 * sample.B03, 2.5 * sample.B02, 1];
}`;

// False color (NIR-Red-Green)
const EVALSCRIPT_FALSECOLOR = `//VERSION=3
function setup() {
  return {
    input: ["B03", "B04", "B08", "SCL"],
    output: { bands: 4, sampleType: "AUTO" }
  };
}

function evaluatePixel(sample) {
  if ([0, 1, 3, 8, 9, 10].includes(sample.SCL)) {
    return [0, 0, 0, 0];
  }
  return [2.5 * sample.B08, 2.5 * sample.B04, 2.5 * sample.B03, 1];
}`;

// EVI (Enhanced Vegetation Index)
const EVALSCRIPT_EVI = `//VERSION=3
function setup() {
  return {
    input: ["B02", "B04", "B08", "SCL"],
    output: { bands: 4, sampleType: "AUTO" }
  };
}

function evaluatePixel(sample) {
  if ([0, 1, 3, 6, 8, 9, 10, 11].includes(sample.SCL)) {
    return [0, 0, 0, 0];
  }

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
 * Search the Sentinel-2 catalog for available dates over a polygon.
 * Returns dates with cloud coverage info, sorted newest first.
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
 * Generate an NDVI (or other layer) PNG image for a bounding box and date.
 * Returns a base64-encoded PNG data URL.
 */
export async function generateNdviImage(
    bbox: [number, number, number, number],
    date: string,
    layer: NdviLayerType = "ndvi_contrast",
    width: number = 512,
    height: number = 512,
): Promise<string | null> {
    const token = await getAccessToken();

    const fromDate = `${date}T00:00:00Z`;
    const toDate = `${date}T23:59:59Z`;

    const requestBody = {
        input: {
            bounds: {
                properties: { crs: "http://www.opengis.net/def/crs/OGC/1.3/CRS84" },
                bbox,
            },
            data: [{
                type: "sentinel-2-l2a",
                dataFilter: {
                    timeRange: { from: fromDate, to: toDate },
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
        evalscript: getEvalscript(layer),
    };

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
        console.error(`[Copernicus] Process API failed (${res.status}): ${err}`);
        return null;
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    return `data:image/png;base64,${buffer.toString("base64")}`;
}

/**
 * Calculate NDVI statistics (mean, min, max) for a bbox and date.
 * Returns raw NDVI float values which we average.
 */
export async function getNdviStats(
    bbox: [number, number, number, number],
    date: string,
): Promise<{ mean: number; min: number; max: number } | null> {
    const token = await getAccessToken();

    const evalscript = `//VERSION=3
function setup() {
  return {
    input: ["B04", "B08", "SCL"],
    output: { bands: 1, sampleType: "FLOAT32" },
    mosaicking: "SIMPLE"
  };
}

function evaluatePixel(sample) {
  if ([0, 1, 3, 6, 8, 9, 10, 11].includes(sample.SCL)) {
    return [-9999];
  }
  return [index(sample.B08, sample.B04)];
}`;

    const requestBody = {
        input: {
            bounds: {
                properties: { crs: "http://www.opengis.net/def/crs/OGC/1.3/CRS84" },
                bbox,
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
            width: 64,
            height: 64,
            responses: [{
                identifier: "default",
                format: { type: "image/tiff" },
            }],
        },
        evalscript,
    };

    try {
        const res = await fetch(PROCESS_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
                Accept: "image/tiff",
            },
            body: JSON.stringify(requestBody),
        });

        if (!res.ok) return null;

        const buffer = Buffer.from(await res.arrayBuffer());
        const floats = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);

        let sum = 0, count = 0, min = 1, max = -1;
        for (const v of floats) {
            if (v > -1 && v <= 1) {
                sum += v;
                count++;
                if (v < min) min = v;
                if (v > max) max = v;
            }
        }

        if (count === 0) return null;
        return {
            mean: Math.round((sum / count) * 1000) / 1000,
            min: Math.round(min * 1000) / 1000,
            max: Math.round(max * 1000) / 1000,
        };
    } catch (err) {
        console.error("[Copernicus] Stats error:", err);
        return null;
    }
}

/**
 * Coordinates helper: convert [{lat, lng}] to [minLng, minLat, maxLng, maxLat] bbox
 */
export function coordinatesToBbox(coords: { lat: number; lng: number }[]): [number, number, number, number] {
    const lats = coords.map(c => c.lat);
    const lngs = coords.map(c => c.lng);
    return [
        Math.min(...lngs),
        Math.min(...lats),
        Math.max(...lngs),
        Math.max(...lats),
    ];
}

/**
 * Check if Copernicus credentials are configured
 */
export function isCopernicusConfigured(): boolean {
    return !!(process.env.COPERNICUS_CLIENT_ID && process.env.COPERNICUS_CLIENT_SECRET);
}
