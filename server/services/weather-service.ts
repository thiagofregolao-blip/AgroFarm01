/**
 * Weather Service - Open-Meteo API (100% free, no API key needed)
 * Provides weather forecast for farm locations
 */

interface WeatherForecast {
    date: string;
    tempMax: number;
    tempMin: number;
    precipitation: number;
    weatherDescription: string;
    weatherEmoji: string;
}

const WEATHER_CODES: Record<number, { description: string; emoji: string }> = {
    0: { description: "Céu limpo", emoji: "☀️" },
    1: { description: "Parcialmente nublado", emoji: "🌤️" },
    2: { description: "Parcialmente nublado", emoji: "⛅" },
    3: { description: "Nublado", emoji: "☁️" },
    45: { description: "Neblina", emoji: "🌫️" },
    48: { description: "Neblina com geada", emoji: "🌫️" },
    51: { description: "Garoa leve", emoji: "🌦️" },
    53: { description: "Garoa moderada", emoji: "🌦️" },
    55: { description: "Garoa forte", emoji: "🌧️" },
    61: { description: "Chuva leve", emoji: "🌦️" },
    63: { description: "Chuva moderada", emoji: "🌧️" },
    65: { description: "Chuva forte", emoji: "🌧️" },
    71: { description: "Neve leve", emoji: "🌨️" },
    73: { description: "Neve moderada", emoji: "🌨️" },
    75: { description: "Neve forte", emoji: "❄️" },
    80: { description: "Pancadas de chuva leves", emoji: "🌦️" },
    81: { description: "Pancadas de chuva", emoji: "🌧️" },
    82: { description: "Pancadas de chuva fortes", emoji: "⛈️" },
    95: { description: "Tempestade", emoji: "⛈️" },
    96: { description: "Tempestade com granizo leve", emoji: "⛈️" },
    99: { description: "Tempestade com granizo forte", emoji: "⛈️" },
};

export async function getWeatherForecast(latitude: number, longitude: number, days: number = 3): Promise<WeatherForecast[]> {
    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&timezone=America/Asuncion&forecast_days=${days}`;

        const response = await fetch(url);
        if (!response.ok) throw new Error(`Open-Meteo API error: ${response.status}`);

        const data = await response.json();

        const forecasts: WeatherForecast[] = [];
        for (let i = 0; i < data.daily.time.length; i++) {
            const code = data.daily.weathercode[i];
            const weather = WEATHER_CODES[code] || { description: "Variável", emoji: "🌤️" };

            forecasts.push({
                date: data.daily.time[i],
                tempMax: Math.round(data.daily.temperature_2m_max[i]),
                tempMin: Math.round(data.daily.temperature_2m_min[i]),
                precipitation: data.daily.precipitation_sum[i],
                weatherDescription: weather.description,
                weatherEmoji: weather.emoji,
            });
        }

        return forecasts;
    } catch (error) {
        console.error("[WEATHER]", error);
        return [];
    }
}

export function formatWeatherMessage(forecasts: WeatherForecast[], city: string = ""): string {
    if (forecasts.length === 0) return "Não consegui buscar a previsão do tempo no momento.";

    const today = forecasts[0];
    const cityLabel = city ? ` em *${city}*` : "";
    const rainInfo = today.precipitation > 0
        ? `💧 Chuva prevista: ${today.precipitation}mm`
        : "Sem chuva prevista";

    let msg = `${today.weatherEmoji} *Tempo hoje${cityLabel}*\n`;
    msg += `Máx *${today.tempMax}°C* | Mín *${today.tempMin}°C*\n`;
    msg += `${today.weatherDescription}. ${rainInfo}`;

    if (forecasts.length > 1) {
        msg += "\n\n📅 *Próximos dias:*";
        for (let i = 1; i < forecasts.length; i++) {
            const f = forecasts[i];
            const dateFormatted = new Date(f.date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" });
            const rain = f.precipitation > 0 ? ` 💧${f.precipitation}mm` : "";
            msg += `\n${f.weatherEmoji} ${dateFormatted}: ${f.tempMax}°/${f.tempMin}°${rain}`;
        }
    }

    return msg;
}
