import { db, dbReady } from './db';
import { users } from '@shared/schema';

async function listUsers() {
  await dbReady;
  
  console.log('🔍 Consultando usuários no banco de dados...\n');
  
  const allUsers = await db.select({
    id: users.id,
    username: users.username,
    name: users.name,
    role: users.role,
    managerId: users.managerId
  }).from(users);
  
  if (allUsers.length === 0) {
    console.log('❌ Nenhum usuário encontrado no banco de dados.');
    console.log('\n💡 Dica: Execute o script create-admin.ts para criar um usuário administrador.');
    process.exit(0);
  }
  
  console.log(`✅ Encontrados ${allUsers.length} usuário(s) cadastrado(s):\n`);
  console.log('┌─────────────────────────────────────────────────────────────────────────┐');
  console.log('│ ID                                    │ Username    │ Nome            │ Role          │');
  console.log('├─────────────────────────────────────────────────────────────────────────┤');
  
  allUsers.forEach((user, index) => {
    const id = user.id.substring(0, 8) + '...';
    const username = (user.username || '').padEnd(11);
    const name = (user.name || '').padEnd(15);
    const role = (user.role || '').padEnd(13);
    
    console.log(`│ ${id.padEnd(38)} │ ${username} │ ${name} │ ${role} │`);
    
    if (index < allUsers.length - 1) {
      console.log('├─────────────────────────────────────────────────────────────────────────┤');
    }
  });
  
  console.log('└─────────────────────────────────────────────────────────────────────────┘');
  console.log('\n📊 Resumo por função:');
  
  const roleCount: Record<string, number> = {};
  allUsers.forEach(user => {
    const role = user.role || 'sem função';
    roleCount[role] = (roleCount[role] || 0) + 1;
  });
  
  Object.entries(roleCount).forEach(([role, count]) => {
    console.log(`   ${role}: ${count}`);
  });
  
  process.exit(0);
}

listUsers().catch((err) => {
  console.error('❌ Erro ao consultar usuários:', err);
  process.exit(1);
});


