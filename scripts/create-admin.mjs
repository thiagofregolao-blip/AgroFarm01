import { scryptSync, randomBytes } from "crypto";
import postgres from "postgres";

function mustGetEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} não está definido`);
  return v;
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const buf = scryptSync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}

async function main() {
  const DATABASE_URL = mustGetEnv("DATABASE_URL");
  const username = process.env.ADMIN_USERNAME || "admin";
  const plainPassword = process.env.ADMIN_PASSWORD || "admin123";
  const createIfMissing = (process.env.ADMIN_CREATE_IF_MISSING || "").toLowerCase() === "true";
  const updateProfile = (process.env.ADMIN_UPDATE_PROFILE || "").toLowerCase() === "true";
  const name = process.env.ADMIN_NAME || "Administrador";
  const role = process.env.ADMIN_ROLE || "administrador";

  const sql = postgres(DATABASE_URL, {
    ssl: "require",
    max: 1,
  });

  try {
    // Verifica se a tabela existe (mensagem mais amigável)
    const [{ exists }] = await sql`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'users'
      ) AS exists
    `;
    if (!exists) {
      throw new Error(
        "Tabela users não existe. Rode primeiro `npm run db:push` (ou aplique migrations) apontando para este DATABASE_URL."
      );
    }

    const password = hashPassword(plainPassword);

    const existing = await sql`
      SELECT id, username, role
      FROM users
      WHERE username = ${username}
      LIMIT 1
    `;

    if (existing.length > 0) {
      const userId = existing[0].id;
      if (updateProfile) {
        await sql`
          UPDATE users
          SET password = ${password}, name = ${name}, role = ${role}
          WHERE id = ${userId}
        `;
      } else {
        await sql`
          UPDATE users
          SET password = ${password}
          WHERE id = ${userId}
        `;
      }
      console.log("✅ Usuário atualizado com sucesso:");
      console.log(`   Username: ${username}`);
      console.log("⚠️  Senha foi redefinida para o valor informado em ADMIN_PASSWORD.");
    } else {
      if (!createIfMissing) {
        throw new Error(
          `Usuário '${username}' não existe neste banco. Verifique se o DATABASE_URL aponta para o Neon correto. ` +
            `Se você realmente quiser criar, rode com ADMIN_CREATE_IF_MISSING=true.`
        );
      }

      await sql`
        INSERT INTO users (username, password, name, role)
        VALUES (${username}, ${password}, ${name}, ${role})
      `;
      console.log("✅ Usuário criado com sucesso:");
      console.log(`   Username: ${username}`);
      console.log("⚠️  Senha foi definida para o valor informado em ADMIN_PASSWORD.");
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error("❌ Falha ao criar/atualizar admin:", err?.message || err);
  process.exit(1);
});


