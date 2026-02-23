import { db, dbReady } from './server/db';
import { farmInvoiceItems, farmInvoices, farmProductsCatalog } from './shared/schema';
import { ilike, and, or, eq, sql } from 'drizzle-orm';

async function check() {
  await dbReady;
  const filters = { product: "SPHERE MAX" };

  const invoicesWithItems = await db
    .select({
      invoiceNumber: farmInvoices.invoiceNumber,
      productName: farmInvoiceItems.productName,
    })
    .from(farmInvoices)
    .innerJoin(farmInvoiceItems, eq(farmInvoices.id, farmInvoiceItems.invoiceId))
    .leftJoin(farmProductsCatalog, eq(farmInvoiceItems.productId, farmProductsCatalog.id))
    .where(
      or(
        ilike(farmInvoiceItems.productName, `%${filters.product.replace(/[^a-zA-Z0-9]/g, "")}%`),
        ilike(farmInvoiceItems.productName, `%${filters.product}%`),
        ilike(farmProductsCatalog.name, `%${filters.product}%`),
        ilike(farmProductsCatalog.activeIngredient, `%${filters.product}%`),
        ilike(farmProductsCatalog.category, `%${filters.product}%`),
        sql`regexp_replace(${farmProductsCatalog.name}, '[^a-zA-Z0-9]', '', 'g') ILIKE ${`%${filters.product.replace(/[^a-zA-Z0-9]/g, "")}%`}`,
        sql`regexp_replace(${farmProductsCatalog.activeIngredient}, '[^a-zA-Z0-9]', '', 'g') ILIKE ${`%${filters.product.replace(/[^a-zA-Z0-9]/g, "")}%`}`,
        sql`regexp_replace(${farmInvoiceItems.productName}, '[^a-zA-Z0-9]', '', 'g') ILIKE ${`%${filters.product.replace(/[^a-zA-Z0-9]/g, "")}%`}`,
        ilike(farmInvoices.supplier, `%${filters.product}%`),
        sql`regexp_replace(${farmInvoices.supplier}, '[^a-zA-Z0-9]', '', 'g') ILIKE ${`%${filters.product.replace(/[^a-zA-Z0-9]/g, "")}%`}`
      )
    );
  
  console.log('Results using exact logic:', invoicesWithItems);
  process.exit(0);
}
check();
