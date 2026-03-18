import JSZip from "jszip";
import shp from "shpjs";

interface LatLng { lat: number; lng: number; }

export interface ParsedPolygon {
    name: string;
    coordinates: LatLng[];
    areaHa?: number;
}

/** Parse KML XML string and extract ALL polygon coordinates */
function parseKmlPolygons(kmlText: string): ParsedPolygon[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(kmlText, "text/xml");
    const results: ParsedPolygon[] = [];

    // Find all Placemark elements (each can contain a polygon)
    const placemarks = doc.getElementsByTagName("Placemark");
    for (let i = 0; i < placemarks.length; i++) {
        const pm = placemarks[i];

        // Get name
        const nameEl = pm.getElementsByTagName("name")[0];
        const name = nameEl?.textContent?.trim() || `Talhão ${i + 1}`;

        // Get coordinates from Polygon
        const coordElements = pm.getElementsByTagName("coordinates");
        for (let j = 0; j < coordElements.length; j++) {
            const text = (coordElements[j].textContent || "").trim();
            if (!text) continue;

            const coords: LatLng[] = [];
            const points = text.split(/\s+/).filter(Boolean);
            for (const point of points) {
                const parts = point.split(",");
                if (parts.length >= 2) {
                    const lng = parseFloat(parts[0]);
                    const lat = parseFloat(parts[1]);
                    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                        coords.push({ lat, lng });
                    }
                }
            }

            // Remove closing point if duplicated
            if (coords.length > 3) {
                const first = coords[0], last = coords[coords.length - 1];
                if (Math.abs(first.lat - last.lat) < 0.000001 && Math.abs(first.lng - last.lng) < 0.000001) {
                    coords.pop();
                }
            }
            if (coords.length >= 3) {
                results.push({ name, coordinates: coords });
                break; // One polygon per placemark
            }
        }
    }

    // If no placemarks found, try raw coordinates (simple KML)
    if (results.length === 0) {
        const coordElements = doc.getElementsByTagName("coordinates");
        for (let i = 0; i < coordElements.length; i++) {
            const text = (coordElements[i].textContent || "").trim();
            if (!text) continue;
            const coords: LatLng[] = [];
            const points = text.split(/\s+/).filter(Boolean);
            for (const point of points) {
                const parts = point.split(",");
                if (parts.length >= 2) {
                    const lng = parseFloat(parts[0]);
                    const lat = parseFloat(parts[1]);
                    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90) {
                        coords.push({ lat, lng });
                    }
                }
            }
            if (coords.length > 3) {
                const first = coords[0], last = coords[coords.length - 1];
                if (Math.abs(first.lat - last.lat) < 0.000001 && Math.abs(first.lng - last.lng) < 0.000001) coords.pop();
            }
            if (coords.length >= 3) results.push({ name: `Talhão ${i + 1}`, coordinates: coords });
        }
    }

    return results;
}

/** Parse ISOXML — extract polygons from PNT elements */
function parseIsoxmlPolygons(xmlText: string): ParsedPolygon[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, "text/xml");
    const results: ParsedPolygon[] = [];

    // Try Partfield (PFD) elements first — each is a field/talhão
    const pfdElements = doc.getElementsByTagName("PFD");
    for (let i = 0; i < pfdElements.length; i++) {
        const pfd = pfdElements[i];
        const name = pfd.getAttribute("C") || pfd.getAttribute("B") || `Talhão ${i + 1}`;

        const coords: LatLng[] = [];
        const pntElements = pfd.getElementsByTagName("PNT");
        for (let j = 0; j < pntElements.length; j++) {
            const lat = parseFloat(pntElements[j].getAttribute("C") || pntElements[j].getAttribute("A") || "");
            const lng = parseFloat(pntElements[j].getAttribute("D") || pntElements[j].getAttribute("B") || "");
            if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90) {
                coords.push({ lat, lng });
            }
        }
        if (coords.length > 3) {
            const first = coords[0], last = coords[coords.length - 1];
            if (Math.abs(first.lat - last.lat) < 0.000001 && Math.abs(first.lng - last.lng) < 0.000001) coords.pop();
        }
        if (coords.length >= 3) results.push({ name, coordinates: coords });
    }

    // Fallback: PLN → LSG → PNT
    if (results.length === 0) {
        const plnElements = doc.getElementsByTagName("PLN");
        for (let i = 0; i < plnElements.length; i++) {
            const coords: LatLng[] = [];
            const pnts = plnElements[i].getElementsByTagName("PNT");
            for (let j = 0; j < pnts.length; j++) {
                const lat = parseFloat(pnts[j].getAttribute("C") || pnts[j].getAttribute("A") || "");
                const lng = parseFloat(pnts[j].getAttribute("D") || pnts[j].getAttribute("B") || "");
                if (!isNaN(lat) && !isNaN(lng)) coords.push({ lat, lng });
            }
            if (coords.length > 3) {
                const first = coords[0], last = coords[coords.length - 1];
                if (Math.abs(first.lat - last.lat) < 0.000001 && Math.abs(first.lng - last.lng) < 0.000001) coords.pop();
            }
            if (coords.length >= 3) results.push({ name: `Talhão ${i + 1}`, coordinates: coords });
        }
    }

    return results;
}

