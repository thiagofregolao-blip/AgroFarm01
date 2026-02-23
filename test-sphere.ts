import { db } from './server/db';
import { farmInvoiceItems, farmInvoices, farmProductsCatalog } from './shared/schema';
import { ilike, and, or, eq, sql } from 'drizzle-orm';

async function check() {
  const searchTerm = 'SPHERE MAX';
  const cleanTerm = searchTerm.replace(/[^a-zA-Z0-9]/g, "");
  
  const invoicesWithItems = await db
    .select({
      invoiceNumber: farmInvoices.invoiceNumber,
      productName: farmInvoiceItems.productName,
      catalogName: farmProductsCatalog.name
    })
    .from(farmInvoices)
    .innerJoin(farmInvoiceItems, eq(farmInvoices.id, farmInvoiceItems.invoiceId))
    .leftJoin(farmProductsCatalog, eq(farmInvoiceItems.productId, farmProductsCatalog.id))
    .where(
      or(
        ilike(farmInvoiceItems.productName, `%${cleanTerm}%`),
        ilike(farmInvoiceItems.productName, `%${searchTerm}%`),
        ilike(farmProductsCatalog.name, `%${searchTerm}%`)
      )
    );
  
  console.log('Results using exact logic from message-handler:', invoicesWithItems);

  const rawInvoices = await db.select({
      invoiceNumber: farmInvoices.invoiceNumber,
      productName: farmInvoiceItems.productName,
  }).from(farmInvoices).innerJoin(farmInvoiceItems, eq(farmInvoices.id, farmInvoiceItems.invoiceId)).where(ilike(farmInvoiceItems.productName, '%SPHERE%'));
  
  console.log('Results with just %SPHERE%:', rawInvoices);
  
  process.exit(0);
}
check();
