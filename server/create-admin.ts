import { db, dbReady } from './db';
import { users } from '@shared/schema';
import { sql, eq } from 'drizzle-orm';
import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function createAdmin() {
  await dbReady;
  
  console.log('🔐 Criando usuário administrador...');
  
  // Verifica se já existe um usuário admin
  const existingAdmin = await db.select()
    .from(users)
    .where(eq(users.username, 'admin'));
  
  if (existingAdmin.length > 0) {
    console.log('ℹ️  Usuário admin já existe. Para redefinir a senha, delete o usuário primeiro.');
    console.log(`   Username: admin`);
    process.exit(0);
  }
  
  const password = await hashPassword('admin123');
  
  const [admin] = await db.insert(users).values({
    username: 'admin',
    password: password,
    name: 'Administrador',
    role: 'administrador'
  }).returning();
  
  console.log('✅ Usuário administrador criado com sucesso!');
  console.log('');
  console.log('📋 Credenciais de acesso:');
  console.log('   Username: admin');
  console.log('   Password: admin123');
  console.log('');
  console.log('⚠️  IMPORTANTE: Altere a senha após o primeiro login!');
  
  process.exit(0);
}

createAdmin().catch((err) => {
  console.error('❌ Erro ao criar usuário admin:', err);
  process.exit(1);
});

