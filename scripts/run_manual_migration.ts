
import fs from 'fs';
import path from 'path';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const runMigration = async () => {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
        console.error('❌ ERRO: DATABASE_URL não encontrada no arquivo .env');
        process.exit(1);
    }

    const migrationFile = process.argv[2];
    if (!migrationFile) {
        console.error('❌ ERRO: Arquivo de migração não informado. Uso: tsx scripts/run_manual_migration.ts <arquivo.sql>');
        process.exit(1);
    }

    console.log('🔄 Conectando ao banco de dados...');

    const sql = postgres(databaseUrl, {
        max: 1,
        idle_timeout: 20,
        connect_timeout: 30,
    });

    try {
        const migrationPath = path.resolve(migrationFile);
        const migrationSql = fs.readFileSync(migrationPath, 'utf-8');

        console.log('📄 Lendo arquivo de migração:', migrationPath);
        console.log('🚀 Executando SQL...');

        await sql.unsafe(migrationSql);

        console.log('✅ Migração concluída com sucesso!');

    } catch (error) {
        console.error('❌ Erro ao executar migração:', error);
    } finally {
        await sql.end();
    }
};

runMigration();
