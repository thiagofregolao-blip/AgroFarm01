
import { db, dbReady } from './server/db';
import { users, seasons } from '@shared/schema';
import { importExcelFile } from './server/import-excel';
import fs from 'fs';

async function main() {
    console.log('🔄 Inicializando importação manual...');
    await dbReady;

    // 1. Encontrar usuário
    // Tentar encontrar um usuário com "Thiago" no nome, ou pegar o primeiro disponível
    const allUsers = await db.select().from(users);
    let user = allUsers.find(u => u.name.toLowerCase().includes('thiago') || u.username.toLowerCase().includes('thiago'));

    if (!user && allUsers.length > 0) {
        user = allUsers[0];
        console.log('⚠️ Usuário Thiago não encontrado, usando o primeiro disponível.');
    }

    if (!user) {
        console.error('❌ ERRO: Nenhum usuário encontrado no banco de dados!');
        process.exit(1);
    }
    console.log(`👤 Usuário selecionado: ${user.name} (${user.id})`);

    // 2. Encontrar Safra
    const allSeasons = await db.select().from(seasons);
    const season = allSeasons[0];
    if (!season) {
        console.error('❌ ERRO: Nenhuma safra encontrada!');
        process.exit(1);
    }
    console.log(`📅 Safra selecionada: ${season.name} (${season.id})`);

    // 3. Ler Arquivo
    const fileName = 'safra tiago.xls';
    if (!fs.existsSync(fileName)) {
        console.error(`❌ ERRO: Arquivo ${fileName} não encontrado!`);
        process.exit(1);
    }
    console.log(`📂 Lendo arquivo: ${fileName}`);
    const buffer = fs.readFileSync(fileName);

    // 4. Executar Importação
    console.log('🚀 Executando importExcelFile diretamenta (código do disco)...');
    const result = await importExcelFile(buffer, season.id, user.id);

    console.log('\n📊 RESULTADO DA IMPORTAÇÃO:');
    console.log(JSON.stringify(result, null, 2));

    if (result.importedSales > 120) {
        console.log('\n✅ SUCESSO! Importação completa realizada.');
    } else {
        console.log('\n⚠️ AVISO: Número de vendas importadas (' + result.importedSales + ') parece baixo. Verifique se a lógica de duplicatas foi corrigida.');
    }

    process.exit(0);
}

main().catch(err => {
    console.error('❌ Erro fatal no script:', err);
    process.exit(1);
});
