/**
 * NDVI Service — Satellite vegetation monitoring using Agromonitoring API
 * Uses Sentinel-2 and Landsat 8 satellite data to calculate NDVI index
 * 
 * API Docs: https://agromonitoring.com/api/polygons
 * Free tier: 1000 calls/day
 */

const AGRO_API_KEY = process.env.AGROMONITORING_API_KEY || "";
const AGRO_BASE = "https://api.agromonitoring.com/agro/1.0";

export interface NdviPolygon {
    id: string;
    name: string;
    coordinates: number[][][]; // GeoJSON polygon format
}

export interface NdviDataPoint {
    dt: number; // timestamp
    source: string; // "Landsat 8" or "Sentinel-2"
    dc: number; // % of clouds
    cl: number; // % of clear sky
    data: {
        std: number;  // standard deviation
        p75: number;  // 75th percentile
        min: number;
        max: number;
        median: number;
        p25: number;  // 25th percentile
        num: number;  // number of pixels
        mean: number; // average NDVI value (0-1)
    };
}

export interface NdviImageData {
    dt: number;
    type: string; // "NDVI", "EVI", "TrueColor"
    dc: number;
    cl: number;
    sun: { elevation: number; azimuth: number };
    image: {
        truecolor: string; // URL to true color image
        falsecolor: string; // URL to false color image
        ndvi: string; // URL to NDVI colored image
        evi: string; // URL to EVI image
    };
    tile: {
        truecolor: string;
        falsecolor: string;
        ndvi: string;
        evi: string;
    };
    stats: {
        ndvi: string; // URL to NDVI stats
        evi: string;
    };
    data: {
        truecolor: string;
        falsecolor: string;
        ndvi: string;
        evi: string;
    };
}

/**
 * Register a polygon (plot boundary) in the Agromonitoring API
 * This is needed before we can request NDVI data
 */
export async function registerPolygon(name: string, coordinates: { lat: number; lng: number }[]): Promise<string | null> {
    if (!AGRO_API_KEY) {
        console.error("[NDVI] No API key configured");
        return null;
    }

    try {
        // Convert our {lat, lng} array to GeoJSON format [lng, lat]
        const geoJsonCoords = coordinates.map(c => [c.lng, c.lat]);
        // Close the polygon (first point = last point)
        if (geoJsonCoords.length > 0) {
            const first = geoJsonCoords[0];
            const last = geoJsonCoords[geoJsonCoords.length - 1];
            if (first[0] !== last[0] || first[1] !== last[1]) {
                geoJsonCoords.push([...first]);
            }
        }

        const response = await fetch(`${AGRO_BASE}/polygons?appid=${AGRO_API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name,
                geo_json: {
                    type: "Feature",
                    properties: {},
                    geometry: {
                        type: "Polygon",
                        coordinates: [geoJsonCoords],
                    },
                },
            }),
        });

        if (!response.ok) {
            const errText = await response.text();

            // Handle duplicated polygon error (422)
            // Example message: "Your polygon is duplicated your already created polygon '69a2202df...'."
            if (response.status === 422 && errText.includes("is duplicated")) {
                try {
                    const errData = JSON.parse(errText);
                    const match = errData.message.match(/'([^']+)'/);
                    if (match && match[1]) {
                        console.log(`[NDVI] ⚠️ Recovered duplicated polygon "${name}" → ${match[1]}`);
                        return match[1]; // Return the existing polygon ID
                    }
                } catch (e) {
                    // Fallback to text parsing if JSON fails
                    const match = errText.match(/'([^']+)'/);
                    if (match && match[1]) {
                        console.log(`[NDVI] ⚠️ Recovered duplicated polygon (text) "${name}" → ${match[1]}`);
                        return match[1];
                    }
                }
            }

            console.error(`[NDVI] Failed to register polygon: ${response.status} - ${errText}`);
            return null;
        }

        const data = await response.json();
        console.log(`[NDVI] ✅ Registered polygon "${name}" → ${data.id}`);
        return data.id;
    } catch (error) {
        console.error("[NDVI] Error registering polygon:", error);
        return null;
    }
}

/**
 * Get NDVI statistics history for a polygon
 */
export async function getNdviHistory(polygonId: string, startDate?: Date, endDate?: Date): Promise<NdviDataPoint[]> {
    if (!AGRO_API_KEY) return [];

    try {
        const end = endDate || new Date();
        const start = startDate || new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000); // 90 days back

        const startUnix = Math.floor(start.getTime() / 1000);
        const endUnix = Math.floor(end.getTime() / 1000);

        const response = await fetch(
            `${AGRO_BASE}/ndvi/history?polyid=${polygonId}&start=${startUnix}&end=${endUnix}&appid=${AGRO_API_KEY}`
        );

        if (!response.ok) {
            console.error(`[NDVI] History failed: ${response.status}`);
            return [];
        }

        return await response.json();
    } catch (error) {
        console.error("[NDVI] Error getting history:", error);
        return [];
    }
}

/**
 * Get satellite images for a polygon (NDVI, TrueColor, etc.)
 */
export async function getNdviImages(polygonId: string, startDate?: Date, endDate?: Date): Promise<NdviImageData[]> {
    if (!AGRO_API_KEY) return [];

    try {
        const end = endDate || new Date();
        const start = startDate || new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days

        const startUnix = Math.floor(start.getTime() / 1000);
        const endUnix = Math.floor(end.getTime() / 1000);

        const response = await fetch(
            `${AGRO_BASE}/image/search?polyid=${polygonId}&start=${startUnix}&end=${endUnix}&appid=${AGRO_API_KEY}`
        );

        if (!response.ok) {
            console.error(`[NDVI] Images failed: ${response.status}`);
            return [];
        }

        return await response.json();
    } catch (error) {
        console.error("[NDVI] Error getting images:", error);
        return [];
    }
}

/**
 * Delete a polygon from the API
 */
export async function deletePolygon(polygonId: string): Promise<boolean> {
    if (!AGRO_API_KEY) return false;

    try {
        const response = await fetch(
            `${AGRO_BASE}/polygons/${polygonId}?appid=${AGRO_API_KEY}`,
            { method: "DELETE" }
        );
        return response.ok;
    } catch (error) {
        console.error("[NDVI] Error deleting polygon:", error);
        return false;
    }
}
