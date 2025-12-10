import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { db } from "@db/schema";
import { getState, setState } from "@db/state";

const GEOFENCE_TASK = "GEOFENCE_BASE";
const TRACK_TASK = "TRACK_TRIP";

let currentTripId: string | null = null;

export async function registerBaseGeofence(lat: number, lng: number, radius = 200) {
  try {
    const { status } = await Location.requestBackgroundPermissionsAsync();
    if (status !== 'granted') {
      console.warn('Background location permission denied');
      return;
    }
    
    await Location.startGeofencingAsync(GEOFENCE_TASK, [{
      latitude: lat,
      longitude: lng,
      radius,
      identifier: "base"
    }]);
    
    setState("base_lat", String(lat));
    setState("base_lng", String(lng));
  } catch (error) {
    console.error('Geofence setup error:', error);
  }
}

TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }) => {
  if (error || !data) return;
  
  const { eventType, region } = (data as any);
  
  if (eventType === Location.GeofencingEventType.Exit) {
    const activeVisitId = getState("active_visit_id");
    if (!activeVisitId) return;
    
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });
      
      const speedKmh = (location.coords.speed ?? 0) * 3.6;
      
      if (speedKmh > 15) {
        const tripId = `trip-${Date.now()}`;
        currentTripId = tripId;
        setState("current_trip_id", tripId);
        
        db.runSync(
          "INSERT INTO outbox (op_id, type, payload, created_at) VALUES (?, ?, ?, ?)",
          [
            `trip_start_${tripId}`,
            "TRIP_START",
            JSON.stringify({
              trip_id: tripId,
              visit_id: activeVisitId,
              gps: {
                lat: location.coords.latitude,
                lng: location.coords.longitude,
                speed_kmh: speedKmh,
                accuracy_m: location.coords.accuracy
              },
              odometer: null,
              started_at: new Date().toISOString()
            }),
            new Date().toISOString()
          ]
        );
        
        await startTracking();
      }
    } catch (err) {
      console.error('Exit handler error:', err);
    }
  }
});

export async function startTracking() {
  try {
    await Location.startLocationUpdatesAsync(TRACK_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: 7000,
      distanceInterval: 10,
      showsBackgroundLocationIndicator: true,
      pausesUpdatesAutomatically: true,
      foregroundService: {
        notificationTitle: "CRM Agro",
        notificationBody: "Rastreando viagem",
      }
    });
  } catch (error) {
    console.error('Tracking error:', error);
  }
}

export async function stopTracking() {
  try {
    await Location.stopLocationUpdatesAsync(TRACK_TASK);
    
    const tripId = getState("current_trip_id");
    if (tripId) {
      const remaining = db.getAllSync(
        "SELECT * FROM telemetry_buffer WHERE trip_id = ? ORDER BY ts",
        [tripId]
      );
      
      if (remaining && Array.isArray(remaining) && remaining.length > 0) {
        const normalizedPoints = remaining.map((row: any) => ({
          lat: row.lat,
          lng: row.lng,
          speed_kmh: row.speed_kmh,
          accuracy_m: row.accuracy_m,
          timestamp: row.ts
        }));
        
        const batchId = `gps_batch_${tripId}_final`;
        db.runSync(
          "INSERT INTO outbox (op_id, type, payload, created_at) VALUES (?, ?, ?, ?)",
          [
            batchId,
            "GPS_BATCH",
            JSON.stringify({
              trip_id: tripId,
              points: normalizedPoints
            }),
            new Date().toISOString()
          ]
        );
        
        db.runSync("DELETE FROM telemetry_buffer WHERE trip_id = ?", [tripId]);
      }
      
      db.runSync(
        "INSERT INTO outbox (op_id, type, payload, created_at) VALUES (?, ?, ?, ?)",
        [
          `trip_end_${tripId}`,
          "TRIP_END",
          JSON.stringify({
            trip_id: tripId,
            ended_at: new Date().toISOString(),
            odometer: null
          }),
          new Date().toISOString()
        ]
      );
      
      setState("current_trip_id", "");
      currentTripId = null;
    }
  } catch (error) {
    console.error('Stop tracking error:', error);
  }
}

TaskManager.defineTask(TRACK_TASK, ({ data, error }) => {
  if (error || !data) {
    console.error('Tracking task error:', error);
    return;
  }
  
  const { locations } = (data as any);
  const tripId = getState("current_trip_id");
  
  if (!tripId || !locations || locations.length === 0) return;
  
  try {
    for (const loc of locations) {
      const gpsPoint = {
        trip_id: tripId,
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        speed_kmh: (loc.coords.speed ?? 0) * 3.6,
        accuracy_m: loc.coords.accuracy,
        ts: new Date(loc.timestamp).toISOString()
      };
      
      db.runSync(
        "INSERT INTO telemetry_buffer (trip_id, lat, lng, speed_kmh, accuracy_m, ts) VALUES (?, ?, ?, ?, ?, ?)",
        [
          gpsPoint.trip_id,
          gpsPoint.lat,
          gpsPoint.lng,
          gpsPoint.speed_kmh,
          gpsPoint.accuracy_m,
          gpsPoint.ts
        ]
      );
    }
    
    const buffered = db.getAllSync(
      "SELECT * FROM telemetry_buffer WHERE trip_id = ? ORDER BY ts",
      [tripId]
    );
    
    if (buffered && Array.isArray(buffered) && buffered.length >= 10) {
      const normalizedPoints = buffered.map((row: any) => ({
        lat: row.lat,
        lng: row.lng,
        speed_kmh: row.speed_kmh,
        accuracy_m: row.accuracy_m,
        timestamp: row.ts
      }));
      
      const batchId = `gps_batch_${tripId}_${Date.now()}`;
      db.runSync(
        "INSERT INTO outbox (op_id, type, payload, created_at) VALUES (?, ?, ?, ?)",
        [
          batchId,
          "GPS_BATCH",
          JSON.stringify({
            trip_id: tripId,
            points: normalizedPoints
          }),
          new Date().toISOString()
        ]
      );
      
      db.runSync("DELETE FROM telemetry_buffer WHERE trip_id = ?", [tripId]);
    }
  } catch (err) {
    console.error('GPS buffer error:', err);
  }
});

export async function manualTripStart(visitId: string) {
  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High
    });
    
    const tripId = `trip-${Date.now()}`;
    currentTripId = tripId;
    setState("current_trip_id", tripId);
    
    db.runSync(
      "INSERT INTO outbox (op_id, type, payload, created_at) VALUES (?, ?, ?, ?)",
      [
        `trip_start_${tripId}`,
        "TRIP_START",
        JSON.stringify({
          trip_id: tripId,
          visit_id: visitId,
          gps: {
            lat: location.coords.latitude,
            lng: location.coords.longitude,
            speed_kmh: (location.coords.speed ?? 0) * 3.6,
            accuracy_m: location.coords.accuracy
          },
          odometer: null,
          started_at: new Date().toISOString()
        }),
        new Date().toISOString()
      ]
    );
    
    await startTracking();
    return tripId;
  } catch (error) {
    console.error('Manual trip start error:', error);
    throw error;
  }
}
