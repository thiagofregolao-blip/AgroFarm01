import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, integer, timestamp, boolean, jsonb, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const session = pgTable("session", {
  sid: varchar("sid").primaryKey(),
  sess: jsonb("sess").notNull(),
  expire: timestamp("expire").notNull(),
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("consultor"), // consultor, gerente, administrador, faturista
  managerId: varchar("manager_id").references((): any => users.id), // gerente responsável (apenas para consultores)
  whatsapp_number: text("whatsapp_number"), // Número de WhatsApp para integração
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  usedAt: timestamp("used_at"),
});

export const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(), // fertilizantes, sementes, especialidades, agroquimicos
  greenCommission: decimal("green_commission", { precision: 5, scale: 3 }).notNull(),
  greenMarginMin: decimal("green_margin_min", { precision: 5, scale: 2 }).notNull(),
  yellowCommission: decimal("yellow_commission", { precision: 5, scale: 3 }).notNull(),
  yellowMarginMin: decimal("yellow_margin_min", { precision: 5, scale: 2 }).notNull(),
  yellowMarginMax: decimal("yellow_margin_max", { precision: 5, scale: 2 }).notNull(),
  redCommission: decimal("red_commission", { precision: 5, scale: 3 }).notNull(),
  redMarginMin: decimal("red_margin_min", { precision: 5, scale: 2 }).notNull(),
  redMarginMax: decimal("red_margin_max", { precision: 5, scale: 2 }).notNull(),
  belowListCommission: decimal("below_list_commission", { precision: 5, scale: 3 }).notNull(),
  defaultIva: decimal("default_iva", { precision: 4, scale: 2 }).notNull().default("10.00"),
});

export const subcategories = pgTable("subcategories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  categoryId: varchar("category_id").notNull().references(() => categories.id),
  displayOrder: integer("display_order").notNull().default(0),
});

export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  categoryId: varchar("category_id").notNull().references(() => categories.id),
  subcategoryId: varchar("subcategory_id").references(() => subcategories.id),
  description: text("description"),
  marca: text("marca"), // brand name (e.g., "Timac")
  packageSize: decimal("package_size", { precision: 10, scale: 2 }), // extracted from product name (e.g., 20 from "20LTS")
  segment: text("segment"), // for agrochemicals: fungicida, inseticida, herbicida, ts, outros
  timacPoints: decimal("timac_points", { precision: 10, scale: 2 }).default("0.00"), // points generated for Timac program
  isActive: boolean("is_active").notNull().default(true),
});

export const regions = pgTable("regions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  country: text("country").notNull().default("Paraguay"),
});

export const timacSettings = pgTable("timac_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consultorValue: decimal("consultor_value", { precision: 10, scale: 2 }).notNull().default("0.76"), // value per point for Consultor
  gerentesValue: decimal("gerentes_value", { precision: 10, scale: 2 }).notNull().default("0.76"), // value per point for Gerentes
  faturistasValue: decimal("faturistas_value", { precision: 10, scale: 2 }).notNull().default("0.76"), // value per point for Faturistas
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  regionId: varchar("region_id").notNull().references(() => regions.id),
  plantingArea: decimal("planting_area", { precision: 10, scale: 2 }).notNull(), // hectares
  cultures: jsonb("cultures").notNull().default("[]"), // array of strings
  plantingProgress: decimal("planting_progress", { precision: 5, scale: 2 }).notNull().default("0.00"), // percentage
  isTop80_20: boolean("is_top80_20").notNull().default(false),
  includeInMarketArea: boolean("include_in_market_area").notNull().default(false), // mark client as part of market area for potential calculations
  isActive: boolean("is_active").notNull().default(true),
  userId: varchar("user_id").references(() => users.id),
});

