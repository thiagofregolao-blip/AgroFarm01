import { db } from "../db";
import { virtualWeatherStations, weatherHistoryLogs } from "@shared/schema";
import { eq, and, gte, sql, desc } from "drizzle-orm";

export interface WeatherData {
    temperature: number;
    precipitation: number;
    windSpeed: number;
    humidity: number;
    clouds: number;
    ts: Date;
    rawData?: any;
}

export interface SprayWindowItem {
    time: string;
    status: 'GREEN' | 'YELLOW' | 'RED';
    reason?: string;
}

export interface DailyForecast {
    date: string;
    dayName: string;
    minTemp: number;
    maxTemp: number;
    rain: number;
    windKmh: number;
    humidity: number;
    clouds: number;
}

function formatTime(dt: number): string {
    const d = new Date(dt * 1000);
    return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

const DAY_NAMES_PT: Record<number, string> = {
    0: 'Domingo', 1: 'Segunda', 2: 'Terça', 3: 'Quarta',
    4: 'Quinta', 5: 'Sexta', 6: 'Sábado'
};

export class WeatherStationService {
    static async fetchAndLogWeather(stationId: string): Promise<boolean> {
        const station = await db.query.virtualWeatherStations.findFirst({
            where: eq(virtualWeatherStations.id, stationId),
        });

        if (!station || !station.isActive) return false;

        try {
            const api_key = process.env.AGROMONITORING_API_KEY;
            if (!api_key) {
                throw new Error("AGROMONITORING_API_KEY is not configured.");
            }

            const response = await fetch(
                `https://api.agromonitoring.com/agro/1.0/weather?lat=${station.lat}&lon=${station.lng}&appid=${api_key}&units=metric`
            );

            if (!response.ok) {
                throw new Error(`AgroMonitoring API error: ${response.statusText}`);
            }

            const data = await response.json();

            const temperature = data.main.temp;
            const humidity = data.main.humidity;
            const windSpeed = data.wind.speed;
            const clouds = data.clouds.all;
            const precipitation = data.rain ? data.rain['1h'] || 0 : 0;

            await db.insert(weatherHistoryLogs).values({
                stationId: station.id,
                ts: new Date(),
                temperature: String(temperature),
                precipitation: String(precipitation),
                windSpeed: String(windSpeed),
                humidity: humidity,
                clouds: clouds,
                rawData: data,
            });

            return true;
        } catch (error) {
            console.error(`Error fetching weather for station ${stationId}:`, error);
            return false;
        }
    }

    static async pollAllActiveStations() {
        console.log("[Cron] Starting weather check for all active virtual stations...");
        const stations = await db.query.virtualWeatherStations.findMany({
            where: eq(virtualWeatherStations.isActive, true),
        });

        for (const station of stations) {
            await this.fetchAndLogWeather(station.id);
        }
        console.log(`[Cron] Finished weather check for ${stations.length} stations.`);
    }

    static async getForecastWithIntelligence(lat: string | undefined, lng: string | undefined) {
        const api_key = process.env.AGROMONITORING_API_KEY;
        const emptyResult = {
            charts: { temperatures: [], precipitation: [], wind: [], humidity: [], clouds: [] },
            sprayWindow: [],
            forecast: []
        };

        if (!lat || !lng) throw new Error("Missing coordinates.");
        if (!api_key) {
            console.warn("AGROMONITORING_API_KEY is not configured.");
            return emptyResult;
        }

        const response = await fetch(
            `https://api.agromonitoring.com/agro/1.0/weather/forecast?lat=${lat}&lon=${lng}&appid=${api_key}&units=metric`
        );

        if (!response.ok) {
            console.warn(`AgroMonitoring Forecast API error: ${response.statusText}.`);
            return emptyResult;
        }

        const data = await response.json();
        const forecastList = Array.isArray(data) ? data : (data.list || []);

        if (!forecastList || forecastList.length === 0) {
            console.warn("Forecast data is empty or invalid format.");
            return emptyResult;
        }

        const hourlyData = forecastList.slice(0, 8);

        const charts = {
            temperatures: hourlyData.map((d: any) => ({
                time: formatTime(d.dt), value: Math.round(d.main.temp)
            })),
            precipitation: hourlyData.map((d: any) => ({
                time: formatTime(d.dt), value: d.rain ? Math.round((d.rain['3h'] || 0) * 10) / 10 : 0
            })),
            wind: hourlyData.map((d: any) => ({
                time: formatTime(d.dt), value: Math.round((d.wind.speed * 3.6) * 10) / 10
            })),
            humidity: hourlyData.map((d: any) => ({
                time: formatTime(d.dt), value: Math.round(d.main.humidity)
            })),
            clouds: hourlyData.map((d: any) => ({
                time: formatTime(d.dt), value: d.clouds?.all ?? 0
            })),
        };

        // --- Spray Window with EMBRAPA-based agronomic rules ---
        const sprayWindow: SprayWindowItem[] = hourlyData.map((d: any) => {
            const windKmh = d.wind.speed * 3.6;
            const humidity = d.main.humidity;
            const temp = d.main.temp;
            const rainMm = d.rain ? (d.rain['3h'] || 0) : 0;
            const hour = new Date(d.dt * 1000).getUTCHours();

            let status: 'GREEN' | 'YELLOW' | 'RED' = 'GREEN';
            const reasons: string[] = [];

            // RED conditions (do not spray)
            if (rainMm > 0.5) { status = 'RED'; reasons.push('Chuva prevista'); }
            if (windKmh > 10) { status = 'RED'; reasons.push(`Vento ${windKmh.toFixed(0)} km/h`); }
            if (humidity < 55) { status = 'RED'; reasons.push(`Umidade ${humidity}% (< 55%)`); }
            if (temp > 35) { status = 'RED'; reasons.push(`Temp ${temp.toFixed(0)}°C`); }
            if (temp < 10) { status = 'RED'; reasons.push(`Temp baixa ${temp.toFixed(0)}°C`); }

            // YELLOW conditions (caution)
            if (status === 'GREEN') {
                if (windKmh > 7) { status = 'YELLOW'; reasons.push(`Vento ${windKmh.toFixed(0)} km/h`); }
                if (humidity < 60) { status = 'YELLOW'; reasons.push(`Umidade ${humidity}%`); }
                if (humidity > 90) { status = 'YELLOW'; reasons.push(`Umidade alta ${humidity}%`); }
                if (temp > 30) { status = 'YELLOW'; reasons.push(`Temp ${temp.toFixed(0)}°C`); }
                if (hour < 5 || hour >= 22) { status = 'YELLOW'; reasons.push('Inversão térmica'); }
            }

            if (status === 'GREEN') reasons.push('Condições ideais');

            return {
                time: formatTime(d.dt),
                status,
                reason: reasons.join(' | ')
            };
        });

        // --- Aggregate daily forecasts with real min/max ---
        const dailyMap = new Map<string, { temps: number[], rain: number, wind: number[], humidity: number[], clouds: number[], date: Date }>();

        for (const entry of forecastList) {
            const date = new Date(entry.dt * 1000);
            const key = date.toISOString().split('T')[0];

            if (!dailyMap.has(key)) {
                dailyMap.set(key, { temps: [], rain: 0, wind: [], humidity: [], clouds: [], date });
            }
            const day = dailyMap.get(key)!;
            day.temps.push(entry.main.temp_min, entry.main.temp_max);
            day.rain += entry.rain ? (entry.rain['3h'] || 0) : 0;
            day.wind.push(entry.wind.speed * 3.6);
            day.humidity.push(entry.main.humidity);
            day.clouds.push(entry.clouds?.all ?? 0);
        }

        const forecast: DailyForecast[] = [];
        for (const [dateKey, day] of dailyMap) {
            if (forecast.length >= 5) break;
            const dayOfWeek = day.date.getUTCDay();
            forecast.push({
                date: dateKey,
                dayName: DAY_NAMES_PT[dayOfWeek] || dateKey,
                minTemp: Math.round(Math.min(...day.temps)),
                maxTemp: Math.round(Math.max(...day.temps)),
                rain: Math.round(day.rain * 10) / 10,
                windKmh: Math.round((day.wind.reduce((a, b) => a + b, 0) / day.wind.length) * 10) / 10,
                humidity: Math.round(day.humidity.reduce((a, b) => a + b, 0) / day.humidity.length),
                clouds: Math.round(day.clouds.reduce((a, b) => a + b, 0) / day.clouds.length),
            });
        }

        return { charts, sprayWindow, forecast };
    }

    /**
     * GDD = sum of max(((TempMax + TempMin) / 2) - BaseTemp, 0) per day
     * Uses weather_history_logs grouped by day to find daily min/max
     */
    static async calculateGDD(stationId: string, baseTemp: number = 10): Promise<number> {
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        try {
            const dailyTemps = await db
                .select({
                    day: sql<string>`DATE(${weatherHistoryLogs.ts})`,
                    minTemp: sql<number>`MIN(CAST(${weatherHistoryLogs.temperature} AS NUMERIC))`,
                    maxTemp: sql<number>`MAX(CAST(${weatherHistoryLogs.temperature} AS NUMERIC))`,
                })
                .from(weatherHistoryLogs)
                .where(
                    and(
                        eq(weatherHistoryLogs.stationId, stationId),
                        gte(weatherHistoryLogs.ts, ninetyDaysAgo)
                    )
                )
                .groupBy(sql`DATE(${weatherHistoryLogs.ts})`)
                .orderBy(sql`DATE(${weatherHistoryLogs.ts})`);

            let totalGDD = 0;
            for (const row of dailyTemps) {
                const min = Number(row.minTemp) || 0;
                const max = Number(row.maxTemp) || 0;
                const avg = (max + min) / 2;
                const gdd = Math.max(avg - baseTemp, 0);
                totalGDD += gdd;
            }

            return Math.round(totalGDD);
        } catch (error) {
            console.error(`Error calculating GDD for station ${stationId}:`, error);
            return 0;
        }
    }
}
