import { db } from "../db";
import { farmStock, farmExpenses, farmInvoices, farmInvoiceItems, farmApplications, farmProperties, farmPlots, farmProductsCatalog } from "../../shared/schema";
import { eq, and, gte, lte, desc, ilike, or, sql } from "drizzle-orm";
import type { QueryIntent } from "./gemini-client";

export class MessageHandler {
  /**
   * Executa query baseada na intenção identificada
   */
  async executeQuery(intent: QueryIntent, userId: string): Promise<any> {
    switch (intent.entity) {
      case "stock":
        return this.getStock(userId, intent.filters);
      case "expenses":
        return this.getExpenses(userId, intent.filters);
      case "invoices":
        return this.getInvoices(userId, intent.filters);
      case "applications":
        return this.getApplications(userId, intent.filters);
      case "properties":
        return this.getProperties(userId);
      case "plots":
        return this.getPlots(userId, intent.filters);
      default:
        return null;
    }
  }

  private async getStock(userId: string, filters?: Record<string, any>) {
    let query = db
      .select({
        productId: farmStock.productId,
        quantity: farmStock.quantity,
        productName: farmProductsCatalog.name,
        activeIngredient: farmProductsCatalog.activeIngredient,
        category: farmProductsCatalog.category,
        unit: farmProductsCatalog.unit,
        averageCost: farmStock.averageCost,
      })
      .from(farmStock)
      .innerJoin(farmProductsCatalog, eq(farmStock.productId, farmProductsCatalog.id))
      .where(eq(farmStock.farmerId, userId));

    if (filters?.product) {
      console.log(`[MessageHandler] Searching stock for product: '${filters.product}'`);
      const cleanTerm = filters.product.replace(/[^a-zA-Z0-9]/g, "");
      console.log(`[MessageHandler] Clean term: '${cleanTerm}'`);
      query = query.where(
        and(
          eq(farmStock.farmerId, userId),
          or(
            ilike(farmProductsCatalog.name, `%${cleanTerm}%`), // Buscando pelo termo limpo no nome
            ilike(farmProductsCatalog.name, `%${filters.product}%`), // Buscando pelo termo original no nome
            ilike(farmProductsCatalog.activeIngredient, `%${filters.product}%`),
            ilike(farmProductsCatalog.category, `%${filters.product}%`),
            // Busca normalizada para ignorar símbolos (ex: "2,4-D" vs "24d")
            sql`regexp_replace(${farmProductsCatalog.name}, '[^a-zA-Z0-9]', '', 'g') ILIKE ${`%${cleanTerm}%`}`
          )
        )
      );
    }

    if (filters?.category) {
      query = query.where(ilike(farmProductsCatalog.category, `%${filters.category}%`));
    }

    const stock = await query.orderBy(desc(farmStock.updatedAt));
    console.log(`[MessageHandler] Clean term: '${filters?.product || 'N/A'}' - Stock found: ${stock.length}`);

    // Enrich stock with last purchase price
    const stockWithPrice = await Promise.all(stock.map(async (item) => {
      // Buscar última compra deste produto
      const lastPurchase = await db
        .select({
          unitPrice: farmInvoiceItems.unitPrice,
          issueDate: farmInvoices.issueDate
        })
        .from(farmInvoiceItems)
        .innerJoin(farmInvoices, eq(farmInvoices.id, farmInvoiceItems.invoiceId))
        .where(
          and(
            eq(farmInvoices.farmerId, userId),
            eq(farmInvoiceItems.productId, item.productId)
          )
        )
        .orderBy(desc(farmInvoices.issueDate))
        .limit(1);

      return {
        productName: item.productName,
        activeIngredient: item.activeIngredient,
        quantity: item.quantity,
        unit: item.unit,
        averageCost: item.averageCost, // Added average cost
        lastPrice: lastPurchase[0]?.unitPrice || null,
        lastPriceDate: lastPurchase[0]?.issueDate || null
      };
    }));

    return stockWithPrice;
  }

  private async getExpenses(userId: string, filters?: Record<string, any>) {
    let query = db
      .select()
      .from(farmExpenses)
      .where(eq(farmExpenses.farmerId, userId));

    // Aplicar filtros de data se existirem
    if (filters?.period === "month" || filters?.period === "mês") {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      query = query.where(and(eq(farmExpenses.farmerId, userId), gte(farmExpenses.expenseDate, startOfMonth)));
    }

    if (filters?.category) {
      query = query.where(and(eq(farmExpenses.farmerId, userId), ilike(farmExpenses.category, `%${filters.category}%`)));
    }

    // Fallback: se pediu "gastos com X" mas não é categoria, tenta descrição
    if (filters?.product && !filters?.category) {
      const cleanTerm = filters.product.replace(/[^a-zA-Z0-9]/g, "");
      query = query.where(
        and(
          eq(farmExpenses.farmerId, userId),
          or(
            ilike(farmExpenses.description, `%${cleanTerm}%`),
            ilike(farmExpenses.description, `%${filters.product}%`),
            ilike(farmExpenses.category, `%${filters.product}%`)
          )
        )
      );
    }



    const expenses = await query.orderBy(desc(farmExpenses.expenseDate)).limit(20);

    // Fallback Inteligente:
    // Se não achou despesas, mas tem filtro de produto, pode ser que o usuário
    // esteja perguntando "quanto paguei no X" (que é uma fatura/invoice),
    // mas o Gemini classificou como "expense".
    if (expenses.length === 0 && filters?.product) {
      console.log(`[MessageHandler] Sem despesas para '${filters.product}'. Tentando buscar em Invoices...`);
      return this.getInvoices(userId, filters);
    }

    return expenses;
  }

