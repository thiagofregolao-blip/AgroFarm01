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
        unit: farmProductsCatalog.unit,
      })
      .from(farmStock)
      .innerJoin(farmProductsCatalog, eq(farmStock.productId, farmProductsCatalog.id))
      .where(eq(farmStock.farmerId, userId));

    if (filters?.product) {
      const cleanTerm = filters.product.replace(/[^a-zA-Z0-9]/g, "");
      query = query.where(
        and(
          eq(farmStock.farmerId, userId),
          sql`regexp_replace(${farmProductsCatalog.name}, '[^a-zA-Z0-9]', '', 'g') ILIKE ${`%${cleanTerm}%`}`
        )
      );
    }

    const stock = await query.orderBy(desc(farmStock.updatedAt));

    return stock.map((item) => ({
      productName: item.productName,
      quantity: item.quantity,
      unit: item.unit,
    }));
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
            ilike(farmExpenses.description, `%${filters.product}%`),
            ilike(farmExpenses.category, `%${filters.product}%`),
            sql`regexp_replace(${farmExpenses.description}, '[^a-zA-Z0-9]', '', 'g') ILIKE ${`%${cleanTerm}%`}`
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
        .where(
          and(
            eq(farmInvoices.farmerId, userId),
            sql`regexp_replace(${farmInvoiceItems.productName}, '[^a-zA-Z0-9]', '', 'g') ILIKE ${`%${filters.product.replace(/[^a-zA-Z0-9]/g, "")}%`}`
          )
        )
        .orderBy(desc(farmInvoices.issueDate))
        .limit(10);

      return invoicesWithItems;
    }

    // Consulta normal de faturas
    const invoices = await db
      .select()
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
          sql`regexp_replace(${farmProductsCatalog.name}, '[^a-zA-Z0-9]', '', 'g') ILIKE ${`%${cleanTerm}%`}`
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
