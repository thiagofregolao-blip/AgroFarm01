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

export { pool, db, dbReady };
