
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

        // Migration 8: Add status and is_draft to farmProductsCatalog
        const catalogStatusPath = path.join(process.cwd(), 'migration_add_catalog_status.sql');
        if (fs.existsSync(catalogStatusPath)) {
            const catalogStatusSql = fs.readFileSync(catalogStatusPath, 'utf-8');
            console.log('📄 Lendo arquivo de migração:', catalogStatusPath);
            console.log('🚀 Executando SQL (catalog_status)...');
            await sql.unsafe(catalogStatusSql);
            console.log('✅ Migração catalog_status concluída!');
        }

        // Migration 9: Merge farm_farmers into users
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

        // Migration 10: Create farm_manuals table for RAG
        const farmManualsPath = path.join(process.cwd(), 'migration_add_farm_manuals.sql');
        if (fs.existsSync(farmManualsPath)) {
            const farmManualsSql = fs.readFileSync(farmManualsPath, 'utf-8');
            console.log('📄 Lendo arquivo de migração:', farmManualsPath);
            console.log('🚀 Executando SQL (farm_manuals)...');
            await sql.unsafe(farmManualsSql);
            console.log('✅ Migração farm_manuals concluída!');
        }

        // Migration 11: Add Equipment Table & Diesel PDV Support
        const equipmentDieselPath = path.join(process.cwd(), 'migration_add_equipment_diesel.sql');
        if (fs.existsSync(equipmentDieselPath)) {
            const equipmentDieselSql = fs.readFileSync(equipmentDieselPath, 'utf-8');
            console.log('📄 Lendo arquivo de migração:', equipmentDieselPath);
            console.log('🚀 Executando SQL (equipment_diesel)...');
            await sql.unsafe(equipmentDieselSql);
            console.log('✅ Migração equipment_diesel concluída!');
        }

        // Migration 12: Price History Table
        const priceHistoryPath = path.join(process.cwd(), 'migration_add_price_history.sql');
        if (fs.existsSync(priceHistoryPath)) {
            const priceHistorySql = fs.readFileSync(priceHistoryPath, 'utf-8');
            console.log('📄 Lendo arquivo de migração:', priceHistoryPath);
            console.log('🚀 Executando SQL (price_history)...');
            await sql.unsafe(priceHistorySql);
            console.log('✅ Migração price_history concluída!');
        }

        // Migration 13: Backfill Price History from existing confirmed invoices
        const backfillPath = path.join(process.cwd(), 'migration_backfill_price_history.sql');
        if (fs.existsSync(backfillPath)) {
            const backfillSql = fs.readFileSync(backfillPath, 'utf-8');
            console.log('📄 Lendo arquivo de migração:', backfillPath);
            console.log('🚀 Executando SQL (backfill_price_history)...');
            await sql.unsafe(backfillSql);
            console.log('✅ Migração backfill_price_history concluída!');
        }
        // Migration 14: Farm Location Fields
        const farmLocationPath = path.join(process.cwd(), 'migration_add_farm_location.sql');
        if (fs.existsSync(farmLocationPath)) {
            const farmLocationSql = fs.readFileSync(farmLocationPath, 'utf-8');
            console.log('📄 Lendo arquivo de migração:', farmLocationPath);
            console.log('🚀 Executando SQL (farm_location)...');
            await sql.unsafe(farmLocationSql);
            console.log('✅ Migração farm_location concluída!');
        }
        // Migration 15: Invoice Email Import columns
        const invoiceEmailPath = path.join(process.cwd(), 'migration_invoice_email.sql');
        if (fs.existsSync(invoiceEmailPath)) {
            const invoiceEmailSql = fs.readFileSync(invoiceEmailPath, 'utf-8');
            console.log('📄 Lendo arquivo de migração:', invoiceEmailPath);
            console.log('🚀 Executando SQL (invoice_email)...');
            await sql.unsafe(invoiceEmailSql);
            console.log('✅ Migração invoice_email concluída!');
        }
        // Migration 16: Accountant Email + PDF Storage
        const accountantPdfPath = path.join(process.cwd(), 'migration_accountant_pdf.sql');
        if (fs.existsSync(accountantPdfPath)) {
            const accountantPdfSql = fs.readFileSync(accountantPdfPath, 'utf-8');
            console.log('📄 Lendo arquivo de migração:', accountantPdfPath);
            console.log('🚀 Executando SQL (accountant_pdf)...');
            await sql.unsafe(accountantPdfSql);
            console.log('✅ Migração accountant_pdf concluída!');
        }
        // Migration 17: User Modules (per-client module access control)
        const userModulesPath = path.join(process.cwd(), 'migration_user_modules.sql');
        if (fs.existsSync(userModulesPath)) {
            const userModulesSql = fs.readFileSync(userModulesPath, 'utf-8');
            console.log('📄 Lendo arquivo de migração:', userModulesPath);
            console.log('🚀 Executando SQL (user_modules)...');
            await sql.unsafe(userModulesSql);
            console.log('✅ Migração user_modules concluída!');
        }

        // Migration 18: Weather Stations
        const weatherStationsPath = path.join(process.cwd(), 'migration_weather_stations.sql');
        if (fs.existsSync(weatherStationsPath)) {
            const weatherStationsSql = fs.readFileSync(weatherStationsPath, 'utf-8');
            console.log('📄 Lendo arquivo de migração:', weatherStationsPath);
            console.log('🚀 Executando SQL (weather_stations)...');
            await sql.unsafe(weatherStationsSql);
            console.log('✅ Migração weather_stations concluída!');
        }

        // Migration 19: Fix missing Centroid Column on virtual_weather_stations
        console.log('🚀 Executando SQL (centroid)...');
        await sql.unsafe('ALTER TABLE "virtual_weather_stations" ADD COLUMN IF NOT EXISTS "centroid" text;');
        console.log('✅ Migração centroid concluída via SQL direto!');

        // Migration 20: Add missing columns (centroid on farms, coordinates/centroid on farm_plots)
        const missingColumnsPath = path.join(process.cwd(), 'migration_add_missing_columns.sql');
        if (fs.existsSync(missingColumnsPath)) {
            const missingColumnsSql = fs.readFileSync(missingColumnsPath, 'utf-8');
            console.log('📄 Lendo arquivo de migração:', missingColumnsPath);
            console.log('🚀 Executando SQL (missing_columns)...');
            await sql.unsafe(missingColumnsSql);
            console.log('✅ Migração missing_columns concluída!');
        }

        const languagePath = path.join(process.cwd(), 'migration_add_language.sql');
        if (fs.existsSync(languagePath)) {
            const languageSql = fs.readFileSync(languagePath, 'utf-8');
            console.log('📄 Lendo arquivo de migração:', languagePath);
            console.log('🚀 Executando SQL (language)...');
            await sql.unsafe(languageSql);
            console.log('✅ Migração language concluída!');
        }

        // Migration 21: Add dose_per_ha to farm_applications
        const dosePerHaPath = path.join(process.cwd(), 'migration_add_dose_per_ha.sql');
        if (fs.existsSync(dosePerHaPath)) {
            const dosePerHaSql = fs.readFileSync(dosePerHaPath, 'utf-8');
            console.log('📄 Lendo arquivo de migração:', dosePerHaPath);
            console.log('🚀 Executando SQL (dose_per_ha)...');
            await sql.unsafe(dosePerHaSql);
            console.log('✅ Migração dose_per_ha concluída!');
        }

        // Migration 22: Add equipment_id to farm_expenses
        const expenseEquipPath = path.join(process.cwd(), 'migration_add_expense_equipment.sql');
        if (fs.existsSync(expenseEquipPath)) {
            const expenseEquipSql = fs.readFileSync(expenseEquipPath, 'utf-8');
            console.log('📄 Lendo arquivo de migração:', expenseEquipPath);
            console.log('🚀 Executando SQL (expense_equipment)...');
            await sql.unsafe(expenseEquipSql);
            console.log('✅ Migração expense_equipment concluída!');
        }

        // Migration 23: Add expense items table + supplier/image columns
        const expenseItemsPath = path.join(process.cwd(), 'migration_add_expense_items.sql');
        if (fs.existsSync(expenseItemsPath)) {
            const expenseItemsSql = fs.readFileSync(expenseItemsPath, 'utf-8');
            console.log('📄 Lendo arquivo de migração:', expenseItemsPath);
            console.log('🚀 Executando SQL (expense_items)...');
            await sql.unsafe(expenseItemsSql);
            console.log('✅ Migração expense_items concluída!');
        }

        // Migration 24: Cash flow tables
        const cashFlowPath = path.join(process.cwd(), 'migration_add_cash_flow.sql');
        if (fs.existsSync(cashFlowPath)) {
            const cashFlowSql = fs.readFileSync(cashFlowPath, 'utf-8');
            console.log('📄 Lendo arquivo de migração:', cashFlowPath);
            console.log('🚀 Executando SQL (cash_flow)...');
            await sql.unsafe(cashFlowSql);
            console.log('✅ Migração cash_flow concluída!');
        }

        // Migration 25: Payment status + custom categories
        const paymentCatPath = path.join(process.cwd(), 'migration_add_payment_categories.sql');
        if (fs.existsSync(paymentCatPath)) {
            const paymentCatSql = fs.readFileSync(paymentCatPath, 'utf-8');
            console.log('📄 Lendo arquivo de migração:', paymentCatPath);
            console.log('🚀 Executando SQL (payment_categories)...');
            await sql.unsafe(paymentCatSql);
            console.log('✅ Migração payment_categories concluída!');
        }
        // Migration 26: Romaneio AI Import (table + new columns)
        const romaneioImportPath = path.join(process.cwd(), 'migration_romaneio_ai_import.sql');
        if (fs.existsSync(romaneioImportPath)) {
            const romaneioImportSql = fs.readFileSync(romaneioImportPath, 'utf-8');
            console.log('📄 Lendo arquivo de migração:', romaneioImportPath);
            console.log('🚀 Executando SQL (romaneio_ai_import)...');
            await sql.unsafe(romaneioImportSql);
            console.log('✅ Migração romaneio_ai_import concluída!');
        }

        // Migration 27: Global Silos (Admin managed silos for profitability)
        const globalSilosPath = path.join(process.cwd(), 'migration_global_silos.sql');
        if (fs.existsSync(globalSilosPath)) {
            const globalSilosSql = fs.readFileSync(globalSilosPath, 'utf-8');
            console.log('📄 Lendo arquivo de migração:', globalSilosPath);
            console.log('🚀 Executando SQL (global_silos)...');
            await sql.unsafe(globalSilosSql);
            console.log('✅ Migração global_silos concluída!');
        }

        console.log('✅ Todas as migrações concluídas com sucesso!');

    } catch (error) {
        console.error('❌ Erro ao executar migração:', error);
    } finally {
        await sql.end();
    }
};

runMigration();
