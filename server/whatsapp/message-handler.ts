/**
 * Handler para processar intenções e executar queries no banco de dados
 */

import { db } from "../db";
import { farmStock, farmExpenses, farmInvoices, farmApplications, farmProperties, farmPlots, farmProductsCatalog } from "../../shared/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import type { QueryIntent } from "./gemini-client";

export class MessageHandler {
  /**
   * Executa query baseada na intenção identificada
   */
  async executeQuery(intent: QueryIntent, userId: string): Promise<any> {
    switch (intent.entity) {
      case "stock":
        return this.getStock(userId);
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

  private async getStock(userId: string) {
    const stock = await db
      .select({
        productId: farmStock.productId,
        quantity: farmStock.quantity,
        productName: farmProductsCatalog.name,
        unit: farmProductsCatalog.unit,
      })
      .from(farmStock)
      .innerJoin(farmProductsCatalog, eq(farmStock.productId, farmProductsCatalog.id))
      .where(eq(farmStock.farmerId, userId))
      .orderBy(desc(farmStock.updatedAt));

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

    const expenses = await query.orderBy(desc(farmExpenses.expenseDate)).limit(20);

    return expenses;
  }

  private async getInvoices(userId: string, filters?: Record<string, any>) {
    const invoices = await db
      .select()
      .from(farmInvoices)
      .where(eq(farmInvoices.farmerId, userId))
      .orderBy(desc(farmInvoices.issueDate))
      .limit(20);

    return invoices;
  }

  private async getApplications(userId: string, filters?: Record<string, any>) {
    const applications = await db
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
      .where(eq(farmApplications.farmerId, userId))
      .orderBy(desc(farmApplications.appliedAt))
      .limit(20);

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
