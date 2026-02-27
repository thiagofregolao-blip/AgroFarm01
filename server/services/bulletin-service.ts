/**
 * Bulletin Service - Daily AgroZap newsletter via WhatsApp
 * Runs at 06:00 AM (America/Asuncion) every day
 */

import { getWeatherForecast, formatWeatherMessage } from "./weather-service";
import { getCommodityData, formatCommodityMessage } from "./commodity-service";
import { getAgroNews, formatNewsMessage } from "./news-service";

const Z_API_INSTANCE = process.env.Z_API_INSTANCE_ID || "3EE9E067CA2DB1B055091AD735EF201A";
const Z_API_TOKEN = process.env.Z_API_TOKEN || "9938EA066A5F1A693D48545A";
const Z_API_CLIENT_TOKEN = process.env.Z_API_CLIENT_TOKEN || "F17220cd7efa3420282c5cc5f3f0746b9S";

async function sendWhatsAppMessage(phone: string, message: string): Promise<boolean> {
    try {
        const response = await fetch(
            `https://api.z-api.io/instances/${Z_API_INSTANCE}/token/${Z_API_TOKEN}/send-text`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "client-token": Z_API_CLIENT_TOKEN,
                },
                body: JSON.stringify({ phone, message }),
            }
        );
        return response.ok;
    } catch (error) {
        console.error(`[BULLETIN] Failed to send to ${phone}:`, error);
        return false;
    }
}

async function buildBulletinMessage(latitude: number | null, longitude: number | null, city: string | null): Promise<string> {
    const today = new Date().toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });

    let msg = `🌾 *Bom dia! Boletim AgroZap - ${today}* 🌾\n\n`;

    // Weather
    if (latitude && longitude) {
        const forecasts = await getWeatherForecast(latitude, longitude, 3);
        msg += formatWeatherMessage(forecasts, city || "") + "\n\n";
    }

    // Commodities
    const commodities = await getCommodityData();
    msg += formatCommodityMessage(commodities) + "\n\n";

    // News
    const news = await getAgroNews(3);
    const newsMsg = formatNewsMessage(news);
    if (newsMsg) msg += newsMsg + "\n\n";

    msg += "Bom trabalho no campo! 🚜";

    return msg;
}

export async function sendDailyBulletins(): Promise<void> {
    console.log("[BULLETIN] Starting daily bulletin send...");

    try {
        const { users } = await import("../../shared/schema");
        const { eq, and, isNotNull, sql } = await import("drizzle-orm");
        const { db } = await import("../db");

        // Get all users with bulletin enabled and a WhatsApp number
        const farmers = await db.select({
            id: users.id,
            username: users.username,
            whatsappNumber: users.whatsapp_number,
            farmLatitude: sql<number>`farm_latitude`,
            farmLongitude: sql<number>`farm_longitude`,
            farmCity: sql<string>`farm_city`,
            bulletinEnabled: sql<boolean>`bulletin_enabled`,
        })
            .from(users)
            .where(
                and(
                    isNotNull(users.whatsapp_number),
                    sql`bulletin_enabled = true OR bulletin_enabled IS NULL`
                )
            );

        console.log(`[BULLETIN] Found ${farmers.length} farmers to send bulletin`);

        let sent = 0;
        for (const farmer of farmers) {
            if (!farmer.whatsappNumber) continue;

            try {
                const message = await buildBulletinMessage(
                    farmer.farmLatitude,
                    farmer.farmLongitude,
                    farmer.farmCity
                );

                const success = await sendWhatsAppMessage(farmer.whatsappNumber, message);
                if (success) {
                    sent++;
                    console.log(`[BULLETIN] ✅ Sent to ${farmer.username} (${farmer.whatsappNumber})`);
                }

                // Rate limiting: wait 2 seconds between sends
                await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (e) {
                console.error(`[BULLETIN] Error sending to ${farmer.username}:`, e);
            }
        }

        console.log(`[BULLETIN] Complete: ${sent}/${farmers.length} bulletins sent`);
    } catch (error) {
        console.error("[BULLETIN] Fatal error:", error);
    }
}

/**
 * Schedule the daily bulletin cron job
 * Runs at 06:00 AM America/Asuncion time (UTC-3 = 09:00 UTC)
 */
export function scheduleDailyBulletin(): void {
    const NINE_UTC = 9; // 06:00 Asuncion = 09:00 UTC

    function scheduleNext() {
        const now = new Date();
        const next = new Date(now);
        next.setUTCHours(NINE_UTC, 0, 0, 0);

        // If we already passed 09:00 UTC today, schedule for tomorrow
        if (now >= next) {
            next.setUTCDate(next.getUTCDate() + 1);
        }

        const msUntilNext = next.getTime() - now.getTime();
        const hoursUntil = (msUntilNext / (1000 * 60 * 60)).toFixed(1);

        console.log(`[BULLETIN] 📅 Next bulletin scheduled in ${hoursUntil}h (${next.toISOString()})`);

        setTimeout(async () => {
            await sendDailyBulletins();
            scheduleNext(); // Schedule next day
        }, msUntilNext);
    }

    scheduleNext();
    console.log("[BULLETIN] ✅ Daily bulletin scheduler started");
}