/** Extract polygons from GeoJSON (Shapefile result) */
function parseGeoJsonPolygons(geojson: any): ParsedPolygon[] {
    const features = geojson.features || (Array.isArray(geojson) ? geojson.flatMap((g: any) => g.features || []) : []);
    const results: ParsedPolygon[] = [];

    for (let i = 0; i < features.length; i++) {
        const feature = features[i];
        const geom = feature.geometry;
        if (!geom) continue;

        // Try to get name from properties
        const props = feature.properties || {};
        const name = props.Name || props.name || props.NAME || props.NOMBRE || props.FieldName || props.field_name || `Talhão ${i + 1}`;

        let rings: number[][][] = [];
        if (geom.type === "Polygon") {
            rings = [geom.coordinates[0]]; // outer ring
        } else if (geom.type === "MultiPolygon") {
            rings = geom.coordinates.map((poly: number[][][]) => poly[0]); // outer ring of each polygon
        }

        for (const ring of rings) {
            if (!ring || ring.length < 3) continue;
            const coords = ring.map(([lng, lat]: number[]) => ({ lat, lng }));
            // Remove closing point
            if (coords.length > 3) {
                const first = coords[0], last = coords[coords.length - 1];
                if (Math.abs(first.lat - last.lat) < 0.000001 && Math.abs(first.lng - last.lng) < 0.000001) coords.pop();
            }
            if (coords.length >= 3) results.push({ name, coordinates: coords });
        }
    }

    return results;
}

/** Read a map file and return ALL polygons found */
export async function parseMapFile(file: File): Promise<ParsedPolygon[]> {
    const ext = file.name.toLowerCase().split(".").pop();

    if (ext === "kmz") {
        const zip = await JSZip.loadAsync(file);
        const kmlFile = Object.keys(zip.files).find(name => name.toLowerCase().endsWith(".kml"));
        if (!kmlFile) throw new Error("Nenhum arquivo .kml encontrado dentro do KMZ");
        const kmlText = await zip.files[kmlFile].async("text");
        return parseKmlPolygons(kmlText);
    } else if (ext === "kml") {
        return parseKmlPolygons(await file.text());
    } else if (ext === "zip") {
        const buffer = await file.arrayBuffer();
        const geojson = await shp(buffer);
        return parseGeoJsonPolygons(geojson);
    } else if (ext === "xml") {
        const xmlText = await file.text();
        const isoResults = parseIsoxmlPolygons(xmlText);
        if (isoResults.length > 0) return isoResults;
        // Fallback: maybe KML saved as .xml
        const kmlResults = parseKmlPolygons(xmlText);
        if (kmlResults.length > 0) return kmlResults;
        return [];
    } else if (ext === "shp") {
        throw new Error("Envie o Shapefile compactado em .zip (com .shp, .shx e .dbf juntos)");
    } else {
        throw new Error(`Formato não suportado: .${ext}. Use KML, KMZ, Shapefile (.zip) ou ISOXML (.xml)`);
    }
}
