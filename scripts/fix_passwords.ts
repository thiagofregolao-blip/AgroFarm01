import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || "postgresql://localhost:5432/agrofarm",
});

async function fixPasswords() {
    console.log("Starting password fix script...");
    try {
        const res = await pool.query('SELECT id, username, password FROM users');
        let updatedCount = 0;

        for (const row of res.rows) {
            if (row.password && row.password.endsWith(' ')) {
                const trimmedPassword = row.password.trim();

                await pool.query('UPDATE users SET password = $1 WHERE id = $2', [trimmedPassword, row.id]);

                console.log(`✅ Fixed trailing space for user: ${row.username}`);
                updatedCount++;
            }
        }

        console.log(`\n🎉 Process completed! Fixed ${updatedCount} passwords affected by the trailing space bug.`);
        process.exit(0);
    } catch (error) {
        console.error("Error fixing passwords:", error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

fixPasswords();
