import { type Express, type Request, type Response } from "express";
import { db } from "./db";
import { eq, and, sql, desc, gte, lte, notInArray } from "drizzle-orm";
import {
    salesOrders,
    salesOrderItems,
    companyClients,
    companyUsers,
    users
} from "../shared/schema";

export function registerAdminReportRoutes(app: Express) {
    app.get("/api/company/admin-reports/dashboard", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });

            const user = req.user as any;

            // Buscar company role (não platform role)
            const [cu] = await db
                .select({ companyId: companyUsers.companyId, role: companyUsers.role })
                .from(companyUsers)
                .where(and(eq(companyUsers.userId, user.id), eq(companyUsers.isActive, true)))
                .limit(1);

            // Permite: diretor/admin da empresa OU administrador da plataforma
            const isCompanyAdmin = cu && ["director", "admin_empresa"].includes(cu.role);
            const isPlatformAdmin = user.role === "administrador";

            if (!isCompanyAdmin && !isPlatformAdmin) {
                return res.status(403).json({ error: "Acesso negado. Apenas diretoria." });
            }

            if (!cu) return res.status(403).json({ error: "Sem empresa vinculada" });

            const companyId = cu.companyId;
            const { startDate, endDate, rtvId } = req.query;

            // Filtros base: apenas pedidos não-rascunho e não-cancelados desta empresa
            const conditions: any[] = [
                eq(salesOrders.companyId, companyId),
                notInArray(salesOrders.status, ["draft", "cancelled"])
            ];

            if (startDate) {
                conditions.push(gte(salesOrders.createdAt, new Date(startDate as string)));
            }
            if (endDate) {
                // Incluir o dia inteiro da data final
                const end = new Date(endDate as string);
                end.setHours(23, 59, 59, 999);
                conditions.push(lte(salesOrders.createdAt, end));
            }
            if (rtvId && rtvId !== "all") {
                conditions.push(eq(salesOrders.consultantId, rtvId as string));
            }

            // 1. Ranking de vendas por RTV
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

            const totalRevenue = salesData.reduce((acc, curr) => acc + Number(curr.totalAmountUsd), 0);
            const totalOrders = salesData.reduce((acc, curr) => acc + Number(curr.orderCount), 0);
            const averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

            // 2. Curva ABC — Top 10 produtos
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

            // 3. Top 10 clientes
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
                kpis: { totalRevenue, totalOrders, averageTicket },
                salesByRtv: salesData,
                topProducts: productData,
                topClients: clientData,
            });

        } catch (e: any) {
            console.error("[Admin Reports Error]:", e);
            res.status(500).json({ error: "Erro interno ao gerar relatórios", details: e.message });
        }
    });
}
