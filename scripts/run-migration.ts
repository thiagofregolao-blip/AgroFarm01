
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

        // Migration 5: Add image_base64 to products
        const imageBase64Path = path.join(process.cwd(), 'migration_add_image_base64.sql');
        if (fs.existsSync(imageBase64Path)) {
            const imageBase64Sql = fs.readFileSync(imageBase64Path, 'utf-8');
            console.log('📄 Lendo arquivo de migração:', imageBase64Path);
            console.log('🚀 Executando SQL (image_base64)...');
            await sql.unsafe(imageBase64Sql);
            console.log('✅ Migração image_base64 concluída!');
        }

        // Migration 6: Farm Farmers (Agricultores)
        const farmFarmersPath = path.join(process.cwd(), 'migration_add_farm_farmers.sql');
        console.log('🔍 Verificando arquivo:', farmFarmersPath);

        if (fs.existsSync(farmFarmersPath)) {
            const farmFarmersSql = fs.readFileSync(farmFarmersPath, 'utf-8');
            console.log('📄 Lendo arquivo de migração:', farmFarmersPath);
            console.log('🚀 Executando SQL (farm_farmers)...');
            await sql.unsafe(farmFarmersSql);
            console.log('✅ Migração farm_farmers concluída!');
        } else {
            console.error('❌ ARQUIVO DE MIGRAÇÃO NÃO ENCONTRADO:', farmFarmersPath);
            console.log('📂 Diretório atual:', process.cwd());
            try {
                const files = fs.readdirSync(process.cwd());
                console.log('📂 Arquivos na raiz:', files.join(', '));
            } catch (err) {
                console.error('Erro ao listar arquivos:', err);
            }
        }

        // Migration 7: Add fields to farm_farmers (property_size, main_culture, region)
        const farmFarmersFieldsPath = path.join(process.cwd(), 'migration_add_farm_farmers_fields.sql');
        if (fs.existsSync(farmFarmersFieldsPath)) {
            const farmFarmersFieldsSql = fs.readFileSync(farmFarmersFieldsPath, 'utf-8');
            console.log('📄 Lendo arquivo de migração:', farmFarmersFieldsPath);
            console.log('🚀 Executando SQL (farm_farmers_fields)...');
            await sql.unsafe(farmFarmersFieldsSql);
            console.log('✅ Migração farm_farmers_fields concluída!');
        }

        // Migration 7.5: Merge farm_farmers into users
        const mergeFarmersPath = path.join(process.cwd(), 'migration_merge_farm_farmers.sql');
        if (fs.existsSync(mergeFarmersPath)) {
            const mergeFarmersSql = fs.readFileSync(mergeFarmersPath, 'utf-8');
            console.log('📄 Lendo arquivo de migração:', mergeFarmersPath);
            console.log('🚀 Executando SQL (merge_farm_farmers)...');
            await sql.unsafe(mergeFarmersSql);
            console.log('✅ Migração merge_farm_farmers concluída!');
        }

        // Migration 8: Add whatsapp_extra_numbers to users
        const whatsappExtraPath = path.join(process.cwd(), 'migration_whatsapp_extra_numbers.sql');
        if (fs.existsSync(whatsappExtraPath)) {
            const whatsappExtraSql = fs.readFileSync(whatsappExtraPath, 'utf-8');
            console.log('📄 Lendo arquivo de migração:', whatsappExtraPath);
            console.log('🚀 Executando SQL (whatsapp_extra_numbers)...');
            await sql.unsafe(whatsappExtraSql);
            console.log('✅ Migração whatsapp_extra_numbers concluída!');
        }

        // Migration 9: Add skip_stock_entry to farm_invoices
        const skipStockPath = path.join(process.cwd(), 'migration_add_skip_stock_entry.sql');
        if (fs.existsSync(skipStockPath)) {
            const skipStockSql = fs.readFileSync(skipStockPath, 'utf-8');
            console.log('📄 Lendo arquivo de migração:', skipStockPath);
            console.log('🚀 Executando SQL (skip_stock_entry)...');
            await sql.unsafe(skipStockSql);
            console.log('✅ Migração skip_stock_entry concluída!');
        }

        console.log('✅ Todas as migrações concluídas com sucesso!');

    } catch (error) {
        console.error('❌ Erro ao executar migração:', error);
    } finally {
        await sql.end();
    }
};

runMigration();
