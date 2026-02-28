import { db } from "../db";
import { virtualWeatherStations, weatherHistoryLogs } from "@shared/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";



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
    time: string; // Ex: '10:00'
    status: 'GREEN' | 'YELLOW' | 'RED';
    reason?: string;
}

export class WeatherStationService {
    /**
     * Fetches the current weather for a specific station and stores the log
     */
    static async fetchAndLogWeather(stationId: string): Promise<boolean> {
        const station = await db.query.virtualWeatherStations.findFirst({
            where: eq(virtualWeatherStations.id, stationId),
        });

        if (!station || !station.isActive) return false;

        try {
            const openWeatherKey = process.env.OPENWEATHER_API_KEY;
            if (!openWeatherKey) {
                throw new Error("OPENWEATHER_API_KEY is not configured.");
            }

            // Using OpenWeather API to get current weather
            const response = await fetch(
                `https://api.openweathermap.org/data/2.5/weather?lat=${station.lat}&lon=${station.lng}&appid=${openWeatherKey}&units=metric`
            );

            if (!response.ok) {
                throw new Error(`OpenWeather API error: ${response.statusText}`);
            }

            const data = await response.json();

            // Extract metrics
            const temperature = data.main.temp;
            const humidity = data.main.humidity;
            const windSpeed = data.wind.speed; // usually m/s
            const clouds = data.clouds.all;
            const precipitation = data.rain ? data.rain['1h'] || 0 : 0;

            // Save to history log
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

    /**
     * Poll weather for all active stations (designed for cron job)
     */
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

    /**
     * Gets the 5-Day/3-Hour forecast for a given station to generate charts and the Spray Window
     */
    static async getForecastWithIntelligence(lat: string | undefined, lng: string | undefined) {
        const openWeatherKey = process.env.OPENWEATHER_API_KEY;
        if (!lat || !lng) throw new Error("Missing coordinates.");
        if (!openWeatherKey) throw new Error("OPENWEATHER_API_KEY is not configured.");

        const response = await fetch(
            `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&appid=${openWeatherKey}&units=metric`
        );

        if (!response.ok) {
            throw new Error(`OpenWeather Forecast API error: ${response.statusText}`);
        }

        const data = await response.json();

        const hourlyData = data.list.slice(0, 8); // Pega as próximas 24h (8 entradas de 3h)
        const dailyForecasts = Array.from(new Set(data.list.map((i: any) => new Date(i.dt * 1000).toDateString()))).slice(0, 5); // Simplificando para 5 dias

        const charts = {
            temperatures: hourlyData.map((d: any) => ({ time: new Date(d.dt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), value: Math.round(d.main.temp) })),
            precipitation: hourlyData.map((d: any) => ({ time: new Date(d.dt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), value: d.rain ? d.rain['3h'] || 0 : 0 })),
            wind: hourlyData.map((d: any) => ({ time: new Date(d.dt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), value: Math.round((d.wind.speed * 3.6) * 10) / 10 })), // m/s to km/h
            humidity: hourlyData.map((d: any) => ({ time: new Date(d.dt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), value: Math.round(d.main.humidity) })),
        };

        // Calculate Spray Window Status using simple heuristics
        const sprayWindow: SprayWindowItem[] = hourlyData.map((d: any) => {
            const windKmh = d.wind.speed * 3.6;
            const humidity = d.main.humidity;
            const temp = d.main.temp;
            const willRain = d.rain ? (d.rain['3h'] > 1) : false; // Mais de 1mm em 3h

            let status: 'GREEN' | 'YELLOW' | 'RED' = 'GREEN';
            let reason = '';

            if (willRain || windKmh > 10 || temp > 30) {
                status = 'RED';
                if (willRain) reason = 'Chuva prevista';
                else if (windKmh > 10) reason = 'Vento excessivo';
                else if (temp > 30) reason = 'Temperatura alta';
            } else if (windKmh > 7 || humidity < 50 || temp > 28) {
                status = 'YELLOW';
                reason = 'Condições sub-ótimas';
            } else {
                reason = 'Condições ideais';
            }

            return {
                time: new Date(d.dt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                status,
                reason
            };
        });

        return {
            charts,
            sprayWindow,
            forecast: dailyForecasts // Replace with a more sophisticated map in production
        };
    }

    /**
     * Calculates the Growing Degree Days for a station given a Start Date and a Base Temperature
     * GDD = ((MaxTemp + MinTemp)/2) - BaseTemp
     * Note: In a real system we would use the actual daily min/max, but here we estimate from logs
     */
    static async calculateGDD(stationId: string, startDate: Date, baseTemp: number = 10): Promise<number> {
        // Implementation would query weatherHistoryLogs from startDate to Now
        // Aggregating per day, finding max and min temp, and summing the GDD
        return 0; // Stub for now
    }
}