// Master clients database - shared across all users
export const masterClients = pgTable("master_clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  regionId: varchar("region_id").references(() => regions.id),
  plantingArea: decimal("planting_area", { precision: 10, scale: 2 }),
  cultures: jsonb("cultures").default("[]"),
  creditLine: decimal("credit_line", { precision: 12, scale: 2 }), // Linha de Crédito
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// Links users to master clients
export const userClientLinks = pgTable("user_client_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  masterClientId: varchar("master_client_id").notNull().references(() => masterClients.id, { onDelete: "cascade" }),
  customName: text("custom_name"), // optional: override master client name for this user
  plantingArea: decimal("planting_area", { precision: 10, scale: 2 }), // optional: override for this user
  cultures: jsonb("cultures"), // optional: override for this user
  plantingProgress: decimal("planting_progress", { precision: 5, scale: 2 }).default("0.00"),
  isTop80_20: boolean("is_top80_20").notNull().default(false),
  includeInMarketArea: boolean("include_in_market_area").notNull().default(false), // mark client as part of market area for potential calculations
  creditLimit: decimal("credit_limit", { precision: 12, scale: 2 }), // Deprecated but existing in DB
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const clientFamilyRelations = pgTable("client_family_relations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => userClientLinks.id, { onDelete: "cascade" }),
  relatedClientId: varchar("related_client_id").notNull().references(() => userClientLinks.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const alertSettings = pgTable("alert_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id).unique(),
  emailEnabled: boolean("email_enabled").notNull().default(false),
  notificationsEnabled: boolean("notifications_enabled").notNull().default(true),
  goalAlerts: boolean("goal_alerts").notNull().default(true),
  opportunityAlerts: boolean("opportunity_alerts").notNull().default(true),
  seasonDeadlineAlerts: boolean("season_deadline_alerts").notNull().default(true),
  goalThresholdPercent: decimal("goal_threshold_percent", { precision: 5, scale: 2 }).notNull().default("80.00"),
  email: text("email"),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const alerts = pgTable("alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: text("type").notNull(), // meta, oportunidade, prazo_safra
  title: text("title").notNull(),
  message: text("message").notNull(),
  severity: text("severity").notNull().default("info"), // info, warning, urgent
  relatedId: varchar("related_id"), // seasonId, clientId, etc
  relatedType: text("related_type"), // season, client, goal, etc
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const seasons = pgTable("seasons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // e.g., "Soja 25/26", "Milho 25/25"
  type: text("type").notNull(), // soja_verao, soja_safrinha, milho, trigo
  year: integer("year").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

export const seasonGoals = pgTable("season_goals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  seasonId: varchar("season_id").notNull().references(() => seasons.id),
  goalAmount: decimal("goal_amount", { precision: 15, scale: 2 }).notNull(),
  metaAgroquimicos: decimal("meta_agroquimicos", { precision: 15, scale: 2 }).notNull().default("0"),
  metaEspecialidades: decimal("meta_especialidades", { precision: 15, scale: 2 }).notNull().default("0"),
  metaSementesMilho: decimal("meta_sementes_milho", { precision: 15, scale: 2 }).notNull().default("0"),
  metaSementesSoja: decimal("meta_sementes_soja", { precision: 15, scale: 2 }).notNull().default("0"),
  metaSementesTrigo: decimal("meta_sementes_trigo", { precision: 15, scale: 2 }).notNull().default("0"),
  metaSementesDiversas: decimal("meta_sementes_diversas", { precision: 15, scale: 2 }).notNull().default("0"),
  metaFertilizantes: decimal("meta_fertilizantes", { precision: 15, scale: 2 }).notNull().default("0"),
  metaCorretivos: decimal("meta_corretivos", { precision: 15, scale: 2 }).notNull().default("0"),
  userId: varchar("user_id").notNull().references(() => users.id),
});

export const sales = pgTable("sales", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => userClientLinks.id),
  productId: varchar("product_id").notNull().references(() => products.id),
  categoryId: varchar("category_id").notNull().references(() => categories.id),
  seasonId: varchar("season_id").notNull().references(() => seasons.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  saleDate: timestamp("sale_date").notNull(),
  dueDate: timestamp("due_date").notNull(),
  totalAmount: decimal("total_amount", { precision: 15, scale: 2 }).notNull(), // USD
  quantity: decimal("quantity", { precision: 15, scale: 2 }), // calculated quantity (Cant. Pedido × packageSize)
  margin: decimal("margin", { precision: 5, scale: 2 }).notNull(), // percentage
  ivaRate: decimal("iva_rate", { precision: 4, scale: 2 }).notNull(),
  commissionRate: decimal("commission_rate", { precision: 5, scale: 3 }).notNull(),
  commissionAmount: decimal("commission_amount", { precision: 15, scale: 2 }).notNull(),
  commissionTier: text("commission_tier").notNull(), // verde, amarela, vermelha, abaixo_lista
  timacPoints: decimal("timac_points", { precision: 10, scale: 2 }), // Timac reward points
  isManual: boolean("is_manual").notNull().default(false),
  importBatchId: varchar("import_batch_id"),
  orderCode: varchar("order_code"), // Código do pedido da planilha (ex: "120051") para evitar duplicatas
  pdfFileName: text("pdf_file_name"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const seasonParameters = pgTable("season_parameters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(), // soja_verao, soja_safrinha, milho, trigo
  dueDateMonth: integer("due_date_month").notNull(),
  dueDateDay: integer("due_date_day").notNull(),
  labelPattern: text("label_pattern").notNull(), // e.g., "Soja {year}/{next_year}", "Milho {year}/{year}"
});

export const salesHistory = pgTable("sales_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => userClientLinks.id),
  seasonId: varchar("season_id").notNull().references(() => seasons.id),
  totalSales: decimal("total_sales", { precision: 15, scale: 2 }).notNull(),
  totalCommissions: decimal("total_commissions", { precision: 15, scale: 2 }).notNull(),
  productsSold: jsonb("products_sold").notNull().default("[]"), // array of product info
});

export const marketInvestmentRates = pgTable("market_investment_rates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  categoryId: varchar("category_id").notNull().references(() => categories.id),
  investmentPerHa: decimal("investment_per_ha", { precision: 10, scale: 2 }).notNull(), // USD per hectare
  subcategories: jsonb("subcategories"), // optional breakdown for categories like Agroquímicos
});

export const clientMarketRates = pgTable("client_market_rates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => userClientLinks.id),
  categoryId: varchar("category_id").notNull().references(() => categories.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  seasonId: varchar("season_id").notNull().references(() => seasons.id),
  investmentPerHa: decimal("investment_per_ha", { precision: 10, scale: 2 }).notNull(), // USD per hectare
  subcategories: jsonb("subcategories"), // optional breakdown for categories like Agroquímicos
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// Client Market Values - Valores da coluna "Mercado" (vendas com concorrentes)
export const clientMarketValues = pgTable("client_market_values", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => userClientLinks.id, { onDelete: "cascade" }),
  categoryId: varchar("category_id").notNull().references(() => categories.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  seasonId: varchar("season_id").notNull().references(() => seasons.id),
  marketValue: decimal("market_value", { precision: 12, scale: 2 }).notNull().default("0.00"), // valor manual ou automático de vendas perdidas para concorrentes
  subcategories: jsonb("subcategories"), // breakdown para Agroquímicos
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const marketBenchmarks = pgTable("market_benchmarks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  categoryId: varchar("category_id").notNull().references(() => categories.id),
  seasonId: varchar("season_id").notNull().references(() => seasons.id),
  marketPercentage: decimal("market_percentage", { precision: 5, scale: 2 }).notNull(), // percentage (0-100)
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const externalPurchases = pgTable("external_purchases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  clientId: varchar("client_id").notNull().references(() => userClientLinks.id),
  categoryId: varchar("category_id").notNull().references(() => categories.id),
  seasonId: varchar("season_id").notNull().references(() => seasons.id),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(), // USD amount purchased externally
  company: text("company"), // optional: name of external company
  subcategories: jsonb("subcategories"), // optional breakdown for Agroquímicos: {Dessecação: 1000, Inseticidas: 2000, etc}
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// BARTER MODULE TABLES
export const barterProducts = pgTable("barter_products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  category: text("category").notNull(), // sementes, fertilizantes, herbicidas, inseticidas, fungicidas, especialidades, tratamento_sementes, dessecacao
  principioAtivo: text("principio_ativo"), // active ingredient / technical description
  dosePerHa: text("dose_per_ha"), // dose/hectare as text (e.g., "2ml/Kg", "1Lt/Há")
  unit: text("unit").notNull(), // kg, lt, sc, etc
  fabricante: text("fabricante"), // manufacturer/brand
  priceUsd: decimal("price_usd", { precision: 10, scale: 2 }).notNull(), // default price (verde)
  priceVermelha: decimal("price_vermelha", { precision: 10, scale: 2 }), // red tier price
  priceAmarela: decimal("price_amarela", { precision: 10, scale: 2 }), // yellow tier price
  priceVerde: decimal("price_verde", { precision: 10, scale: 2 }), // green tier price
  seasonId: varchar("season_id").references(() => seasons.id), // optional: associate with specific season
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const barterSettings = pgTable("barter_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(), // sack_price, buffer_percentage, min_products, etc
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const barterSimulations = pgTable("barter_simulations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  clientId: varchar("client_id").notNull().references(() => userClientLinks.id),
  clientName: text("client_name").notNull(),
  areaHa: decimal("area_ha", { precision: 10, scale: 2 }).notNull(),
  totalUsd: decimal("total_usd", { precision: 15, scale: 2 }).notNull(),
  sackPriceUsd: decimal("sack_price_usd", { precision: 10, scale: 2 }).notNull(),
  bufferPercentage: decimal("buffer_percentage", { precision: 5, scale: 2 }).notNull(),
  grainQuantityKg: decimal("grain_quantity_kg", { precision: 15, scale: 2 }).notNull(),
  grainQuantitySacks: decimal("grain_quantity_sacks", { precision: 15, scale: 3 }).notNull(),
  status: text("status").notNull().default("draft"), // draft, approved, executed, cancelled
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const barterSimulationItems = pgTable("barter_simulation_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  simulationId: varchar("simulation_id").notNull().references(() => barterSimulations.id, { onDelete: "cascade" }),
  productId: varchar("product_id").notNull().references(() => barterProducts.id),
  productName: text("product_name").notNull(),
  category: text("category").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 3 }).notNull(),
  unit: text("unit").notNull(),
  priceUsd: decimal("price_usd", { precision: 10, scale: 2 }).notNull(),
  totalUsd: decimal("total_usd", { precision: 15, scale: 2 }).notNull(),
});

// Action Plans (Manager feature)
export const actionPlans = pgTable("action_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  managerId: varchar("manager_id").notNull().references(() => users.id),
  seasonId: varchar("season_id").notNull().references(() => seasons.id),
  title: text("title").notNull(),
  meetingDate: timestamp("meeting_date").notNull(),
  targetAmount: decimal("target_amount", { precision: 15, scale: 2 }).notNull(),
  currentAmount: decimal("current_amount", { precision: 15, scale: 2 }).notNull(),
  status: text("status").notNull().default("planejado"), // planejado, em_andamento, concluido, atrasado
  strengths: text("strengths"), // pontos fortes
  challenges: text("challenges"), // desafios
  opportunities: text("opportunities"), // oportunidades
  nextMeetingDate: timestamp("next_meeting_date"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const actionPlanItems = pgTable("action_plan_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  planId: varchar("plan_id").notNull().references(() => actionPlans.id, { onDelete: "cascade" }),
  consultorId: varchar("consultor_id").notNull().references(() => users.id),
  description: text("description").notNull(),
  categoryId: varchar("category_id").references(() => categories.id),
  clientId: varchar("client_id").references(() => userClientLinks.id),
  deadline: timestamp("deadline").notNull(),
  expectedValue: decimal("expected_value", { precision: 15, scale: 2 }).notNull(),
  actualValue: decimal("actual_value", { precision: 15, scale: 2 }),
  status: text("status").notNull().default("pendente"), // pendente, em_progresso, concluida, cancelada
  notes: text("notes"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const actionPlanParticipants = pgTable("action_plan_participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  planId: varchar("plan_id").notNull().references(() => actionPlans.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  name: true,
  role: true,
  managerId: true,
});

export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
});

export const insertSubcategorySchema = createInsertSchema(subcategories).omit({
  id: true,
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
});

export const insertRegionSchema = createInsertSchema(regions).omit({
  id: true,
});

export const insertTimacSettingsSchema = createInsertSchema(timacSettings).omit({
  id: true,
  updatedAt: true,
});

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
});

export const insertSeasonSchema = createInsertSchema(seasons).omit({
  id: true,
});

export const insertSeasonGoalSchema = z.object({
  seasonId: z.string(),
  goalAmount: z.string(),
  metaAgroquimicos: z.string().optional(),
  metaEspecialidades: z.string().optional(),
  metaSementesMilho: z.string().optional(),
  metaSementesSoja: z.string().optional(),
  metaSementesTrigo: z.string().optional(),
  metaSementesDiversas: z.string().optional(),
  metaFertilizantes: z.string().optional(),
  metaCorretivos: z.string().optional(),
  userId: z.string(),
});

export const insertSaleSchema = createInsertSchema(sales).omit({
  id: true,
  createdAt: true,
});

export const insertSeasonParameterSchema = createInsertSchema(seasonParameters).omit({
  id: true,
});

export const insertMarketInvestmentRateSchema = createInsertSchema(marketInvestmentRates).omit({
  id: true,
});

export const insertClientMarketRateSchema = createInsertSchema(clientMarketRates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertClientMarketValueSchema = createInsertSchema(clientMarketValues).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMarketBenchmarkSchema = createInsertSchema(marketBenchmarks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertExternalPurchaseSchema = createInsertSchema(externalPurchases).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertClientFamilyRelationSchema = createInsertSchema(clientFamilyRelations).omit({
  id: true,
  createdAt: true,
});

export const insertAlertSettingsSchema = createInsertSchema(alertSettings).omit({
  id: true,
  updatedAt: true,
});

export const insertAlertSchema = createInsertSchema(alerts).omit({
  id: true,
  createdAt: true,
});

export const purchaseHistory = pgTable("purchase_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  clientId: varchar("client_id").notNull().references(() => userClientLinks.id),
  seasonId: varchar("season_id").references(() => seasons.id),
  seasonName: text("season_name").notNull(), // extracted from PDF if season not matched
  sourceFile: text("source_file").notNull(),
  importDate: timestamp("import_date").notNull().default(sql`now()`),
  totalAmount: decimal("total_amount", { precision: 15, scale: 2 }).notNull().default("0"),
});

export const purchaseHistoryItems = pgTable("purchase_history_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  purchaseHistoryId: varchar("purchase_history_id").notNull().references(() => purchaseHistory.id, { onDelete: "cascade" }),
  productCode: text("product_code").notNull(), // from PDF (e.g., "925041")
  productName: text("product_name").notNull(),
  packageType: text("package_type"), // envase (e.g., "BIDON 20L")
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  unitPrice: decimal("total_price", { precision: 15, scale: 2 }).notNull(),
  totalPrice: decimal("unit_price", { precision: 15, scale: 2 }).notNull(),
  purchaseDate: timestamp("purchase_date").notNull(), // emisión date
  orderCode: text("order_code"), // Cód.Int from PDF
});

export const insertPurchaseHistorySchema = createInsertSchema(purchaseHistory).omit({
  id: true,
  importDate: true,
});

export const insertPurchaseHistoryItemSchema = createInsertSchema(purchaseHistoryItems).omit({
  id: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;

export type Subcategory = typeof subcategories.$inferSelect;
export type InsertSubcategory = z.infer<typeof insertSubcategorySchema>;

export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;

export type Region = typeof regions.$inferSelect;
export type InsertRegion = z.infer<typeof insertRegionSchema>;

export type TimacSettings = typeof timacSettings.$inferSelect;
export type InsertTimacSettings = z.infer<typeof insertTimacSettingsSchema>;

export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;

export type Season = typeof seasons.$inferSelect;
export type InsertSeason = z.infer<typeof insertSeasonSchema>;

export type SeasonGoal = typeof seasonGoals.$inferSelect;
export type InsertSeasonGoal = z.infer<typeof insertSeasonGoalSchema>;

export type Sale = typeof sales.$inferSelect;
export type InsertSale = z.infer<typeof insertSaleSchema>;

export type SeasonParameter = typeof seasonParameters.$inferSelect;
export type InsertSeasonParameter = z.infer<typeof insertSeasonParameterSchema>;

export type SalesHistory = typeof salesHistory.$inferSelect;

export type MarketInvestmentRate = typeof marketInvestmentRates.$inferSelect;
export type InsertMarketInvestmentRate = z.infer<typeof insertMarketInvestmentRateSchema>;

export type ClientMarketRate = typeof clientMarketRates.$inferSelect;
export type InsertClientMarketRate = z.infer<typeof insertClientMarketRateSchema>;

export type ClientMarketValue = typeof clientMarketValues.$inferSelect;
export type InsertClientMarketValue = z.infer<typeof insertClientMarketValueSchema>;

export type MarketBenchmark = typeof marketBenchmarks.$inferSelect;
export type InsertMarketBenchmark = z.infer<typeof insertMarketBenchmarkSchema>;

export type ExternalPurchase = typeof externalPurchases.$inferSelect;
export type InsertExternalPurchase = z.infer<typeof insertExternalPurchaseSchema>;

export type ClientFamilyRelation = typeof clientFamilyRelations.$inferSelect;
export type InsertClientFamilyRelation = z.infer<typeof insertClientFamilyRelationSchema>;

export type AlertSettings = typeof alertSettings.$inferSelect;
export type InsertAlertSettings = z.infer<typeof insertAlertSettingsSchema>;

export type Alert = typeof alerts.$inferSelect;
export type InsertAlert = z.infer<typeof insertAlertSchema>;

export type PurchaseHistory = typeof purchaseHistory.$inferSelect;
export type InsertPurchaseHistory = z.infer<typeof insertPurchaseHistorySchema>;

export type PurchaseHistoryItem = typeof purchaseHistoryItems.$inferSelect;
export type InsertPurchaseHistoryItem = z.infer<typeof insertPurchaseHistoryItemSchema>;

export type MasterClient = typeof masterClients.$inferSelect;
export const insertMasterClientSchema = createInsertSchema(masterClients).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMasterClient = z.infer<typeof insertMasterClientSchema>;

export type UserClientLink = typeof userClientLinks.$inferSelect;
export const insertUserClientLinkSchema = createInsertSchema(userClientLinks).omit({ id: true, createdAt: true });
export type InsertUserClientLink = z.infer<typeof insertUserClientLinkSchema>;

export type BarterProduct = typeof barterProducts.$inferSelect;
export const insertBarterProductSchema = createInsertSchema(barterProducts).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBarterProduct = z.infer<typeof insertBarterProductSchema>;

export type BarterSettings = typeof barterSettings.$inferSelect;
export const insertBarterSettingsSchema = createInsertSchema(barterSettings).omit({ id: true, updatedAt: true });
export type InsertBarterSettings = z.infer<typeof insertBarterSettingsSchema>;

export type BarterSimulation = typeof barterSimulations.$inferSelect;
export const insertBarterSimulationSchema = createInsertSchema(barterSimulations).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBarterSimulation = z.infer<typeof insertBarterSimulationSchema>;

export type BarterSimulationItem = typeof barterSimulationItems.$inferSelect;
export const insertBarterSimulationItemSchema = createInsertSchema(barterSimulationItems).omit({ id: true });
export type InsertBarterSimulationItem = z.infer<typeof insertBarterSimulationItemSchema>;

export type ActionPlan = typeof actionPlans.$inferSelect;
export const insertActionPlanSchema = createInsertSchema(actionPlans).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertActionPlan = z.infer<typeof insertActionPlanSchema>;

export type ActionPlanItem = typeof actionPlanItems.$inferSelect;
export const insertActionPlanItemSchema = createInsertSchema(actionPlanItems).omit({ id: true, createdAt: true });
export type InsertActionPlanItem = z.infer<typeof insertActionPlanItemSchema>;

export type ActionPlanParticipant = typeof actionPlanParticipants.$inferSelect;
export const insertActionPlanParticipantSchema = createInsertSchema(actionPlanParticipants).omit({ id: true });
export type InsertActionPlanParticipant = z.infer<typeof insertActionPlanParticipantSchema>;

// Inventory Management Tables for Faturista
export const uploadSessions = pgTable("upload_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionName: text("session_name").notNull(),
  inventoryFileName: text("inventory_file_name"),
  orderFilesCount: integer("order_files_count").notNull().default(0),
  status: text("status").notNull().default("processing"), // processing, completed, error
  userId: varchar("user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  completedAt: timestamp("completed_at"),
});

export const inventoryItems = pgTable("inventory_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productCode: text("product_code").notNull(), // Cód.Int from PDF
  productName: text("product_name").notNull(), // Mercadería from PDF
  packageType: text("package_type"), // Embalaje from PDF
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  uploadedBy: varchar("uploaded_by").notNull().references(() => users.id),
  uploadSessionId: varchar("upload_session_id").notNull().references(() => uploadSessions.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const pendingOrders = pgTable("pending_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productCode: text("product_code").notNull(), // (Cód) from PDF
  productName: text("product_name").notNull(),
  packageType: text("package_type"), // Envase from PDF
  quantityPending: decimal("quantity_pending", { precision: 10, scale: 2 }).notNull(), // Cant. Falta
  clientName: text("client_name").notNull(), // Entidad from PDF
  consultorName: text("consultor_name"), // Comprador/Vendedor from PDF
  orderCode: text("order_code"), // Cód.Int from PDF
  uploadedBy: varchar("uploaded_by").notNull().references(() => users.id),
  uploadSessionId: varchar("upload_session_id").notNull().references(() => uploadSessions.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const stockAnalysisResults = pgTable("stock_analysis_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productCode: text("product_code").notNull(),
  productName: text("product_name").notNull(),
  stockQuantity: decimal("stock_quantity", { precision: 10, scale: 2 }).notNull(),
  ordersQuantity: decimal("orders_quantity", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull(), // DISPONÍVEL, PARCIAL, INDISPONÍVEL
  percentage: decimal("percentage", { precision: 5, scale: 2 }),
  clientsList: jsonb("clients_list").notNull().default("[]"), // array of { clientName, quantity }
  uploadSessionId: varchar("upload_session_id").notNull().references(() => uploadSessions.id, { onDelete: "cascade" }),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// CRM Tables
export const farms = pgTable("farms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  clientId: varchar("client_id").notNull().references(() => masterClients.id),
  lat: decimal("lat", { precision: 10, scale: 7 }),
  lng: decimal("lng", { precision: 10, scale: 7 }),
  centroid: text("centroid"), // Geometry column in DB, mapped as Text here to prevent deletion
  address: text("address"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const fields = pgTable("fields", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  farmId: varchar("farm_id").notNull().references(() => farms.id, { onDelete: "cascade" }),
  area: decimal("area", { precision: 10, scale: 2 }), // hectares
  crop: text("crop"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const visits = pgTable("visits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => masterClients.id),
  farmId: varchar("farm_id").references(() => farms.id),
  fieldId: varchar("field_id").references(() => fields.id),
  scheduledAt: timestamp("scheduled_at"),
  windowStart: timestamp("window_start"),
  windowEnd: timestamp("window_end"),
  status: text("status").notNull().default("PLANEJADA"),
  assignee: varchar("assignee").references(() => users.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const trips = pgTable("trips", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  visitId: varchar("visit_id").references(() => visits.id),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  startOdometer: integer("start_odometer"),
  endOdometer: integer("end_odometer"),
  distanceKm: decimal("distance_km", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const telemetryGps = pgTable("telemetry_gps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tripId: varchar("trip_id").references(() => trips.id),
  ts: timestamp("ts").notNull(),
  lat: decimal("lat", { precision: 10, scale: 7 }).notNull(),
  lng: decimal("lng", { precision: 10, scale: 7 }).notNull(),
  speedKmh: decimal("speed_kmh", { precision: 5, scale: 2 }),
  accuracyM: decimal("accuracy_m", { precision: 6, scale: 2 }),
});

export const checklists = pgTable("checklists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  visitId: varchar("visit_id").notNull().references(() => visits.id, { onDelete: "cascade" }),
  data: jsonb("data").notNull(), // flexible checklist data
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const automations = pgTable("automations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  trigger: text("trigger").notNull(), // GEOFENCE_ENTER, GEOFENCE_EXIT, TIME_BASED
  action: text("action").notNull(), // UPDATE_STATUS, SEND_NOTIFICATION
  config: jsonb("config").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: varchar("entity_id").notNull(),
  changes: jsonb("changes"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Sales Targets - Kanban de Metas
export const salesTargets = pgTable("sales_targets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  clientId: varchar("client_id").notNull().references(() => userClientLinks.id, { onDelete: "cascade" }),
  seasonId: varchar("season_id").notNull().references(() => seasons.id),
  segmento: text("segmento").notNull(), // fertilizantes, sementes, especialidades, agroquimicos, corretivos
  valorCapturado: decimal("valor_capturado", { precision: 12, scale: 2 }).notNull(),
  subcategories: jsonb("subcategories"), // para agroquimicos: { "Tratamento de semente": 50, "Dessecação": 30, ... }
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// Products Price Table - Tabela de Preços
export const productsPriceTable = pgTable("products_price_table", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mercaderia: text("mercaderia").notNull(), // product name
  principioAtivo: text("principio_ativo"), // P.A
  categoria: text("categoria").notNull(), // TS, DESSECAÇÃO, INSETICIDAS, FUNGICIDAS
  subcategory: text("subcategory"), // manual classification: Fungicidas, Inseticidas, TS, Dessecação
  dose: text("dose"), // dosage
  fabricante: text("fabricante"), // manufacturer
  precoVerde: decimal("preco_verde", { precision: 10, scale: 2 }).notNull(), // green price $/ha or $/L/Ha
  precoAmarela: decimal("preco_amarela", { precision: 10, scale: 2 }).notNull(), // yellow price
  precoVermelha: decimal("preco_vermelha", { precision: 10, scale: 2 }).notNull(), // red price
  unidade: text("unidade").notNull().default("$/ha"), // unit: $/ha, $/L/Ha, etc
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// Global Management Applications - Manejo Global (GLOBAL POR SAFRA - não vinculado a usuário)
export const globalManagementApplications = pgTable("global_management_applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  seasonId: varchar("season_id").notNull().references(() => seasons.id),
  categoria: text("categoria").notNull(), // FUNGICIDAS, INSETICIDAS
  applicationNumber: integer("application_number").notNull(), // 1, 2, 3, etc
  productId: varchar("product_id").notNull().references(() => productsPriceTable.id),
  priceTier: text("price_tier").notNull(), // verde, amarela, vermelha
  pricePerHa: decimal("price_per_ha", { precision: 10, scale: 2 }).notNull(), // calculated from product + tier
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// Client Application Tracking - Rastreamento de Aplicações por Cliente
export const clientApplicationTracking = pgTable("client_application_tracking", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  clientId: varchar("client_id").notNull().references(() => userClientLinks.id, { onDelete: "cascade" }),
  seasonId: varchar("season_id").notNull().references(() => seasons.id),
  globalApplicationId: varchar("global_application_id").notNull().references(() => globalManagementApplications.id),
  categoria: text("categoria").notNull(), // FUNGICIDAS, INSETICIDAS
  applicationNumber: integer("application_number").notNull(),
  totalValue: decimal("total_value", { precision: 12, scale: 2 }).notNull(), // price_per_ha × client planting area
  status: text("status"), // 'ABERTO' | 'FECHADO' | null - explicit status from user selection
  isLostToCompetitor: boolean("is_lost_to_competitor").notNull().default(false), // DEPRECATED: use status instead
  soldValue: decimal("sold_value", { precision: 12, scale: 2 }).notNull().default("0.00"), // vendas do Excel
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
}, (table) => ({
  // Unique constraint: um cliente não pode ter múltiplos registros para a mesma aplicação na mesma safra
  uniqueTracking: unique().on(table.clientId, table.seasonId, table.globalApplicationId),
}));

// System Settings - Configurações Gerais do Sistema
export const systemSettings = pgTable("system_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  allowUserRegistration: boolean("allow_user_registration").notNull().default(true),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// Insert schemas
export const insertInventoryItemSchema = createInsertSchema(inventoryItems).omit({ id: true, createdAt: true });
export type InsertInventoryItem = z.infer<typeof insertInventoryItemSchema>;
export type InventoryItem = typeof inventoryItems.$inferSelect;

export const insertPendingOrderSchema = createInsertSchema(pendingOrders).omit({ id: true, createdAt: true });
export type InsertPendingOrder = z.infer<typeof insertPendingOrderSchema>;
export type PendingOrder = typeof pendingOrders.$inferSelect;

export const insertStockAnalysisResultSchema = createInsertSchema(stockAnalysisResults).omit({ id: true, createdAt: true });
export type InsertStockAnalysisResult = z.infer<typeof insertStockAnalysisResultSchema>;
export type StockAnalysisResult = typeof stockAnalysisResults.$inferSelect;

export const insertUploadSessionSchema = createInsertSchema(uploadSessions).omit({ id: true, createdAt: true, completedAt: true });
export type InsertUploadSession = z.infer<typeof insertUploadSessionSchema>;
export type UploadSession = typeof uploadSessions.$inferSelect;

// CRM Insert schemas
export const insertFarmSchema = createInsertSchema(farms).omit({ id: true, createdAt: true }).extend({
  clientId: z.string().min(1, "Cliente é obrigatório"),
  lat: z.union([z.string(), z.number()]).optional().transform(val => val ? String(val) : undefined),
  lng: z.union([z.string(), z.number()]).optional().transform(val => val ? String(val) : undefined),
});
export type InsertFarm = z.infer<typeof insertFarmSchema>;
export type Farm = typeof farms.$inferSelect;

export const insertFieldSchema = createInsertSchema(fields).omit({
  id: true,
  createdAt: true,
}).partial({
  crop: true,
  area: true
});
export type InsertField = z.infer<typeof insertFieldSchema>;
export type Field = typeof fields.$inferSelect;

export const insertVisitSchema = createInsertSchema(visits).omit({ id: true, createdAt: true });
export type InsertVisit = z.infer<typeof insertVisitSchema>;
export type Visit = typeof visits.$inferSelect;

export const insertTripSchema = createInsertSchema(trips).omit({ id: true, createdAt: true });
export type InsertTrip = z.infer<typeof insertTripSchema>;
export type Trip = typeof trips.$inferSelect;

export const insertTelemetryGpsSchema = createInsertSchema(telemetryGps).omit({ id: true });
export type InsertTelemetryGps = z.infer<typeof insertTelemetryGpsSchema>;
export type TelemetryGps = typeof telemetryGps.$inferSelect;

export const insertChecklistSchema = createInsertSchema(checklists).omit({ id: true, createdAt: true });
export type InsertChecklist = z.infer<typeof insertChecklistSchema>;
export type Checklist = typeof checklists.$inferSelect;

export const insertAutomationSchema = createInsertSchema(automations).omit({ id: true, createdAt: true });
export type InsertAutomation = z.infer<typeof insertAutomationSchema>;
export type Automation = typeof automations.$inferSelect;

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

export const insertSalesTargetSchema = createInsertSchema(salesTargets).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSalesTarget = z.infer<typeof insertSalesTargetSchema>;
export type SalesTarget = typeof salesTargets.$inferSelect;

export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({ id: true, createdAt: true, usedAt: true });
export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

// Products Price Table schemas
export const insertProductPriceTableSchema = createInsertSchema(productsPriceTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProductPriceTable = z.infer<typeof insertProductPriceTableSchema>;
export type ProductPriceTable = typeof productsPriceTable.$inferSelect;

// Global Management Applications schemas
export const insertGlobalManagementApplicationSchema = createInsertSchema(globalManagementApplications).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertGlobalManagementApplication = z.infer<typeof insertGlobalManagementApplicationSchema>;
export type GlobalManagementApplication = typeof globalManagementApplications.$inferSelect;

// Client Application Tracking schemas
export const insertClientApplicationTrackingSchema = createInsertSchema(clientApplicationTracking).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertClientApplicationTracking = z.infer<typeof insertClientApplicationTrackingSchema>;
export type ClientApplicationTracking = typeof clientApplicationTracking.$inferSelect;


// Client Category Pipeline - Pipeline de Oportunidades por Categoria (Fertilizantes, Sementes, etc)
export const clientCategoryPipeline = pgTable("client_category_pipeline", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => userClientLinks.id, { onDelete: "cascade" }),
  categoryId: varchar("category_id").notNull().references(() => categories.id),
  seasonId: varchar("season_id").notNull().references(() => seasons.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  status: text("status"), // 'ABERTO' | 'FECHADO'
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
}, (table) => ({
  uniquePipeline: unique().on(table.clientId, table.seasonId, table.categoryId),
}));

// Manager Team Rates - Configuração Global do Gerente
export const managerTeamRates = pgTable("manager_team_rates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  managerId: varchar("manager_id").notNull().references(() => users.id), // ID do gerente que definiu a regra
  seasonId: varchar("season_id").notNull().references(() => seasons.id),
  categoryId: varchar("category_id").notNull().references(() => categories.id),
  investmentPerHa: decimal("investment_per_ha", { precision: 10, scale: 2 }).notNull(), // $/ha
  subcategories: jsonb("subcategories"), // breakdown opcional
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
}, (table) => ({
  // Garante uma única regra por gerente/safra/categoria
  uniqueRate: unique().on(table.managerId, table.seasonId, table.categoryId),
}));

export const insertClientCategoryPipelineSchema = createInsertSchema(clientCategoryPipeline).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertClientCategoryPipeline = z.infer<typeof insertClientCategoryPipelineSchema>;
export type ClientCategoryPipeline = typeof clientCategoryPipeline.$inferSelect;

export const insertManagerTeamRateSchema = createInsertSchema(managerTeamRates).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertManagerTeamRate = z.infer<typeof insertManagerTeamRateSchema>;
export type ManagerTeamRate = typeof managerTeamRates.$inferSelect;

// System Settings schemas
export const insertSystemSettingsSchema = createInsertSchema(systemSettings).omit({ id: true, updatedAt: true });
export type InsertSystemSettings = z.infer<typeof insertSystemSettingsSchema>;
export type SystemSettings = typeof systemSettings.$inferSelect;


// ==========================================
// Módulo de Planejamento de Vendas 2026
// ==========================================

export const planningProductsBase = pgTable("planning_products_base", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // Chave de ligação
  segment: text("segment"), // fungicida, inseticida, ts, dessecacao
  dosePerHa: decimal("dose_per_ha", { precision: 10, scale: 3 }), // Vindo de Planilha de produtos.xlsx
  price: decimal("price", { precision: 10, scale: 2 }), // Vindo de Planejamento de Vendas 2026.xls
  unit: text("unit"), // L, Kg, etc
  packageSize: decimal("package_size", { precision: 10, scale: 2 }), // Extracted or imported
  seasonId: varchar("season_id").references(() => seasons.id), // Referência à safra (2026)
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const salesPlanning = pgTable("sales_planning", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => userClientLinks.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  seasonId: varchar("season_id").notNull().references(() => seasons.id),
  totalPlantingArea: decimal("total_planting_area", { precision: 10, scale: 2 }), // Snapshot da área total
  fungicidesArea: decimal("fungicides_area", { precision: 10, scale: 2 }).default("0.00"),
  insecticidesArea: decimal("insecticides_area", { precision: 10, scale: 2 }).default("0.00"),
  herbicidesArea: decimal("herbicides_area", { precision: 10, scale: 2 }).default("0.00"), // Dessecação
  seedTreatmentArea: decimal("seed_treatment_area", { precision: 10, scale: 2 }).default("0.00"), // TS
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
}, (table) => ({
  uniquePlanning: unique().on(table.clientId, table.seasonId),
}));

export const salesPlanningItems = pgTable("sales_planning_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  planningId: varchar("planning_id").notNull().references(() => salesPlanning.id, { onDelete: "cascade" }),
  productId: varchar("product_id").notNull().references(() => planningProductsBase.id),
  quantity: decimal("quantity", { precision: 15, scale: 2 }).notNull(), // Calculado: Share Area * Dose
  totalAmount: decimal("total_amount", { precision: 15, scale: 2 }).notNull(), // Calculado: Qtd * Preço
});

// Exports Types & Zod Schemas
export const insertPlanningProductSchema = createInsertSchema(planningProductsBase).omit({ id: true, createdAt: true });
export type InsertPlanningProduct = z.infer<typeof insertPlanningProductSchema>;
export type PlanningProduct = typeof planningProductsBase.$inferSelect;

export const insertSalesPlanningSchema = createInsertSchema(salesPlanning).omit({ id: true, updatedAt: true });
export type InsertSalesPlanning = z.infer<typeof insertSalesPlanningSchema>;
export type SalesPlanning = typeof salesPlanning.$inferSelect;

export const insertSalesPlanningItemSchema = createInsertSchema(salesPlanningItems).omit({ id: true });
export type InsertSalesPlanningItem = z.infer<typeof insertSalesPlanningItemSchema>;
export type SalesPlanningItem = typeof salesPlanningItems.$inferSelect;
export const planningGlobalConfigurations = pgTable("planning_global_configurations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  seasonId: varchar("season_id").notNull().references(() => seasons.id),
  productIds: jsonb("product_ids").notNull().default("[]"), // Array of selected product IDs
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
}, (table) => ({
  uniqueConfig: unique().on(table.userId, table.seasonId),
}));

export const insertPlanningGlobalConfigurationSchema = createInsertSchema(planningGlobalConfigurations).omit({ id: true, updatedAt: true });
export type InsertPlanningGlobalConfiguration = z.infer<typeof insertPlanningGlobalConfigurationSchema>;
export type PlanningGlobalConfiguration = typeof planningGlobalConfigurations.$inferSelect;

// ============================================================================
// FARM STOCK MANAGEMENT SYSTEM — Tabelas independentes do CRM
// ============================================================================

// Agricultores (login próprio, separado dos users do CRM)
export const farmFarmers = pgTable("farm_farmers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  document: text("document"), // RUC / CPF
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Propriedades / Fazendas
export const farmProperties = pgTable("farm_properties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  farmerId: varchar("farmer_id").notNull().references(() => farmFarmers.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  location: text("location"),
  totalAreaHa: decimal("total_area_ha", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Talhões
export const farmPlots = pgTable("farm_plots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  propertyId: varchar("property_id").notNull().references(() => farmProperties.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  areaHa: decimal("area_ha", { precision: 12, scale: 2 }).notNull(),
  crop: text("crop"), // Cultura atual (soja, milho, etc.)
  coordinates: text("coordinates"), // JSON array of {lat, lng} polygon vertices
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Catálogo Global de Produtos (dose, unidade, categoria)
export const farmProductsCatalog = pgTable("farm_products_catalog", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  unit: text("unit").notNull(), // LT, KG, UNI
  dosePerHa: decimal("dose_per_ha", { precision: 12, scale: 4 }),
  category: text("category"), // herbicida, fungicida, inseticida, fertilizante, semente, adjuvante, etc.
  activeIngredient: text("active_ingredient"),
  imageUrl: text("image_url"),
  imageBase64: text("image_base64"), // Store photo directly in DB
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Estoque atual (snapshot, atualizado a cada movimentação)
export const farmStock = pgTable("farm_stock", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  farmerId: varchar("farmer_id").notNull().references(() => farmFarmers.id, { onDelete: "cascade" }),
  productId: varchar("product_id").notNull().references(() => farmProductsCatalog.id),
  quantity: decimal("quantity", { precision: 15, scale: 4 }).notNull().default("0"),
  averageCost: decimal("average_cost", { precision: 15, scale: 4 }).notNull().default("0"), // Custo médio ponderado
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
}, (table) => ({
  uniqueStock: unique().on(table.farmerId, table.productId),
}));

// Safras da fazenda
export const farmSeasons = pgTable("farm_seasons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  farmerId: varchar("farmer_id").notNull().references(() => farmFarmers.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Faturas importadas
export const farmInvoices = pgTable("farm_invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  farmerId: varchar("farmer_id").notNull().references(() => farmFarmers.id, { onDelete: "cascade" }),
  seasonId: varchar("season_id").references(() => farmSeasons.id),
  invoiceNumber: text("invoice_number"),
  supplier: text("supplier"),
  issueDate: timestamp("issue_date"),
  currency: text("currency").default("USD"),
  totalAmount: decimal("total_amount", { precision: 15, scale: 2 }),
  status: text("status").notNull().default("pending"), // pending, confirmed, cancelled
  rawPdfData: text("raw_pdf_data"), // Texto extraído do PDF para debug
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Itens da fatura
export const farmInvoiceItems = pgTable("farm_invoice_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").notNull().references(() => farmInvoices.id, { onDelete: "cascade" }),
  productId: varchar("product_id").references(() => farmProductsCatalog.id),
  productCode: text("product_code"),
  productName: text("product_name").notNull(),
  unit: text("unit"),
  quantity: decimal("quantity", { precision: 15, scale: 4 }).notNull(),
  unitPrice: decimal("unit_price", { precision: 15, scale: 4 }).notNull(),
  discount: decimal("discount", { precision: 15, scale: 2 }).default("0"),
  totalPrice: decimal("total_price", { precision: 15, scale: 2 }).notNull(),
  batch: text("batch"), // Lote
  expiryDate: timestamp("expiry_date"), // Vencimento do produto
});

// Movimentações de estoque
export const farmStockMovements = pgTable("farm_stock_movements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  farmerId: varchar("farmer_id").notNull().references(() => farmFarmers.id, { onDelete: "cascade" }),
  seasonId: varchar("season_id").references(() => farmSeasons.id),
  productId: varchar("product_id").notNull().references(() => farmProductsCatalog.id),
  type: text("type").notNull(), // "entry" (entrada via fatura) ou "exit" (saída via PDV)
  quantity: decimal("quantity", { precision: 15, scale: 4 }).notNull(), // Positivo entrada, negativo saída
  unitCost: decimal("unit_cost", { precision: 15, scale: 4 }),
  referenceType: text("reference_type"), // "invoice" ou "pdv"
  referenceId: varchar("reference_id"), // ID da fatura ou da aplicação
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Aplicações nos talhões (registradas pelo PDV)
export const farmApplications = pgTable("farm_applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  farmerId: varchar("farmer_id").notNull().references(() => farmFarmers.id, { onDelete: "cascade" }),
  productId: varchar("product_id").notNull().references(() => farmProductsCatalog.id),
  plotId: varchar("plot_id").notNull().references(() => farmPlots.id, { onDelete: "cascade" }),
  propertyId: varchar("property_id").notNull().references(() => farmProperties.id, { onDelete: "cascade" }),
  quantity: decimal("quantity", { precision: 15, scale: 4 }).notNull(),
  appliedAt: timestamp("applied_at").notNull().default(sql`now()`),
  appliedBy: text("applied_by"), // Nome do funcionário (manual)
  notes: text("notes"),
  syncedFromOffline: boolean("synced_from_offline").default(false),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Despesas extras (diesel, frete, mão de obra)
export const farmExpenses = pgTable("farm_expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  farmerId: varchar("farmer_id").notNull().references(() => farmFarmers.id, { onDelete: "cascade" }),
  plotId: varchar("plot_id").references(() => farmPlots.id),
  propertyId: varchar("property_id").references(() => farmProperties.id),
  category: text("category").notNull(), // diesel, frete, mao_de_obra, outro
  description: text("description"),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  expenseDate: timestamp("expense_date").notNull().default(sql`now()`),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Terminais PDV (login do tablet no depósito)
export const farmPdvTerminals = pgTable("farm_pdv_terminals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  farmerId: varchar("farmer_id").notNull().references(() => farmFarmers.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // ex: "Depósito Principal"
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  propertyId: varchar("property_id").references(() => farmProperties.id),
  isOnline: boolean("is_online").default(false),
  lastHeartbeat: timestamp("last_heartbeat"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// ============ Farm Zod Schemas & Types ============

export const insertFarmFarmerSchema = createInsertSchema(farmFarmers).omit({ id: true, createdAt: true });
export type InsertFarmFarmer = z.infer<typeof insertFarmFarmerSchema>;
export type FarmFarmer = typeof farmFarmers.$inferSelect;

export const insertFarmPropertySchema = createInsertSchema(farmProperties).omit({ id: true, createdAt: true });
export type InsertFarmProperty = z.infer<typeof insertFarmPropertySchema>;
export type FarmProperty = typeof farmProperties.$inferSelect;

export const insertFarmPlotSchema = createInsertSchema(farmPlots).omit({ id: true, createdAt: true });
export type InsertFarmPlot = z.infer<typeof insertFarmPlotSchema>;
export type FarmPlot = typeof farmPlots.$inferSelect;

export const insertFarmProductCatalogSchema = createInsertSchema(farmProductsCatalog).omit({ id: true, createdAt: true });
export type InsertFarmProductCatalog = z.infer<typeof insertFarmProductCatalogSchema>;
export type FarmProductCatalog = typeof farmProductsCatalog.$inferSelect;

export const insertFarmStockSchema = createInsertSchema(farmStock).omit({ id: true, updatedAt: true });
export type InsertFarmStock = z.infer<typeof insertFarmStockSchema>;
export type FarmStock = typeof farmStock.$inferSelect;

export const insertFarmInvoiceSchema = createInsertSchema(farmInvoices).omit({ id: true, createdAt: true });
export type InsertFarmInvoice = z.infer<typeof insertFarmInvoiceSchema>;
export type FarmInvoice = typeof farmInvoices.$inferSelect;

export const insertFarmInvoiceItemSchema = createInsertSchema(farmInvoiceItems).omit({ id: true });
export type InsertFarmInvoiceItem = z.infer<typeof insertFarmInvoiceItemSchema>;
export type FarmInvoiceItem = typeof farmInvoiceItems.$inferSelect;

export const insertFarmStockMovementSchema = createInsertSchema(farmStockMovements).omit({ id: true, createdAt: true });
export type InsertFarmStockMovement = z.infer<typeof insertFarmStockMovementSchema>;
export type FarmStockMovement = typeof farmStockMovements.$inferSelect;

export const insertFarmApplicationSchema = createInsertSchema(farmApplications).omit({ id: true, createdAt: true });
export type InsertFarmApplication = z.infer<typeof insertFarmApplicationSchema>;
export type FarmApplication = typeof farmApplications.$inferSelect;

export const insertFarmExpenseSchema = createInsertSchema(farmExpenses).omit({ id: true, createdAt: true });
export type InsertFarmExpense = z.infer<typeof insertFarmExpenseSchema>;
export type FarmExpense = typeof farmExpenses.$inferSelect;

export const insertFarmPdvTerminalSchema = createInsertSchema(farmPdvTerminals).omit({ id: true, createdAt: true });
export type InsertFarmPdvTerminal = z.infer<typeof insertFarmPdvTerminalSchema>;
export type FarmPdvTerminal = typeof farmPdvTerminals.$inferSelect;

export const insertFarmSeasonSchema = createInsertSchema(farmSeasons).omit({ id: true, createdAt: true });
export type InsertFarmSeason = z.infer<typeof insertFarmSeasonSchema>;
export type FarmSeason = typeof farmSeasons.$inferSelect;

// Farm Farmers (Agricultores management separately from internal team)
export const farmFarmers = pgTable("farm_farmers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  document: text("document"), // CPF/CNPJ
  role: text("role").notNull().default("farmer"),
  managerId: varchar("manager_id"), // Optional reference to a manager
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertFarmFarmerSchema = createInsertSchema(farmFarmers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type FarmFarmer = typeof farmFarmers.$inferSelect;
export type InsertFarmFarmer = z.infer<typeof insertFarmFarmerSchema>;
