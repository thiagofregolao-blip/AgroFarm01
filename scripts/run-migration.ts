
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
        // Migration 1: Planning tables
        const planningPath = path.join(process.cwd(), 'migration_planning_2026.sql');
        const planningSql = fs.readFileSync(planningPath, 'utf-8');
        console.log('📄 Lendo arquivo de migração:', planningPath);
        console.log('🚀 Executando SQL (planning)...');
        await sql.unsafe(planningSql);
        console.log('✅ Migração planning concluída!');

        // Migration 2: Farm tables
        const farmPath = path.join(process.cwd(), 'migration_farm_system.sql');
        if (fs.existsSync(farmPath)) {
            const farmSql = fs.readFileSync(farmPath, 'utf-8');
            console.log('📄 Lendo arquivo de migração:', farmPath);
            console.log('🚀 Executando SQL (farm)...');
            await sql.unsafe(farmSql);
            console.log('✅ Migração farm concluída!');
        }

        // Migration 3: DB Fixes (Season ID & Cascade Delete)
        const fixesPath = path.join(process.cwd(), 'migration_fix_db_issues.sql');
        if (fs.existsSync(fixesPath)) {
            const fixesSql = fs.readFileSync(fixesPath, 'utf-8');
            console.log('📄 Lendo arquivo de migração:', fixesPath);
            console.log('🚀 Executando SQL (fixes)...');
            await sql.unsafe(fixesSql);
            console.log('✅ Migração de correções concluída!');
        }

        // Migration 4: WhatsApp Number Field
        const whatsappPath = path.join(process.cwd(), 'migration_add_whatsapp_number.sql');
        if (fs.existsSync(whatsappPath)) {
            const whatsappSql = fs.readFileSync(whatsappPath, 'utf-8');
            console.log('📄 Lendo arquivo de migração:', whatsappPath);
            console.log('🚀 Executando SQL (whatsapp)...');
            await sql.unsafe(whatsappSql);
            console.log('✅ Migração WhatsApp concluída!');
        }

        console.log('✅ Todas as migrações concluídas com sucesso!');

    } catch (error) {
        console.error('❌ Erro ao executar migração:', error);
    } finally {
        await sql.end();
    }
};

runMigration();
