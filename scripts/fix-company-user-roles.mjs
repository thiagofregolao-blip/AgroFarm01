import pkg from 'pg';
import { config } from 'dotenv';
config();

const { Pool } = pkg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function fixCompanyUserRoles() {
    console.log("🔧 Corrigindo platform roles de usuários da empresa...");
    try {
        // Busca todos os userIds que estão na tabela company_users
        const companyUsersResult = await pool.query(
            'SELECT DISTINCT user_id FROM company_users'
        );
        const userIds = companyUsersResult.rows.map(r => r.user_id);

        if (userIds.length === 0) {
            console.log("Nenhum usuário de empresa encontrado.");
            return;
        }

        console.log(`Encontrados ${userIds.length} usuários na empresa.`);

        // Mostra estado atual antes da correção
        const before = await pool.query(
            `SELECT id, username, role FROM users WHERE id = ANY($1::text[]) ORDER BY username`,
            [userIds]
        );
        console.log("\nEstado ANTES da correção:");
        before.rows.forEach(u => console.log(`  - ${u.username}: role=${u.role}`));

        // Atualiza para 'rtv' todos que não são administrador e não são já 'rtv'
        const result = await pool.query(
            `UPDATE users SET role = 'rtv'
             WHERE id = ANY($1::text[])
               AND role NOT IN ('administrador', 'rtv')
             RETURNING id, username, role`,
            [userIds]
        );

        console.log(`\n✅ ${result.rows.length} usuário(s) corrigido(s):`);
        result.rows.forEach(u => console.log(`  - ${u.username}: agora role=${u.role}`));

        if (result.rows.length === 0) {
            console.log("  (nenhum precisava de correção)");
        }

    } catch (err) {
        console.error("❌ Erro:", err.message);
    } finally {
        await pool.end();
    }
}

fixCompanyUserRoles();
