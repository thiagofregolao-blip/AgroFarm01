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
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid,
        season_id uuid,
        selected_product_ids jsonb DEFAULT '[]'::jsonb,
        updated_at timestamp DEFAULT now()
      );
    `);

    console.log("✅ Schema verificado/corrigido com sucesso.");
  } catch (error) {
    console.error("❌ Erro ao verificar schema:", error);
    // Não damos exit, tentamos seguir
  }
}

export { pool, db, dbReady };
