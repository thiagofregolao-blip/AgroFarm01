/**
 * Weather Station Routes — estacoes virtuais, dashboard, historico de chuva.
 * Extraido de routes.ts para isolar o dominio meteorologico.
 */

import type { Express } from "express";
import { db } from "./db";
import { requireAuth } from "./auth";
import { virtualWeatherStations, weatherHistoryLogs } from "@shared/schema";
import { WeatherStationService } from "./services/weather_station_service";
import { eq, and, desc } from "drizzle-orm";
import { logger } from "./lib/logger";

export function registerWeatherStationRoutes(app: Express): void {

  // POST /api/farm/weather/stations - Criar nova estacao
  app.post("/api/farm/weather/stations", requireAuth, async (req: any, res) => {
    try {
      const { name, lat, lng, farmId } = req.body;

      if (!name || lat === undefined || lng === undefined) {
        return res.status(400).json({ error: "Nome, latitude e longitude sao obrigatorios." });
      }

      const [newStation] = await db.insert(virtualWeatherStations).values({
        name,
        lat: String(lat),
        lng: String(lng),
        farmId: farmId || null,
        userId: req.user!.id,
      }).returning();

      await WeatherStationService.fetchAndLogWeather(newStation.id);

      res.status(201).json(newStation);
    } catch (error) {
      logger.error('Erro ao criar estacao meteorologica', { route: 'POST /api/farm/weather/stations' }, error instanceof Error ? error : new Error(String(error)));
      res.status(500).json({ error: "Falha ao criar estacao" });
    }
  });

  // GET /api/farm/weather/stations - Listar estacoes do usuario
  app.get("/api/farm/weather/stations", requireAuth, async (req: any, res) => {
    try {
      const stations = await db
        .select()
        .from(virtualWeatherStations)
        .where(eq(virtualWeatherStations.userId, req.user!.id));

      const stationsWithWeather = await Promise.all(stations.map(async (station: any) => {
        const [latestLog] = await db
          .select()
          .from(weatherHistoryLogs)
          .where(eq(weatherHistoryLogs.stationId, station.id))
          .orderBy(desc(weatherHistoryLogs.ts))
          .limit(1);

        return { ...station, currentWeather: latestLog || null };
      }));

      res.json(stationsWithWeather);
    } catch (error) {
      logger.error('Erro ao listar estacoes', { route: 'GET /api/farm/weather/stations' }, error instanceof Error ? error : new Error(String(error)));
      res.status(500).json({ error: "Falha ao listar estacoes" });
    }
  });

  // GET /api/farm/weather/stations/:id/dashboard
  app.get("/api/farm/weather/stations/:id/dashboard", requireAuth, async (req: any, res) => {
    try {
      const stationId = req.params.id;

      const [station] = await db
        .select()
        .from(virtualWeatherStations)
        .where(and(eq(virtualWeatherStations.id, stationId), eq(virtualWeatherStations.userId, req.user!.id)));

      if (!station) return res.status(404).json({ error: "Estacao nao encontrada" });

      const intelligence = await WeatherStationService.getForecastWithIntelligence(
        station.lat?.toString(),
        station.lng?.toString()
      );

      const rainData = await WeatherStationService.fetchAccumulatedPrecipitation(
        station.lat?.toString() || '',
        station.lng?.toString() || '',
        30
      );

      const gdd = await WeatherStationService.calculateGDD(stationId);

      const [lastLog] = await db
        .select({ ts: weatherHistoryLogs.ts })
        .from(weatherHistoryLogs)
        .where(eq(weatherHistoryLogs.stationId, stationId))
        .orderBy(desc(weatherHistoryLogs.ts))
        .limit(1);

      res.json({
        station,
        ...intelligence,
        accumulatedRain: rainData.total,
        gdd,
        lastUpdate: lastLog?.ts || null,
      });
    } catch (error) {
      logger.error('Erro no dashboard da estacao', { route: 'GET /api/farm/weather/stations/:id/dashboard' }, error instanceof Error ? error : new Error(String(error)));
      res.status(500).json({ error: "Falha ao carregar dashboard" });
    }
  });

  // DELETE /api/farm/weather/stations/:id
  app.delete("/api/farm/weather/stations/:id", requireAuth, async (req: any, res) => {
    try {
      const stationId = req.params.id;

      const [station] = await db
        .select()
        .from(virtualWeatherStations)
        .where(eq(virtualWeatherStations.id, stationId));

      if (!station) return res.status(404).json({ error: "Estacao nao encontrada" });

      await db.delete(weatherHistoryLogs).where(eq(weatherHistoryLogs.stationId, stationId));
      await db.delete(virtualWeatherStations).where(eq(virtualWeatherStations.id, stationId));

      res.status(200).json({ success: true, message: "Estacao deletada" });
    } catch (error) {
      logger.error('Erro ao deletar estacao', { route: 'DELETE /api/farm/weather/stations/:id' }, error instanceof Error ? error : new Error(String(error)));
      res.status(500).json({ error: "Falha ao deletar estacao" });
    }
  });

  // GET /api/farm/weather/stations/:id/history
  app.get("/api/farm/weather/stations/:id/history", requireAuth, async (req: any, res) => {
    try {
      const stationId = req.params.id;
      const days = Number(req.query.days) || 30;

      const [station] = await db
        .select()
        .from(virtualWeatherStations)
        .where(eq(virtualWeatherStations.id, stationId));

      if (!station) return res.status(404).json({ error: "Estacao nao encontrada" });

      const rainData = await WeatherStationService.fetchAccumulatedPrecipitation(
        station.lat?.toString() || '',
        station.lng?.toString() || '',
        days
      );

      const formattedHistory = rainData.daily.map((day: any) => ({
        date: day.date,
        precipitation: day.rain
      }));

      res.status(200).json(formattedHistory);
    } catch (error) {
      logger.error('Erro ao buscar historico de chuva', { route: 'GET /api/farm/weather/stations/:id/history' }, error instanceof Error ? error : new Error(String(error)));
      res.status(500).json({ error: "Falha ao buscar historico" });
    }
  });
}
