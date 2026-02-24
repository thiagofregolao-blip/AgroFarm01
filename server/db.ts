import * as schema from '@shared/schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const databaseUrl = process.env.DATABASE_URL;

// Detecta se é uma URL Neon (usa WebSocket) - APENAS para neon.tech
// Railway e outros PostgreSQL padrão usam postgres-js
const isNeonUrl = databaseUrl.includes('neon.tech');

let db: any;
let pool: any;
let dbReady: Promise<void>;

if (isNeonUrl) {
  // Usa driver Neon para URLs Neon (requer inicialização assíncrona)
  dbReady = (async () => {
    const { drizzle } = await import('drizzle-orm/neon-serverless');
    const { Pool, neonConfig } = await import('@neondatabase/serverless');
    const ws = await import('ws');

    neonConfig.webSocketConstructor = ws.default;
    pool = new Pool({ connectionString: databaseUrl });
    db = drizzle(pool, { schema });
  })();
} else {
  // Usa driver postgres-js para PostgreSQL local
  dbReady = Promise.all([
    import('drizzle-orm/postgres-js'),
    import('postgres')
  ]).then(([{ drizzle }, postgres]) => {
    const sql = postgres.default(databaseUrl);
    db = drizzle(sql, { schema });
    pool = sql;
  });
}

dbReady.catch((err) => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

// Função de auto-correção de schema para produção
export async function ensureSchema() {
  await dbReady;
  console.log("Inteverificando integridade do schema (Hotfix)...");

  try {
    // 1. Garantir package_size em planning_products_base
    // Usamos raw SQL através do objeto 'pool' (postgres-js ou neon Pool)
    // Precisamos diferenciar como executar query

    // Helper para executar raw sql
    const execute = async (query: string) => {
      if (isNeonUrl) {
        return pool.query(query);
      } else {
        return pool.unsafe(query);
      }
    };

    console.log("Verificando coluna package_size...");
    await execute(`
      ALTER TABLE planning_products_base 
      ADD COLUMN IF NOT EXISTS package_size TEXT;
    `);

    // 2. Garantir tabela planning_global_configurations
    console.log("Verificando tabela planning_global_configurations...");
    await execute(`
      CREATE TABLE IF NOT EXISTS planning_global_configurations (
        id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id text,
        season_id text,
        product_ids jsonb DEFAULT '[]'::jsonb,
        updated_at timestamp DEFAULT now()
      );
    `);

    // 2.1 HOTFIX: Corrigir nome da coluna se foi criada errada (De selected_product_ids para product_ids)
    try {
      await execute(`
            ALTER TABLE planning_global_configurations 
            RENAME COLUMN selected_product_ids TO product_ids;
        `);
      console.log("✅ Coluna renomeada de selected_product_ids para product_ids");
    } catch (e) {
      // Ignora erro se coluna não existir ou já estiver correta
    }

    // 2.2 HOTFIX: Remover duplicatas antigas e adicionar constrain UNIQUE
    console.log("Removendo duplicatas de planning_global_configurations...");
    try {
      await execute(`
            WITH duplicates AS (
                SELECT id, 
                    ROW_NUMBER() OVER (
                        PARTITION BY user_id, season_id 
                        ORDER BY updated_at DESC
                    ) as rn
                FROM planning_global_configurations
            )
            DELETE FROM planning_global_configurations
            WHERE id IN (
                SELECT id FROM duplicates WHERE rn > 1
            );
        `);
      console.log("✅ Duplicatas removidas.");

      await execute(`
            ALTER TABLE planning_global_configurations 
            ADD CONSTRAINT planning_global_configurations_user_id_season_id_unique UNIQUE (user_id, season_id);
        `);
      console.log("✅ Constraint UNIQUE adicionada.");
    } catch (e: any) {
      if (e.message && e.message.includes('already exists')) {
        console.log("ℹ️ Constraint UNIQUE já existe.");
      } else {
        console.log("⚠️ erro ao limpar duplicatas/add constraint:", e.message);
      }
    }

    // 3. Garantir image_url em farm_products_catalog
    try {
      await execute(`
        ALTER TABLE farm_products_catalog 
        ADD COLUMN IF NOT EXISTS image_url TEXT;
      `);
      console.log("✅ Coluna image_url verificada.");
    } catch (e) { /* ignora se já existe */ }

    // 4. Garantir coordinates em farm_plots
    try {
      await execute(`
        ALTER TABLE farm_plots 
        ADD COLUMN IF NOT EXISTS coordinates TEXT;
      `);
      console.log("✅ Coluna coordinates verificada.");
    } catch (e) { /* ignora se já existe */ }

    // 5. Garantir status em farm_expenses
    try {
      await execute(`
        ALTER TABLE farm_expenses 
        ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'confirmed';
      `);
      console.log("✅ Coluna status em farm_expenses verificada.");
    } catch (e) { /* ignora se já existe */ }

    console.log("✅ Schema verificado/corrigido com sucesso.");
  } catch (error) {
    console.error("❌ Erro ao verificar schema:", error);
    // Não damos exit, tentamos seguir
  }
}

export { pool, db, dbReady };
