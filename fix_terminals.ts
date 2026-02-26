import { db } from './server/db';
import { farmPdvTerminals } from './shared/schema';
import { eq, ilike, or } from 'drizzle-orm';

async function fix() {
  console.log('Fixing terminals...');
  await db.update(farmPdvTerminals)
    .set({ type: 'diesel' })
    .where(
      or(
        ilike(farmPdvTerminals.name, '%diesel%'),
        ilike(farmPdvTerminals.name, '%bomba%'),
        ilike(farmPdvTerminals.name, '%combust%')
      )
    );
  console.log('Done!');
  process.exit(0);
}

fix().catch(console.error);
