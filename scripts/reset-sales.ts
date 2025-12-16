
import { db, dbReady } from "../server/db";
import { sales, seasons } from "@shared/schema";
import { eq, ne } from "drizzle-orm";

async function main() {
    await dbReady; // Aguardar inicialização do banco
    console.log("Iniciando limpeza de vendas antigas...");

    try {
        // 1. Obter a safra ativa (Atual)
        const activeSeasons = await db.select().from(seasons).where(eq(seasons.isActive, true)).limit(1);

        if (activeSeasons.length === 0) {
            console.error("ERRO: Nenhuma safra ativa encontrada!");
            process.exit(1);
        }

        const currentSeason = activeSeasons[0];
        console.log(`Safra Atual (Ativa): ${currentSeason.name} (ID: ${currentSeason.id})`);

        // 2. Encontrar vendas que não são da safra atual
        const salesToDelete = await db.select().from(sales).where(ne(sales.seasonId, currentSeason.id));
        console.log(`Encontradas ${salesToDelete.length} vendas de safras anteriores (ou inválidas).`);

        if (salesToDelete.length > 0) {
            console.log("Deletando vendas antigas...");
            await db.delete(sales).where(ne(sales.seasonId, currentSeason.id));
            console.log("Vendas antigas deletadas com sucesso! As informações foram zeradas.");
        } else {
            console.log("Nenhuma venda antiga para deletar. O banco já está limpo.");
        }

    } catch (e) {
        console.error("Erro durante o processo:", e);
        process.exit(1);
    }

    console.log("Concluído.");
    process.exit(0);
}

main();
