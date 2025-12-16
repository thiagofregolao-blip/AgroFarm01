
import { db, dbReady } from "../server/db";
import {
    subcategories, clients, sales, seasons, seasonGoals, categories, products,
    clientMarketRates, externalPurchases, purchaseHistory, marketBenchmarks,
    userClientLinks, masterClients, salesHistory, clientFamilyRelations,
    purchaseHistoryItems, barterSimulations, barterSimulationItems, farms,
    fields, passwordResetTokens, users, productsPriceTable,
    globalManagementApplications, clientApplicationTracking,
    insertClientApplicationTrackingSchema, clientCategoryPipeline, systemSettings
} from "../shared/schema";
import { eq, sql, and, gt, desc, inArray } from "drizzle-orm";

async function main() {
    try {
        await dbReady;
        const userId = "0fa9f9d3-2a9e-4c47-a5f9-962a589682cf";
        const seasonId = "bdf75ee5-4b45-4269-a24c-fe543bbbd593";

        console.log("Starting reproduction with User:", userId, "Season:", seasonId);

        // Get all categories
        const allCategories = await db.select().from(categories);
        console.log("Categories fetched:", allCategories.length);

        // Get user's clients with badge amarelo (includeInMarketArea) - for potential calculation
        const clientsAmarelo = await db.select({
            id: userClientLinks.id,
            name: masterClients.name,
            userArea: userClientLinks.plantingArea,
            masterArea: masterClients.plantingArea
        })
            .from(userClientLinks)
            .innerJoin(masterClients, eq(userClientLinks.masterClientId, masterClients.id))
            .where(and(
                eq(userClientLinks.userId, userId),
                eq(userClientLinks.includeInMarketArea, true)
            ));
        console.log("Clients Amarelo fetched:", clientsAmarelo.length);

        const clientAmareloIds = clientsAmarelo.map(c => c.id);

        // Get client market rates for potential calculation (badge amarelo only)
        const marketRates = clientAmareloIds.length > 0
            ? await db.select()
                .from(clientMarketRates)
                .where(and(
                    eq(clientMarketRates.userId, userId),
                    eq(clientMarketRates.seasonId, seasonId),
                    inArray(clientMarketRates.clientId, clientAmareloIds)
                ))
            : [];

        // Get ALL sales (C.Vale) for this user, regardless of badge
        const salesData = await db.select({
            categoryId: sales.categoryId,
            totalAmount: sales.totalAmount,
            clientId: sales.clientId,
            saleDate: sales.saleDate
        })
            .from(sales)
            .where(and(
                eq(sales.userId, userId),
                eq(sales.seasonId, seasonId)
            ));

        console.log(`[MARKET-CARDS] User ${userId}: Found ${salesData.length} total sales`);

        // Calculate Monthly Sales for Chart
        const monthlySalesMap = new Array(12).fill(0);
        salesData.forEach((sale: any) => {
            if (sale.saleDate) {
                const date = new Date(sale.saleDate);
                const month = date.getMonth(); // 0 = Jan, 11 = Dec
                monthlySalesMap[month] += parseFloat(sale.totalAmount || '0');
            }
        });

        const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        const monthlySales = monthlySalesMap.map((total: number, index: number) => ({
            month: monthNames[index],
            total
        }));

        // Get ALL pipeline statuses (General Categories)
        const pipelineStatuses = await db.select()
            .from(clientCategoryPipeline)
            .where(and(
                eq(clientCategoryPipeline.userId, userId),
                eq(clientCategoryPipeline.seasonId, seasonId)
            ));

        // Get ALL application tracking (Agroquimicos)
        let allApps: any[] = [];
        let validApps: any[] = [];
        try {
            allApps = await db.select({
                id: clientApplicationTracking.id,
                clientId: clientApplicationTracking.clientId,
                globalApplicationId: clientApplicationTracking.globalApplicationId,
                seasonId: clientApplicationTracking.seasonId,
                userId: clientApplicationTracking.userId,
                status: clientApplicationTracking.status,
                totalValue: clientApplicationTracking.totalValue,
                categoria: clientApplicationTracking.categoria,
                globalCategory: globalManagementApplications.categoria
            })
                .from(clientApplicationTracking)
                .leftJoin(globalManagementApplications, eq(clientApplicationTracking.globalApplicationId, globalManagementApplications.id))
                .where(and(
                    eq(clientApplicationTracking.userId, userId),
                    eq(clientApplicationTracking.seasonId, seasonId)
                ));

            // Safety: filter out any apps with missing critical data
            validApps = allApps.filter(app => {
                const hasCategoria = app.categoria || app.globalCategory;
                const hasClientId = app.clientId;
                return hasCategoria && hasClientId;
            });
        } catch (appError) {
            console.error('[MARKET-CARDS] Error fetching applications:', appError);
            // Continue with empty array if apps query fails
            validApps = [];
        }

        console.log(`[MARKET-CARDS] Pipeline Statuses: ${pipelineStatuses.length}`);
        console.log(`[MARKET-CARDS] All Apps: ${allApps.length}, Valid Apps: ${validApps.length}`);

        // Helper to differentiate Agroquimicos
        const isAgroquimico = (type: string | null | undefined) => {
            if (!type) return false;
            const t = type.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            return t === 'agroquimicos';
        };

        // Normalize category helper
        const normalizeCategoryName = (name: string | null | undefined): string => {
            if (!name) return 'Outros';
            const agroquimicoVariants = ['FUNGICIDAS', 'INSETICIDAS', 'DESSECAÇÃO', 'TRATAMENTO DE SEMENTE', 'TS'];
            if (agroquimicoVariants.includes(name.toUpperCase())) {
                return 'Agroquímicos';
            }
            return name;
        };

        const normalizeString = (str: any) => {
            if (!str) return "";
            return String(str).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        };

        // Calculate data per category
        const categoryData = new Map<string, {
            categoryId: string;
            categoryName: string;
            categoryType: string;
            potentialUsd: number;
            potentialHa: number;
            cvaleUsd: number;       // Global Sales
            cvaleMarketUsd: number; // Market Badge Clients Sales
            oportunidadesUsd: number;
            jaNegociadoUsd: number;
        }>();

        // Client Breakdown Map: ClientID -> { clientName, categories: { [catId]: { potential, sales, ops, negotiated } } }
        const clientBreakdownMap = new Map<string, {
            clientId: string;
            clientName: string;
            categories: Map<string, {
                potentialUsd: number;
                salesUsd: number;
                oportunidadesUsd: number;
                jaNegociadoUsd: number;
            }>
        }>();


        // Initialize all categories
        allCategories.forEach(cat => {
            categoryData.set(cat.id, {
                categoryId: cat.id,
                categoryName: cat.name,
                categoryType: cat.type,
                potentialUsd: 0,
                potentialHa: 0,
                cvaleUsd: 0,
                cvaleMarketUsd: 0,
                oportunidadesUsd: 0,
                jaNegociadoUsd: 0
            });
        });

        // Map Sales by Client -> Category
        const salesMap = new Map<string, Map<string, number>>();
        salesData.forEach(sale => {
            if (!sale.clientId) return;
            if (!salesMap.has(sale.clientId)) salesMap.set(sale.clientId, new Map());
            const clientSales = salesMap.get(sale.clientId)!;
            const current = clientSales.get(sale.categoryId!) || 0;
            clientSales.set(sale.categoryId!, current + parseFloat(sale.totalAmount || '0'));
        });

        // Map Pipeline Status by Client -> Category
        const pipelineMap = new Map<string, Map<string, string>>();
        pipelineStatuses.forEach(p => {
            if (!pipelineMap.has(p.clientId)) pipelineMap.set(p.clientId, new Map());
            pipelineMap.get(p.clientId)!.set(p.categoryId, p.status || 'ABERTO');
        });
        console.log(`[MARKET-CARDS] Pipeline Map Keys (Clients): ${pipelineMap.size}`);

        // 0. Calculate Global Sales (C.Vale) - All clients, regardless of badge
        salesData.forEach(sale => {
            if (!sale.categoryId) return;
            const catData = categoryData.get(sale.categoryId);
            if (catData) {
                catData.cvaleUsd += parseFloat(sale.totalAmount || '0');
            }
        });

        // map market rates
        const ratesMap = new Map<string, Map<string, typeof marketRates[0]>>();
        marketRates.forEach(r => {
            if (!ratesMap.has(r.clientId)) ratesMap.set(r.clientId, new Map());
            ratesMap.get(r.clientId)!.set(r.categoryId, r);
        });

        // 1. Process General Categories (Fertilizers, Seeds, etc.)
        clientsAmarelo.forEach(client => {
            // Initialize client breakdown entry
            if (!clientBreakdownMap.has(client.id)) {
                clientBreakdownMap.set(client.id, {
                    clientId: client.id,
                    clientName: client.name || 'Unknown Client',
                    categories: new Map()
                });
            }
            const clientEntry = clientBreakdownMap.get(client.id)!;

            allCategories.forEach(category => {
                const catData = categoryData.get(category.id);
                if (!catData) return;

                // Initialize category entry for client
                if (!clientEntry.categories.has(category.id)) {
                    clientEntry.categories.set(category.id, {
                        potentialUsd: 0,
                        salesUsd: 0,
                        oportunidadesUsd: 0,
                        jaNegociadoUsd: 0
                    });
                }
                const clientCatEntry = clientEntry.categories.get(category.id)!;

                const rate = ratesMap.get(client.id)?.get(category.id);

                // Calculate Potential
                let potentialValue = 0;
                let area = parseFloat(client.userArea || client.masterArea || '0');

                if (rate) {
                    const investmentPerHa = parseFloat(rate.investmentPerHa || '0');
                    potentialValue = area * investmentPerHa;
                    catData.potentialUsd += potentialValue;
                    catData.potentialHa += area;

                    clientCatEntry.potentialUsd += potentialValue;
                }

                // Sales for this specific client/category
                const clientSalesValue = salesMap.get(client.id)?.get(category.id) || 0;
                catData.cvaleMarketUsd += clientSalesValue;
                clientCatEntry.salesUsd += clientSalesValue;

                // Logic for Oportunidades / Já Negociado (General Categories Only)
                if (!isAgroquimico(catData.categoryType)) {
                    const residual = Math.max(0, potentialValue - clientSalesValue);
                    const status = pipelineMap.get(client.id)?.get(category.id);

                    if (status === 'FECHADO') {
                        catData.jaNegociadoUsd += residual;
                        clientCatEntry.jaNegociadoUsd += residual;
                    } else if (status === 'PARCIAL') {
                        catData.jaNegociadoUsd += residual / 2;
                        catData.oportunidadesUsd += residual / 2;
                        clientCatEntry.jaNegociadoUsd += residual / 2;
                        clientCatEntry.oportunidadesUsd += residual / 2;
                    } else {
                        // ABERTO or null
                        catData.oportunidadesUsd += residual;
                        clientCatEntry.oportunidadesUsd += residual;
                    }
                }
            });
        });

        console.log("Passed first loop (General Categories)");

        // 2. Process Agroquimicos via Application Tracking
        validApps.forEach((app, index) => {
            // Validation check for debugging
            if (!app) console.log(`App at index ${index} is undefined`);

            // Map application categoria to main category (Agroquimicos)
            if (!app.categoria && !app.globalCategory) {
                console.warn('[MARKET-CARDS] Skipping app without categoria:', app);
                return;
            }
            const normalizedName = normalizeCategoryName(app.categoria || app.globalCategory || '');
            const target = normalizeString(normalizedName);

            const category = allCategories.find(c => {
                return normalizeString(c.name) === target || normalizeString(c.type) === target;
            });

            if (category) {
                const catData = categoryData.get(category.id);

                if (catData && isAgroquimico(catData.categoryType)) {
                    // We only process apps for clients that are already in the market breakdown (80/20)
                    const clientEntry = clientBreakdownMap.get(app.clientId);

                    if (clientEntry) {
                        // Ensure category keys happen
                        if (!clientEntry.categories.has(category.id)) {
                            clientEntry.categories.set(category.id, {
                                potentialUsd: 0,
                                salesUsd: 0,
                                oportunidadesUsd: 0,
                                jaNegociadoUsd: 0
                            });
                        }
                        const clientCatEntry = clientEntry.categories.get(category.id)!;

                        const val = parseFloat(app.totalValue || '0');

                        if (app.status === 'FECHADO') {
                            catData.jaNegociadoUsd += val;
                            clientCatEntry.jaNegociadoUsd += val;
                        } else if (app.status === 'PARCIAL') {
                            catData.jaNegociadoUsd += val / 2;
                            catData.oportunidadesUsd += val / 2;
                            clientCatEntry.jaNegociadoUsd += val / 2;
                            clientCatEntry.oportunidadesUsd += val / 2;
                        } else if (app.status === 'ABERTO' || !app.status) {
                            // Treat Open or Null as "Oportunidades"
                            catData.oportunidadesUsd += val;
                            clientCatEntry.oportunidadesUsd += val;
                        }
                    } else {
                        // console.log("Client not found in Amarelo List:", app.clientId);
                    }
                }
            }
        });

        console.log("Passed second loop (Applications)");

        // Calculate Segment Breakdown for Dashboard
        const segmentBreakdown = {
            agroquimicos: {
                total: 0,
                subcategories: {} as Record<string, number>
            },
            fertilizantes: 0,
            sementes: 0,
            corretivos: 0,
            especialidades: 0
        };

        // 1. Agroquimicos Breakdown (from Applications)
        validApps.forEach(app => {
            // Safety check: skip if categoria is missing
            if (!app.categoria && !app.globalCategory) {
                return;
            }
            // Only count tracked apps that are Open or Partial (Oportunidades)
            let val = 0;
            const totalVal = parseFloat(app.totalValue || '0');

            if (app.status === 'ABERTO' || !app.status) {
                val = totalVal;
            } else if (app.status === 'PARCIAL') {
                val = totalVal / 2;
            }

            if (val > 0) {
                let subName = app.globalCategory || app.categoria || 'Outros';
                subName = subName.charAt(0).toUpperCase() + subName.slice(1).toLowerCase();

                segmentBreakdown.agroquimicos.total += val;
                segmentBreakdown.agroquimicos.subcategories[subName] = (segmentBreakdown.agroquimicos.subcategories[subName] || 0) + val;
            }
        });

        console.log("Reproduction Finished Logic. Testing JSON Serialization...");

        const cards = Array.from(categoryData.values())
            .filter(cat => cat.potentialUsd > 0 || cat.cvaleUsd > 0 || cat.oportunidadesUsd > 0 || cat.jaNegociadoUsd > 0)
            .map(cat => {
                const totalCapturedUsd = cat.cvaleUsd + cat.jaNegociadoUsd;
                const penetrationPercent = cat.potentialUsd > 0
                    ? (totalCapturedUsd / cat.potentialUsd) * 100
                    : 0;

                return {
                    categoryId: cat.categoryId,
                    categoryName: cat.categoryName,
                    categoryType: cat.categoryType,
                    potentialUsd: cat.potentialUsd,
                    potentialHa: cat.potentialHa,
                    cvaleUsd: cat.cvaleUsd,
                    oportunidadesUsd: cat.oportunidadesUsd,
                    jaNegociadoUsd: cat.jaNegociadoUsd,
                    totalCapturedUsd,
                    penetrationPercent: Math.min(penetrationPercent, 100)
                };
            });

        const clientBreakdown = Array.from(clientBreakdownMap.values()).map(client => ({
            clientId: client.clientId,
            clientName: client.clientName,
            categories: Object.fromEntries(
                Array.from(client.categories.entries()).map(([catId, data]) => [catId, data])
            )
        }));

        const finalPayload = {
            cards,
            clientBreakdown,
            monthlySales,
            segmentBreakdown
        };

        const json = JSON.stringify(finalPayload);
        console.log("Full JSON Serialization Successful. Length:", json.length);

    } catch (error) {
        console.error("CRASH DETECTED:");
        console.error(error);
    }
}

main();
