import { db, dbReady } from './server/db';
import { users } from './shared/schema';
import { eq, or, ilike } from 'drizzle-orm';

async function check() {
  await dbReady;
  const allUsers = await db.select({
    id: users.id,
    name: users.name,
    role: users.role,
    manager_id: users.managerId,
    phone: users.whatsapp_number,
    extra: users.whatsapp_extra_numbers
  }).from(users).where(or(ilike(users.whatsapp_number, '%595986848326%'), ilike(users.whatsapp_extra_numbers, '%595986848326%')));
  
  console.log("Sergio Record:", allUsers);
  process.exit(0);
}
check();