  private async getInvoices(userId: string, filters?: Record<string, any>) {
    // Se tem filtro de produto, faz join com items
    if (filters?.product) {
      const invoicesWithItems = await db
        .select({
          invoiceNumber: farmInvoices.invoiceNumber,
          issueDate: farmInvoices.issueDate,
          supplier: farmInvoices.supplier,
          productName: farmInvoiceItems.productName,
          quantity: farmInvoiceItems.quantity,
          unitPrice: farmInvoiceItems.unitPrice,
          totalPrice: farmInvoiceItems.totalPrice,
          unit: farmInvoiceItems.unit
        })
        .from(farmInvoices)
        .innerJoin(farmInvoiceItems, eq(farmInvoices.id, farmInvoiceItems.invoiceId))
        .leftJoin(farmProductsCatalog, eq(farmInvoiceItems.productId, farmProductsCatalog.id))
        .where(
          and(
            eq(farmInvoices.farmerId, userId),
            or(
              ilike(farmInvoiceItems.productName, `%${filters.product.replace(/[^a-zA-Z0-9]/g, "")}%`),
              ilike(farmInvoiceItems.productName, `%${filters.product}%`),
              ilike(farmProductsCatalog.name, `%${filters.product}%`),
              ilike(farmProductsCatalog.activeIngredient, `%${filters.product}%`),
              ilike(farmProductsCatalog.category, `%${filters.product}%`),
              // Busca normalizada por fornecedor (remove caracteres especiais) para encontrar "C.Vale" com "cvale"
              ilike(farmInvoices.supplier, `%${filters.product}%`),
              sql`regexp_replace(${farmInvoices.supplier}, '[^a-zA-Z0-9]', '', 'g') ILIKE ${`%${filters.product.replace(/[^a-zA-Z0-9]/g, "")}%`}`
            )
          )
        )
        .orderBy(desc(farmInvoices.issueDate))
        .limit(10);

      return invoicesWithItems;
    }

    // Consulta normal de faturas
    const invoices = await db
      .select({
        id: farmInvoices.id,
        invoiceNumber: farmInvoices.invoiceNumber,
        supplier: farmInvoices.supplier,
        issueDate: farmInvoices.issueDate,
        totalAmount: farmInvoices.totalAmount,
        status: farmInvoices.status,
        currency: farmInvoices.currency,
      })
      .from(farmInvoices)
      .where(eq(farmInvoices.farmerId, userId))
      .orderBy(desc(farmInvoices.issueDate))
      .limit(20);

    return invoices;
  }

  private async getApplications(userId: string, filters?: Record<string, any>) {
    let query = db
      .select({
        id: farmApplications.id,
        productId: farmApplications.productId,
        productName: farmProductsCatalog.name,
        plotName: farmPlots.name,
        quantity: farmApplications.quantity,
        appliedAt: farmApplications.appliedAt,
        unit: farmProductsCatalog.unit,
      })
      .from(farmApplications)
      .innerJoin(farmProductsCatalog, eq(farmApplications.productId, farmProductsCatalog.id))
      .innerJoin(farmPlots, eq(farmApplications.plotId, farmPlots.id))
      .where(eq(farmApplications.farmerId, userId));

    if (filters?.product) {
      const cleanTerm = filters.product.replace(/[^a-zA-Z0-9]/g, "");
      query = query.where(
        and(
          eq(farmApplications.farmerId, userId),
          or(
            ilike(farmProductsCatalog.name, `%${cleanTerm}%`),
            ilike(farmProductsCatalog.name, `%${filters.product}%`),
            ilike(farmProductsCatalog.activeIngredient, `%${filters.product}%`),
            ilike(farmProductsCatalog.category, `%${filters.product}%`)
          )
        )
      );
    }

    const applications = await query.orderBy(desc(farmApplications.appliedAt)).limit(20);

    return applications;
  }

  private async getProperties(userId: string) {
    const properties = await db
      .select()
      .from(farmProperties)
      .where(eq(farmProperties.farmerId, userId))
      .orderBy(farmProperties.name);

    return properties;
  }

  private async getPlots(userId: string, filters?: Record<string, any>) {
    const plots = await db
      .select({
        id: farmPlots.id,
        name: farmPlots.name,
        areaHa: farmPlots.areaHa,
        propertyName: farmProperties.name,
      })
      .from(farmPlots)
      .innerJoin(farmProperties, eq(farmPlots.propertyId, farmProperties.id))
      .where(eq(farmProperties.farmerId, userId))
      .orderBy(farmPlots.name);

    return plots;
  }
}
