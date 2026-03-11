import { type Express, type Request, type Response } from "express";
import { db } from "./db";
import { eq, and, sql, desc, gte, lte, notInArray } from "drizzle-orm";
import { 
    salesOrders, 
    salesOrderItems, 
    companyClients,
    companyProducts,
    users
} from "../shared/schema";
import { getCompanyId } from "./commercial-routes";

export function registerAdminReportRoutes(app: Express) {
    app.get("/api/company/admin-reports/dashboard", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            
            const user = req.user as any;
            
            // Apenas diretores/admins podem acessar
            if (!["director", "admin_empresa", "administrador"].includes(user.role)) {
                return res.status(403).json({ error: "Acesso negado. Apenas diretoria." });
            }

            const companyId = await getCompanyId(user.id);
            if (!companyId) return res.status(403).json({ error: "Sem empresa vinculada" });

            const { startDate, endDate, rtvId } = req.query;

            // Filtros base para as consultas
            const conditions = [
                eq(salesOrders.companyId, companyId),
                notInArray(salesOrders.status, ["draft", "cancelled"])
            ];
            
            if (startDate) conditions.push(gte(salesOrders.createdAt, new Date(startDate as string)));
            if (endDate) conditions.push(lte(salesOrders.createdAt, new Date(endDate as string)));
            if (rtvId) conditions.push(eq(salesOrders.consultantId, rtvId as string));

            // 1. Dados de Vendas (Resumo e Ranking de RTVs)
            const salesData = await db.select({
                rtvId: salesOrders.consultantId,
                rtvName: users.name,
                totalAmountUsd: sql<number>`COALESCE(SUM(${salesOrders.totalAmountUsd}), 0)::numeric`,
                orderCount: sql<number>`COUNT(${salesOrders.id})::int`
            })
            .from(salesOrders)
            .leftJoin(users, eq(users.id, salesOrders.consultantId))
            .where(and(...conditions))
            .groupBy(salesOrders.consultantId, users.name)
            .orderBy(desc(sql`SUM(${salesOrders.totalAmountUsd})`));

            // Calcular os KPIs principais baseados no salesData
            const totalRevenue = salesData.reduce((acc: number, curr: any) => acc + Number(curr.totalAmountUsd), 0);
            const totalOrders = salesData.reduce((acc: number, curr: any) => acc + Number(curr.orderCount), 0);
            const averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

            // 2. Curva ABC de Produtos (Top 10)
            const productData = await db.select({
                productId: salesOrderItems.productId,
                productName: salesOrderItems.productName,
                totalQuantity: sql<number>`COALESCE(SUM(${salesOrderItems.quantity}), 0)::numeric`,
                totalAmountUsd: sql<number>`COALESCE(SUM(${salesOrderItems.totalPriceUsd}), 0)::numeric`
            })
            .from(salesOrderItems)
            .innerJoin(salesOrders, eq(salesOrderItems.orderId, salesOrders.id))
            .where(and(...conditions))
            .groupBy(salesOrderItems.productId, salesOrderItems.productName)
            .orderBy(desc(sql`SUM(${salesOrderItems.totalPriceUsd})`))
            .limit(10);

            // 3. Ranking de Clientes (Top 10)
            const clientData = await db.select({
                clientId: salesOrders.clientId,
                clientName: companyClients.name,
                totalAmountUsd: sql<number>`COALESCE(SUM(${salesOrders.totalAmountUsd}), 0)::numeric`,
                orderCount: sql<number>`COUNT(${salesOrders.id})::int`
            })
            .from(salesOrders)
            .leftJoin(companyClients, eq(companyClients.id, salesOrders.clientId))
            .where(and(...conditions))
            .groupBy(salesOrders.clientId, companyClients.name)
            .orderBy(desc(sql`SUM(${salesOrders.totalAmountUsd})`))
            .limit(10);

            res.json({
                kpis: {
                    totalRevenue,
                    totalOrders,
                    averageTicket
                },
                salesByRtv: salesData,
                topProducts: productData,
                topClients: clientData
            });

        } catch (e: any) {
            console.error("[Admin Reports Error]:", e);
            res.status(500).json({ error: "Erro interno ao gerar relatórios", details: e.message });
        }
    });
}
