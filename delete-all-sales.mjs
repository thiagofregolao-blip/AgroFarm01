import pg from 'postgres';

const sql = pg(process.env.DATABASE_URL || 'postgresql://localhost:5432/agrofarm');

console.log('🗑️  Deletando TODAS as vendas do banco de dados...\n');

try {
    const result = await sql`DELETE FROM sales`;
    console.log(`✅ ${result.count} vendas foram deletadas com sucesso!\n`);

    // Verificar se ainda restam vendas
    const remaining = await sql`SELECT COUNT(*) as count FROM sales`;
    console.log(`📊 Vendas restantes: ${remaining[0].count}`);

    if (remaining[0].count === 0) {
        console.log('\n✨ Banco de dados limpo! Agora você pode importar a planilha novamente.\n');
    } else {
        console.log('\n⚠️  Ainda restam vendas no banco. Pode haver referências ou constraints.\n');
    }

    await sql.end();
    process.exit(0);
} catch (error) {
    console.error('❌ Erro ao deletar vendas:', error);
    await sql.end();
    process.exit(1);
}
