
import fs from 'fs';
import path from 'path';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

// Carrega variáveis de ambiente
dotenv.config();

const runMigration = async () => {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
        console.error('❌ ERRO: DATABASE_URL não encontrada no arquivo .env');
        process.exit(1);
    }

    console.log('🔄 Conectando ao banco de dados...');
    console.log(`URL (mascarada): ${databaseUrl.replace(/:[^:]+@/, ':***@')}`);

    const sql = postgres(databaseUrl, {
        max: 1,
        idle_timeout: 20,
        connect_timeout: 30, // 30 segundos timeout
    });

    try {
        const migrationPath = path.join(process.cwd(), 'migration_planning_2026.sql');
        const migrationSql = fs.readFileSync(migrationPath, 'utf-8');

        console.log('📄 Lendo arquivo de migração:', migrationPath);
        console.log('🚀 Executando SQL...');

        // Executa o SQL. O comando `simple` envia a query como string única, útil para multiplos statements se suportado ou quebra
        // O driver postgres.js suporta executar arquivo lido como string
        await sql.unsafe(migrationSql);

        console.log('✅ Migração concluída com sucesso!');
        console.log('Tabelas criadas: planning_products_base, sales_planning, sales_planning_items');

    } catch (error) {
        console.error('❌ Erro ao executar migração:', error);
    } finally {
        await sql.end();
    }
};

runMigration();
